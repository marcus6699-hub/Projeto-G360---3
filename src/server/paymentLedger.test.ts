import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { PaymentLedger } from './paymentLedger.ts';
import { PaymentSimulationError } from './paymentSimulation.ts';
import { JsonPersistenceError } from './jsonPersistence.mjs';

const secret = 'fixture-secret-for-local-ledger-not-a-real-credential';
const now = 1793102400000;
const input = { clientId: 'client-a', reference: 'reference-a', amountCents: 12500, currency: 'BRL' as const, dueOn: '2026-10-30' };
function fixture(io?: typeof fs) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-ledger-'));
  const file = path.join(directory, 'payment-ledger.fixture.json');
  const options = { enabled: true as const, secret, now: () => now, io };
  return { directory, file, options, ledger: new PaymentLedger(file, options) };
}
function event(invoice: any, state: string, id = 'event-a', extra: any = {}) {
  const rawBody = Buffer.from(JSON.stringify({ id, tenantId: invoice.tenantId, invoiceId: invoice.id, amountCents: invoice.amountCents, currency: invoice.currency, state, ...extra }));
  const timestamp = String(now / 1000);
  return { rawBody, timestamp, signature: createHmac('sha256', secret).update(timestamp).update('.').update(rawBody).digest('hex') };
}
function inTest(fn: () => unknown) {
  return async () => { const old = process.env.NODE_ENV; process.env.NODE_ENV = 'test'; try { await fn(); } finally { if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old; } };
}

test('ledger is test-only, refuses non-fixture names and never initializes storage on read', inTest(() => {
  const f = fixture(); assert.equal(fs.existsSync(f.file), false); assert.deepEqual(f.ledger.list('tenant-a'), []); assert.equal(fs.existsSync(f.file), false);
  assert.throws(() => new PaymentLedger(path.join(f.directory, 'db.json'), f.options), PaymentSimulationError);
  assert.throws(() => new PaymentLedger(f.file, { ...f.options, secret: 'short' }), PaymentSimulationError);
  process.env.NODE_ENV = 'production';
  assert.throws(() => new PaymentLedger(f.file, f.options), PaymentSimulationError);
  assert.throws(() => f.ledger.create('tenant-a', input), PaymentSimulationError);
  assert.throws(() => f.ledger.list('tenant-a'), PaymentSimulationError);
  assert.equal(fs.existsSync(f.file), false);
}));
test('intent idempotency is scoped by tenant, survives restart and preserves exact monetary terms', inTest(() => {
  const f = fixture(); const invoice = f.ledger.create('tenant-a', input);
  const before = fs.readFileSync(f.file);
  const restarted = new PaymentLedger(f.file, f.options);
  assert.deepEqual(restarted.create('tenant-a', input), invoice); assert.deepEqual(fs.readFileSync(f.file), before);
  for (const changed of [{ amountCents: 12501 }, { clientId: 'client-b' }, { dueOn: '2026-10-31' }]) assert.throws(() => restarted.create('tenant-a', { ...input, ...changed }));
  const other = restarted.create('tenant-b', input); assert.notEqual(invoice.id, other.id);
  assert.deepEqual(restarted.list('tenant-a'), [invoice]); assert.deepEqual(restarted.list('tenant-b'), [other]);
  assert.throws(() => restarted.get('tenant-b', invoice.id)); assert.throws(() => restarted.history('tenant-b', invoice.id));
  const changed = restarted.get('tenant-a', invoice.id); changed.state = 'confirmed'; assert.equal(restarted.get('tenant-a', invoice.id).state, 'pending');
}));
test('amount, currency, identifiers and dates reject malformed intents without writing', inTest(() => {
  const f = fixture();
  for (const changed of [{ amountCents: 0 }, { amountCents: -1 }, { amountCents: 1.5 }, { amountCents: Number.NaN }, { amountCents: 100_000_001 }, { currency: 'USD' }, { dueOn: '2026-02-30' }, { reference: '../path' }, { clientId: '__proto__' }]) {
    assert.throws(() => f.ledger.create('tenant-a', { ...input, ...changed } as any));
  }
  assert.equal(fs.existsSync(f.file), false);
}));
test('accepted events, idempotency and history survive restart; duplicate old event returns current state', inTest(() => {
  const f = fixture(); const invoice = f.ledger.create('tenant-a', input); const confirmed = event(invoice, 'confirmed');
  assert.equal(f.ledger.receive('tenant-a', confirmed).duplicate, false);
  const restarted = new PaymentLedger(f.file, f.options); const before = fs.readFileSync(f.file);
  assert.equal(restarted.receive('tenant-a', confirmed).duplicate, true); assert.deepEqual(fs.readFileSync(f.file), before);
  restarted.receive('tenant-a', event(invoice, 'refunded', 'event-refund'));
  assert.deepEqual(restarted.receive('tenant-a', confirmed), { duplicate: true, state: 'refunded', originallyAppliedState: 'confirmed', mode: 'simulation' });
  const after = new PaymentLedger(f.file, f.options); assert.equal(after.get('tenant-a', invoice.id).state, 'refunded');
  assert.deepEqual(after.history('tenant-a', invoice.id).map(e => e.state), ['confirmed', 'refunded']);
}));
test('wrong tenant, changed replay, wrong amount/currency and ordering never modify a ledger', inTest(() => {
  const f = fixture(); const invoice = f.ledger.create('tenant-a', input);
  f.ledger.receive('tenant-a', event(invoice, 'confirmed'));
  const before = fs.readFileSync(f.file);
  for (const payload of [event(invoice, 'pending', 'event-old'), event(invoice, 'refunded'), event(invoice, 'refunded', 'event-amount', { amountCents: 1 }), event(invoice, 'refunded', 'event-currency', { currency: 'USD' }), event(invoice, 'refunded', 'event-owner', { tenantId: 'tenant-b' })]) assert.throws(() => f.ledger.receive('tenant-a', payload));
  assert.throws(() => f.ledger.receive('tenant-b', event(invoice, 'refunded', 'event-foreign')));
  assert.deepEqual(fs.readFileSync(f.file), before);
}));
test('HMAC checks exact bytes, bounded body and deadline before loading/mutating data', inTest(() => {
  const f = fixture(); const invoice = f.ledger.create('tenant-a', input); const signed = event(invoice, 'confirmed'); const before = fs.readFileSync(f.file);
  for (const payload of [{ ...signed, signature: '0'.repeat(64) }, { ...signed, rawBody: Buffer.concat([signed.rawBody, Buffer.from(' ')]) }, { ...signed, rawBody: Buffer.alloc(16385) }, { ...signed, timestamp: String(now / 1000 - 301) }, { ...signed, timestamp: String(now / 1000 + 301) }]) assert.throws(() => f.ledger.receive('tenant-a', payload));
  assert.deepEqual(fs.readFileSync(f.file), before);
}));
test('unknown fields and malformed UTF-8/JSON are refused even with valid signatures', inTest(() => {
  const f = fixture(); const invoice = f.ledger.create('tenant-a', input); const before = fs.readFileSync(f.file);
  assert.throws(() => f.ledger.receive('tenant-a', event(invoice, 'confirmed', 'event-extra', { unknown: true })));
  for (const rawBody of [Buffer.from('{invalid'), Buffer.from([0xff, 0xfe])]) {
    const timestamp = String(now / 1000), signature = createHmac('sha256', secret).update(timestamp).update('.').update(rawBody).digest('hex');
    assert.throws(() => f.ledger.receive('tenant-a', { rawBody, timestamp, signature }));
  }
  assert.deepEqual(fs.readFileSync(f.file), before);
}));
test('disk failure never confirms an event; retry after recovery applies it exactly once', inTest(() => {
  let failWrite = false;
  const io = { ...fs, openSync: ((...args: any[]) => { if (failWrite && String(args[0]).includes('.tmp-')) throw Object.assign(Error('Fictional disk full'), { code: 'ENOSPC' }); return (fs.openSync as any)(...args); }) as typeof fs.openSync };
  const f = fixture(io); const invoice = f.ledger.create('tenant-a', input); const signed = event(invoice, 'confirmed'); const before = fs.readFileSync(f.file);
  failWrite = true; assert.throws(() => f.ledger.receive('tenant-a', signed), JsonPersistenceError); assert.deepEqual(fs.readFileSync(f.file), before);
  assert.equal(f.ledger.get('tenant-a', invoice.id).state, 'pending'); assert.deepEqual(f.ledger.history('tenant-a', invoice.id), []);
  failWrite = false; assert.equal(f.ledger.receive('tenant-a', signed).duplicate, false); assert.equal(f.ledger.receive('tenant-a', signed).duplicate, true); assert.equal(f.ledger.history('tenant-a', invoice.id).length, 1);
}));
test('invalid version, corrupted records and forged state cannot silently reset or seed', inTest(() => {
  const f = fixture(); const invoice = f.ledger.create('tenant-a', input); const original = fs.readFileSync(f.file);
  for (const bytes of ['', '{invalid', JSON.stringify({ version: 2, mode: 'simulation', invoices: [], events: [] }), JSON.stringify({ ...JSON.parse(original.toString()), invoices: [{ ...invoice, state: 'confirmed' }] })]) {
    fs.writeFileSync(f.file, bytes);
    assert.throws(() => new PaymentLedger(f.file, f.options), JsonPersistenceError); assert.equal(fs.readFileSync(f.file, 'utf8'), bytes);
  }
  fs.writeFileSync(f.file, original); assert.equal(new PaymentLedger(f.file, f.options).get('tenant-a', invoice.id).state, 'pending');
}));
test('independent instances refresh before mutation, preserving earlier intent and event updates', inTest(() => {
  const f = fixture(), second = new PaymentLedger(f.file, f.options);
  const one = f.ledger.create('tenant-a', input), two = second.create('tenant-a', { ...input, reference: 'reference-b' });
  f.ledger.receive('tenant-a', event(one, 'confirmed'));
  second.receive('tenant-a', event(two, 'canceled', 'event-canceled'));
  assert.deepEqual(f.ledger.list('tenant-a').map(i => i.state), ['confirmed', 'canceled']);
  assert.equal(f.ledger.history('tenant-a', one.id).length, 1);
}));
test('missing main generation with an existing backup requires explicit recovery, never a new empty ledger', inTest(() => {
  const f = fixture(); const invoice = f.ledger.create('tenant-a', input);
  f.ledger.receive('tenant-a', event(invoice, 'confirmed'));
  const backup = fs.readFileSync(`${f.file}.g360-previous.json`);
  fs.renameSync(f.file, `${f.file}.fixture-preserved`);
  assert.throws(() => f.ledger.create('tenant-a', { ...input, reference: 'must-not-create' }), JsonPersistenceError);
  assert.throws(() => new PaymentLedger(f.file, f.options), JsonPersistenceError);
  assert.equal(fs.existsSync(f.file), false); assert.deepEqual(fs.readFileSync(`${f.file}.g360-previous.json`), backup);
  fs.renameSync(`${f.file}.fixture-preserved`, f.file);
  assert.equal(new PaymentLedger(f.file, f.options).get('tenant-a', invoice.id).state, 'confirmed');
}));

test('two concurrent processes conflict explicitly without lost updates; loser can retry safely', inTest(async () => {
  const f = fixture(); f.ledger.create('tenant-a', input);
  const worker = `import fs from 'node:fs'; import {PaymentLedger} from ${JSON.stringify(new URL('./paymentLedger.ts', import.meta.url).href)};
    const [file,who]=process.argv.slice(1); const other=who==='a'?'b':'a';
    const io={...fs,mkdirSync(...args){if(String(args[0]).endsWith('.g360-lock')){fs.writeFileSync(file+'.ready.'+who,'ready');const until=Date.now()+5000;while(!fs.existsSync(file+'.ready.'+other)){if(Date.now()>until)throw Error('Barrier timeout');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);}}return fs.mkdirSync(...args);}};
    try{new PaymentLedger(file,{enabled:true,secret:${JSON.stringify(secret)},now:()=>${now},io}).create('tenant-a',{clientId:'client-a',reference:'race-'+who,amountCents:100,currency:'BRL',dueOn:'2026-10-30'});}catch(error){if(error.status!==409&&error.status!==503)throw error;process.exitCode=3;}`;
  const launch = (who: string) => new Promise<{ who: string; code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', worker, f.file, who], { cwd: process.cwd(), env: { PATH: process.env.PATH, NODE_ENV: 'test' }, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; }); child.once('error', reject); child.once('close', code => resolve({ who, code, stderr }));
  });
  const result = await Promise.all([launch('a'), launch('b')]);
  assert.deepEqual(result.map(r => r.code).sort(), [0, 3], JSON.stringify(result));
  const loser = result.find(r => r.code === 3)!.who;
  assert.equal(f.ledger.list('tenant-a').length, 2); assert.ok(f.ledger.get('tenant-a', f.ledger.list('tenant-a')[0].id));
  f.ledger.create('tenant-a', { ...input, reference: `race-${loser}`, amountCents: 100 }); assert.equal(f.ledger.list('tenant-a').length, 3);
}));
