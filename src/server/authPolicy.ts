import type { Request, Response, NextFunction } from 'express';

/** Explicit browser origins only; proxy forwarded headers are deliberately ignored. */
export function trustedRequestOrigin(req: Request, configuredOrigins: string[] = []): boolean {
  const origin = req.headers.origin;
  if (origin === undefined) return true; // CLI/server clients still need ordinary authentication.
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;
    const host = req.get('host');
    if (host && origin === `${req.protocol}://${host}`) return true;
    return configuredOrigins.some(value => {
      try { const allowed = new URL(value); return allowed.origin === value && value === origin; }
      catch { return false; }
    });
  } catch { return false; }
}

export function protectBrowserMutation(configuredOrigins: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || trustedRequestOrigin(req, configuredOrigins)) return next();
    return res.status(403).json({ detail: 'Origem da solicitação não autorizada.' });
  };
}

/** Process-local protection, not a replacement for a shared limit at the production edge. */
export function createAuthAttemptLimiter(options: { limit?: number; windowMs?: number; maxClients?: number; now?: () => number } = {}) {
  const limit = options.limit ?? 20;
  const windowMs = options.windowMs ?? 60_000;
  const maxClients = options.maxClients ?? 10_000;
  const now = options.now ?? Date.now;
  const clients = new Map<string, { count: number; until: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const time = now();
    const key = req.socket.remoteAddress || 'unknown'; // Never trust user-controlled X-Forwarded-For.
    let entry = clients.get(key);
    if (!entry || entry.until <= time) {
      if (clients.size >= maxClients) {
        for (const [client, state] of clients) if (state.until <= time) clients.delete(client);
        if (clients.size >= maxClients && !clients.has(key)) {
          res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
          return res.status(429).json({ detail: 'Muitas tentativas. Aguarde para tentar novamente.' });
        }
      }
      entry = { count: 0, until: time + windowMs };
      clients.set(key, entry);
    }
    if (++entry.count > limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.until - time) / 1000))));
      return res.status(429).json({ detail: 'Muitas tentativas. Aguarde para tentar novamente.' });
    }
    return next();
  };
}

export function validLoginInput(email: unknown, password: unknown): email is string {
  return typeof email === 'string' && email.trim().length > 0 && email.length <= 254 &&
    typeof password === 'string' && password.length > 0 && password.length <= 1024;
}

export function validRegistrationInput(name: unknown, email: unknown, password: unknown): boolean {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= 120 &&
    validLoginInput(email, password) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email as string).trim());
}

export function accountIsActive(user: { status?: unknown } | null | undefined): boolean {
  return !!user && (user.status === undefined || user.status === 'active');
}
