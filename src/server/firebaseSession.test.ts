import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { app } from '../../server.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
if (process.env.G360_TEST_FIXTURE !== '1' || !process.cwd().startsWith('/tmp/') || JSON.parse(fs.readFileSync('db.json', 'utf8')).securityPlanFixture !== true) throw Error('Fictional fixture required');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
after(async () => { mock.restoreAll(); await new Promise<void>(resolve => server.close(() => resolve())); });
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const authTime = Math.floor(Date.now() / 1000) - 60;
const call = (route: string, method = 'GET', body?: any, cookie?: string, bearer?: string) => fetch(base + route, { method,
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
let record: any;
mock.method(adminAuth, 'verifyIdToken', async (_token: string, checkRevoked?: boolean) => {
  assert.equal(checkRevoked, true);
  return { uid: 'audit-admin', email: 'admin@example.invalid', email_verified: true, admin: true, auth_time: authTime };
});
mock.method(adminAuth, 'getUser', async (uid: string) => {
  assert.equal(uid, 'audit-admin');
  if (record instanceof Error) throw record;
  return record;
});
const active = () => ({ uid: 'audit-admin', email: 'admin@example.invalid', emailVerified: true, disabled: false, customClaims: { admin: true }, tokensValidAfterTime: new Date((authTime - 10) * 1000).toISOString() });
async function exchange() {
  const response = await call('/api/auth/firebase', 'POST', { idToken: 'fictional-id-token' });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie')!.split(';')[0];
}

test('Firebase cookie and Bearer derive role from current claims, not stale token or local admin', async () => {
  record = active(); const cookie = await exchange();
  assert.equal((await call('/api/g360/users', 'GET', undefined, cookie)).status, 200);
  record.customClaims = {};
  assert.equal((await call('/api/auth/me', 'GET', undefined, cookie)).status, 200);
  assert.equal((await (await call('/api/auth/me', 'GET', undefined, cookie)).json()).role, 'user');
  assert.equal((await call('/api/g360/users', 'GET', undefined, cookie)).status, 403);
  assert.equal((await call('/api/g360/users', 'GET', undefined, undefined, 'fictional-old-admin-token')).status, 403);
});
test('refresh preserves Firebase authority and original authentication time', async () => {
  record = active(); const old = await exchange();
  const refresh = await call('/api/auth/refresh', 'POST', {}, old); assert.equal(refresh.status, 200);
  const cookie = refresh.headers.get('set-cookie')!.split(';')[0]; assert.notEqual(cookie, old);
  assert.equal((await call('/api/auth/me', 'GET', undefined, old)).status, 401);
  record.tokensValidAfterTime = new Date((authTime + 1) * 1000).toISOString();
  assert.equal((await call('/api/projects', 'GET', undefined, cookie)).status, 401);
  assert.equal((await call('/api/auth/refresh', 'POST', {}, cookie)).status, 401);
});
test('disabled, unverified or deleted Firebase accounts cannot keep an existing cookie session', async () => {
  for (const change of [{ disabled: true }, { emailVerified: false }, Object.assign(Error('Fictional missing account'), { code: 'auth/user-not-found' })]) {
    record = active(); const cookie = await exchange();
    record = change instanceof Error ? change : { ...record, ...change };
    assert.equal((await call('/api/auth/me', 'GET', undefined, cookie)).status, 401);
    assert.equal((await call('/api/projects', 'GET', undefined, cookie)).status, 401);
  }
});
test('Firebase dependency failure denies access without exposing error, then session can recover', async () => {
  record = active(); const cookie = await exchange();
  record = Error('fictional-sensitive-upstream-detail');
  const failed = await call('/api/auth/me', 'GET', undefined, cookie); assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes('fictional-sensitive-upstream-detail'), false);
  record = active(); assert.equal((await call('/api/auth/me', 'GET', undefined, cookie)).status, 200);
});
test('fresh exchange cannot turn stale Firebase admin claim into local admin authority', async () => {
  record = { ...active(), customClaims: {} }; const cookie = await exchange();
  assert.equal((await call('/api/g360/users', 'GET', undefined, cookie)).status, 403);
});
test('auth/me and private APIs accept the same verified Bearer identity without a cookie', async () => {
  record = active();
  const me = await call('/api/auth/me', 'GET', undefined, undefined, 'fictional-valid-token');
  assert.equal(me.status, 200); const user = await me.json();
  assert.equal(user.id, 'audit-admin'); assert.equal(user.role, 'admin');
  assert.equal((await call('/api/projects', 'GET', undefined, undefined, 'fictional-valid-token')).status, 200);
  assert.equal((await call('/api/auth/me')).status, 401);
});
test('a malformed or rejected Authorization cannot fall back to a valid cookie', async () => {
  record = active(); const cookie = await exchange();
  for (const authorization of ['Bearer ', 'Basic ZmljdGl0aW91cw==', 'Bearer two words']) {
    for (const route of ['/api/auth/me', '/api/projects']) {
      const response = await fetch(base + route, { headers: { Cookie: cookie, Authorization: authorization } });
      assert.equal(response.status, 401);
    }
  }
  const patch = mock.method(adminAuth, 'verifyIdToken', async () => { throw Object.assign(Error('Fictional expired token'), { code: 'auth/id-token-expired' }); });
  try {
    assert.equal((await call('/api/auth/me', 'GET', undefined, cookie, 'fictional-expired-token')).status, 401);
  } finally { patch.mock.restore(); }
});
test('logout removes only the current backend session and states the Firebase sign-out requirement', async () => {
  record = active(); const first = await exchange(); const second = await exchange();
  const logout = await call('/api/auth/logout', 'POST', {}, first); assert.equal(logout.status, 200);
  const result = await logout.json(); assert.equal(result.scope, 'backend_cookie'); assert.equal(result.firebaseSignOutRequired, true);
  assert.equal((await call('/api/auth/me', 'GET', undefined, first)).status, 401);
  assert.equal((await call('/api/projects', 'GET', undefined, first)).status, 401);
  assert.equal((await call('/api/auth/me', 'GET', undefined, second)).status, 200);
});
test('expired backend session cannot be refreshed or used even while Firebase account remains valid', async () => {
  record = active(); const cookie = await exchange(); const clock = Date.now;
  const patch = mock.method(Date, 'now', () => clock() + 8 * 60 * 60 * 1000 + 1000);
  try {
    assert.equal((await call('/api/auth/me', 'GET', undefined, cookie)).status, 401);
    assert.equal((await call('/api/auth/refresh', 'POST', {}, cookie)).status, 401);
  } finally { patch.mock.restore(); }
});
