import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TextDecoder } from 'node:util';

const contexts = new AsyncLocalStorage();
const checksum = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
export class JsonPersistenceError extends Error {
  constructor(message = 'Não foi possível persistir os dados com segurança.', status = 503, uncertain = false) {
    super(message); this.status = status; this.uncertain = uncertain;
  }
}
export function persistenceFailure(error) {
  const failure = error instanceof JsonPersistenceError ? error : new JsonPersistenceError();
  const context = contexts.getStore();
  if (context && (!context.failure || failure.uncertain)) context.failure = failure;
  return failure;
}
export function assertPersistenceHealthy() {
  const failure = contexts.getStore()?.failure;
  if (failure) throw failure;
}
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function isApplicationDb(value) {
  return isObject(value) && Array.isArray(value.users) && value.users.every(user => isObject(user) && typeof user.id === 'string' && typeof user.email === 'string' && typeof user.role === 'string')
    && ['evidenceAudits', 'evidenceClients'].every(key => value[key] === undefined || (Array.isArray(value[key]) && value[key].every(entry => isObject(entry) && typeof entry.id === 'string' && typeof entry.uid === 'string')))
    && Array.isArray(value.projects) && value.projects.every(project => isObject(project) && typeof project.id === 'string')
    && isObject(value.clicks) && isObject(value.aiSettings)
    && (value.g360 === undefined || (isObject(value.g360)
      && (value.g360.audits === undefined || Array.isArray(value.g360.audits))
      && (value.g360.crmLeads === undefined || Array.isArray(value.g360.crmLeads))
      && (value.g360.packagesByBusiness === undefined || isObject(value.g360.packagesByBusiness))));
}
function parse(bytes, validate) {
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new JsonPersistenceError('Arquivo JSON ausente, vazio ou inválido; nenhum dado foi substituído.'); }
  if (!validate(value)) throw new JsonPersistenceError('Estrutura JSON inválida; nenhum dado foi substituído.');
  return value;
}
function readBytes(file, io) {
  const stat = io.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new JsonPersistenceError('Arquivo de dados não é um arquivo regular.');
  const fd = io.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    if (!io.fstatSync(fd).isFile()) throw new JsonPersistenceError('Arquivo de dados não é um arquivo regular.');
    return io.readFileSync(fd);
  } finally { io.closeSync(fd); }
}

/** Plain JSON schema stays unchanged. All cooperating writers share this lock/CAS protocol. */
export class AtomicJsonStore {
  constructor(file, options = /** @type {any} */ ({})) {
    this.file = file;
    this.backup = `${file}.g360-previous.json`;
    this.lock = `${file}.g360-lock`;
    this.io = options.io || fs;
    this.validate = options.validate || isObject;
    this.allowMissing = options.allowMissing === true;
    this.initial = options.initial;
    this.revision = null;
    this.data = undefined;
    this.uncertain = false;
  }
  begin() {
    try {
      assertPersistenceHealthy();
      if (this.uncertain) throw new JsonPersistenceError('Estado da gravação incerto; requer verificação e reinício.', 503, true);
      let bytes;
      try { bytes = readBytes(this.file, this.io); }
      catch (error) {
        if (error.code === 'ENOENT' && this.allowMissing) {
          const value = clone(typeof this.initial === 'function' ? this.initial() : this.initial);
          if (!this.validate(value)) throw new JsonPersistenceError();
          this.revision = null; this.data = value;
          return { data: clone(value), revision: null };
        }
        throw error;
      }
      this.data = parse(bytes, this.validate); this.revision = checksum(bytes);
      return { data: clone(this.data), revision: this.revision };
    } catch (error) { throw persistenceFailure(error); }
  }
  // Recovery is explicit and read-only: never automatically replace a corrupt original.
  previous() {
    try {
      const backup = parse(readBytes(this.backup, this.io), value => isObject(value)
        && value.format === 'g360-json-previous-v1' && typeof value.bytes === 'string'
        && typeof value.sha256 === 'string' && checksum(Buffer.from(value.bytes, 'base64')) === value.sha256);
      const bytes = Buffer.from(backup.bytes, 'base64');
      return { bytes, data: parse(bytes, this.validate), revision: backup.sha256 };
    } catch (error) { throw persistenceFailure(error); }
  }
  commit(value, expectedRevision = this.revision) {
    const io = this.io;
    const temporary = new Set();
    let locked = false, directory, renamed = false;
    const stage = (destination, bytes, metadata = null) => {
      const file = `${destination}.tmp-${randomBytes(12).toString('hex')}`;
      const fd = io.openSync(file, 'wx', 0o600); temporary.add(file);
      try {
        if (metadata) {
          const created = io.fstatSync(fd);
          if (created.uid !== metadata.uid || created.gid !== metadata.gid) io.fchownSync(fd, metadata.uid, metadata.gid);
          io.fchmodSync(fd, metadata.mode & 0o777);
        }
        let offset = 0;
        while (offset < bytes.length) {
          const count = io.writeSync(fd, bytes, offset, bytes.length - offset);
          if (!count) throw new JsonPersistenceError();
          offset += count;
        }
        io.fsyncSync(fd);
      } finally { io.closeSync(fd); }
      return file;
    };
    try {
      assertPersistenceHealthy();
      if (this.uncertain) throw new JsonPersistenceError('Estado da gravação incerto; requer verificação e reinício.', 503, true);
      const serialized = Buffer.from(JSON.stringify(value, null, 2));
      const parsed = parse(serialized, this.validate);
      io.mkdirSync(this.lock, { mode: 0o700 }); locked = true;
      let current = null;
      try { current = readBytes(this.file, io); }
      catch (error) { if (!(error.code === 'ENOENT' && this.allowMissing)) throw error; }
      if (current) parse(current, this.validate);
      const actual = current ? checksum(current) : null;
      if (expectedRevision !== actual) throw new JsonPersistenceError('Os dados mudaram durante a operação. Recarregue e tente novamente.', 409);
      directory = io.openSync(path.dirname(this.file), 'r');
      // Fail before touching the original if this filesystem cannot sync directories.
      io.fsyncSync(directory);
      const staged = stage(this.file, serialized, current ? io.lstatSync(this.file) : null);
      if (current) {
        // Refuse to overwrite an unknown or damaged file at the reserved backup path.
        try { io.lstatSync(this.backup); this.previous(); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        const backupBytes = Buffer.from(JSON.stringify({ format: 'g360-json-previous-v1', sha256: actual, bytes: current.toString('base64') }));
        const previous = stage(this.backup, backupBytes);
        io.renameSync(previous, this.backup); temporary.delete(previous);
        io.fsyncSync(directory);
      }
      // Catch edits by non-cooperating tools too, as close to replacement as possible.
      let latest = null;
      try { latest = readBytes(this.file, io); } catch (error) { if (!(error.code === 'ENOENT' && this.allowMissing)) throw error; }
      if ((latest ? checksum(latest) : null) !== actual) throw new JsonPersistenceError('Conflito de gravação. Recarregue e tente novamente.', 409);
      io.renameSync(staged, this.file); temporary.delete(staged); renamed = true;
      io.fsyncSync(directory);
      this.data = parsed; this.revision = checksum(serialized);
      return this.revision;
    } catch (error) {
      if (renamed) this.uncertain = true;
      const failure = error instanceof JsonPersistenceError ? error : new JsonPersistenceError();
      if (renamed) failure.uncertain = true;
      throw persistenceFailure(failure);
    } finally {
      if (directory !== undefined) try { io.closeSync(directory); } catch { /* original and backup retained */ }
      // Only remove temporary artifacts created by THIS operation, never a data/backup file.
      for (const file of temporary) try { io.unlinkSync(file); } catch { /* retained for inspection */ }
      if (locked) {
        try { io.rmdirSync(this.lock); }
        catch { this.uncertain = true; throw persistenceFailure(new JsonPersistenceError('Bloqueio de gravação não liberado; requer verificação.', 503, true)); }
      }
    }
  }
}

function documentContext(store) {
  const context = contexts.getStore();
  if (!context) throw persistenceFailure(new JsonPersistenceError('Operação de dados fora de uma transação.'));
  if (!context.documents.has(store)) context.documents.set(store, store.begin());
  return context.documents.get(store);
}
export function scopedDocument(store) {
  return new Proxy({}, {
    get: (_target, key) => documentContext(store).data[key],
    set: (_target, key, value) => { documentContext(store).data[key] = value; return true; },
    ownKeys: () => Reflect.ownKeys(documentContext(store).data),
    getOwnPropertyDescriptor: (_target, key) => ({ configurable: true, enumerable: true, value: documentContext(store).data[key] }),
  });
}
export function commitDocument(store, value) {
  const document = documentContext(store);
  document.revision = store.commit(value, document.revision);
}
// The response guard also covers old catch/fallback paths that swallow an IO error.
export function persistenceContext(req, res, next) {
  const context = { documents: new Map(), failure: null };
  const end = res.end.bind(res), write = res.write.bind(res);
  let terminated = false;
  const failResponse = () => {
    if (terminated) return res;
    terminated = true;
    if (res.headersSent) { res.destroy(); return res; }
    res.statusCode = context.failure.status;
    for (const name of ['Content-Length', 'ETag', 'Content-Encoding', 'Location', 'Set-Cookie']) res.removeHeader(name);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return end(JSON.stringify({ ok: false, detail: context.failure.message, persistenceUncertain: context.failure.uncertain }));
  };
  res.end = (...args) => context.failure ? failResponse() : end(...args);
  res.write = (...args) => { if (context.failure) { failResponse(); return false; } return write(...args); };
  contexts.run(context, next);
}
export function persistenceErrorHandler(error, req, res, next) {
  if (!(error instanceof JsonPersistenceError)) return next(error);
  persistenceFailure(error);
  if (res.headersSent) return res.destroy();
  return res.status(error.status).json({ ok: false, detail: error.message, persistenceUncertain: error.uncertain });
}
/** @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<any>} handler
 * @returns {import('express').RequestHandler} */
export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve().then(() => handler(req, res, next)).catch(next);
}

// Storage files must never be delivered by a later static/dev middleware.
export function protectPrivateJsonFiles(req, res, next) {
  let pathname = req.path;
  for (let pass = 0; pass < 6; pass++) {
    if (/(?:^|[\\/])(?:db\.json|cost-guard-metrics\.json)(?:$|[.\\/?#])/i.test(pathname)) return res.sendStatus(404);
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { return res.sendStatus(400); }
    if (decoded === pathname) return next();
    pathname = decoded;
  }
  return res.sendStatus(400);
}
