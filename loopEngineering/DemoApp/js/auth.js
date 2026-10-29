export const BASE_URL = 'https://thingsboard.cloud';
const keys = ['token', 'refreshToken', 'customerId', 'deviceId', 'deviceAccessToken'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let refreshing = null;
export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.name = 'ApiError'; this.status = status; }
}
export function clearSession() { for (const key of keys) sessionStorage.removeItem(key); }
export function hasSession() {
  return keys.every(key => Boolean(sessionStorage.getItem(key))) &&
    uuid.test(sessionStorage.getItem('deviceId')) && uuid.test(sessionStorage.getItem('customerId'));
}
export function logout() { clearSession(); location.replace('login.html'); }
function statusMessage(status, login = false, path = '') {
  if (status === 401) return login ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' : 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
  if (status === 403) {
    if (path === '/api/auth/login') return 'เข้าสู่ระบบถูกปฏิเสธ (403) กรุณาตรวจสอบสถานะบัญชี Customer User';
    if (path === '/api/auth/user') return 'อ่านข้อมูลบัญชีไม่ได้ (403) กรุณาตรวจสอบสิทธิ์ของ Customer User';
    if (path.endsWith('/credentials')) return 'อ่าน Access Token ของอุปกรณ์ไม่ได้ (403) กรุณาให้ Tenant Admin ตรวจสิทธิ์อ่าน Device Credentials ของ Customer User';
    if (path.startsWith('/api/customer/')) return 'อ่านรายการอุปกรณ์ของ Customer ไม่ได้ (403) กรุณาให้ Tenant Admin ตรวจว่าอุปกรณ์และผู้ใช้อยู่ใน Customer เดียวกันและมีสิทธิ์อ่านอุปกรณ์';
    return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้ (403) กรุณาตรวจสอบสิทธิ์กับ Tenant Admin';
  }
  if (status === 404) return 'ไม่พบข้อมูลหรืออุปกรณ์ที่ร้องขอ';
  if (status === 429) return 'มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่';
  if (status >= 500) return 'เซิร์ฟเวอร์ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง';
  return 'คำขอไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่';
}
async function request(path, { method = 'GET', body, authorized = true, login = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authorized) headers['X-Authorization'] = `Bearer ${sessionStorage.getItem('token') || ''}`;
    const response = await fetch(`${BASE_URL}${path}`, {
      method, headers, signal: controller.signal, credentials: 'omit', cache: 'no-store',
      referrerPolicy: 'no-referrer', ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok) throw new ApiError(statusMessage(response.status, login, path), response.status);
    if (response.status === 204) return null;
    try { return await response.json(); }
    catch { throw new ApiError('ข้อมูลตอบกลับจากเซิร์ฟเวอร์ไม่ถูกต้อง'); }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'AbortError') throw new ApiError('การเชื่อมต่อหมดเวลา กรุณาลองใหม่');
    throw new ApiError('เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตและการอนุญาตเชื่อมต่อของเซิร์ฟเวอร์');
  } finally { clearTimeout(timer); }
}
function saveTokens(data) {
  if (!data || typeof data.token !== 'string' || !data.token.trim() ||
      typeof data.refreshToken !== 'string' || !data.refreshToken.trim()) {
    throw new ApiError('ข้อมูลเซสชันไม่ครบถ้วน กรุณาเข้าสู่ระบบใหม่');
  }
  sessionStorage.setItem('token', data.token);
  sessionStorage.setItem('refreshToken', data.refreshToken);
}
async function refresh() {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const refreshToken = sessionStorage.getItem('refreshToken');
        if (!refreshToken) throw new ApiError('กรุณาเข้าสู่ระบบใหม่', 401);
        saveTokens(await request('/api/auth/token', { method: 'POST', body: { refreshToken }, authorized: false }));
      } catch {
        clearSession();
        if (!location.pathname.endsWith('/login.html')) location.replace('login.html');
        throw new ApiError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 401);
      } finally { refreshing = null; }
    })();
  }
  return refreshing;
}
export async function api(path, options = {}) {
  try { return await request(path, options); }
  catch (error) {
    if (error.status !== 401) throw error;
    await refresh();
    try { return await request(path, options); }
    catch (retryError) {
      if (retryError.status === 401) {
        clearSession();
        if (!location.pathname.endsWith('/login.html')) location.replace('login.html');
      }
      throw retryError;
    }
  }
}
export async function login(username, password, progress = () => {}) {
  clearSession();
  try {
    progress('กำลังยืนยันบัญชี…');
    saveTokens(await request('/api/auth/login', { method: 'POST', body: { username, password }, authorized: false, login: true }));
    progress('กำลังตรวจสอบ Customer User…');
    const user = await api('/api/auth/user');
    const customerId = user?.customerId?.id;
    if (user?.authority !== 'CUSTOMER_USER' || !uuid.test(customerId) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(customerId)) {
      throw new ApiError('กรุณาใช้บัญชี Customer User ที่ผูกกับ Customer ของอุปกรณ์');
    }
    sessionStorage.setItem('customerId', customerId);
    progress('กำลังค้นหาอุปกรณ์…');
    const devices = await api(`/api/customer/${customerId}/devices?pageSize=50&page=0`);
    if (!Array.isArray(devices?.data)) throw new ApiError('รูปแบบรายการอุปกรณ์ไม่ถูกต้อง');
    if (!devices.data.length) throw new ApiError('ยังไม่มีอุปกรณ์ผูกกับ Customer นี้ กรุณาให้ Tenant Admin ผูกอุปกรณ์ก่อน');
    const deviceId = devices.data[0]?.id?.id;
    if (!uuid.test(deviceId)) throw new ApiError('ข้อมูลอุปกรณ์ไม่ถูกต้อง');
    sessionStorage.setItem('deviceId', deviceId);
    progress('กำลังตรวจสอบสิทธิ์อุปกรณ์…');
    const credentials = await api(`/api/device/${deviceId}/credentials`);
    if (credentials?.credentialsType !== 'ACCESS_TOKEN' || typeof credentials.credentialsId !== 'string' || !credentials.credentialsId.trim()) {
      throw new ApiError('อุปกรณ์นี้ไม่มี Access Token ที่ใช้งานได้');
    }
    sessionStorage.setItem('deviceAccessToken', credentials.credentialsId);
  } catch (error) { clearSession(); throw error; }
}
