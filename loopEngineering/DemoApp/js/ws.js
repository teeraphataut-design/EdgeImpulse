import { api } from './auth.js?v=20261019-2';
import { sensors } from './telemetry.js';
export function startStream(deviceId, onData, onStatus) {
  let socket=null, retryTimer=null, deadline=null, stopped=false, failures=0, generation=0;
  function dispose() {
    clearTimeout(deadline);
    if(socket) { socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null; socket.close(); socket=null; }
  }
  function retry() {
    if(stopped) return;
    generation++; dispose(); clearTimeout(retryTimer);
    const delay=Math.min(30000,1000*2**Math.min(failures++,5));
    onStatus(`ขาดการเชื่อมต่อ · ลองใหม่ใน ${delay/1000} วินาที`);
    retryTimer=setTimeout(connect,delay);
  }
  async function connect() {
    if(stopped) return;
    const attempt=++generation;
    onStatus('กำลังเชื่อมต่อ…');
    try {
      await api('/api/auth/user');
      if(stopped || attempt!==generation) return;
      socket=new WebSocket(`wss://thingsboard.cloud/api/ws/plugins/telemetry?token=${encodeURIComponent(sessionStorage.getItem('token')||'')}`);
      deadline=setTimeout(retry,10000);
      socket.onopen=()=>{
        clearTimeout(deadline);
        socket.send(JSON.stringify({tsSubCmds:[{entityType:'DEVICE',entityId:deviceId,scope:'LATEST_TELEMETRY',keys:Object.keys(sensors).join(','),cmdId:1}],historyCmds:[],attrSubCmds:[{entityType:'DEVICE',entityId:deviceId,scope:'CLIENT_SCOPE',keys:'led_state',cmdId:2}]}));
        onStatus('เชื่อมต่อสตรีมแล้ว');
      };
      socket.onmessage=event=>{
        try {
          const message=JSON.parse(event.data);
          if(!message || typeof message!=='object') return;
          if(message.errorCode) { onStatus('อ่านสตรีมไม่ได้ กรุณาตรวจสอบสิทธิ์อุปกรณ์'); return; }
          if([1,2].includes(message.subscriptionId) && message.data && typeof message.data==='object') {
            failures=0; onData(message);
          }
        } catch { onStatus('ได้รับข้อความสตรีมที่อ่านไม่ได้ รอข้อมูลถัดไป'); }
      };
      socket.onerror=retry; socket.onclose=retry;
    } catch { if(!stopped && attempt===generation) retry(); }
  }
  connect();
  return ()=>{stopped=true;generation++;clearTimeout(retryTimer);dispose();};
}
