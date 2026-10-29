export const sensors = Object.freeze({
  acc_x: ['Acceleration X','g',-16,16,'x'], acc_y: ['Acceleration Y','g',-16,16,'y'], acc_z: ['Acceleration Z','g',-16,16,'z'],
  gyro_x: ['Gyroscope X','°/s',-2000,2000,'x'], gyro_y: ['Gyroscope Y','°/s',-2000,2000,'y'], gyro_z: ['Gyroscope Z','°/s',-2000,2000,'z'],
  angle_x: ['Angle X','°',-180,180,'x'], angle_y: ['Angle Y','°',-180,180,'y'], angle_z: ['Angle Z','°',-180,180,'z'],
  mpu_temp: ['Temperature','°C',-40,85,'']
});
export function sensorValue(key, raw) {
  if (!Object.hasOwn(sensors,key) || !['string','number'].includes(typeof raw) || (typeof raw==='string' && !raw.trim())) return null;
  const value=Number(raw), range=sensors[key];
  return Number.isFinite(value) && value>=range[2] && value<=range[3] ? value : null;
}
export const tiltPercent = value => Math.max(0,Math.min(100,(value+1)*50));
export function validSamples(key,pairs,now=Date.now()) {
  if (!Array.isArray(pairs)) return [];
  return pairs.filter(pair=>Array.isArray(pair) && Number.isFinite(pair[0]) && pair[0]>0 && pair[0]<=now+1000)
    .map(([ts,raw])=>({ts,value:sensorValue(key,raw)})).filter(p=>p.value!==null).sort((a,b)=>a.ts-b.ts);
}
export function trimWindow(points, now=Date.now()) { return points.filter(p=>p.ts>=now-8000 && p.ts<=now+1000); }
