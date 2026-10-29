import { login, ApiError } from './auth.js?v=20261019-2';
const form = document.querySelector('#login-form');
const button = document.querySelector('#login-button');
const spinner = document.querySelector('#login-spinner');
const label = document.querySelector('#login-label');
const errorBox = document.querySelector('#login-error');
const status = document.querySelector('#login-status');
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  errorBox.hidden = true;
  const username = form.elements.username.value.trim();
  const password = form.elements.password.value;
  if (!username || !password) {
    errorBox.textContent = '⚠ กรุณากรอก Username และ Password ให้ครบ';
    errorBox.hidden = false;
    (!username ? form.elements.username : form.elements.password).focus();
    return;
  }
  button.disabled = true; spinner.hidden = false; label.textContent = 'กำลังเชื่อมต่อ…';
  form.setAttribute('aria-busy', 'true');
  try {
    await login(username, password, text => { status.textContent = text; });
    form.elements.password.value = '';
    location.assign('dashboard.html');
  } catch (error) {
    status.textContent = '';
    errorBox.textContent = `⚠ ${error instanceof ApiError ? error.message : 'ไม่สามารถเริ่มเซสชันได้ กรุณาตรวจสอบว่าเบราว์เซอร์อนุญาต sessionStorage'}`;
    errorBox.hidden = false;
  } finally {
    button.disabled = false; spinner.hidden = true; label.textContent = 'Login to Dashboard';
    form.removeAttribute('aria-busy');
  }
});
