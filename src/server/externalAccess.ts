/** Backend policy only. Does not replace publicUrlClient or verify a provider's bill. */
export type ExternalProvider = 'overpass' | 'gemini' | 'google_places' | 'outscraper' | 'nvidia' | 'openrouter' | 'groq' | 'cerebras' | 'mistral' | 'huggingface' | 'pollinations' | 'serper' | 'nominatim' | 'brasilapi' | 'cnpjws';
type Grant = { id: string; provider: ExternalProvider; cost: 'free_verified'; evidenceRef: string; issuedAt: string; expiresAt: string; maxCallsPerProcess: number };
type Destination = { provider: ExternalProvider; method: string; host: string; path: RegExp };
const destinations: Destination[] = [
  { provider: 'overpass', method: 'POST', host: 'overpass-api.de', path: /^\/api\/interpreter$/ },
  { provider: 'google_places', method: 'GET', host: 'places.googleapis.com', path: /^\/v1\/places\/[A-Za-z0-9_%=-]+(?:\/photos\/[A-Za-z0-9_=-]+\/media)?$/ },
  { provider: 'google_places', method: 'POST', host: 'places.googleapis.com', path: /^\/v1\/places:searchText$/ },
  { provider: 'outscraper', method: 'GET', host: 'api.app.outscraper.com', path: /^\/maps\/search-v3$/ },
  { provider: 'nvidia', method: 'POST', host: 'integrate.api.nvidia.com', path: /^\/v1\/chat\/completions$/ },
  { provider: 'openrouter', method: 'POST', host: 'openrouter.ai', path: /^\/api\/v1\/chat\/completions$/ },
  { provider: 'groq', method: 'POST', host: 'api.groq.com', path: /^\/openai\/v1\/chat\/completions$/ },
  { provider: 'cerebras', method: 'POST', host: 'api.cerebras.ai', path: /^\/v1\/chat\/completions$/ },
  { provider: 'mistral', method: 'POST', host: 'api.mistral.ai', path: /^\/v1\/chat\/completions$/ },
  { provider: 'huggingface', method: 'POST', host: 'router.huggingface.co', path: /^\/v1\/chat\/completions$/ },
  { provider: 'pollinations', method: 'POST', host: 'text.pollinations.ai', path: /^\/openai$/ },
  { provider: 'serper', method: 'POST', host: 'google.serper.dev', path: /^\/places$/ },
  { provider: 'nominatim', method: 'GET', host: 'nominatim.openstreetmap.org', path: /^\/search$/ },
  { provider: 'brasilapi', method: 'GET', host: 'brasilapi.com.br', path: /^\/api\/cnpj\/v1\/\d{14}$/ },
  { provider: 'cnpjws', method: 'GET', host: 'publica.cnpj.ws', path: /^\/cnpj\/\d{14}$/ },
];
const providers = new Set<ExternalProvider>(['gemini', ...destinations.map(d => d.provider)]);
export class ExternalAccessError extends Error {
  constructor(public status: 403 | 429 | 502 | 503, message: string) { super(message); }
}

/** A grant is an operator declaration with evidence, not automatic proof of free balance. */
export class ExternalAccessPolicy {
  private used = new Map<string, number>();
  constructor(private options: { readGrants?: () => string | undefined; now?: () => number } = {}) {}
  private now() { return (this.options.now || Date.now)(); }
  private grants(): Grant[] {
    try {
      const raw = (this.options.readGrants || (() => process.env.G360_EXTERNAL_ACCESS_GRANTS))();
      if (!raw || raw.length > 16384) return [];
      const grants = JSON.parse(raw);
      if (!Array.isArray(grants) || grants.length > 16) return [];
      const keys = ['id', 'provider', 'cost', 'evidenceRef', 'issuedAt', 'expiresAt', 'maxCallsPerProcess'];
      const ids = new Set<string>(); const byProvider = new Set<ExternalProvider>();
      for (const g of grants) {
        if (!g || Object.keys(g).length !== keys.length || Object.keys(g).some(k => !keys.includes(k))
          || typeof g.id !== 'string' || !/^[a-zA-Z0-9_-]{3,80}$/.test(g.id) || ids.has(g.id)
          || !providers.has(g.provider) || byProvider.has(g.provider) || g.cost !== 'free_verified'
          || typeof g.evidenceRef !== 'string' || !g.evidenceRef.trim() || g.evidenceRef.length > 200
          || typeof g.issuedAt !== 'string' || typeof g.expiresAt !== 'string'
          || !Number.isSafeInteger(g.maxCallsPerProcess) || g.maxCallsPerProcess < 1 || g.maxCallsPerProcess > 1000) return [];
        const start = Date.parse(g.issuedAt), end = Date.parse(g.expiresAt);
        if (!Number.isFinite(start) || !Number.isFinite(end) || new Date(start).toISOString() !== g.issuedAt || new Date(end).toISOString() !== g.expiresAt || end <= start || end - start > 3600000) return [];
        ids.add(g.id); byProvider.add(g.provider);
      }
      return grants;
    } catch { return []; }
  }
  private grant(provider: ExternalProvider) {
    const time = this.now();
    return this.grants().find(g => g.provider === provider && Date.parse(g.issuedAt) <= time && Date.parse(g.expiresAt) > time);
  }
  allowed(provider: ExternalProvider): boolean {
    const g = this.grant(provider);
    return !!g && (this.used.get(g.id) || 0) < g.maxCallsPerProcess;
  }
  reserve(provider: ExternalProvider): void {
    const g = this.grant(provider);
    if (!g) throw new ExternalAccessError(403, 'Saída externa sem autorização gratuita comprovada pelo operador.');
    const count = this.used.get(g.id) || 0;
    if (count >= g.maxCallsPerProcess) throw new ExternalAccessError(429, 'Limite local da autorização externa atingido.');
    if (!this.used.has(g.id) && this.used.size >= 10000) throw new ExternalAccessError(503, 'Capacidade local da política externa indisponível.');
    // No rollback: a failure after dispatch may still consume provider quota.
    this.used.set(g.id, count + 1);
  }
  status(provider: ExternalProvider) {
    return { provider, allowed: this.allowed(provider), creditType: 'unknown', balance: null, paidUseAuthorized: false };
  }
}
export const externalAccess = new ExternalAccessPolicy();

/** Fixed provider APIs only. User-supplied URLs must continue through publicUrlClient. */
export async function providerFetch(input: string | URL, init: RequestInit = {}, policy = externalAccess, transport: typeof fetch = fetch, limits: { timeoutMs?: number } = {}): Promise<Response> {
  let url: URL;
  try { url = new URL(input); } catch { throw new ExternalAccessError(403, 'Destino externo não permitido.'); }
  const method = (init.method || 'GET').toUpperCase();
  const destination = url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
    && destinations.find(d => d.host === url.hostname && d.method === method && d.path.test(url.pathname));
  if (!destination) throw new ExternalAccessError(403, 'Destino externo não permitido.');
  const timeoutMs = limits.timeoutMs ?? 10000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new ExternalAccessError(403, 'Limite de transporte inválido.');
  if (init.signal?.aborted) throw new ExternalAccessError(502, 'Solicitação externa cancelada.');
  policy.reserve(destination.provider);
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let abort!: () => void;
  const deadline = new Promise<never>((_, reject) => {
    abort = () => {
      reject(Error('Deadline or cancellation'));
      controller.abort();
      reader?.cancel().catch(() => {});
    };
    timer = setTimeout(abort, timeoutMs);
    init.signal?.addEventListener('abort', abort, { once: true });
  });
  try {
    const operation = async () => {
      const response = await transport(url.href, { ...init, method, redirect: 'error', signal: controller.signal });
      if (controller.signal.aborted) { await response.body?.cancel(); throw Error('Deadline'); }
      if (response.status >= 300 && response.status < 400) throw Error('Redirect denied');
      const advertised = response.headers.get('content-length');
      if (advertised && (!/^\d+$/.test(advertised) || Number(advertised) > 2 * 1024 * 1024)) {
        await response.body?.cancel(); throw Error('Response too large');
      }
      if (!response.body) return response;
      reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          size += value.byteLength; if (size > 2 * 1024 * 1024) throw Error('Response too large'); chunks.push(value);
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
      const headers = new Headers(response.headers); headers.delete('content-length'); headers.delete('content-encoding');
      return new Response(Buffer.concat(chunks), { status: response.status, statusText: response.statusText, headers });
    };
    return await Promise.race([operation(), deadline]);
  } catch { throw new ExternalAccessError(502, 'Provedor externo indisponível ou resposta fora dos limites.'); }
  finally { clearTimeout(timer!); init.signal?.removeEventListener('abort', abort); }
}

/** Reserve before every SDK method, including methods obtained before a grant expires. */
export function guardSdkClient<T extends object>(provider: ExternalProvider, client: T, policy = externalAccess): T {
  const wrapped = new WeakMap<object, object>();
  const wrap = (object: object): object => {
    const cached = wrapped.get(object); if (cached) return cached;
    const proxy = new Proxy(object, { get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value === 'function') return (...args: unknown[]) => { policy.reserve(provider); return Reflect.apply(value, target, args); };
      return value && typeof value === 'object' ? wrap(value) : value;
    } });
    wrapped.set(object, proxy); return proxy;
  };
  return wrap(client) as T;
}
