import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { app } from '../../server.ts';
import { createLocalSession } from '../middleware/auth.ts';
if (process.env.G360_TEST_FIXTURE !== '1' || !process.cwd().startsWith('/tmp/') || JSON.parse(fs.readFileSync('db.json', 'utf8')).securityPlanFixture !== true) throw Error('Fictional fixture required');
const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
after(async () => { mock.restoreAll(); await new Promise<void>(resolve => server.close(() => resolve())); });
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const admin = `sxp_uid=${createLocalSession('audit-admin')}`;
const user = `sxp_uid=${createLocalSession('legacy-user')}`;
const networkFetch = globalThis.fetch;
async function call(route: string, method = 'GET', body?: any, cookie = admin) {
  return networkFetch(base + route, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test('new audits preserve other tenants, unowned history and earlier revisions beyond thirty records', async () => {
  const original = fs.readFileSync('db.json');
  try {
    const db = JSON.parse(original.toString());
    const history = Array.from({ length: 40 }, (_, i) => ({ id: `fixture-history-${i}`, ...(i % 3 ? { ownerUid: i % 2 ? 'legacy-user' : 'audit-admin' } : {}), business: { name: 'Same fictitious business' } }));
    db.g360.audits = history; fs.writeFileSync('db.json', JSON.stringify(db));
    for (const cookie of [user, admin]) {
      const response = await call('/api/g360/audit', 'POST', { business: { name: 'Same fictitious business', city: 'Fixture', category: 'Fixture' } }, cookie);
      assert.equal(response.status, 200);
    }
    const saved = JSON.parse(fs.readFileSync('db.json', 'utf8')).g360.audits;
    assert.equal(saved.length, 42);
    for (const entry of history) assert.deepEqual(saved.find((a: any) => a.id === entry.id), entry);
    const visible = await (await call('/api/g360/audits', 'GET', undefined, user)).json();
    assert.ok(visible.audits.every((a: any) => a.ownerUid === 'legacy-user'));
  } finally { fs.writeFileSync('db.json', original); }
});
test('administrator removal cannot leave only ordinary or inactive accounts; unknown target is not success', async () => {
  const original = fs.readFileSync('db.json');
  try {
    const db = JSON.parse(original.toString()); db.users.find((u: any) => u.id === 'url-fixture-admin').status = 'suspended';
    fs.writeFileSync('db.json', JSON.stringify(db)); const before = fs.readFileSync('db.json');
    assert.equal((await call('/api/g360/users/audit-admin', 'DELETE')).status, 409);
    assert.equal((await call('/api/g360/users/nonexistent-fixture', 'DELETE')).status, 404);
    assert.deepEqual(fs.readFileSync('db.json'), before);
  } finally { fs.writeFileSync('db.json', original); }
});
test('configured fake provider keys do not authorize network calls or SDK fallback without a grant', async () => {
  const names = ['GEMINI_API_KEY', 'GOOGLE_PLACES_API_KEY', 'OUTSCRAPER_API_KEY', 'G360_EXTERNAL_ACCESS_GRANTS'];
  const before = Object.fromEntries(names.map(k => [k, process.env[k]]));
  let calls = 0; const patch = mock.method(globalThis, 'fetch', async () => { calls++; throw Error('External transport forbidden'); });
  try {
    for (const name of names.slice(0, 3)) process.env[name] = 'fictional-provider-key-not-real';
    delete process.env.G360_EXTERNAL_ACCESS_GRANTS;
    assert.equal((await call('/api/places/photo?name=places/fixture/photos/photo_1')).status, 502);
    const clone = await call('/api/ai/clone-site', 'POST', { rawHtml: '<html><title>Fictitious public structure</title></html>' });
    assert.ok([200, 503].includes(clone.status));
    await clone.arrayBuffer();
    assert.equal(calls, 0);
  } finally {
    patch.mock.restore();
    for (const name of names) if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name];
  }
});
test('real HTTP handoff preserves tenant identity from audit through project, client and reviewed document', async () => {
  const original = fs.readFileSync('db.json');
  try {
    const business = { name: 'Clearly Fictitious Multimodule Company', city: 'Fixture City', category: 'Fixture service' };
    const auditResponse = await call('/api/g360/audit', 'POST', { business }, user); assert.equal(auditResponse.status, 200);
    const audit = (await auditResponse.json()).report; assert.equal(audit.ownerUid, 'legacy-user');
    const projectResponse = await call('/api/projects', 'POST', { name: business.name, data: { business, fixture: true } }, user); assert.equal(projectResponse.status, 200);
    const project = await projectResponse.json(); assert.equal(project.ownerUid, 'legacy-user');
    const clientResponse = await call('/api/office/clients', 'POST', { ownerUid: 'legacy-user', name: 'Fictitious Contact', businessName: business.name, email: 'fixture@example.invalid' }); assert.equal(clientResponse.status, 201);
    const client = await clientResponse.json();
    assert.equal((await call(`/api/office/clients/${client.id}/sites`, 'POST', { projectId: project.id })).status, 201);
    assert.equal((await call(`/api/projects/${project.id}`, 'DELETE', undefined, user)).status, 409);
    const draftResponse = await call('/api/office/contracts', 'POST', { clientId: client.id, projectId: project.id, serviceType: 'Fixture service', title: 'Fictitious draft only', text: 'Fictitious obligations for controlled testing.' }, user); assert.equal(draftResponse.status, 201);
    const draft = await draftResponse.json(); assert.equal(draft.status, 'draft'); assert.equal(draft.projectId, project.id);
    assert.equal((await call(`/api/office/contracts/${draft.id}/review`, 'POST', {}, user)).status, 200);
    assert.equal((await call(`/api/office/contracts/${draft.id}/approve`, 'POST', { sha256: draft.versions[0].sha256 })).status, 200);
    const queued = await call(`/api/office/contracts/${draft.id}/signature-request`, 'POST', { sha256: draft.versions[0].sha256 }); assert.equal(queued.status, 202); assert.equal((await queued.json()).delivered, false);
    const document = await call(`/api/office/contracts/${draft.id}/document?version=1`, 'GET', undefined, user); assert.equal(document.status, 200); assert.match(await document.text(), /Fictitious obligations/);
    assert.equal((await call(`/api/office/contracts/${draft.id}/document?version=1`, 'GET', undefined, `sxp_uid=${createLocalSession('url-fixture-admin')}`)).status, 200); // Explicit administrator access.
    const other = JSON.parse(original.toString()); other.users.push({ id: 'fixture-other-tenant', email: 'other-tenant@example.invalid', role: 'user' });
    const current = JSON.parse(fs.readFileSync('db.json', 'utf8')); current.users = other.users; fs.writeFileSync('db.json', JSON.stringify(current));
    const otherCookie = `sxp_uid=${createLocalSession('fixture-other-tenant')}`;
    assert.equal((await call(`/api/office/contracts/${draft.id}/document?version=1`, 'GET', undefined, otherCookie)).status, 404);
    const view = await (await call('/api/office', 'GET', undefined, otherCookie)).json(); assert.deepEqual(view.contracts, []); assert.deepEqual(view.sites, []);
  } finally { fs.writeFileSync('db.json', original); }
});
test('invalid project mutations never persist and optional If-Match prevents stale overwrites', async () => {
  const original = fs.readFileSync('db.json');
  try {
    for (const payload of [[], { name: { not: 'a string' } }, { name: 'x'.repeat(201) }, { data: '<script>evil()</script>' }, { status: 'invented-status' }]) {
      assert.equal((await call('/api/projects', 'POST', payload, user)).status, 400);
      assert.deepEqual(fs.readFileSync('db.json'), original);
    }
    const created = await call('/api/projects', 'POST', { name: 'Fixture revision', ownerUid: 'audit-admin', data: {} }, user); assert.equal(created.status, 200);
    const project = await created.json(); assert.equal(project.ownerUid, 'legacy-user');
    const read = await call(`/api/projects/${project.id}`, 'GET', undefined, user); assert.equal(read.status, 200);
    const etag = read.headers.get('etag'); assert.ok(etag);
    const save = async (name: string) => networkFetch(base + `/api/projects/${project.id}`, { method: 'PUT', headers: { Cookie: user, 'Content-Type': 'application/json', 'If-Match': etag! }, body: JSON.stringify({ name }) });
    assert.equal((await save('First reviewed update')).status, 200);
    assert.equal((await save('Stale client update')).status, 412);
    const current = await (await call(`/api/projects/${project.id}`, 'GET', undefined, user)).json(); assert.equal(current.name, 'First reviewed update');
    const otherCookie = `sxp_uid=${createLocalSession('fixture-project-intruder')}`;
    const db = JSON.parse(fs.readFileSync('db.json', 'utf8')); db.users.push({ id: 'fixture-project-intruder', email: 'intruder@example.invalid', role: 'user' }); fs.writeFileSync('db.json', JSON.stringify(db));
    assert.equal((await call(`/api/projects/${project.id}`, 'GET', undefined, otherCookie)).status, 403);
  } finally { fs.writeFileSync('db.json', original); }
});
test('public tracking rejects private sites, malformed events and prototype keys without writing data', async () => {
  const original = fs.readFileSync('db.json');
  try {
    for (const button of ['__proto__', 'constructor', 'prototype', 'x'.repeat(81), { invalid: true }]) {
      assert.equal((await call('/api/public/track/fixture', 'POST', { button })).status, 400);
      assert.deepEqual(fs.readFileSync('db.json'), original);
    }
    const db = JSON.parse(original.toString()); db.projects.find((p: any) => p.slug === 'fixture').status = 'draft'; fs.writeFileSync('db.json', JSON.stringify(db)); const draft = fs.readFileSync('db.json');
    assert.equal((await call('/api/public/track/fixture', 'POST', { button: 'hero_cta' })).status, 404); assert.deepEqual(fs.readFileSync('db.json'), draft);
    db.projects.find((p: any) => p.slug === 'fixture').status = 'active'; db.clicks['fixture-project'] = { total: 5, last7: 5, by_button: { hero_cta: 5 } }; fs.writeFileSync('db.json', JSON.stringify(db));
    assert.equal((await call('/api/public/track/fixture', 'POST', { button: 'hero_cta' })).status, 200);
    assert.equal(JSON.parse(fs.readFileSync('db.json', 'utf8')).clicks['fixture-project'].by_button.hero_cta, 6);
  } finally { fs.writeFileSync('db.json', original); }
});
