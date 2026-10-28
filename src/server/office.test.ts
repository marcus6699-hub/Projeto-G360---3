import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { registerOfficeRoutes, expirationState } from './office.ts';
import { AtomicJsonStore, isApplicationDb, scopedDocument, commitDocument, persistenceContext, persistenceErrorHandler } from './jsonPersistence.mjs';

async function fixture(options: { simulate?: boolean; saveFailure?: boolean } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-office-test-')); const file = path.join(dir, 'db.json');
  fs.writeFileSync(file, JSON.stringify({ users: [{ id: 'admin', email: 'admin@example.invalid', role: 'admin' }, { id: 'alice', email: 'alice@example.invalid', role: 'user' }, { id: 'bob', email: 'bob@example.invalid', role: 'user' }], projects: [{ id: 'a', ownerUid: 'alice', name: 'A', data: { secret: true } }, { id: 'b', ownerUid: 'bob', name: 'B' }, { id: 'legacy' }], clicks: {}, aiSettings: {} }));
  const store = new AtomicJsonStore(file, { validate: isApplicationDb }); const db: any = scopedDocument(store); const app = express();
  app.use(express.json()); app.use(persistenceContext);
  // Controlled test identities, never used by the production application.
  app.use((req: any, _res, next) => { const id = req.headers['x-fixture-identity']; if (['admin', 'alice', 'bob'].includes(id as string)) req.user = { uid: id, role: id === 'admin' ? 'admin' : 'user' }; next(); });
  registerOfficeRoutes(app, { db, saveDb: value => { if (options.saveFailure) throw new Error('fixture failure'); commitDocument(store, value); }, allowSimulation: options.simulate, now: () => new Date('2026-10-27T12:00:00Z') });
  app.use(persistenceErrorHandler); app.use((_error: any, _req: any, res: any, _next: any) => res.status(503).json({ error: 'Persistence unavailable' }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (method: string, endpoint: string, identity = 'admin', body?: any) => {
    const response = await fetch(url + '/api/office' + endpoint, { method, headers: { 'content-type': 'application/json', 'x-fixture-identity': identity }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: response.status, headers: response.headers, body: response.headers.get('content-type')?.startsWith('application/json') ? await response.json() as any : await response.text() };
  };
  return { request, file, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
const client = (ownerUid = 'alice') => ({ ownerUid, name: 'Fictitious Owner', businessName: 'Fixture Company', email: `${ownerUid}@example.invalid`, plan: 'starter', expiresOn: '2026-11-01' });

test('client list paginates and searches only authorized records with strict query validation', async () => {
  const f = await fixture(); try {
    await f.request('POST', '/clients', 'admin', { ...client(), name: 'Alice One' });
    await f.request('POST', '/clients', 'admin', { ...client(), name: 'Alice Two', plan: 'business' });
    await f.request('POST', '/clients', 'admin', { ...client('bob'), name: 'Bob Private' });
    const first = await f.request('GET', '/clients?page=1&limit=1', 'alice');
    const second = await f.request('GET', '/clients?page=2&limit=1', 'alice');
    assert.equal(first.status, 200); assert.equal(first.body.total, 2); assert.equal(first.body.clients.length, 1); assert.notEqual(first.body.clients[0].id, second.body.clients[0].id);
    assert.equal((await f.request('GET', '/clients?q=Bob', 'alice')).body.total, 0);
    assert.equal((await f.request('GET', '/clients?q=alice&plan=business', 'alice')).body.total, 1);
    assert.equal((await f.request('GET', '/clients?q=', 'alice')).body.total, 2);
    assert.equal((await f.request('GET', '/clients', 'admin')).body.total, 3);
    for (const query of ['?page=0', '?page=1.5', '?limit=101', '?limit=-1', '?q=a&q=b', '?archived=no', '?plan=invented']) assert.equal((await f.request('GET', '/clients' + query, 'alice')).status, 400);
  } finally { await f.close(); }
});
test('client detail is owner-scoped, read-only and returns a non-persisted revision', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body; const before = fs.readFileSync(f.file, 'utf8');
    assert.equal((await f.request('GET', `/clients/${c.id}`, '')).status, 401);
    assert.equal((await f.request('GET', `/clients/${c.id}`, 'bob')).status, 404);
    const detail = await f.request('GET', `/clients/${c.id}`, 'alice'); assert.equal(detail.status, 200); assert.match(detail.body.client.revision, /^[a-f0-9]{64}$/);
    assert.equal(fs.readFileSync(f.file, 'utf8'), before); assert.equal(JSON.parse(before).office.clients[0].revision, undefined);
  } finally { await f.close(); }
});
test('administrative client update requires revision and rejects stale writes or reassignment without changing contract snapshots', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    const record = (await f.request('POST', '/contracts', 'alice', { clientId: c.id, title: 'Existing draft', text: 'Fictional text' })).body;
    const endpoint = `/clients/${c.id}`; const revision = (await f.request('GET', endpoint, 'alice')).body.client.revision;
    assert.equal((await f.request('PATCH', endpoint, 'alice', { expectedRevision: revision, name: 'Forbidden' })).status, 403);
    assert.equal((await f.request('PATCH', endpoint, 'admin', { name: 'Missing revision' })).status, 428);
    assert.equal((await f.request('PATCH', endpoint, 'admin', { expectedRevision: revision, ownerUid: 'bob' })).status, 400);
    const updated = await f.request('PATCH', endpoint, 'admin', { expectedRevision: revision, name: 'New Name', businessName: 'New Business', email: 'new@example.invalid' }); assert.equal(updated.status, 200); assert.equal(updated.body.client.ownerUid, 'alice'); assert.notEqual(updated.body.client.revision, revision);
    const before = fs.readFileSync(f.file, 'utf8');
    assert.equal((await f.request('PATCH', endpoint, 'admin', { expectedRevision: revision, name: 'Stale change' })).status, 409); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    const contract = (await f.request('GET', '', 'alice')).body.contracts.find((r: any) => r.id === record.id);
    assert.equal(contract.versions[0].clientSnapshot.name, c.name); assert.equal(contract.versions[0].sha256, record.versions[0].sha256);
  } finally { await f.close(); }
});
test('two simultaneous administrative updates with the same client revision produce one winner and one conflict', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    const endpoint = `/clients/${c.id}`; const revision = (await f.request('GET', endpoint)).body.client.revision;
    const results = await Promise.all([
      f.request('PATCH', endpoint, 'admin', { expectedRevision: revision, businessName: 'Concurrent One' }),
      f.request('PATCH', endpoint, 'admin', { expectedRevision: revision, businessName: 'Concurrent Two' }),
    ]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const persisted = JSON.parse(fs.readFileSync(f.file, 'utf8'));
    assert.equal(persisted.office.clients[0].businessName, results.find(r => r.status === 200)!.body.client.businessName);
    assert.equal(persisted.office.events.filter((e: any) => e.type === 'client.updated').length, 1);
  } finally { await f.close(); }
});
test('logical archiving preserves contracts and data, filters lists and prevents new drafts until restored', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    const record = (await f.request('POST', '/contracts', 'alice', { clientId: c.id, title: 'Preserved', text: 'Never delete' })).body;
    const endpoint = `/clients/${c.id}`; const revision = (await f.request('GET', endpoint, 'admin')).body.client.revision;
    const archive = await f.request('PATCH', endpoint, 'admin', { expectedRevision: revision, archived: true }); assert.equal(archive.status, 200);
    assert.equal((await f.request('GET', '/clients', 'alice')).body.total, 0);
    assert.equal((await f.request('GET', '/clients?archived=true', 'alice')).body.total, 1);
    assert.equal((await f.request('GET', '/clients?archived=all', 'alice')).body.total, 1);
    assert.equal((await f.request('GET', '', 'alice')).body.clients.length, 1);
    assert.equal((await f.request('GET', `/contracts/${record.id}/document?version=1`, 'alice')).body, 'Never delete');
    assert.equal((await f.request('POST', '/contracts', 'alice', { clientId: c.id, title: 'Forbidden', text: 'Archived' })).status, 409);
    assert.equal((await f.request('PATCH', endpoint, 'admin', { expectedRevision: archive.body.client.revision, archived: false })).status, 200);
    assert.equal(JSON.parse(fs.readFileSync(f.file, 'utf8')).office.contracts.length, 1);
  } finally { await f.close(); }
});
test('subscription accepts revision precondition and cannot overwrite a newer client update', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    const endpoint = `/clients/${c.id}`; const original = (await f.request('GET', endpoint)).body.client;
    const updated = await f.request('PATCH', endpoint, 'admin', { expectedRevision: original.revision, businessName: 'Updated fixture business' }); assert.equal(updated.status, 200);
    const before = fs.readFileSync(f.file, 'utf8');
    assert.equal((await f.request('PATCH', endpoint + '/subscription', 'admin', { expectedRevision: original.revision, plan: 'business', canceled: false })).status, 409); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    assert.equal((await f.request('PATCH', endpoint + '/subscription', 'admin', { expectedRevision: updated.body.client.revision, plan: 'business', canceled: false })).status, 200);
    assert.equal((await f.request('GET', endpoint)).body.client.businessName, 'Updated fixture business');
  } finally { await f.close(); }
});
test('contract can bind only to an explicitly linked project owned by the same client', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    const payload = { clientId: c.id, title: 'Linked contract', text: 'Scope fixture', projectId: 'a', serviceType: 'Site institucional' };
    assert.equal((await f.request('POST', '/contracts', 'alice', payload)).status, 404);
    await f.request('POST', `/clients/${c.id}/sites`, 'admin', { projectId: 'a' });
    const created = await f.request('POST', '/contracts', 'alice', payload); assert.equal(created.status, 201); assert.equal(created.body.projectId, 'a'); assert.equal(created.body.serviceType, 'Site institucional');
    assert.equal((await f.request('POST', '/contracts', 'alice', { ...payload, projectId: 'b' })).status, 404);
    assert.equal((await f.request('POST', '/contracts', 'bob', payload)).status, 404);
  } finally { await f.close(); }
});
test('contract expectedVersion rejects stale concurrent intent and preserves every previous version', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    const record = (await f.request('POST', '/contracts', 'alice', { clientId: c.id, title: 'Version fixture', text: 'First' })).body;
    const endpoint = `/contracts/${record.id}/versions`;
    assert.equal((await f.request('POST', endpoint, 'alice', { expectedVersion: 1, text: 'Second' })).status, 201);
    const before = fs.readFileSync(f.file, 'utf8');
    assert.equal((await f.request('POST', endpoint, 'alice', { expectedVersion: 1, text: 'Stale intent' })).status, 409); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    assert.equal((await f.request('POST', endpoint, 'alice', { expectedVersion: '2', text: 'Invalid' })).status, 400);
    const appended = await f.request('POST', endpoint, 'alice', { text: 'Legacy append remains compatible' }); assert.equal(appended.status, 201); assert.equal(appended.body.versions.length, 3); assert.equal(appended.body.versions[0].text, 'First'); assert.equal(appended.body.versions[1].text, 'Second');
  } finally { await f.close(); }
});
test('corrupt duplicate client identities or orphan records fail closed without rewriting data', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body; const original = fs.readFileSync(f.file, 'utf8');
    for (const mutate of [(db: any) => db.office.clients.push({ ...c, ownerUid: 'bob' }), (db: any) => db.office.events.push({ id: 'orphan', clientId: 'missing-client' })]) {
      const data = JSON.parse(original); mutate(data); fs.writeFileSync(f.file, JSON.stringify(data)); const corrupt = fs.readFileSync(f.file, 'utf8');
      assert.equal((await f.request('GET', '', 'alice')).status, 503); assert.equal(fs.readFileSync(f.file, 'utf8'), corrupt);
    }
    fs.writeFileSync(f.file, original); assert.equal((await f.request('GET', '', 'alice')).status, 200);
  } finally { await f.close(); }
});
test('office expiration states include due day, future, expired and cancellation', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  assert.equal(expirationState('2026-10-26', false, now), 'expired'); assert.equal(expirationState('2026-10-27', false, now), 'expiring'); assert.equal(expirationState('2026-11-03', false, now), 'expiring'); assert.equal(expirationState('2026-11-04', false, now), 'active'); assert.equal(expirationState(null, false, now), 'no_expiration'); assert.equal(expirationState(null, true, now), 'canceled');
});
test('office read is non-mutating, denies anonymous and restricts administrative creation', async () => {
  const f = await fixture(); try {
    const original = fs.readFileSync(f.file, 'utf8');
    assert.equal((await f.request('GET', '', '')).status, 401); assert.equal((await f.request('GET', '', 'alice')).status, 200);
    assert.equal(fs.readFileSync(f.file, 'utf8'), original);
    assert.equal((await f.request('POST', '/clients', 'alice', client())).status, 403);
    assert.equal((await f.request('POST', '/clients', 'admin', client('missing'))).status, 400);
    assert.equal(fs.readFileSync(f.file, 'utf8'), original);
  } finally { await f.close(); }
});
test('tenant isolation covers clients, contracts, events, metadata and foreign mutation', async () => {
  const f = await fixture(); try {
    const a = (await f.request('POST', '/clients', 'admin', client())).body;
    const b = (await f.request('POST', '/clients', 'admin', client('bob'))).body;
    assert.equal((await f.request('POST', `/clients/${a.id}/sites`, 'admin', { projectId: 'a' })).status, 201);
    assert.equal((await f.request('POST', '/contracts', 'alice', { clientId: b.id, title: 'Invalid', text: 'Foreign' })).status, 404);
    const created = await f.request('POST', '/contracts', 'alice', { clientId: a.id, title: 'Fixture contract', text: 'Fixture obligations' }); assert.equal(created.status, 201);
    assert.equal((await f.request('POST', `/contracts/${created.body.id}/versions`, 'bob', { text: 'Intrusion' })).status, 404);
    const view = (await f.request('GET', '', 'alice')).body;
    assert.equal(view.clients.length, 1); assert.equal(view.contracts.length, 1); assert.ok(view.history.every((e: any) => e.clientId === a.id));
    assert.deepEqual(view.sites.map((s: any) => s.id), ['a']); assert.equal('data' in view.sites[0], false);
    assert.equal((await f.request('PATCH', `/clients/${a.id}/subscription`, 'alice', { plan: 'business', canceled: false })).status, 403);
  } finally { await f.close(); }
});
test('site association is explicit, administrative, owner-verified and idempotent without legacy claims', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    const other = (await f.request('POST', '/clients', 'admin', client())).body;
    assert.deepEqual((await f.request('GET', '', 'alice')).body.sites, []);
    const endpoint = `/clients/${c.id}/sites`;
    assert.equal((await f.request('POST', endpoint, 'alice', { projectId: 'a' })).status, 403);
    assert.equal((await f.request('POST', endpoint, 'admin', { projectId: 'b' })).status, 404);
    assert.equal((await f.request('POST', endpoint, 'admin', { projectId: 'legacy' })).status, 404);
    assert.equal((await f.request('POST', endpoint, 'admin', { projectId: 'a' })).status, 201);
    const before = fs.readFileSync(f.file, 'utf8'); assert.equal((await f.request('POST', endpoint, 'admin', { projectId: 'a' })).status, 200); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    assert.equal((await f.request('POST', `/clients/${other.id}/sites`, 'admin', { projectId: 'a' })).status, 409);
    const view = (await f.request('GET', '', 'alice')).body; assert.equal(view.sites.length, 1); assert.equal(view.sites[0].clientId, c.id); assert.equal(view.sites[0].id, 'a');
    assert.deepEqual((await f.request('GET', '', 'bob')).body.sites, []);
    const changed = JSON.parse(fs.readFileSync(f.file, 'utf8')); changed.projects[0].ownerUid = 'bob'; fs.writeFileSync(f.file, JSON.stringify(changed));
    assert.deepEqual((await f.request('GET', '', 'alice')).body.sites, []);
  } finally { await f.close(); }
});
test('document download requires ownership and explicit version, preserves old bytes and uses safe attachment headers', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    const originalText = '<script>alert("fixture")</script>\nCláusula fictícia';
    const record = (await f.request('POST', '/contracts', 'alice', { clientId: c.id, title: 'Fixture document', text: originalText })).body;
    const endpoint = `/contracts/${record.id}/document`;
    assert.equal((await f.request('GET', endpoint + '?version=1', '')).status, 401);
    assert.equal((await f.request('GET', endpoint + '?version=1', 'bob')).status, 404);
    for (const query of ['', '?version=0', '?version=-1', '?version=1.5', '?version=1&version=2', '?version=9007199254740992']) assert.equal((await f.request('GET', endpoint + query, 'alice')).status, 400);
    assert.equal((await f.request('GET', endpoint + '?version=99', 'alice')).status, 404);
    await f.request('POST', `/contracts/${record.id}/versions`, 'alice', { text: 'New version' });
    const before = fs.readFileSync(f.file, 'utf8'); const result = await f.request('GET', endpoint + '?version=1', 'alice');
    assert.equal(result.status, 200); assert.equal(result.body, originalText); assert.equal(result.headers.get('content-type'), 'text/plain; charset=utf-8'); assert.equal(result.headers.get('x-content-type-options'), 'nosniff'); assert.equal(result.headers.get('content-disposition'), 'attachment; filename="contrato-v1.txt"'); assert.equal(result.headers.get('cache-control'), 'private, no-store'); assert.equal(result.headers.get('x-g360-version-sha256'), record.versions[0].sha256); assert.equal(result.headers.get('x-content-sha256'), createHash('sha256').update(Buffer.from(originalText)).digest('hex'));
    assert.equal((await f.request('GET', endpoint + '?version=2', 'admin')).body, 'New version'); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  } finally { await f.close(); }
});
test('contract versions, review and explicit hash approval freeze reviewed content; delivery stays blocked', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    let record = (await f.request('POST', '/contracts', 'alice', { clientId: c.id, title: 'Agreement fixture', text: 'First' })).body;
    assert.equal((await f.request('POST', `/contracts/${record.id}/signature-request`, 'admin', { sha256: record.versions[0].sha256 })).status, 409);
    record = (await f.request('POST', `/contracts/${record.id}/versions`, 'alice', { text: 'Second' })).body;
    assert.equal(record.versions[0].text, 'First'); assert.equal(record.versions[1].number, 2);
    const expected = createHash('sha256').update(JSON.stringify({ text: 'Second', clientSnapshot: record.versions[1].clientSnapshot })).digest('hex'); assert.equal(record.versions[1].sha256, expected);
    assert.equal((await f.request('POST', `/contracts/${record.id}/review`, 'alice')).status, 200);
    assert.equal((await f.request('POST', `/contracts/${record.id}/approve`, 'alice', { sha256: expected })).status, 403);
    assert.equal((await f.request('POST', `/contracts/${record.id}/approve`, 'admin', { sha256: 'wrong' })).status, 409);
    assert.equal((await f.request('POST', `/contracts/${record.id}/approve`, 'admin', { sha256: expected })).status, 200);
    assert.equal((await f.request('POST', `/contracts/${record.id}/versions`, 'alice', { text: 'Replacement' })).status, 409);
    const queued = await f.request('POST', `/contracts/${record.id}/signature-request`, 'admin', { sha256: expected }); assert.equal(queued.status, 202); assert.equal(queued.body.delivered, false); assert.equal(queued.body.contract.status, 'awaiting_provider');
    const before = fs.readFileSync(f.file, 'utf8'); assert.equal((await f.request('POST', `/contracts/${record.id}/signature-request`, 'admin')).status, 200); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    assert.equal((await f.request('POST', `/contracts/${record.id}/simulate-signature`, 'admin')).status, 403);
  } finally { await f.close(); }
});
test('simulation needs test environment plus opt-in; evidence explicitly has no legal signature', async () => {
  const beforeEnv = process.env.NODE_ENV; process.env.NODE_ENV = 'test'; const f = await fixture({ simulate: true });
  try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    const r = (await f.request('POST', '/contracts', 'alice', { clientId: c.id, title: 'Simulation', text: 'Fictional' })).body;
    await f.request('POST', `/contracts/${r.id}/review`, 'alice'); await f.request('POST', `/contracts/${r.id}/approve`, 'admin', { sha256: r.versions[0].sha256 }); await f.request('POST', `/contracts/${r.id}/signature-request`, 'admin', { sha256: r.versions[0].sha256 });
    process.env.NODE_ENV = 'production'; assert.equal((await f.request('POST', `/contracts/${r.id}/simulate-signature`, 'admin')).status, 403);
    process.env.NODE_ENV = 'test'; assert.equal((await f.request('POST', `/contracts/${r.id}/simulate-signature`, 'alice')).status, 403);
    const signed = await f.request('POST', `/contracts/${r.id}/simulate-signature`, 'admin'); assert.equal(signed.status, 200); assert.equal(signed.body.status, 'simulated_signed'); assert.equal(signed.body.evidence.legalSignature, false); assert.equal(signed.body.evidence.sha256, r.versions[0].sha256);
  } finally { if (beforeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = beforeEnv; await f.close(); }
});
test('contract cancellation is administrative, idempotent and retains content and history', async () => {
  const f = await fixture(); try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    const record = (await f.request('POST', '/contracts', 'alice', { clientId: c.id, title: 'Cancelable fixture', text: 'Preserved obligations' })).body;
    assert.equal((await f.request('POST', `/contracts/${record.id}/cancel`, 'alice')).status, 403);
    const canceled = await f.request('POST', `/contracts/${record.id}/cancel`, 'admin'); assert.equal(canceled.status, 200); assert.equal(canceled.body.status, 'canceled'); assert.deepEqual(canceled.body.versions, record.versions);
    const before = fs.readFileSync(f.file, 'utf8'); assert.equal((await f.request('POST', `/contracts/${record.id}/cancel`, 'admin')).status, 200); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    assert.equal((await f.request('POST', `/contracts/${record.id}/review`, 'alice')).status, 409);
  } finally { await f.close(); }
});
test('financial fixtures are idempotent, tenant isolated and validate payment transition ordering', async () => {
  const beforeEnv = process.env.NODE_ENV; process.env.NODE_ENV = 'test'; const f = await fixture({ simulate: true });
  try {
    const c = (await f.request('POST', '/clients', 'admin', client())).body;
    const payload = { clientId: c.id, amountCents: 12345, dueOn: '2026-10-26', reference: 'fixture-unique' };
    const first = await f.request('POST', '/financial/simulate', 'admin', payload); assert.equal(first.status, 201);
    const before = fs.readFileSync(f.file, 'utf8'); const second = await f.request('POST', '/financial/simulate', 'admin', payload); assert.equal(second.body.id, first.body.id); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    assert.equal((await f.request('POST', '/financial/simulate', 'admin', { ...payload, amountCents: 1 })).status, 409);
    assert.equal((await f.request('GET', '', 'bob')).body.financial.length, 0); assert.equal((await f.request('GET', '', 'alice')).body.financial[0].state, 'overdue');
    const endpoint = `/financial/${first.body.id}/simulate-status`;
    assert.equal((await f.request('POST', endpoint, 'admin', { status: 'refunded' })).status, 409);
    assert.equal((await f.request('POST', endpoint, 'alice', { status: 'confirmed' })).status, 403);
    assert.equal((await f.request('POST', endpoint, 'admin', { status: 'confirmed' })).status, 200);
    assert.equal((await f.request('POST', endpoint, 'admin', { status: 'refunded' })).status, 200);
    assert.equal((await f.request('POST', endpoint, 'admin', { status: 'confirmed' })).status, 409);
  } finally { if (beforeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = beforeEnv; await f.close(); }
});
test('invalid dates, plans and body fields never persist; malformed office never gets replaced', async () => {
  const f = await fixture(); try {
    const before = fs.readFileSync(f.file, 'utf8');
    for (const patch of [{ expiresOn: '2026-02-30' }, { expiresOn: 'tomorrow' }, { plan: 'admin' }, { name: '' }, { ownerUid: {} }]) assert.equal((await f.request('POST', '/clients', 'admin', { ...client(), ...patch })).status, 400);
    assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    const corrupted = JSON.parse(before); corrupted.office = { version: 99, clients: [] }; fs.writeFileSync(f.file, JSON.stringify(corrupted)); const malformed = fs.readFileSync(f.file, 'utf8');
    assert.equal((await f.request('GET', '', 'admin')).status, 503); assert.equal((await f.request('POST', '/clients', 'admin', client())).status, 503); assert.equal(fs.readFileSync(f.file, 'utf8'), malformed);
  } finally { await f.close(); }
});
test('failed save cannot return successful office creation or mutate stored data', async () => {
  const f = await fixture({ saveFailure: true }); try {
    const before = fs.readFileSync(f.file, 'utf8'); assert.equal((await f.request('POST', '/clients', 'admin', client())).status, 503); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    assert.equal((await f.request('GET', '', 'admin')).body.clients.length, 0);
  } finally { await f.close(); }
});
