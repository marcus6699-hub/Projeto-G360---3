import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const project = 'demo-g360-codex';
const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (process.env.G360_EMULATOR_FIXTURE !== '1' || process.env.GCLOUD_PROJECT !== project || !/^127\.0\.0\.1:\d+$/.test(host || '')) throw Error('Isolated demo Auth emulator required');
const app = initializeApp({ projectId: project }, 'g360-real-local-emulator');
const auth = getAuth(app);
after(async () => { await deleteApp(app); });
async function action(endpoint, payload) {
  const response = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=fictional-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return { status: response.status, data: await response.json() };
}
let sequence = 0;
async function fixture() {
  const email = `fixture-${++sequence}@example.invalid`;
  const password = 'Fictional-Only-Password-2026';
  const user = await auth.createUser({ email, password, emailVerified: true });
  const signed = await action('signInWithPassword', { email, password, returnSecureToken: true });
  assert.equal(signed.status, 200);
  return { email, password, uid: user.uid, token: signed.data.idToken };
}
test('local Auth accepts a valid password and rejects incorrect password; Admin verifies the issued token', async () => {
  const user = await fixture();
  const decoded = await auth.verifyIdToken(user.token, true);
  assert.equal(decoded.uid, user.uid); assert.equal(decoded.email_verified, true);
  assert.equal((await action('signInWithPassword', { email: user.email, password: 'incorrect-fixture-password', returnSecureToken: true })).status, 400);
});
test('real local Auth token is rejected for wrong project and expiration', async () => {
  const user = await fixture();
  const parts = user.token.split('.');
  const original = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  for (const patch of [{ aud: 'demo-another-project' }, { exp: Math.floor(Date.now() / 1000) - 60 }]) {
    const altered = [parts[0], Buffer.from(JSON.stringify({ ...original, ...patch })).toString('base64url'), parts[2]].join('.');
    await assert.rejects(auth.verifyIdToken(altered, true));
  }
});
test('real local Auth blocks a token after disabling or deleting its account', async () => {
  const disabled = await fixture(); await auth.updateUser(disabled.uid, { disabled: true });
  await assert.rejects(auth.verifyIdToken(disabled.token, true), { code: 'auth/user-disabled' });
  const removed = await fixture(); await auth.deleteUser(removed.uid);
  await assert.rejects(auth.verifyIdToken(removed.token, true), { code: 'auth/user-not-found' });
});
test('real local Auth revocation invalidates an older issued token', async () => {
  const user = await fixture();
  await new Promise(resolve => setTimeout(resolve, 1100));
  await auth.revokeRefreshTokens(user.uid);
  await assert.rejects(auth.verifyIdToken(user.token, true), { code: 'auth/id-token-revoked' });
});
test('real local Auth custom claims reflect current authority and differ from old token claims', async () => {
  const user = await fixture(); await auth.setCustomUserClaims(user.uid, { admin: true });
  assert.equal((await auth.getUser(user.uid)).customClaims.admin, true);
  await auth.setCustomUserClaims(user.uid, {});
  assert.equal((await auth.getUser(user.uid)).customClaims.admin, undefined);
  assert.equal((await auth.verifyIdToken(user.token)).admin, undefined);
});
test('real local Auth password update changes sign-in behavior without changing another user', async () => {
  const user = await fixture(); const other = await fixture();
  await auth.updateUser(user.uid, { password: 'Another-Fictional-Password-2026' });
  assert.equal((await action('signInWithPassword', { email: user.email, password: user.password, returnSecureToken: true })).status, 400);
  assert.equal((await action('signInWithPassword', { email: user.email, password: 'Another-Fictional-Password-2026', returnSecureToken: true })).status, 200);
  assert.equal((await action('signInWithPassword', { email: other.email, password: other.password, returnSecureToken: true })).status, 200);
});
test('G360 backend uses the real local Auth emulator for cookies, claims, refresh, logout and revocation', async () => {
  const user = await fixture();
  const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-backend-emulator-'));
  fs.cpSync(source, directory, { recursive: true, filter: file => !path.relative(source, file).split(path.sep).some(part => ['node_modules', '.git', 'dist', 'attachments'].includes(part) || part.startsWith('.env') || /^(db|cost-guard-metrics)\.json/.test(part)) });
  // A disposable source fixture reuses read-only dependency resolution; no worktree is linked.
  fs.symlinkSync(path.join(source, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(directory, 'firebase-applet-config.json'), JSON.stringify({ projectId: project }));
  const db = JSON.stringify({ users: [{ id: user.uid, name: 'Fictional Firebase user', email: user.email, role: 'user' }], projects: [], clicks: {}, aiSettings: {} });
  fs.writeFileSync(path.join(directory, 'db.json'), db, { mode: 0o600 });
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "const {app}=await import('./server.ts');const s=app.listen(0,'127.0.0.1',()=>console.log('FIXTURE_PORT='+s.address().port));"], {
    cwd: directory, env: { PATH: process.env.PATH, NODE_ENV: 'test', FIREBASE_AUTH_EMULATOR_HOST: host, GCLOUD_PROJECT: project, GOOGLE_CLOUD_PROJECT: project, GCE_METADATA_DISABLED: 'true' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const closed = new Promise(resolve => child.once('close', resolve));
  let output = '';
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Fictional backend did not become ready')), 15000);
      child.stdout.on('data', bytes => { output += bytes; const match = output.match(/FIXTURE_PORT=(\d+)/); if (match) { clearTimeout(timeout); resolve(Number(match[1])); } });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', () => { clearTimeout(timeout); reject(Error('Fictional backend stopped before ready')); });
    });
    const call = (route, method = 'GET', payload, cookie) => fetch(`http://127.0.0.1:${port}${route}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    const exchange = async () => {
      const response = await call('/api/auth/firebase', 'POST', { idToken: user.token });
      assert.equal(response.status, 200);
      return response.headers.get('set-cookie').split(';')[0];
    };
    const first = await exchange(); const parallel = await exchange();
    assert.equal((await call('/api/auth/me', 'GET', undefined, first)).status, 200);
    assert.equal((await call('/api/g360/users', 'GET', undefined, first)).status, 403);
    await auth.setCustomUserClaims(user.uid, { admin: true });
    assert.equal((await call('/api/g360/users', 'GET', undefined, first)).status, 200);
    await auth.setCustomUserClaims(user.uid, {});
    assert.equal((await call('/api/g360/users', 'GET', undefined, first)).status, 403);
    const refresh = await call('/api/auth/refresh', 'POST', {}, first); assert.equal(refresh.status, 200);
    const rotated = refresh.headers.get('set-cookie').split(';')[0];
    assert.equal((await call('/api/auth/me', 'GET', undefined, first)).status, 401);
    assert.equal((await call('/api/auth/logout', 'POST', {}, rotated)).status, 200);
    assert.equal((await call('/api/projects', 'GET', undefined, rotated)).status, 401);
    assert.equal((await call('/api/projects', 'GET', undefined, parallel)).status, 200);
    await new Promise(resolve => setTimeout(resolve, 1100));
    await auth.revokeRefreshTokens(user.uid);
    assert.equal((await call('/api/projects', 'GET', undefined, parallel)).status, 401);
    assert.equal(fs.readFileSync(path.join(directory, 'db.json'), 'utf8'), db);
  } finally { child.kill('SIGTERM'); await closed; }
});

if (process.env.G360_EMULATOR_MODE === 'all') {
  const store = process.env.FIRESTORE_EMULATOR_HOST;
  if (!/^127\.0\.0\.1:\d+$/.test(store || '')) throw Error('Local Firestore emulator required');
  const url = `http://${store}/v1/projects/${project}/databases/(default)/documents`;
  const fields = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, typeof value === 'number' ? { integerValue: String(value) } : typeof value === 'boolean' ? { booleanValue: value } : { stringValue: value }]));
  const request = (resource, token, method = 'GET', value) => fetch(`${url}/${resource}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(value ? { body: JSON.stringify({ fields: fields(value) }) } : {}) });
  test('real Firestore rules enforce owner, verified writes, schema and cross-tenant denial', async () => {
    const a = await fixture(); const b = await fixture();
    const profile = { uid: a.uid, name: 'Fixture A', email: a.email, plan: 'site_express_only', createdAt: '2026-10-28', updatedAt: '2026-10-28' };
    assert.equal((await request(`users/${a.uid}`, a.token, 'PATCH', profile)).status, 200);
    assert.equal((await request(`users/${a.uid}`, a.token)).status, 200);
    assert.equal((await request(`users/${a.uid}`, b.token)).status, 403);
    assert.equal((await request(`users/${a.uid}`, undefined)).status, 403);
    assert.equal((await request(`users/${a.uid}`, b.token, 'PATCH', { ...profile, name: 'Intrusion' })).status, 403);
    assert.equal((await request(`users/${a.uid}`, a.token, 'PATCH', { ...profile, role: 'admin' })).status, 403);
    assert.equal((await request(`signed_contracts/fixture`, a.token, 'PATCH', { status: 'signed' })).status, 403);
    const unverified = await auth.createUser({ email: 'unverified-firestore-fixture@example.invalid', password: 'Fictional-Only-Password-2026', emailVerified: false });
    const login = await action('signInWithPassword', { email: unverified.email, password: 'Fictional-Only-Password-2026', returnSecureToken: true });
    assert.equal((await request(`users/${unverified.uid}`, login.data.idToken, 'PATCH', { ...profile, uid: unverified.uid, email: unverified.email })).status, 403);
  });
}
