import { hasSession, logout, api } from './auth.js?v=20261019-2';
import { sensors, validSamples, tiltPercent, trimWindow } from './telemetry.js';
import { startStream } from './ws.js';
const $=selector=>document.querySelector(selector);
let stop=()=>{}, tick=null, frame=null, disposed=false;
function cleanup() { disposed=true;stop();clearInterval(tick);cancelAnimationFrame(frame); }
async function init() {
  if(!hasSession()) { logout(); return; }
  const deviceId=sessionStorage.getItem('deviceId');
  $('#device-id').textContent=deviceId; $('#dashboard').hidden=false;
  $('#logout').addEventListener('click',()=>{cleanup();logout();});
  window.addEventListener('pagehide',cleanup,{once:true});
  const values={}, series={acc_x:[],acc_y:[],acc_z:[]}, tiles={};
  let newest=0, led=false, pending=false, ledTs=0;
  for(const [key,[label,unit,,,axis]] of Object.entries(sensors)) {
    const tile=document.createElement('div');tile.className='tile';
    const title=document.createElement('small'); title.textContent=label;title.className=axis?`axis-${axis}`:'';
    const value=document.createElement('strong');value.textContent='--';
    const suffix=document.createElement('small');suffix.textContent=unit;
    tile.append(title,value,suffix);$('#tiles').append(tile);tiles[key]=value;
  }
  function renderLed() { $('#led-toggle').setAttribute('aria-checked',String(led));$('#led-label').textContent=led?'ON':'OFF'; }
  function data(message) {
    if(message.subscriptionId===2) {
      const pairs=message.data.led_state;
      if(!pending && Array.isArray(pairs)) for(const pair of [...pairs].sort((a,b)=>a?.[0]-b?.[0])) {
        if(Array.isArray(pair) && Number.isFinite(pair[0]) && pair[0]>=ledTs && ['true','false',true,false].includes(pair[1])) {
          ledTs=pair[0];led=pair[1]===true||pair[1]==='true';renderLed();
        }
      }
      return;
    }
    for(const key of Object.keys(sensors)) {
      for(const sample of validSamples(key,message.data[key])) {
        if(!values[key]||sample.ts>=values[key].ts) { values[key]=sample;tiles[key].textContent=sample.value.toFixed(2);newest=Math.max(newest,sample.ts); }
        if(series[key] && sample.ts>=Date.now()-8000) {
          const index=series[key].findIndex(p=>p.ts===sample.ts);
          if(index>=0) series[key][index]=sample;else series[key].push(sample);
          series[key].sort((a,b)=>a.ts-b.ts);
        }
      }
    }
    if(values.acc_x && values.acc_y) {
      $('#tilt-dot').hidden=false;
      $('#tilt-dot').style.left=`${tiltPercent(values.acc_x.value)}%`;
      $('#tilt-dot').style.top=`${tiltPercent(values.acc_y.value)}%`;
      const text=`X ${values.acc_x.value.toFixed(2)} g / Y ${values.acc_y.value.toFixed(2)} g`;
      $('#tilt-values').textContent=`${text} · ช่วงแสดงผล ±1 g`;$('#tilt').setAttribute('aria-label',text);
    }
  }
  function freshness() {
    const age=Date.now()-newest;
    $('#updated').textContent=newest?`ข้อมูลล่าสุด ${new Date(newest).toLocaleTimeString('th-TH')}${age>5000?' · ข้อมูลเก่า':''}`:'ยังไม่ได้รับข้อมูล';
    $('#chart-status').textContent=!newest?'รอข้อมูลจากอุปกรณ์ เริ่ม Wokwi เพื่อส่งค่าเซนเซอร์':age>5000?'ไม่มีข้อมูลใหม่เกิน 5 วินาที ตรวจสอบว่า Wokwi และ MQTT ยังทำงาน':'แสดงความเร่งดิบ X / Y / Z · หน่วย g';
  }
  const canvas=$('#waveform'),ctx=canvas.getContext('2d');
  function draw() {
    if(disposed) return;
    const now=Date.now(),box=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    const w=Math.max(1,box.width),h=Math.max(1,box.height);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)) {canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const css=getComputedStyle(document.documentElement),left=42,right=w-12,top=15,bottom=h-30;
    for(const key of Object.keys(series)) series[key]=trimWindow(series[key],now);
    const all=Object.values(series).flat();const bound=Math.max(2,...all.map(p=>Math.abs(p.value)))*1.1;
    ctx.font=`12px ${css.getPropertyValue('--font')}`;ctx.lineWidth=1;
    for(let i=0;i<=4;i++) {
      const y=top+(bottom-top)*i/4;
      ctx.strokeStyle=css.getPropertyValue('--line');ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
      ctx.fillStyle=css.getPropertyValue('--muted');ctx.fillText((bound-bound*2*i/4).toFixed(1),0,y+4);
    }
    ctx.fillText('g',0,10);ctx.fillText('-8s',left,h-7);ctx.fillText('now',Math.max(left,right-25),h-7);
    ctx.save();ctx.beginPath();ctx.rect(left,top,Math.max(0,right-left),bottom-top);ctx.clip();
    for(const [key,points] of Object.entries(series)) {
      ctx.strokeStyle=css.getPropertyValue(`--${key.at(-1)}`);ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=2;ctx.beginPath();
      points.forEach((p,i)=>{const x=left+(p.ts-(now-8000))/8000*(right-left),y=top+(bound-p.value)/(2*bound)*(bottom-top);if(!i||p.ts-points[i-1].ts>3000)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
      for(const p of points) {const x=left+(p.ts-(now-8000))/8000*(right-left),y=top+(bound-p.value)/(2*bound)*(bottom-top);ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();frame=requestAnimationFrame(draw);
  }
  $('#led-toggle').addEventListener('click',async()=>{
    if(pending||disposed)return;
    const previous=led;pending=true;$('#led-toggle').disabled=true;$('#led-error').hidden=true;$('#led-status').textContent='กำลังรอการยืนยันจากอุปกรณ์…';
    try {
      const reply=await api(`/api/rpc/twoway/${deviceId}`,{method:'POST',body:{method:'setLed',params:!previous,timeout:5000}});
      if(reply?.success!==true||typeof reply.led_state!=='boolean')throw new Error('invalid reply');
      if(disposed)return;led=reply.led_state;ledTs=Date.now();$('#led-status').textContent='อุปกรณ์ยืนยันสถานะแล้ว';
    } catch(error) {
      if(disposed)return;led=previous;$('#led-error').hidden=false;
      $('#led-error').textContent=[408,504].includes(error.status)?'⚠ อุปกรณ์ไม่ตอบสนอง ตรวจสอบ Wokwi และ MQTT':error.status===0?'⚠ การเชื่อมต่อหมดเวลาหรือขัดข้อง กรุณาลองใหม่':'⚠ ส่งคำสั่งไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ';
      $('#led-status').textContent='คงสถานะก่อนส่งคำสั่ง';
    } finally { pending=false;if(!disposed){renderLed();$('#led-toggle').disabled=false;} }
  });
  try {
    const attributes=await api(`/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/CLIENT_SCOPE`);
    const current=Array.isArray(attributes)?attributes.find(a=>a?.key==='led_state'):null;
    if(current&&typeof current.value==='boolean') {led=current.value;ledTs=Number.isFinite(current.lastUpdateTs)?current.lastUpdateTs:0;}
    $('#led-status').textContent=current&&typeof current.value==='boolean'?'สถานะล่าสุดที่อุปกรณ์รายงาน':'ไม่มีสถานะ LED เริ่มต้น แสดง OFF';
  } catch { $('#led-status').textContent='อ่านสถานะ LED ไม่ได้ แสดง OFF'; }
  if(disposed)return;
  renderLed();$('#led-toggle').disabled=false;
  stop=startStream(deviceId,data,text=>{$('#connection').textContent=text;});
  tick=setInterval(freshness,1000);freshness();draw();
}
init().catch(()=>{cleanup();$('#stream-error').hidden=false;$('#stream-error').textContent='⚠ เปิด Dashboard ไม่สำเร็จ กรุณาโหลดหน้าใหม่หรือเข้าสู่ระบบอีกครั้ง';});
