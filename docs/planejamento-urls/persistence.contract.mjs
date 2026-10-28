import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (process.env.G360_URL_PLAN_FIXTURE !== '1' || !root.startsWith('/tmp/') || process.cwd() !== root) throw Error('Execute somente em cópia fictícia em /tmp.');
const file = path.join(root, 'db.json');
assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).securityPlanFixture, true);
process.env.NODE_ENV = 'test';
for (const name of Object.keys(process.env)) if (/API_KEY$|^(VERCEL|NETLIFY)_TOKEN$/.test(name)) delete process.env[name];
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw Error('No external service allowed in persistence tests'); };
const { app } = await import('../../server.ts');
const { createLocalSession } = await import('../../src/middleware/auth.ts');
const cookie = `sxp_uid=${createLocalSession('audit-admin')}`;
const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
after(async () => { mock.restoreAll(); globalThis.fetch = originalFetch; await new Promise(resolve => server.close(resolve)); });
function call(route, method = 'GET', payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : '';
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      const parts = []; res.on('data', chunk => parts.push(chunk)); res.once('end', () => resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(parts).toString()) })); res.on('error', reject);
    }); req.on('error', reject); req.end(body);
  });
}
test('G360 reads never seed demos or rewrite existing audit photos', async () => {
  const original = fs.readFileSync(file);
  try {
    const db = JSON.parse(original); delete db.g360;
    fs.writeFileSync(file, JSON.stringify(db)); const empty = fs.readFileSync(file);
    const response = await call('/api/g360/crm');
    assert.equal(response.status, 200); assert.deepEqual(response.data.leads, []); assert.deepEqual(fs.readFileSync(file), empty);
    db.g360 = { audits: [{ id: 'fixture-photo', business: { name: 'Fixture', photos: ['%malformed'] } }], crmLeads: [], packagesByBusiness: {} };
    fs.writeFileSync(file, JSON.stringify(db)); const before = fs.readFileSync(file);
    assert.equal((await call('/api/g360/audits')).status, 200); assert.deepEqual(fs.readFileSync(file), before);
  } finally { fs.writeFileSync(file, original); }
});
for (const [route, body] of [
  ['/api/projects', { name: 'Must not persist', data: {} }],
  ['/api/g360/gbp-package/generate', { business: { name: 'Fictional persistence company' } }],
  ['/api/g360/audit', { business: { name: 'Fixture no network', city: 'Fixture', category: 'Fixture' } }],
]) {
  test(`${route} returns persistence failure and preserves disk after IO error`, async () => {
    const original = fs.readFileSync(file); const open = fs.openSync;
    const patch = mock.method(fs, 'openSync', (target, ...args) => {
      if (String(target).startsWith(`${file}.tmp-`)) throw Object.assign(new Error('Fictional permission error'), { code: 'EACCES' });
      return open(target, ...args);
    });
    try {
      const response = await call(route, 'POST', body);
      assert.equal(response.status, 503); assert.equal(response.data.ok, false); assert.deepEqual(fs.readFileSync(file), original);
    } finally { patch.mock.restore(); }
    assert.equal((await call('/api/projects')).data.projects.some(project => project.name === 'Must not persist'), false);
  });
}
test('a corrupted/empty database during a request yields 503, never demo data or success', async () => {
  const original = fs.readFileSync(file);
  try {
    for (const invalid of ['', '{invalid']) {
      fs.writeFileSync(file, invalid);
      const response = await call('/api/projects'); assert.equal(response.status, 503);
      assert.equal(fs.readFileSync(file, 'utf8'), invalid);
    }
  } finally { fs.writeFileSync(file, original); }
  assert.equal((await call('/api/projects')).status, 200);
});

test('private data and recovery artifacts are never accessible via HTTP', async () => {
  for (const route of ['/db.json', '/db.json.g360-previous.json', '/cost-guard-metrics.json', `/@fs${file}?raw`, '/%2564b%252ejson']) {
    const status = await new Promise((resolve, reject) => {
      const req = http.get({ hostname: '127.0.0.1', port: server.address().port, path: route }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); req.on('error', reject);
    });
    assert.equal(status, 404);
  }
});
