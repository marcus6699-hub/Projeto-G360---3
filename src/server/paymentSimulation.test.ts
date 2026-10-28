import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PaymentSimulation, PaymentSimulationError } from './paymentSimulation.ts';

const secret = 'fictional-test-secret-never-a-real-credential';
const now = 1793102400000;
function event(body: any, timestamp = String(now / 1000)) {
  const rawBody = Buffer.from(JSON.stringify(body));
  return { rawBody, timestamp, signature: createHmac('sha256', secret).update(timestamp).update('.').update(rawBody).digest('hex') };
}
function inTest(fn: () => void) { const old = process.env.NODE_ENV; process.env.NODE_ENV = 'test'; try { fn(); } finally { if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old; } }
test('payment harness refuses production and short secrets', () => inTest(() => {
  assert.throws(() => new PaymentSimulation({ enabled: true, secret: 'short' }), PaymentSimulationError);
  const sim = new PaymentSimulation({ enabled: true, secret }); process.env.NODE_ENV = 'production';
  assert.throws(() => new PaymentSimulation({ enabled: true, secret }), PaymentSimulationError); assert.throws(() => sim.create('fixture', 100), PaymentSimulationError);
}));
test('simulated charges and exact webhook replays are idempotent', () => inTest(() => {
  const sim = new PaymentSimulation({ enabled: true, secret, now: () => now });
  assert.equal(sim.create('invoice', 100).state, 'pending'); assert.deepEqual(sim.create('invoice', 100), { id: 'invoice', amountCents: 100, state: 'pending' }); assert.throws(() => sim.create('invoice', 200));
  const e = event({ id: 'e1', invoiceId: 'invoice', amountCents: 100, state: 'confirmed' });
  assert.deepEqual(sim.receive(e), { duplicate: false, state: 'confirmed', mode: 'simulation' }); assert.deepEqual(sim.receive(e), { duplicate: true, state: 'confirmed', mode: 'simulation' });
  assert.throws(() => sim.receive(event({ id: 'e1', invoiceId: 'invoice', amountCents: 100, state: 'refunded' })), PaymentSimulationError);
}));
test('HMAC verifies exact raw body and enforces time, size and amount checks', () => inTest(() => {
  const sim = new PaymentSimulation({ enabled: true, secret, now: () => now }); sim.create('invoice', 100);
  const body = { id: 'e1', invoiceId: 'invoice', amountCents: 100, state: 'confirmed' }; const signed = event(body);
  assert.throws(() => sim.receive({ ...signed, signature: '0'.repeat(64) }));
  assert.throws(() => sim.receive({ ...signed, rawBody: Buffer.from(JSON.stringify(body) + ' ') }));
  assert.throws(() => sim.receive(event(body, String(now / 1000 - 301)))); assert.throws(() => sim.receive(event(body, String(now / 1000 + 301))));
  assert.throws(() => sim.receive(event({ ...body, extra: 'x'.repeat(16384) })));
  assert.throws(() => sim.receive(event({ ...body, amountCents: 101 })));
  assert.throws(() => sim.receive(event({ ...body, invoiceId: 'unknown' })));
  assert.equal(sim.receive(signed).state, 'confirmed');
}));
test('state ordering blocks false refunds and reversal after final states', () => inTest(() => {
  const sim = new PaymentSimulation({ enabled: true, secret, now: () => now }); sim.create('invoice', 100);
  const e = (id: string, state: string) => event({ id, invoiceId: 'invoice', amountCents: 100, state });
  assert.throws(() => sim.receive(e('bad', 'refunded'))); assert.equal(sim.receive(e('1', 'overdue')).state, 'overdue'); assert.equal(sim.receive(e('2', 'confirmed')).state, 'confirmed'); assert.throws(() => sim.receive(e('bad2', 'pending'))); assert.equal(sim.receive(e('3', 'refunded')).state, 'refunded'); assert.throws(() => sim.receive(e('bad3', 'confirmed')));
  sim.create('canceled', 100); assert.equal(sim.receive(event({ id: '4', invoiceId: 'canceled', amountCents: 100, state: 'canceled' })).state, 'canceled'); assert.throws(() => sim.receive(event({ id: '5', invoiceId: 'canceled', amountCents: 100, state: 'confirmed' })));
}));
