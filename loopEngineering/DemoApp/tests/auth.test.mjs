import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
export async function runAuthTests(root) {
  const original = { fetch: globalThis.fetch, sessionStorage: globalThis.sessionStorage, location: globalThis.location };
  const source = await readFile(`${root}/js/auth.js`, 'utf8');
  const store = new Map();
  const results = [];
  const id = '11111111-2222-3333-4444-555555555555';
  globalThis.sessionStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
  globalThis.location = { pathname: '/login.html', replace: () => {} };
  const auth = await import('../js/auth.js');
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const sequence = entries => {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      const [path, result] = entries[calls++] ?? [];
      assert.equal(url, `https://thingsboard.cloud${path}`);
      assert.equal(options.headers.Accept, 'application/json');
      assert.equal(options.signal instanceof AbortSignal, true);
      assert.equal(options.credentials, 'omit');
      if (options.headers['X-Authorization']) assert.match(options.headers['X-Authorization'], /^Bearer /);
      return typeof result === 'function' ? result(options) : result;
    };
    return () => calls;
  };
  const test = async (name, fn) => { store.clear(); await fn(); results.push({ name, result: 'PASS' }); };
  try {
    await test('Complete customer login and session cleanup', async () => {
      const count = sequence([
        ['/api/auth/login', options => { assert.deepEqual(JSON.parse(options.body), { username: 'test@example.invalid', password: 'test-only' }); assert.equal(options.headers['X-Authorization'], undefined); return json({ token: 'test-jwt', refreshToken: 'test-refresh' }); }],
        ['/api/auth/user', json({ authority: 'CUSTOMER_USER', customerId: { id } })],
        [`/api/customer/${id}/devices?pageSize=50&page=0`, json({ data: [{ id: { id } }] })],
        [`/api/device/${id}/credentials`, json({ credentialsType: 'ACCESS_TOKEN', credentialsId: 'test-device-token' })]
      ]);
      await auth.login('test@example.invalid', 'test-only'); assert.equal(count(), 4); assert.equal(auth.hasSession(), true);
      assert.equal([...store.values()].includes('test-only'), false);
      auth.clearSession(); assert.equal(store.size, 0);
    });
    for (const status of [401, 404, 503]) await test(`Login ${status}: one attempt and cleared session`, async () => {
      const count = sequence([['/api/auth/login', json({}, status)]]);
      await assert.rejects(auth.login('u', 'p'), error => error.status === status);
      assert.equal(count(), 1); assert.equal(store.size, 0);
    });
    for (const [path, expected] of [
      ['/api/auth/user', 'อ่านข้อมูลบัญชี'],
      [`/api/customer/${id}/devices?pageSize=50&page=0`, 'อ่านรายการอุปกรณ์'],
      [`/api/device/${id}/credentials`, 'อ่าน Access Token']
    ]) await test(`403 identifies operation: ${expected}`, async () => {
      const count = sequence([[path, json({}, 403)]]);
      await assert.rejects(auth.api(path), error => error.status === 403 && error.message.includes(expected));
      assert.equal(count(), 1);
    });
    await test('Malformed JSON handled', async () => {
      sequence([['/api/auth/login', new Response('{', { status: 200 })]]);
      await assert.rejects(auth.login('u', 'p'), auth.ApiError); assert.equal(store.size, 0);
    });
    await test('Tenant Admin rejected', async () => {
      sequence([['/api/auth/login', json({ token: 'test', refreshToken: 'test' })], ['/api/auth/user', json({ authority: 'TENANT_ADMIN', customerId: { id } })]]);
      await assert.rejects(auth.login('u', 'p'), auth.ApiError); assert.equal(store.size, 0);
    });
    await test('Empty device list rejected', async () => {
      sequence([['/api/auth/login', json({ token: 'test', refreshToken: 'test' })], ['/api/auth/user', json({ authority: 'CUSTOMER_USER', customerId: { id } })], [`/api/customer/${id}/devices?pageSize=50&page=0`, json({ data: [] })]]);
      await assert.rejects(auth.login('u', 'p'), auth.ApiError); assert.equal(store.size, 0);
    });
    await test('Protected 401 refreshes once and retries once', async () => {
      store.set('token', 'old'); store.set('refreshToken', 'test-refresh');
      const count = sequence([['/protected', json({}, 401)], ['/api/auth/token', json({ token: 'new', refreshToken: 'new-refresh' })], ['/protected', options => { assert.equal(options.headers['X-Authorization'], 'Bearer new'); return json({ ok: true }); }]]);
      assert.equal((await auth.api('/protected')).ok, true); assert.equal(count(), 3);
    });
    await test('Failed refresh is not retried', async () => {
      store.set('token', 'old'); store.set('refreshToken', 'test-refresh');
      const count = sequence([['/protected', json({}, 401)], ['/api/auth/token', json({}, 503)]]);
      await assert.rejects(auth.api('/protected'), auth.ApiError); assert.equal(count(), 2); assert.equal(store.size, 0);
    });
    await test('Network failure handled without retry', async () => {
      let count = 0; globalThis.fetch = async () => { count++; throw new TypeError('test'); };
      await assert.rejects(auth.login('u', 'p'), auth.ApiError); assert.equal(count, 1);
    });
    await test('Abort handled without retry', async () => {
      globalThis.fetch = async () => { throw new DOMException('test', 'AbortError'); };
      await assert.rejects(auth.login('u', 'p'), error => error instanceof auth.ApiError && error.message.includes('หมดเวลา'));
    });
    assert.equal(/console\.|localStorage|innerHTML/.test(source), false);
    return results;
  } finally { Object.assign(globalThis, original); }
}
