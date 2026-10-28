import test from 'node:test';
import assert from 'node:assert/strict';
import { ExternalAccessError, ExternalAccessPolicy, guardSdkClient, providerFetch } from './externalAccess.ts';

const time = Date.parse('2026-10-28T12:00:00.000Z');
const grant = (changes: Record<string, unknown> = {}) => ({ id: 'fixture-grant', provider: 'gemini', cost: 'free_verified', evidenceRef: 'fictional-proof-for-tests-only', issuedAt: new Date(time).toISOString(), expiresAt: new Date(time + 60000).toISOString(), maxCallsPerProcess: 3, ...changes });
const policy = (grants: unknown, now = () => time) => new ExternalAccessPolicy({ readGrants: () => JSON.stringify(grants), now });
const denied = (error: any) => error instanceof ExternalAccessError && error.status === 403;

test('missing, malformed or paid grants never authorize a provider from a key or strict-free flag', () => {
  const cases = [undefined, '', '{invalid', JSON.stringify({ GEMINI_API_KEY: 'fictional', strictFreeMode: true }), JSON.stringify([grant({ cost: 'paid' })]), JSON.stringify([grant({ evidenceRef: '' })])];
  for (const raw of cases) {
    const p = new ExternalAccessPolicy({ readGrants: () => raw, now: () => time });
    assert.equal(p.allowed('gemini'), false); assert.throws(() => p.reserve('gemini'), denied);
  }
});
test('invalid, duplicate, unknown, excessive and future/expired grants fail closed', () => {
  const invalid = [
    [grant({ provider: 'unknown' })], [grant({ unknownField: true })], [grant({ maxCallsPerProcess: 0 })], [grant({ maxCallsPerProcess: 1001 })], [grant({ maxCallsPerProcess: 1.5 })],
    [grant(), grant()], [grant({ id: '__' })], [grant({ issuedAt: 'broken' })], [grant({ expiresAt: new Date(time + 3600001).toISOString() })],
    [grant({ expiresAt: new Date(time).toISOString() })], [grant({ issuedAt: new Date(time + 1).toISOString() })],
  ];
  for (const grants of invalid) assert.throws(() => policy(grants).reserve('gemini'), denied);
});
test('reserve enforces quota before concurrent operations and does not claim a known balance', async () => {
  const p = policy([grant({ maxCallsPerProcess: 1 })]); let executed = 0;
  const client = guardSdkClient('gemini', { models: { async generateContent() { executed++; await Promise.resolve(); return 'fixture'; } } }, p);
  const results = await Promise.allSettled([Promise.resolve().then(() => client.models.generateContent()), Promise.resolve().then(() => client.models.generateContent())]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(executed, 1);
  assert.equal(p.status('gemini').balance, null); assert.equal(p.status('gemini').paidUseAuthorized, false);
});
test('SDK guard checks each call at invocation, preserves receiver and denies after expiry', async () => {
  let now = time; let calls = 0;
  const p = policy([grant()], () => now);
  const client = guardSdkClient('gemini', { models: { value: 'fixture', async generateContent() { calls++; return this.value; } } }, p);
  const method = client.models.generateContent;
  assert.equal(await method(), 'fixture'); now += 60000;
  assert.throws(() => method(), denied); assert.equal(calls, 1);
});
test('failed SDK invocation remains charged to local safety quota, never automatic retry', async () => {
  const p = policy([grant({ maxCallsPerProcess: 1 })]); let calls = 0;
  const client = guardSdkClient('gemini', { models: { async generateContent() { calls++; throw Error('Fictional failure'); } } }, p);
  await assert.rejects(client.models.generateContent());
  assert.throws(() => client.models.generateContent(), (error: any) => error.status === 429); assert.equal(calls, 1);
});
test('HTTP transport is never invoked without matching grant or for an unrecognized target/method', async () => {
  let calls = 0; const transport: typeof fetch = async () => { calls++; return new Response('{}'); };
  const p = policy([grant({ provider: 'groq' })]);
  for (const url of ['http://api.groq.com/openai/v1/chat/completions', 'https://127.0.0.1/openai/v1/chat/completions', 'https://api.groq.com.attacker.invalid/openai/v1/chat/completions', 'https://user:pass@api.groq.com/openai/v1/chat/completions', 'https://api.groq.com:444/openai/v1/chat/completions', 'https://api.groq.com/unknown', 'https://api.groq.com/openai/v1/chat/completions#fragment']) {
    await assert.rejects(providerFetch(url, { method: 'POST' }, p, transport), denied);
  }
  await assert.rejects(providerFetch('https://api.groq.com/openai/v1/chat/completions', {}, p, transport), denied);
  await assert.rejects(providerFetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST' }, policy([]), transport), denied);
  assert.equal(calls, 0);
});
test('fixed allowed HTTP destination uses forced redirect rejection and no response-secret logging', async () => {
  const p = policy([grant({ provider: 'groq' })]); let calls = 0;
  const transport: typeof fetch = async (input, init) => {
    calls++; assert.equal(String(input), 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(init!.redirect, 'error'); assert.ok(init!.signal); assert.equal(init!.method, 'POST');
    return new Response('{"fixture":true}', { headers: { 'content-type': 'application/json' } });
  };
  const response = await providerFetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', redirect: 'follow' }, p, transport);
  assert.deepEqual(await response.json(), { fixture: true }); assert.equal(calls, 1);
});
test('redirect, huge responses and transport errors fail with sanitized errors and no fallback', async () => {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  for (const transport of [
    async () => new Response('', { status: 302, headers: { Location: 'http://169.254.169.254/' } }),
    async () => new Response('', { headers: { 'content-length': String(2 * 1024 * 1024 + 1) } }),
    async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1)),
    async () => { throw Error('fictional-sensitive-key'); },
  ]) {
    let calls = 0;
    await assert.rejects(providerFetch(url, { method: 'POST' }, policy([grant({ provider: 'groq' })]), async () => { calls++; return transport(); }), (error: any) => {
      assert.equal(error.status, 502); assert.equal(error.message.includes('fictional-sensitive-key'), false); return true;
    });
    assert.equal(calls, 1);
  }
});
test('absolute timeout covers a stalled transport and a stalled body; caller cancellation avoids dispatch', async () => {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const p = () => policy([grant({ provider: 'groq' })]);
  await assert.rejects(providerFetch(url, { method: 'POST' }, p(), async () => new Promise(() => {}), { timeoutMs: 20 }), (error: any) => error.status === 502);
  let canceled = false;
  await assert.rejects(providerFetch(url, { method: 'POST' }, p(), async () => new Response(new ReadableStream({ cancel() { canceled = true; } })), { timeoutMs: 20 }), (error: any) => error.status === 502);
  assert.equal(canceled, true);
  let calls = 0; const controller = new AbortController(); controller.abort();
  await assert.rejects(providerFetch(url, { method: 'POST', signal: controller.signal }, p(), async () => { calls++; return new Response('{}'); }));
  assert.equal(calls, 0);
});
test('installed Gemini SDK is intercepted before its real generateContent method can dispatch', async () => {
  const { GoogleGenAI } = await import('@google/genai');
  const client = guardSdkClient('gemini', new GoogleGenAI({ apiKey: 'fictional-not-a-real-key', httpOptions: { timeout: 100, retryOptions: { attempts: 1 } } }), policy([]));
  // A synchronous policy exception proves the real SDK method was never entered;
  // it cannot create a network request or consume a provider key.
  assert.throws(() => client.models.generateContent({ model: 'fictional-model', contents: 'Fictional fixture' }), denied);
});
