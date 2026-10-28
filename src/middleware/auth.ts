import { Request, Response, NextFunction } from 'express';
import { AtomicJsonStore, isApplicationDb } from '../server/jsonPersistence.mjs';
import { randomBytes } from 'node:crypto';
import { adminAuth } from '../lib/firebase-admin.ts';
import { accountIsActive } from '../server/authPolicy.ts';
import { dataFile } from '../server/dataPaths.mjs';

const DB_PATH = dataFile('db.json');

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  role: 'admin' | 'user';
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

function getLocalUser(uid: string) {
  const snapshot = new AtomicJsonStore(DB_PATH, { validate: isApplicationDb }).begin();
  return snapshot.data.users.find((u: any) => u.id === uid) || null;
}

type Session = { uid: string; expires: number; firebaseAuthTime?: number };
const sessions = new Map<string, Session>();
function createSession(session: Session): string {
  for (const [token, entry] of sessions) if (entry.expires <= Date.now()) sessions.delete(token);
  if (sessions.size >= 10000) throw new Error('Session capacity unavailable');
  const token = randomBytes(32).toString('base64url');
  sessions.set(token, session);
  return token;
}
export function createLocalSession(uid: string): string {
  return createSession({ uid, expires: Date.now() + 8 * 60 * 60 * 1000 });
}
export function revokeLocalSession(token: string | undefined): void {
  if (token) sessions.delete(token);
}
// Firebase-backed opaque sessions retain their original authentication time.
// Current roles and revocation come from Firebase, never a stale local role.
async function firebaseAuthority(uid: string, authTime: number) {
  if (!Number.isFinite(authTime) || authTime <= 0 || authTime * 1000 > Date.now() + 60000) return null;
  let record;
  try { record = await adminAuth.getUser(uid); }
  catch (error: any) {
    if (error?.code === 'auth/user-not-found') return null;
    throw new Error('Identity verification unavailable');
  }
  if (record.uid !== uid || record.disabled || !record.emailVerified) return null;
  if (record.tokensValidAfterTime) {
    const validAfter = Date.parse(record.tokensValidAfterTime) / 1000;
    if (!Number.isFinite(validAfter) || authTime < validAfter) return null;
  }
  return { role: record.customClaims?.admin === true || record.customClaims?.role === 'admin' ? 'admin' as const : 'user' as const,
    email: record.email, name: record.displayName };
}
export async function createFirebaseSession(uid: string, authTime: number) {
  const user = getLocalUser(uid);
  if (!accountIsActive(user)) return null;
  const authority = await firebaseAuthority(uid, authTime);
  if (!authority) return null;
  return { token: createSession({ uid, expires: Date.now() + 8 * 60 * 60 * 1000, firebaseAuthTime: authTime }), user: { ...user, ...authority } };
}
async function getSessionUser(token: string | undefined) {
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expires <= Date.now()) { sessions.delete(token!); return null; }
  const user = getLocalUser(session.uid);
  if (!accountIsActive(user)) return null;
  if (session.firebaseAuthTime !== undefined) {
    const authority = await firebaseAuthority(session.uid, session.firebaseAuthTime);
    if (!authority) { sessions.delete(token!); return null; }
    return { ...user, ...authority };
  }
  return user;
}
export function localSessionUser(token: string | undefined) { return getSessionUser(token); }
export async function rotateLocalSession(token: string | undefined) {
  const user = await getSessionUser(token);
  const original = token && sessions.get(token);
  if (!user || !original) return null;
  const replacement = createSession({ ...original, expires: Date.now() + 8 * 60 * 60 * 1000 });
  sessions.delete(token!);
  return { token: replacement, user };
}

/**
 * Validates authentication via Firebase Bearer ID Token or valid session cookie.
 * Fails closed with HTTP 401 if unauthenticated.
 */
const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  // 1. Try Firebase Bearer Token
  if (authHeader !== undefined) {
    const match = /^Bearer ([^\s]+)$/i.exec(authHeader);
    if (!match) return res.status(401).json({ error: 'Unauthorized: Cabeçalho de autenticação inválido.' });
    const token = match[1];
    if (token) {
      try {
        if (token.length > 16384) return res.sendStatus(401);
        const decodedToken = await adminAuth.verifyIdToken(token, true);
        if (!decodedToken.uid || decodedToken.email_verified !== true) return res.sendStatus(401);
        const local = getLocalUser(decodedToken.uid);
        if (local && !accountIsActive(local)) return res.sendStatus(401);
        const authority = await firebaseAuthority(decodedToken.uid, decodedToken.auth_time);
        if (!authority) return res.sendStatus(401);

        req.user = {
          uid: decodedToken.uid,
          ...authority,
        };
        return next();
      } catch (error) {
        console.warn('[Auth] Invalid or expired Firebase ID token');
        return res.status(401).json({ error: 'Unauthorized: Token de autenticação inválido ou expirado.' });
      }
    }
  }

  // 2. Try Local Session Cookie (sxp_uid)
  const cookieUid = req.cookies?.sxp_uid;
  if (cookieUid) {
    const localUser = await getSessionUser(cookieUid);
    if (localUser) {
      const isAdmin = localUser.role === 'admin';

      req.user = {
        uid: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: isAdmin ? 'admin' : 'user',
      };
      return next();
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Autenticação necessária para acessar este recurso.' });
};

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => authenticate(req, res, next).catch(next);

/**
 * Strict RBAC: Requires authenticated user with validated role === 'admin'.
 * Fails closed: 401 if unauthenticated, 403 if authenticated but not admin.
 */
export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  await requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: Acesso restrito exclusivamente a administradores do sistema.',
      });
    }
    next();
  });
};
