import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { AtomicJsonStore, isApplicationDb } from '../src/server/jsonPersistence.mjs';

const checkout = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_BYTES = 64 * 1024 * 1024;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const parse = bytes => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));

function readRegular(file, io) {
  const descriptor = io.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const info = io.fstatSync(descriptor);
    if (!info.isFile() || info.size > MAX_BYTES) throw Error('Arquivo inválido ou acima do limite de backup.');
    return io.readFileSync(descriptor);
  } finally { io.closeSync(descriptor); }
}

function destinationOutsideCheckout(destination, protectedRoot, io) {
  const parent = io.realpathSync(path.dirname(path.resolve(destination)));
  const root = io.realpathSync(protectedRoot);
  if (parent === root || parent.startsWith(`${root}${path.sep}`)) {
    throw Error('O destino deve ficar fora do diretório do aplicativo, em local privado.');
  }
  return path.join(parent, path.basename(destination));
}

function createExclusive(destination, bytes, io) {
  // An interrupted export may leave an incomplete artifact. Never overwrite it;
  // verification rejects it and the operator chooses a different fresh path.
  const descriptor = io.openSync(destination, 'wx', 0o600);
  try {
    io.fchmodSync(descriptor, 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const written = io.writeSync(descriptor, bytes, offset, bytes.length - offset);
      if (!written) throw Error('Gravação incompleta. Preserve o arquivo para inspeção.');
      offset += written;
    }
    io.fsyncSync(descriptor);
  } finally { io.closeSync(descriptor); }
  const directory = io.openSync(path.dirname(destination), 'r');
  try { io.fsyncSync(directory); } finally { io.closeSync(directory); }
}

export function verifyBackup(file, { io = fs } = {}) {
  const envelope = parse(readRegular(file, io));
  if (envelope?.format !== 'g360-external-backup-v1' || typeof envelope.bytes !== 'string'
      || !/^[a-f0-9]{64}$/.test(envelope.sha256 || '')
      || !Number.isSafeInteger(envelope.byteLength) || envelope.byteLength < 1) {
    throw Error('Formato de backup inválido.');
  }
  const bytes = Buffer.from(envelope.bytes, 'base64');
  if (bytes.length !== envelope.byteLength || bytes.toString('base64') !== envelope.bytes
      || digest(bytes) !== envelope.sha256 || !isApplicationDb(parse(bytes))) {
    throw Error('Backup inválido: conteúdo, estrutura ou integridade divergente.');
  }
  return { bytes, sha256: envelope.sha256 };
}

export function exportBackup(source, destination, { protectedRoot = checkout, io = fs } = {}) {
  const store = new AtomicJsonStore(path.resolve(source), { validate: isApplicationDb, io });
  const snapshot = store.begin();
  const bytes = readRegular(path.resolve(source), io);
  if (digest(bytes) !== snapshot.revision) throw Error('A base mudou durante a leitura; tente um novo backup.');
  const target = destinationOutsideCheckout(destination, protectedRoot, io);
  const envelope = Buffer.from(JSON.stringify({
    format: 'g360-external-backup-v1', createdAt: new Date().toISOString(),
    sha256: snapshot.revision, byteLength: bytes.length, bytes: bytes.toString('base64'),
  }));
  if (envelope.length > MAX_BYTES) throw Error('Backup acima do limite de tamanho.');
  createExclusive(target, envelope, io);
  const verified = verifyBackup(target, { io });
  if (verified.sha256 !== snapshot.revision) throw Error('Não foi possível confirmar a cópia gravada.');
  return { sha256: verified.sha256, byteLength: bytes.length };
}

export function restoreBackup(backup, destination, { protectedRoot = checkout, io = fs } = {}) {
  const verified = verifyBackup(path.resolve(backup), { io });
  const target = destinationOutsideCheckout(destination, protectedRoot, io);
  createExclusive(target, verified.bytes, io);
  const restored = new AtomicJsonStore(target, { validate: isApplicationDb, io }).begin();
  if (restored.revision !== verified.sha256) throw Error('Restauração não confirmada; preserve o arquivo para inspeção.');
  return { sha256: restored.revision, byteLength: verified.bytes.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [action, source, destination, ...extra] = process.argv.slice(2);
    if (extra.length || !source || !['export', 'verify', 'restore-new'].includes(action)
        || (action !== 'verify' && !destination) || (action === 'verify' && destination)) {
      throw Error('Uso: node scripts/backup-json.mjs export ORIGEM DESTINO | verify BACKUP | restore-new BACKUP NOVO_ARQUIVO');
    }
    const result = action === 'export' ? exportBackup(source, destination)
      : action === 'restore-new' ? restoreBackup(source, destination) : verifyBackup(source);
    console.log(JSON.stringify({ ok: true, action, sha256: result.sha256, byteLength: result.byteLength ?? result.bytes.length }));
  } catch {
    // IO exceptions can include paths/PII; never dump the original error or data.
    console.error('Operação não confirmada. Verifique os argumentos, permissões, espaço e integridade. Nenhum arquivo existente foi substituído.');
    process.exitCode = 1;
  }
}
