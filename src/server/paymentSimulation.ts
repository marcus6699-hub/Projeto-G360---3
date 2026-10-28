import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type SimulatedPaymentState = 'pending' | 'confirmed' | 'overdue' | 'canceled' | 'refunded';
export class PaymentSimulationError extends Error {}
type Invoice = { id: string; amountCents: number; state: SimulatedPaymentState };
/** In-memory harness for tests, NOT a provider integration or production event store. */
export class PaymentSimulation {
  private invoices = new Map<string, Invoice>();
  private events = new Map<string, { digest: string; state: SimulatedPaymentState }>();
  private secret: Buffer;
  constructor(options: { enabled: true; secret: string; now?: () => number }) {
    if (process.env.NODE_ENV !== 'test' || options.enabled !== true) throw new PaymentSimulationError('Simulador disponível somente em testes.');
    if (Buffer.byteLength(options.secret) < 32) throw new PaymentSimulationError('Segredo fictício deve ter pelo menos 32 bytes.');
    this.secret = Buffer.from(options.secret); this.now = options.now || Date.now;
  }
  private now: () => number;
  private enabled() { if (process.env.NODE_ENV !== 'test') throw new PaymentSimulationError('Simulador desativado fora de testes.'); }
  create(id: string, amountCents: number): Invoice {
    this.enabled(); if (!id || id.length > 200 || !Number.isSafeInteger(amountCents) || amountCents <= 0) throw new PaymentSimulationError('Cobrança fictícia inválida.');
    const existing = this.invoices.get(id);
    if (existing) { if (existing.amountCents !== amountCents) throw new PaymentSimulationError('Referência reutilizada com outro valor.'); return { ...existing }; }
    const invoice: Invoice = { id, amountCents, state: 'pending' }; this.invoices.set(id, invoice); return { ...invoice };
  }
  receive(input: { timestamp: string; signature: string; rawBody: Buffer }) {
    this.enabled(); const { timestamp, signature, rawBody } = input;
    if (!/^\d{10}$/.test(timestamp) || Math.abs(this.now() - Number(timestamp) * 1000) > 300000 || !/^[a-f0-9]{64}$/.test(signature) || rawBody.length > 16384) throw new PaymentSimulationError('Evento fictício inválido ou expirado.');
    const expected = createHmac('sha256', this.secret).update(timestamp).update('.').update(rawBody).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new PaymentSimulationError('Assinatura HMAC inválida.');
    let body: any; try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody)); } catch { throw new PaymentSimulationError('JSON inválido.'); }
    if (!body || typeof body.id !== 'string' || !body.id || body.id.length > 200 || typeof body.invoiceId !== 'string' || !['pending', 'confirmed', 'overdue', 'canceled', 'refunded'].includes(body.state)) throw new PaymentSimulationError('Evento inválido.');
    const digest = createHash('sha256').update(rawBody).digest('hex'); const replay = this.events.get(body.id);
    if (replay) { if (replay.digest !== digest) throw new PaymentSimulationError('Evento repetido com conteúdo diferente.'); return { duplicate: true, state: replay.state, mode: 'simulation' as const }; }
    const invoice = this.invoices.get(body.invoiceId);
    if (!invoice || body.amountCents !== invoice.amountCents) throw new PaymentSimulationError('Cobrança ou valor desconhecido.');
    const transitions: Record<SimulatedPaymentState, SimulatedPaymentState[]> = { pending: ['overdue', 'confirmed', 'canceled'], overdue: ['confirmed', 'canceled'], confirmed: ['refunded'], canceled: [], refunded: [] };
    if (body.state !== invoice.state && !transitions[invoice.state].includes(body.state)) throw new PaymentSimulationError('Transição inválida.');
    invoice.state = body.state; this.events.set(body.id, { digest, state: invoice.state });
    return { duplicate: false, state: invoice.state, mode: 'simulation' as const };
  }
}
