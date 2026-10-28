import { createHash, randomUUID } from 'node:crypto';
import type { Express, Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import { JsonPersistenceError } from './jsonPersistence.mjs';

/** Local workflow only. No provider, network call, charge or legal signature is performed. */
export const OFFICE_PLANS = [
  { id: 'unassigned', name: 'Sem plano contratado' },
  { id: 'starter', name: 'Inicial' },
  { id: 'business', name: 'Business' },
] as const;
type Client = { id: string; ownerUid: string; name: string; businessName: string; email: string; plan: string; expiresOn: string | null; canceled: boolean; createdAt: string; siteIds?: string[]; archived?: boolean; updatedAt?: string };
type Version = { number: number; text: string; clientSnapshot: { name: string; businessName: string; email: string }; sha256: string; createdAt: string; createdBy: string };
type Contract = { id: string; clientId: string; projectId?: string; serviceType?: string; title: string; expiresOn: string | null; status: 'draft' | 'review' | 'approved' | 'awaiting_provider' | 'simulated_signed' | 'canceled'; versions: Version[]; evidence?: { kind: 'simulation'; sha256: string; at: string; actorUid: string; legalSignature: false } };
type Financial = { id: string; clientId: string; amountCents: number; dueOn: string; status: 'pending' | 'confirmed' | 'canceled' | 'refunded'; mode: 'simulation'; reference: string; createdAt: string };
type Event = { id: string; clientId: string; type: string; actorUid: string; at: string; recordId: string };
type Office = { version: 1; clients: Client[]; contracts: Contract[]; financial: Financial[]; events: Event[] };
type Db = { users: Array<{ id: string }>; projects: any[]; office?: Office };
class OfficeError extends Error { constructor(public status: number, message: string) { super(message); } }
const fail = (status: number, message: string): never => { throw new OfficeError(status, message); };
const text = (value: unknown, name: string, max = 200): string => typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : fail(400, `${name} inválido.`);
const date = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail(400, 'Data inválida.');
  return value as string;
};
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const email = (value: unknown) => { const result = text(value, 'E-mail', 254); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : fail(400, 'E-mail inválido.'); };
const checkRevision = (value: unknown, current: Client, required = false) => {
  if (value === undefined && !required) return;
  if (value === undefined) fail(428, 'Leia o cliente e informe expectedRevision antes de alterar.');
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail(400, 'Revisão inválida.');
  if (value !== digest(current)) fail(409, 'Cliente atualizado em outra operação; leia novamente antes de alterar.');
};
const checkContractVersion = (value: unknown, current: Contract) => {
  if (value === undefined) return; // Existing consumers append versions without this precondition.
  if (!Number.isSafeInteger(value) || Number(value) < 1) fail(400, 'Versão esperada inválida.');
  if (value !== current.versions.length) fail(409, 'Contrato atualizado em outra operação; leia novamente.');
};
export function expirationState(expiresOn: string | null, canceled = false, now = new Date()) {
  if (canceled) return 'canceled';
  if (!expiresOn) return 'no_expiration';
  const today = now.toISOString().slice(0, 10);
  const days = (Date.parse(expiresOn) - Date.parse(today)) / 86400000;
  return days < 0 ? 'expired' : days <= 7 ? 'expiring' : 'active';
}
function readOffice(db: Db): Office {
  if (db.office === undefined) return { version: 1, clients: [], contracts: [], financial: [], events: [] };
  const o = db.office;
  if (!o || o.version !== 1 || !Array.isArray(o.clients) || !Array.isArray(o.contracts) || !Array.isArray(o.financial) || !Array.isArray(o.events)
    || !o.clients.every(c => c && typeof c.id === 'string' && typeof c.ownerUid === 'string' && typeof c.name === 'string' && typeof c.businessName === 'string' && typeof c.email === 'string' && typeof c.canceled === 'boolean' && (c.archived === undefined || typeof c.archived === 'boolean') && OFFICE_PLANS.some(p => p.id === c.plan) && (c.siteIds === undefined || (Array.isArray(c.siteIds) && c.siteIds.every(id => typeof id === 'string') && new Set(c.siteIds).size === c.siteIds.length)))
    || !o.contracts.every(c => c && typeof c.id === 'string' && typeof c.clientId === 'string' && (c.projectId === undefined || typeof c.projectId === 'string') && (c.serviceType === undefined || typeof c.serviceType === 'string') && ['draft', 'review', 'approved', 'awaiting_provider', 'simulated_signed', 'canceled'].includes(c.status) && Array.isArray(c.versions) && c.versions.length > 0 && c.versions.every((v, i) => v && v.number === i + 1 && typeof v.text === 'string' && v.clientSnapshot && v.sha256 === digest({ text: v.text, clientSnapshot: v.clientSnapshot })))
    || !o.financial.every(c => c && typeof c.id === 'string' && typeof c.clientId === 'string' && c.mode === 'simulation' && Number.isSafeInteger(c.amountCents) && c.amountCents > 0 && ['pending', 'confirmed', 'canceled', 'refunded'].includes(c.status))
    || !o.events.every(c => c && typeof c.id === 'string' && typeof c.clientId === 'string')) throw new JsonPersistenceError('Dados do Escritório inválidos; nenhum dado foi substituído.');
  const clientIds = new Set(o.clients.map(c => c.id));
  if (clientIds.size !== o.clients.length || new Set(o.contracts.map(c => c.id)).size !== o.contracts.length
    || new Set(o.financial.map(c => c.id)).size !== o.financial.length
    || [...o.contracts, ...o.financial, ...o.events].some(c => !clientIds.has(c.clientId))) throw new JsonPersistenceError('Vínculos do Escritório inválidos; nenhum dado foi substituído.');
  return o;
}

/** Register AFTER verified authentication and persistenceContext, BEFORE persistenceErrorHandler. */
export function registerOfficeRoutes(app: Express, deps: { db: Db; saveDb: (db: any) => void; now?: () => Date; allowSimulation?: boolean }) {
  const { db, saveDb } = deps;
  const now = deps.now || (() => new Date());
  const route = (handler: (req: AuthRequest, res: Response) => unknown) => (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.uid) return res.status(401).json({ error: 'Autenticação necessária.' });
    Promise.resolve().then(() => handler(req, res)).catch(error => error instanceof OfficeError ? res.status(error.status).json({ error: error.message }) : next(error));
  };
  const admin = (req: AuthRequest) => { if (req.user!.role !== 'admin') fail(403, 'Operação administrativa.'); };
  const owned = (req: AuthRequest, o: Office, id: string) => {
    const c = o.clients.find(c => c.id === id);
    if (!c || (req.user!.role !== 'admin' && c.ownerUid !== req.user!.uid)) fail(404, 'Cliente não encontrado.');
    return c!;
  };
  const event = (req: AuthRequest, o: Office, clientId: string, type: string, recordId: string) => o.events.push({ id: randomUUID(), clientId, type, recordId, actorUid: req.user!.uid, at: now().toISOString() });
  const persist = (o: Office) => { db.office = o; saveDb(db); };
  const contract = (req: AuthRequest, o: Office, id: string) => {
    const c = o.contracts.find(c => c.id === id); if (!c) fail(404, 'Contrato não encontrado.'); owned(req, o, c!.clientId); return c!;
  };
  const simulation = () => { if (process.env.NODE_ENV !== 'test' || deps.allowSimulation !== true) fail(403, 'Simulação disponível somente no ambiente de testes autorizado.'); };
  const plan = (value: unknown) => OFFICE_PLANS.some(p => p.id === value) ? value as string : fail(400, 'Plano desconhecido.');
  const publicClient = (c: Client) => ({ ...c, archived: c.archived ?? false, revision: digest(c), expiration: expirationState(c.expiresOn, c.canceled, now()) });

  app.get('/api/office', route((req, res) => {
    const o = readOffice(db); const clients = o.clients.filter(c => req.user!.role === 'admin' || c.ownerUid === req.user!.uid);
    const ids = new Set(clients.map(c => c.id));
    res.json({ mode: 'local_preparation', commercialActivation: false, plans: OFFICE_PLANS, clients: clients.map(publicClient),
      contracts: o.contracts.filter(c => ids.has(c.clientId)).map(c => ({ ...c, expiration: expirationState(c.expiresOn, c.status === 'canceled', now()) })),
      financial: o.financial.filter(f => ids.has(f.clientId)).map(f => ({ ...f, state: f.status === 'pending' && expirationState(f.dueOn, false, now()) === 'expired' ? 'overdue' : f.status })),
      history: o.events.filter(e => ids.has(e.clientId)),
      // Metadata only, existing project content and credentials are never included.
      sites: clients.flatMap(c => db.projects.filter(p => c.siteIds?.includes(p.id) && p.ownerUid === c.ownerUid).map(p => ({ id: p.id, clientId: c.id, ownerUid: p.ownerUid, name: p.name, slug: p.slug, publicationStatus: 'not_verified' }))),
      notices: clients.filter(c => ['expired', 'expiring'].includes(expirationState(c.expiresOn, c.canceled, now()))).map(c => ({ clientId: c.id, state: expirationState(c.expiresOn, c.canceled, now()), delivered: false })) });
  }));
  app.get('/api/office/clients', route((req, res) => {
    const positive = (value: unknown, fallback: number, max: number) => value === undefined ? fallback : typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= max ? Number(value) : fail(400, 'Paginação inválida.');
    const page = positive(req.query.page, 1, 1000000); const limit = positive(req.query.limit, 25, 100);
    const query = req.query.q === undefined ? '' : typeof req.query.q === 'string' && req.query.q.length <= 200 ? req.query.q.trim().toLocaleLowerCase('pt-BR') : fail(400, 'Busca inválida.');
    const requestedPlan = req.query.plan === undefined ? undefined : plan(req.query.plan);
    const archived = req.query.archived ?? 'false'; if (!['false', 'true', 'all'].includes(archived as string)) fail(400, 'Filtro de arquivamento inválido.');
    const o = readOffice(db);
    const selected = o.clients.filter(c => (req.user!.role === 'admin' || c.ownerUid === req.user!.uid)
      && (!requestedPlan || c.plan === requestedPlan)
      && (archived === 'all' || Boolean(c.archived) === (archived === 'true'))
      && (!query || `${c.name}\n${c.businessName}\n${c.email}`.toLocaleLowerCase('pt-BR').includes(query)))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
    res.json({ clients: selected.slice((page - 1) * limit, page * limit).map(publicClient), page, limit, total: selected.length });
  }));
  app.get('/api/office/clients/:id', route((req, res) => {
    const c = owned(req, readOffice(db), String(req.params.id)); res.json({ client: publicClient(c) });
  }));
  app.patch('/api/office/clients/:id', route((req, res) => {
    admin(req); const o = readOffice(db); const c = owned(req, o, String(req.params.id)); const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).some(k => !['expectedRevision', 'name', 'businessName', 'email', 'archived'].includes(k))) fail(400, 'Campos de atualização inválidos.');
    checkRevision(b.expectedRevision, c, true);
    if (!['name', 'businessName', 'email', 'archived'].some(k => Object.hasOwn(b, k))) fail(400, 'Informe ao menos uma alteração.');
    const changes: Partial<Client> = {};
    if (Object.hasOwn(b, 'name')) changes.name = text(b.name, 'Nome');
    if (Object.hasOwn(b, 'businessName')) changes.businessName = text(b.businessName, 'Empresa');
    if (Object.hasOwn(b, 'email')) changes.email = email(b.email);
    if (Object.hasOwn(b, 'archived')) { if (typeof b.archived !== 'boolean') fail(400, 'Arquivamento deve ser explícito.'); changes.archived = b.archived; }
    Object.assign(c, changes, { updatedAt: now().toISOString() }); event(req, o, c.id, 'client.updated', c.id); persist(o); res.json({ client: publicClient(c) });
  }));
  app.post('/api/office/clients', route((req, res) => {
    admin(req); const b = req.body || {}; const ownerUid = text(b.ownerUid, 'Proprietário');
    if (!db.users.some(u => u.id === ownerUid)) fail(400, 'Proprietário deve ser uma conta existente e verificada pelo administrador.');
    const c: Client = { id: randomUUID(), ownerUid, name: text(b.name, 'Nome'), businessName: text(b.businessName, 'Empresa'), email: email(b.email), plan: plan(b.plan ?? 'unassigned'), expiresOn: date(b.expiresOn), canceled: false, createdAt: now().toISOString() };
    const o = readOffice(db); o.clients.push(c); event(req, o, c.id, 'client.created', c.id); persist(o); res.status(201).json(c);
  }));
  app.patch('/api/office/clients/:id/subscription', route((req, res) => {
    admin(req); const o = readOffice(db); const c = owned(req, o, String(req.params.id)); const b = req.body || {};
    checkRevision(b.expectedRevision, c);
    if (typeof b.canceled !== 'boolean') fail(400, 'Cancelamento deve ser explícito.');
    const nextPlan = plan(b.plan); const expiresOn = date(b.expiresOn);
    c.plan = nextPlan; c.expiresOn = expiresOn; c.canceled = b.canceled; event(req, o, c.id, 'subscription.manually_recorded', c.id); persist(o); res.json({ ...c, paymentActivated: false });
  }));
  app.post('/api/office/clients/:id/sites', route((req, res) => {
    admin(req); const o = readOffice(db); const c = owned(req, o, String(req.params.id)); const projectId = text(req.body?.projectId, 'Projeto');
    const project = db.projects.find(p => p.id === projectId);
    if (!project || project.ownerUid !== c.ownerUid) fail(404, 'Projeto com propriedade compatível não encontrado.');
    if (o.clients.some(other => other.id !== c.id && other.siteIds?.includes(projectId))) fail(409, 'Projeto já associado a outro cliente.');
    if (c.siteIds?.includes(projectId)) return res.json({ clientId: c.id, projectId });
    c.siteIds = [...(c.siteIds || []), projectId]; event(req, o, c.id, 'client.site_associated', projectId); persist(o); res.status(201).json({ clientId: c.id, projectId });
  }));
  app.post('/api/office/contracts', route((req, res) => {
    const o = readOffice(db); const b = req.body || {}; const c = owned(req, o, text(b.clientId, 'Cliente'));
    if (c.archived) fail(409, 'Cliente arquivado; restaure o cadastro antes de criar novas minutas.');
    const projectId = b.projectId === undefined ? undefined : text(b.projectId, 'Projeto');
    if (projectId !== undefined && (!c.siteIds?.includes(projectId) || !db.projects.some(p => p.id === projectId && p.ownerUid === c.ownerUid))) fail(404, 'Projeto explicitamente associado ao cliente não encontrado.');
    const serviceType = b.serviceType === undefined ? undefined : text(b.serviceType, 'Tipo de serviço', 120);
    const title = text(b.title, 'Título'); const expiresOn = date(b.expiresOn); const content = text(b.text, 'Texto', 100000);
    const snapshot = { name: c.name, businessName: c.businessName, email: c.email };
    const v: Version = { number: 1, text: content, clientSnapshot: snapshot, sha256: digest({ text: content, clientSnapshot: snapshot }), createdAt: now().toISOString(), createdBy: req.user!.uid };
    const record: Contract = { id: randomUUID(), clientId: c.id, ...(projectId === undefined ? {} : { projectId }), ...(serviceType === undefined ? {} : { serviceType }), title, expiresOn, status: 'draft', versions: [v] };
    o.contracts.push(record); event(req, o, c.id, 'contract.created', record.id); persist(o); res.status(201).json(record);
  }));
  app.post('/api/office/contracts/:id/versions', route((req, res) => {
    const o = readOffice(db); const c = contract(req, o, String(req.params.id));
    checkContractVersion(req.body?.expectedVersion, c);
    if (!['draft', 'review'].includes(c.status)) fail(409, 'Versão já aprovada; crie outro contrato para alterar o conteúdo.');
    const content = text(req.body?.text, 'Texto', 100000); const snapshot = c.versions[0].clientSnapshot;
    c.versions.push({ number: c.versions.length + 1, text: content, clientSnapshot: snapshot, sha256: digest({ text: content, clientSnapshot: snapshot }), createdAt: now().toISOString(), createdBy: req.user!.uid }); c.status = 'draft';
    event(req, o, c.clientId, 'contract.version_created', c.id); persist(o); res.status(201).json(c);
  }));
  app.get('/api/office/contracts/:id/document', route((req, res) => {
    const o = readOffice(db); const c = contract(req, o, String(req.params.id)); const requested = req.query.version;
    if (typeof requested !== 'string' || !/^[1-9]\d*$/.test(requested) || !Number.isSafeInteger(Number(requested))) fail(400, 'Informe uma versão inteira positiva.');
    const version = c.versions.find(v => v.number === Number(requested)); if (!version) fail(404, 'Versão não encontrada.');
    const bytes = Buffer.from(version!.text, 'utf8');
    res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="contrato-v${version!.number}.txt"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "sandbox; default-src 'none'", 'X-G360-Version-SHA256': version!.sha256, 'X-Content-SHA256': createHash('sha256').update(bytes).digest('hex') });
    res.send(bytes);
  }));
  app.post('/api/office/contracts/:id/review', route((req, res) => {
    const o = readOffice(db); const c = contract(req, o, String(req.params.id));
    if (c.status !== 'draft') fail(409, 'Contrato não está em rascunho.');
    c.status = 'review'; event(req, o, c.clientId, 'contract.review_requested', c.id); persist(o); res.json(c);
  }));
  app.post('/api/office/contracts/:id/approve', route((req, res) => {
    admin(req); const o = readOffice(db); const c = contract(req, o, String(req.params.id));
    if (c.status !== 'review' || req.body?.sha256 !== c.versions.at(-1)!.sha256) fail(409, 'Revise a versão atual e confirme seu hash.');
    c.status = 'approved'; event(req, o, c.clientId, 'contract.approved', c.id); persist(o); res.json(c);
  }));
  app.post('/api/office/contracts/:id/signature-request', route((req, res) => {
    admin(req); const o = readOffice(db); const c = contract(req, o, String(req.params.id));
    if (c.status === 'awaiting_provider') return res.json({ contract: c, delivered: false, blockedBy: 'signature_provider_not_configured' });
    if (c.status !== 'approved' || req.body?.sha256 !== c.versions.at(-1)!.sha256) fail(409, 'Aprovação da versão atual necessária.');
    c.status = 'awaiting_provider'; event(req, o, c.clientId, 'contract.signature_queued_without_delivery', c.id); persist(o);
    res.status(202).json({ contract: c, delivered: false, blockedBy: 'signature_provider_not_configured' });
  }));
  app.post('/api/office/contracts/:id/cancel', route((req, res) => {
    admin(req); const o = readOffice(db); const c = contract(req, o, String(req.params.id));
    if (c.status === 'canceled') return res.json(c);
    if (c.status === 'simulated_signed') fail(409, 'Registro assinado simulado é preservado; registre um novo instrumento.');
    c.status = 'canceled'; event(req, o, c.clientId, 'contract.canceled_locally', c.id); persist(o); res.json(c);
  }));
  app.post('/api/office/contracts/:id/simulate-signature', route((req, res) => {
    admin(req); simulation(); const o = readOffice(db); const c = contract(req, o, String(req.params.id));
    if (c.status !== 'awaiting_provider') fail(409, 'Contrato não aguarda assinatura.');
    c.status = 'simulated_signed'; c.evidence = { kind: 'simulation', sha256: c.versions.at(-1)!.sha256, at: now().toISOString(), actorUid: req.user!.uid, legalSignature: false };
    event(req, o, c.clientId, 'contract.simulated_signature', c.id); persist(o); res.json(c);
  }));
  app.post('/api/office/financial/simulate', route((req, res) => {
    admin(req); simulation(); const o = readOffice(db); const b = req.body || {}; const c = owned(req, o, text(b.clientId, 'Cliente')); const reference = text(b.reference, 'Referência');
    if (!Number.isSafeInteger(b.amountCents) || b.amountCents < 1 || b.amountCents > 100000000) fail(400, 'Valor inválido.');
    const dueOn = date(b.dueOn); if (!dueOn) fail(400, 'Vencimento obrigatório.');
    const existing = o.financial.find(f => f.reference === reference);
    if (existing) { if (existing.clientId !== c.id || existing.amountCents !== b.amountCents || existing.dueOn !== dueOn) fail(409, 'Referência já utilizada com outros dados.'); return res.json(existing); }
    const f: Financial = { id: randomUUID(), clientId: c.id, amountCents: b.amountCents, dueOn: dueOn!, status: 'pending', mode: 'simulation', reference, createdAt: now().toISOString() };
    o.financial.push(f); event(req, o, c.id, 'financial.simulated_created', f.id); persist(o); res.status(201).json(f);
  }));
  app.post('/api/office/financial/:id/simulate-status', route((req, res) => {
    admin(req); simulation(); const o = readOffice(db); const f = o.financial.find(f => f.id === req.params.id); if (!f) fail(404, 'Registro não encontrado.'); owned(req, o, f!.clientId);
    const status = req.body?.status; const transitions: Record<string, string[]> = { pending: ['confirmed', 'canceled'], confirmed: ['refunded'], canceled: [], refunded: [] };
    if (status === f!.status) return res.json(f);
    if (!transitions[f!.status]?.includes(status)) fail(409, 'Transição financeira inválida.');
    f!.status = status; event(req, o, f!.clientId, `financial.simulated_${status}`, f!.id); persist(o); res.json(f);
  }));
}
