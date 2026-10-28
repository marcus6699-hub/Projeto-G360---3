import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { app } from '../../server.ts';
import { createLocalSession } from '../middleware/auth.ts';
if (process.env.G360_TEST_FIXTURE !== '1' || !process.cwd().startsWith('/tmp/') || JSON.parse(fs.readFileSync('db.json', 'utf8')).securityPlanFixture !== true) throw Error('Fictional fixture required');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const cookie = `sxp_uid=${createLocalSession('audit-admin')}`;
const call = (route: string, method = 'GET', body?: any, headers: Record<string, string> = {}) => fetch(base + route, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

test('cross-origin browser mutations and credential CORS are denied; same-origin still works', async () => {
  const response = await call('/api/projects', 'POST', { name: 'Forbidden cross-origin' }, { Origin: 'https://attacker.invalid' });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const allowed = await call('/api/auth/me', 'GET', undefined, { Origin: base });
  assert.equal(allowed.status, 200); assert.equal(allowed.headers.get('access-control-allow-origin'), base);
});
test('password recovery truthfully reports unavailable and preserves data', async () => {
  const before = fs.readFileSync('db.json');
  const response = await call('/api/auth/forgot-password', 'POST', { email: 'admin@example.invalid' });
  assert.equal(response.status, 503); assert.equal((await response.json()).ok, false);
  assert.deepEqual(fs.readFileSync('db.json'), before);
});
test('inactive accounts cannot login or use an existing session', async () => {
  const before = fs.readFileSync('db.json');
  try {
    const db = JSON.parse(before.toString()); db.users.find((u: any) => u.id === 'audit-admin').status = 'suspended'; fs.writeFileSync('db.json', JSON.stringify(db));
    assert.equal((await call('/api/auth/me')).status, 401);
    assert.equal((await call('/api/projects')).status, 401);
    assert.equal((await call('/api/auth/login', 'POST', { email: 'admin@example.invalid', password: 'fixture-password' })).status, 401);
  } finally { fs.writeFileSync('db.json', before); }
  assert.equal((await call('/api/projects')).status, 200);
});
test('private deployment tokens are not returned or newly persisted through browser settings', async () => {
  const before = fs.readFileSync('db.json');
  try {
    const db = JSON.parse(before.toString()); db.g360.deploySettings.vercelToken = 'fictional-private-token'; fs.writeFileSync('db.json', JSON.stringify(db));
    const crm = await call('/api/g360/crm'); assert.equal(crm.status, 200);
    assert.equal((await crm.text()).includes('fictional-private-token'), false);
    const response = await call('/api/g360/settings', 'PUT', { deploySettings: { vercelToken: 'forbidden-new-token' } });
    assert.equal(response.status, 400); assert.equal(fs.readFileSync('db.json', 'utf8').includes('forbidden-new-token'), false);
    const status = await call('/api/admin/integrations'); assert.equal(status.status, 200);
    assert.equal((await status.json()).secretsReturned, false);
  } finally { fs.writeFileSync('db.json', before); }
});
test('public site does not disclose private metadata, drafts or suspended content', async () => {
  const before = fs.readFileSync('db.json');
  try {
    const db = JSON.parse(before.toString());
    db.projects.push({ id: 'public-safe-fixture', slug: 'public-safe-fixture', status: 'active', name: 'Fixture', ownerUid: 'private-owner', internal: 'private-note', data: { headline: 'Public' } });
    fs.writeFileSync('db.json', JSON.stringify(db));
    const response = await call('/api/public/site/public-safe-fixture'); assert.equal(response.status, 200);
    const data = await response.json(); assert.equal(data.ownerUid, undefined); assert.equal(data.internal, undefined);
    const p = db.projects.at(-1); p.status = 'draft'; fs.writeFileSync('db.json', JSON.stringify(db));
    assert.equal((await call('/api/public/site/public-safe-fixture')).status, 404);
    p.status = 'suspended'; fs.writeFileSync('db.json', JSON.stringify(db));
    const suspended = await (await call('/api/public/site/public-safe-fixture')).json(); assert.equal(suspended.status, 'suspended'); assert.equal(suspended.data, undefined);
  } finally { fs.writeFileSync('db.json', before); }
});
test('office is authenticated and test-only financial actions remain disabled on normal app', async () => {
  assert.equal((await call('/api/office', 'GET', undefined, { Cookie: '' })).status, 401);
  assert.equal((await call('/api/office')).status, 200);
  assert.equal((await call('/api/office/financial/simulate', 'POST', {})).status, 403);
});
test('malformed JSON and unknown API routes return sanitized errors without stack traces', async () => {
  const malformed = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.text()).includes('SyntaxError'), false);
  const missing = await call('/api/does-not-exist'); assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('content-type')?.includes('application/json'), true);
});
test('email normalization prevents duplicate registration and preserves legitimate login', async () => {
  const before = fs.readFileSync('db.json');
  const duplicate = await call('/api/auth/register', 'POST', { name: 'Duplicate fixture', email: ' ADMIN@example.invalid ', password: 'fictional-new-password' });
  assert.equal(duplicate.status, 409); assert.deepEqual(fs.readFileSync('db.json'), before);
  const login = await call('/api/auth/login', 'POST', { email: ' ADMIN@example.invalid ', password: 'fixture-password' });
  assert.equal(login.status, 200);
});
test('actual login endpoint rejects oversized inputs and throttles repeated attempts', async () => {
  assert.equal((await call('/api/auth/login', 'POST', { email: 'admin@example.invalid', password: 'x'.repeat(1025) })).status, 400);
  let status = 0;
  for (let i = 0; i < 25; i++) {
    const response = await call('/api/auth/login', 'POST', { email: 'nobody@example.invalid', password: 'wrong' });
    status = response.status;
    if (status === 429) { assert.ok(Number(response.headers.get('retry-after')) > 0); break; }
    assert.equal(status, 401);
  }
  assert.equal(status, 429);
});
