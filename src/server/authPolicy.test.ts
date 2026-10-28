import test from 'node:test';
import assert from 'node:assert/strict';
import { trustedRequestOrigin, protectBrowserMutation, createAuthAttemptLimiter, validLoginInput, validRegistrationInput, accountIsActive } from './authPolicy.ts';

const request = (origin?: string, method = 'POST', remoteAddress = '192.0.2.10') => ({
  headers: origin === undefined ? {} : { origin }, method, protocol: 'https',
  socket: { remoteAddress }, get: (name: string) => name === 'host' ? 'app.example.invalid' : undefined,
} as any);
function run(middleware: any, req: any) {
  let status = 200, next = false;
  const headers: Record<string, string> = {};
  const res = { status(code: number) { status = code; return this; }, json() { return this; }, setHeader(name: string, value: string) { headers[name] = value; } };
  middleware(req, res, () => { next = true; });
  return { status, next, headers };
}

test('browser origins permit same origin and explicitly configured origin', () => {
  assert.equal(trustedRequestOrigin(request('https://app.example.invalid')), true);
  assert.equal(trustedRequestOrigin(request('https://ui.example.invalid'), ['https://ui.example.invalid']), true);
});
test('browser origins reject null, untrusted, malformed and deceptive origins', () => {
  for (const origin of ['null', 'https://evil.invalid', 'https://app.example.invalid.evil.invalid', 'file:///', 'https://app.example.invalid/path', 'https://user@app.example.invalid']) {
    assert.equal(trustedRequestOrigin(request(origin)), false, origin);
  }
});
test('mutation guard accepts CLI without origin and safe reads, rejects cross-origin writes', () => {
  assert.equal(run(protectBrowserMutation(), request()).next, true);
  assert.equal(run(protectBrowserMutation(), request('https://evil.invalid', 'GET')).next, true);
  assert.equal(run(protectBrowserMutation(), request('https://evil.invalid')).status, 403);
});
test('authentication attempts are limited per socket, ignore forged proxy headers and recover after expiry', () => {
  let time = 0;
  const limiter = createAuthAttemptLimiter({ limit: 2, windowMs: 1000, now: () => time });
  assert.equal(run(limiter, request()).next, true);
  const spoof = request(); spoof.headers['x-forwarded-for'] = '198.51.100.2';
  assert.equal(run(limiter, spoof).next, true);
  assert.equal(run(limiter, spoof).status, 429);
  assert.equal(run(limiter, request(undefined, 'POST', '192.0.2.11')).next, true);
  time = 1000;
  assert.equal(run(limiter, request()).next, true);
});
test('limiter bounds memory and fails closed when saturated, recovers expired slots', () => {
  let time = 0;
  const limiter = createAuthAttemptLimiter({ maxClients: 1, windowMs: 1000, now: () => time });
  assert.equal(run(limiter, request()).next, true);
  assert.equal(run(limiter, request(undefined, 'POST', '192.0.2.20')).status, 429);
  time = 1001;
  assert.equal(run(limiter, request(undefined, 'POST', '192.0.2.20')).next, true);
});
test('authentication validates bounded input without invalidating existing short passwords', () => {
  assert.equal(validLoginInput('user@example.invalid', 'x'), true);
  assert.equal(validLoginInput('user@example.invalid', 'x'.repeat(1025)), false);
  assert.equal(validLoginInput('x'.repeat(255), 'x'), false);
  assert.equal(validLoginInput({}, []), false);
  assert.equal(validRegistrationInput('User', 'user@example.invalid', 'fixture-password'), true);
  assert.equal(validRegistrationInput('User', 'invalid', 'fixture-password'), false);
  assert.equal(validRegistrationInput('x'.repeat(121), 'user@example.invalid', 'x'), false);
});
test('missing historical status remains active, explicit disabled states are rejected', () => {
  assert.equal(accountIsActive({}), true);
  assert.equal(accountIsActive({ status: 'active' }), true);
  for (const status of ['disabled', 'suspended', 'cancelled', '', null]) assert.equal(accountIsActive({ status }), false);
  assert.equal(accountIsActive(null), false);
});
