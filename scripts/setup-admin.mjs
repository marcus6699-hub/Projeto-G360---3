import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AtomicJsonStore, isApplicationDb } from '../src/server/jsonPersistence.mjs';
import { dataFile } from '../src/server/dataPaths.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file = dataFile('db.json');
const email = process.env.G360_SETUP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.G360_SETUP_ADMIN_PASSWORD;
const uid = process.env.G360_SETUP_ADMIN_UID?.trim();
const store = new AtomicJsonStore(file, { validate: isApplicationDb });
const transaction = store.begin();
const db = transaction.data;
if (!Array.isArray(db.users)) throw Error('Base sem lista de usuários válida. Nada foi alterado.');
if (!email || !password || password.length < 16) throw Error('Configure email e senha de ao menos 16 caracteres nas variáveis seguras.');
if (db.users.some(u => u.email?.toLowerCase() === email && u.id !== uid) && uid) throw Error('Email e UID não identificam a mesma conta.');
const existing = uid ? db.users.find(u => u.id === uid && u.email?.toLowerCase() === email && u.role === 'admin') : null;
if (uid && !existing) throw Error('Administrador informado não encontrado. Nada foi alterado.');
if (!uid && db.users.length) throw Error('Já existem usuários. Informe o UID e email de um administrador comprovado; nenhuma conta será apropriada automaticamente.');
if (process.argv[2] !== '--apply') {
  console.log(existing ? 'Prévia: redefinir senha do administrador identificado.' : 'Prévia: criar primeiro administrador em base vazia.');
  console.log('Nada foi alterado. --apply exige autorização para dados reais.');
  process.exit(0);
}
const salt = randomBytes(16).toString('hex');
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
if (existing) existing.password = hash;
else db.users.push({ id: randomBytes(16).toString('hex'), name: 'Administrador', email, password: hash, role: 'admin' });
const backupDir = path.join(root, '..', 'g360-admin-backups');
fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
fs.chmodSync(backupDir, 0o700);
const backup = path.join(backupDir, `db.before-admin-setup-${Date.now()}.json`);
fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
fs.chmodSync(backup, 0o600);
store.commit(db, transaction.revision);
console.log(existing ? 'Senha do administrador redefinida.' : 'Administrador inicial criado.');
console.log(`Backup local: ${backup}`);
