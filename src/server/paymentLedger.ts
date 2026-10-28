import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { AtomicJsonStore, JsonPersistenceError } from './jsonPersistence.mjs';
import { PaymentSimulationError, type SimulatedPaymentState } from './paymentSimulation.ts';

type Invoice = {
  id: string; tenantId: string; clientId: string; reference: string; amountCents: number;
  currency: 'BRL'; dueOn: string; state: SimulatedPaymentState; createdAt: string; mode: 'simulation';
};
type Event = {
  id: string; tenantId: string; invoiceId: string; digest: string; previousState: SimulatedPaymentState;
  state: SimulatedPaymentState; processedAt: string;
};
type Ledger = { version: 1; mode: 'simulation'; invoices: Invoice[]; events: Event[] };
type Options = { enabled: true; secret: string; now?: () => number; io?: typeof fs };
const states = ['pending', 'confirmed', 'overdue', 'canceled', 'refunded'] as const;
const transitions: Record<SimulatedPaymentState, SimulatedPaymentState[]> = {
  pending: ['overdue', 'confirmed', 'canceled'], overdue: ['confirmed', 'canceled'], confirmed: ['refunded'], canceled: [], refunded: [],
};
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value);
const isState = (value: unknown): value is SimulatedPaymentState => states.includes(value as any);
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 100_000_000;
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function fail(message: string): never { throw new PaymentSimulationError(message); }

function validLedger(value: any): value is Ledger {
  if (!value || value.version !== 1 || value.mode !== 'simulation' || !Array.isArray(value.invoices) || !Array.isArray(value.events)) return false;
  const ids = new Set<string>(), references = new Set<string>(), eventIds = new Set<string>();
  for (const item of value.invoices) {
    if (!item || !identifier(item.id) || !identifier(item.tenantId) || !identifier(item.clientId) || !identifier(item.reference)
      || !amount(item.amountCents) || item.currency !== 'BRL' || !date(item.dueOn) || !isState(item.state) || !instant(item.createdAt) || item.mode !== 'simulation') return false;
    const reference = JSON.stringify([item.tenantId, item.reference]);
    if (ids.has(item.id) || references.has(reference)) return false;
    ids.add(item.id); references.add(reference);
  }
  for (const item of value.events) {
    if (!item || !identifier(item.id) || !identifier(item.tenantId) || !identifier(item.invoiceId) || !/^[a-f0-9]{64}$/.test(item.digest)
      || !isState(item.previousState) || !isState(item.state) || !instant(item.processedAt)
      || (item.state !== item.previousState && !transitions[item.previousState as SimulatedPaymentState].includes(item.state))) return false;
    const key = JSON.stringify([item.tenantId, item.id]);
    if (eventIds.has(key) || !value.invoices.some((invoice: Invoice) => invoice.id === item.invoiceId && invoice.tenantId === item.tenantId)) return false;
    eventIds.add(key);
  }
  // The accepted history must reproduce every persisted state, not just valid individual events.
  for (const invoice of value.invoices) {
    let state: SimulatedPaymentState = 'pending';
    for (const item of value.events.filter((event: Event) => event.invoiceId === invoice.id)) {
      if (item.previousState !== state) return false;
      state = item.state;
    }
    if (invoice.state !== state) return false;
  }
  return true;
}

/** Offline test adapter. Never register as a production webhook or use real account data. */
export class PaymentLedger {
  private store: AtomicJsonStore;
  private now: () => number;
  private secret: Buffer;
  constructor(file: string, options: Options) {
    this.assertEnabled(options.enabled);
    if (typeof options.secret !== 'string' || Buffer.byteLength(options.secret) < 32) fail('Segredo fictício deve ter pelo menos 32 bytes.');
    const parent = fs.realpathSync(path.dirname(path.resolve(file)));
    const temporary = fs.realpathSync(os.tmpdir());
    if (!parent.startsWith(`${temporary}${path.sep}`) || path.basename(file) !== 'payment-ledger.fixture.json') fail('Use apenas arquivo fictício em diretório temporário próprio.');
    this.secret = Buffer.from(options.secret); this.now = options.now || Date.now;
    this.store = new AtomicJsonStore(path.join(parent, path.basename(file)), {
      io: options.io || fs, validate: validLedger, allowMissing: true,
      initial: () => ({ version: 1, mode: 'simulation', invoices: [], events: [] }),
    });
    this.begin();
  }
  private begin() {
    // Missing is allowed only for a truly new fixture, never a lost existing generation.
    try { this.store.io.lstatSync(this.store.file); }
    catch (error: any) {
      if (error.code !== 'ENOENT') throw new JsonPersistenceError();
      try { this.store.io.lstatSync(this.store.backup); }
      catch (backupError: any) { if (backupError.code === 'ENOENT') return this.store.begin(); throw new JsonPersistenceError(); }
      throw new JsonPersistenceError('Ledger ausente com cópia anterior existente; verifique recuperação em arquivo separado.');
    }
    return this.store.begin();
  }
  private assertEnabled(enabled = true) { if (process.env.NODE_ENV !== 'test' || enabled !== true) fail('Ledger disponível somente para simulação local de testes.'); }
  private tenant(tenantId: string) { this.assertEnabled(); if (!identifier(tenantId)) fail('Contexto de conta inválido.'); }
  private time() { const time = this.now(); if (!Number.isFinite(time)) fail('Relógio de teste inválido.'); return time; }
  create(tenantId: string, input: { clientId: string; reference: string; amountCents: number; currency: 'BRL'; dueOn: string }): Invoice {
    this.tenant(tenantId);
    if (!input || !identifier(input.clientId) || !identifier(input.reference) || !amount(input.amountCents) || input.currency !== 'BRL' || !date(input.dueOn)) fail('Intenção simulada inválida.');
    const snapshot = this.begin(); const data = snapshot.data as Ledger;
    const existing = data.invoices.find(invoice => invoice.tenantId === tenantId && invoice.reference === input.reference);
    if (existing) {
      if (existing.clientId !== input.clientId || existing.amountCents !== input.amountCents || existing.currency !== input.currency || existing.dueOn !== input.dueOn) fail('Referência já utilizada com outros dados.');
      return clone(existing);
    }
    const invoice: Invoice = { id: randomUUID(), tenantId, clientId: input.clientId, reference: input.reference, amountCents: input.amountCents, currency: 'BRL', dueOn: input.dueOn, state: 'pending', createdAt: new Date(this.time()).toISOString(), mode: 'simulation' };
    data.invoices.push(invoice); this.store.commit(data, snapshot.revision); return clone(invoice);
  }
  list(tenantId: string): Invoice[] { this.tenant(tenantId); return clone((this.begin().data as Ledger).invoices.filter(invoice => invoice.tenantId === tenantId)); }
  get(tenantId: string, id: string): Invoice {
    this.tenant(tenantId); if (!identifier(id)) fail('Identificador inválido.');
    const invoice = (this.begin().data as Ledger).invoices.find(invoice => invoice.id === id && invoice.tenantId === tenantId);
    return invoice ? clone(invoice) : fail('Intenção simulada não encontrada.');
  }
  history(tenantId: string, invoiceId: string): Event[] {
    this.get(tenantId, invoiceId);
    return clone((this.begin().data as Ledger).events.filter(event => event.tenantId === tenantId && event.invoiceId === invoiceId));
  }
  receive(tenantId: string, input: { timestamp: string; signature: string; rawBody: Buffer }) {
    this.tenant(tenantId);
    if (!input || !Buffer.isBuffer(input.rawBody) || input.rawBody.length < 1 || input.rawBody.length > 16384 || !/^\d{10}$/.test(input.timestamp) || !/^[a-f0-9]{64}$/.test(input.signature)
      || Math.abs(this.time() - Number(input.timestamp) * 1000) > 300000) fail('Evento inválido, excessivo ou expirado.');
    const expected = createHmac('sha256', this.secret).update(input.timestamp).update('.').update(input.rawBody).digest();
    if (!timingSafeEqual(expected, Buffer.from(input.signature, 'hex'))) fail('Assinatura fictícia inválida.');
    let body: any; try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input.rawBody)); } catch { fail('JSON inválido.'); }
    if (!body || Object.keys(body).sort().join(',') !== 'amountCents,currency,id,invoiceId,state,tenantId'
      || !identifier(body.id) || !identifier(body.invoiceId) || body.tenantId !== tenantId || !amount(body.amountCents) || body.currency !== 'BRL' || !isState(body.state)) fail('Dados do evento inválidos.');
    const snapshot = this.begin(); const data = snapshot.data as Ledger;
    const invoice = data.invoices.find(invoice => invoice.id === body.invoiceId && invoice.tenantId === tenantId);
    if (!invoice || invoice.amountCents !== body.amountCents || invoice.currency !== body.currency) fail('Intenção, conta, moeda ou valor incompatível.');
    const digest = createHash('sha256').update(input.rawBody).digest('hex');
    const replay = data.events.find(event => event.id === body.id && event.tenantId === tenantId);
    if (replay) {
      if (replay.digest !== digest) fail('Evento repetido com conteúdo diferente.');
      return { duplicate: true, state: invoice.state, originallyAppliedState: replay.state, mode: 'simulation' as const };
    }
    if (body.state !== invoice.state && !transitions[invoice.state].includes(body.state)) fail('Transição fora de ordem ou não permitida.');
    data.events.push({ id: body.id, tenantId, invoiceId: invoice.id, digest, previousState: invoice.state, state: body.state, processedAt: new Date(this.time()).toISOString() });
    invoice.state = body.state; this.store.commit(data, snapshot.revision);
    return { duplicate: false, state: invoice.state, originallyAppliedState: body.state as SimulatedPaymentState, mode: 'simulation' as const };
  }
}
