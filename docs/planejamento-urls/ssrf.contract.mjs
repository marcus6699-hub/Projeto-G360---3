// API regression contract using simulated DNS/transport and fictional data.
// Run ONLY in a disposable project copy containing the fixture described below.
import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (process.env.G360_URL_PLAN_FIXTURE !== '1' || !root.startsWith('/tmp/') || process.cwd() !== root) {
  throw Error('Execute somente em cópia fictícia em /tmp.');
}
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'db.json'), 'utf8'));
assert.equal(fixture.securityPlanFixture, true);
assert.equal(fixture.users[0].id, 'url-fixture-admin');
process.env.NODE_ENV = 'test';
// Never allow a configured provider credential into this diagnostic.
for (const name of Object.keys(process.env)) {
  if (/API_KEY$|^(VERCEL|NETLIFY)_TOKEN$/.test(name)) delete process.env[name];
}
const calls = [];
let simulateRedirect = false;
const originalFetch = globalThis.fetch;
// Catch every alternative provider call as well as the safe transport requests.
globalThis.fetch = async input => { calls.push(`FALLBACK:${input}`); throw Error('External fallback forbidden in fixture'); };
const { publicUrlClient } = await import('../../src/server/publicUrl.ts');
let unsafeDns = false;
let legitimateMaps = false;
mock.method(publicUrlClient, 'resolve', async () => unsafeDns
  ? [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]
  : [{ address: '93.184.216.34', family: 4 }]);
mock.method(publicUrlClient, 'request', async target => {
  const url = target.url.href; calls.push(url);
  if (legitimateMaps && url === 'https://maps.app.goo.gl/fixture') return { status: 302, headers: { location: `https://www.google.com/maps/place/${encodeURIComponent(DEMO_BUSINESSES[0].name)}` }, body: Readable.from([]) };
  if (simulateRedirect && (url === 'https://public-fixture.invalid/redirect' || url === 'https://maps.app.goo.gl/fixture')) {
    return { status: 302, headers: { location: 'https://169.254.169.254/fixture' }, body: Readable.from([]) };
  }
  return { status: 200, headers: { 'content-type': 'text/html' }, body: Readable.from(['<html><title>Fictional public site</title></html>']) };
});
const { app, DEMO_BUSINESSES } = await import('../../server.ts');
const { createLocalSession } = await import('../../src/middleware/auth.ts');
const cookie = `sxp_uid=${createLocalSession('url-fixture-admin')}`;
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
after(async () => { mock.restoreAll(); globalThis.fetch = originalFetch; await new Promise(resolve => server.close(resolve)); });

function post(route, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      res.resume(); res.once('end', () => resolve(res.statusCode));
    });
    req.on('error', reject); req.end(body);
  });
}

for (const route of ['/api/g360/website-audit', '/api/ai/clone-site']) {
  for (const url of ['http://127.0.0.1/fixture', 'http://10.0.0.1/fixture', 'http://169.254.169.254/fixture', 'http://[::1]/fixture']) {
    test(`${route}: reject ${url} before upstream access`, async () => {
      calls.length = 0;
      const status = await post(route, { url });
      assert.deepEqual(calls, [], 'blocked destination must never be fetched, including via fallback');
      assert.equal(status, 403);
    });
  }
  test(`${route}: reject redirect from public fixture to metadata`, async () => {
    calls.length = 0; simulateRedirect = true;
    try {
      const status = await post(route, { url: 'https://public-fixture.invalid/redirect' });
      assert.equal(calls.some(url => url.startsWith('http://169.254.169.254/')), false);
      assert.equal(status, 403);
    } finally { simulateRedirect = false; }
  });
}
test('business resolver: reject internal query URL before network/fallback', async () => {
  calls.length = 0;
  const status = await post('/api/g360/audit', { query: 'http://127.0.0.1/fixture' });
  assert.deepEqual(calls, []);
  assert.equal(status, 403);
});
test('public website audit stays available (simulated transport, no DNS)', async () => {
  calls.length = 0;
  assert.equal(await post('/api/g360/website-audit', { url: 'https://public-fixture.invalid/' }), 200);
  assert.ok(calls.includes('https://public-fixture.invalid/'));
});

test('clone: rawHtml does not bypass URL policy or trigger AI', async () => {
  calls.length = 0;
  assert.equal(await post('/api/ai/clone-site', { url: 'http://127.0.0.1/', rawHtml: '<h1>Fixture</h1>' }), 403);
  assert.deepEqual(calls, []);
});
test('public clone and rawHtml-only clone stay available', async () => {
  calls.length = 0;
  assert.equal(await post('/api/ai/clone-site', { url: 'https://public-fixture.invalid/' }), 200);
  assert.equal(await post('/api/ai/clone-site', { rawHtml: '<h1>Fixture</h1>' }), 200);
  assert.deepEqual(calls, ['https://public-fixture.invalid/']);
});
test('mixed public/private DNS blocks before transport or fallback', async () => {
  calls.length = 0; unsafeDns = true;
  try { assert.equal(await post('/api/g360/website-audit', { url: 'https://public-fixture.invalid/' }), 403); assert.deepEqual(calls, []); }
  finally { unsafeDns = false; }
});
test('blocked Maps redirect never reaches a provider', async () => {
  calls.length = 0; simulateRedirect = true;
  try { assert.equal(await post('/api/g360/audit', { query: 'https://maps.app.goo.gl/fixture' }), 403); assert.deepEqual(calls, ['https://maps.app.goo.gl/fixture']); }
  finally { simulateRedirect = false; }
});
test('engine diagnostics also rejects a private URL without AI fallback', async () => {
  calls.length = 0;
  assert.equal(await post('/api/g360/test-engines', { sampleQuery: 'http://127.0.0.1/' }), 403);
  assert.deepEqual(calls, []);
});
test('invalid scheme is blocked and malformed URL is handled', async () => {
  calls.length = 0;
  assert.equal(await post('/api/ai/clone-site', { url: 'file:///etc/hosts' }), 403);
  assert.equal(await post('/api/ai/clone-site', { url: 'https://[' }), 400);
  assert.deepEqual(calls, []);
});

test('recognized Maps short link resolves a business without provider fallback', async () => {
  calls.length = 0; legitimateMaps = true;
  try {
    assert.equal(await post('/api/g360/audit', { query: 'https://maps.app.goo.gl/fixture' }), 200);
    assert.equal(calls.length, 2);
    assert.ok(calls[1].startsWith('https://www.google.com/maps/place/'));
    assert.equal(calls.some(url => url.startsWith('FALLBACK:')), false);
  } finally { legitimateMaps = false; }
});
test('blocked clone does not reach AI even with a fictional configured key', async () => {
  calls.length = 0; process.env.GEMINI_API_KEY = 'fictional-ssrf-test-key';
  try { assert.equal(await post('/api/ai/clone-site', { url: 'http://169.254.169.254/fixture' }), 403); assert.deepEqual(calls, []); }
  finally { delete process.env.GEMINI_API_KEY; }
});
