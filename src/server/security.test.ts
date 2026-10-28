import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { app } from '../../server.ts';
import { createProjectData } from '../lib/sitegen/projectFactory.js';
import { generateSiteHtml } from '../lib/sitegen/generateSiteHtml.js';

// Run against a disposable checkout/fixture: the server persists to db.json.
const fixtureReady = process.env.G360_TEST_FIXTURE === '1' && process.cwd().startsWith('/tmp/') && (() => {
  try { return JSON.parse(fs.readFileSync('db.json', 'utf8')).users?.some((u: any) => u.id === 'audit-admin' && u.email === 'admin@example.invalid'); } catch { return false; }
})();
test('anonymous users cannot obtain a session or change private data', { skip: !fixtureReady }, async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = (path: string, method = 'GET', body?: unknown, cookie?: string) =>
    fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    for (const [path, method, body] of [
      ['/api/auth/me', 'GET'], ['/api/auth/refresh', 'POST'],
      ['/api/projects', 'GET'], ['/api/projects/fixture-project', 'PUT', { name: 'changed' }],
      ['/api/g360/users', 'POST', { name: 'Intruder', email: 'intruder@example.invalid', password: 'x', role: 'admin' }],
      ['/api/g360/crm', 'GET'],
    ] as const) assert.equal((await call(path, method, body)).status, 401, path);
    assert.equal((await call('/api/projects', 'GET', undefined, 'sxp_uid=audit-admin')).status, 401);
    assert.equal((await call('/api/auth/login', 'POST', { email: 'admin@example.invalid', password: 'wrong' })).status, 401);
    assert.equal((await call('/api/auth/login', 'POST', { email: 'legacy@example.invalid', password: 'legacy-fixture-password' })).status, 401);

    const login = await call('/api/auth/login', 'POST', { email: 'admin@example.invalid', password: 'fixture-password' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.notEqual(cookie, 'sxp_uid=audit-admin');
    assert.equal((await call('/api/projects', 'GET', undefined, cookie)).status, 200);
    assert.equal((await (await call('/api/g360/crm', 'GET', undefined, cookie)).json()).leads.length, 1);
    const createdAdmin = await call('/api/g360/users', 'POST', { name: 'Managed', email: 'managed@example.invalid', password: 'fixture-managed-password', role: 'admin' }, cookie);
    assert.equal(createdAdmin.status, 200);
    const managed = await call('/api/auth/login', 'POST', { email: 'managed@example.invalid', password: 'fixture-managed-password' });
    assert.equal(managed.status, 200);
    assert.equal((await call('/api/auth/logout', 'POST', undefined, cookie)).status, 200);
    assert.equal((await call('/api/projects', 'GET', undefined, cookie)).status, 401);

    const register = await call('/api/auth/register', 'POST', { name: 'Normal', email: 'normal@example.invalid', password: 'fixture-user-password' });
    assert.equal(register.status, 200);
    const userCookie = register.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await call('/api/g360/users', 'POST', { name: 'Intruder', email: 'intruder@example.invalid', password: 'x', role: 'admin' }, userCookie)).status, 403);
    assert.equal((await call('/api/projects/fixture-project', 'PUT', { name: 'changed' }, userCookie)).status, 403);
    const crm = await call('/api/g360/crm', 'GET', undefined, userCookie);
    assert.equal(crm.status, 200);
    assert.deepEqual((await crm.json()).leads, []);
    assert.deepEqual((await (await call('/api/g360/audits', 'GET', undefined, userCookie)).json()).audits, []);
    const lead = await call('/api/g360/crm/leads', 'POST', { businessName: 'Fixture lead' }, userCookie);
    assert.equal(lead.status, 200);
    const leadId = (await lead.json()).lead.id;
    const own = await call('/api/projects', 'POST', { name: 'Owned fixture', data: {} }, userCookie);
    assert.equal(own.status, 200);
    const ownId = (await own.json()).id;
    assert.equal((await call(`/api/projects/${ownId}`, 'PUT', { name: 'Updated fixture' }, userCookie)).status, 200);
    const other = await call('/api/auth/register', 'POST', { name: 'Other', email: 'other@example.invalid', password: 'fixture-other-password' });
    assert.equal(other.status, 200);
    const otherCookie = other.headers.get('set-cookie')!.split(';')[0];
    assert.deepEqual((await (await call('/api/g360/crm', 'GET', undefined, otherCookie)).json()).leads, []);
    assert.equal((await call(`/api/g360/crm/leads/${leadId}`, 'PUT', { ownerUid: 'other', stage: 'fechado' }, otherCookie)).status, 403);
    assert.equal((await call(`/api/g360/crm/leads/${leadId}`, 'DELETE', undefined, otherCookie)).status, 403);
    assert.equal((await call('/api/g360/settings', 'PUT', { financeGoals: {} }, otherCookie)).status, 403);
    assert.equal((await call(`/api/projects/${ownId}`, 'PUT', { name: 'Hijacked' }, otherCookie)).status, 403);
    assert.equal((await call(`/api/projects/${ownId}`, 'DELETE', undefined, otherCookie)).status, 403);
    assert.equal((await call('/api/auth/register', 'POST', { name: 'Duplicate', email: 'normal@example.invalid', password: 'x' })).status, 409);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('generated HTML treats hostile business and tracking values as data', () => {
  const payload = '</script><script>window.__auditMarker=1</script>';
  const data = createProjectData({ name: payload, category: 'Test', city: 'Test', uf: 'GO' }, 'servicos');
  data.marketing = { ...data.marketing, metaPixelId: payload, gadsId: payload, gadsLabel: payload, gtmId: payload };
  const html = generateSiteHtml(data, { slug: payload });
  assert.equal(html.includes('<script>window.__auditMarker=1</script>'), false);
  assert.ok(html.includes('\\u003c/script'));
  assert.equal(html.includes("fbq('init','</script>"), false);
});
