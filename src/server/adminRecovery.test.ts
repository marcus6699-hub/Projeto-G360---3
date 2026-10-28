import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { scryptSync, createHash } from 'node:crypto';
import { AtomicJsonStore, isApplicationDb } from './jsonPersistence.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const oldPassword = 'old-fixture-admin-password';
const newPassword = 'new-fixture-admin-password';
const passwordHash = (password: string) => `scrypt:fixture-salt:${scryptSync(password, 'fixture-salt', 64).toString('hex')}`;
function matches(password: string, hash: string) {
  const [, salt, expected] = hash.split(':');
  return scryptSync(password, salt, 64).toString('hex') === expected;
}
function fixture() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-admin-rehearsal-'));
  const root = path.join(workspace, 'app');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/server'), { recursive: true });
  fs.copyFileSync(path.join(source, 'scripts/setup-admin.mjs'), path.join(root, 'scripts/setup-admin.mjs'));
  fs.copyFileSync(path.join(source, 'src/server/jsonPersistence.mjs'), path.join(root, 'src/server/jsonPersistence.mjs'));
  fs.copyFileSync(path.join(source, 'src/server/dataPaths.mjs'), path.join(root, 'src/server/dataPaths.mjs'));
  const data = {
    users: [{ id: 'fixture-admin', name: 'Fictitious Admin', email: 'admin@example.invalid', role: 'admin', password: passwordHash(oldPassword) },
      { id: 'fixture-user', name: 'Fictitious User', email: 'user@example.invalid', role: 'user', password: passwordHash('other-fixture-password') }],
    projects: [{ id: 'fixture-project', ownerUid: 'fixture-user', data: { fixture: true } }],
    clicks: {}, aiSettings: {}, g360: { audits: [{ id: 'fixture-audit' }], crmLeads: [{ id: 'fixture-lead' }] },
  };
  const file = path.join(root, 'db.json');
  fs.writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
  const before = fs.readFileSync(file);
  const run = (apply = false, options: { uid?: string; email?: string; password?: string } = {}) => spawnSync(process.execPath,
    [path.join(root, 'scripts/setup-admin.mjs'), ...(apply ? ['--apply'] : [])], {
      cwd: root, encoding: 'utf8', timeout: 10_000,
      env: { PATH: process.env.PATH, G360_SETUP_ADMIN_UID: options.uid ?? 'fixture-admin', G360_SETUP_ADMIN_EMAIL: options.email ?? 'admin@example.invalid', G360_SETUP_ADMIN_PASSWORD: options.password ?? newPassword },
    });
  return { workspace, root, data, file, before, run };
}

test('administrative recovery preview never changes fixture data or creates backups', () => {
  const f = fixture();
  const result = f.run();
  assert.equal(result.status, 0);
  assert.deepEqual(fs.readFileSync(f.file), f.before);
  assert.equal(fs.existsSync(path.join(f.workspace, 'g360-admin-backups')), false);
  assert.equal((result.stdout + result.stderr).includes(newPassword), false);
});

test('administrative recovery refuses unknown identity and mismatched email without modifying fixture', () => {
  for (const options of [{ uid: 'unknown-fixture' }, { email: 'other@example.invalid' }, { uid: 'fixture-user', email: 'user@example.invalid' }]) {
    const f = fixture();
    assert.notEqual(f.run(true, options).status, 0);
    assert.deepEqual(fs.readFileSync(f.file), f.before);
  }
});

test('administrative recovery requires strong supplied password and explicit UID for an existing database', () => {
  for (const options of [{ password: 'short-fixture' }, { uid: '' }]) {
    const f = fixture();
    assert.notEqual(f.run(true, options).status, 0);
    assert.deepEqual(fs.readFileSync(f.file), f.before);
  }
});

test('offline fixture recovery changes only intended hash, preserves all records, verifies external backup and restoration into separate copy', () => {
  const f = fixture();
  const result = f.run(true);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout + result.stderr).includes(newPassword), false);
  const after = new AtomicJsonStore(f.file, { validate: isApplicationDb }).begin().data;
  assert.equal(matches(newPassword, after.users[0].password), true);
  assert.equal(matches(oldPassword, after.users[0].password), false);
  const changedHash = after.users[0].password;
  after.users[0].password = f.data.users[0].password;
  assert.deepEqual(after, f.data);
  assert.notEqual(changedHash, f.data.users[0].password);
  const backupDir = path.join(f.workspace, 'g360-admin-backups');
  const backups = fs.readdirSync(backupDir);
  assert.equal(backups.length, 1);
  const backup = path.join(backupDir, backups[0]);
  assert.deepEqual(fs.readFileSync(backup), f.before);
  if (process.platform !== 'win32') assert.equal(fs.statSync(backup).mode & 0o777, 0o600);
  // A second directory simulates an external destination, not an independent disk.
  const externalDir = path.join(f.workspace, 'external-backup-simulation');
  fs.mkdirSync(externalDir, { mode: 0o700 });
  const externalFile = path.join(externalDir, 'verified-backup.json');
  fs.copyFileSync(backup, externalFile, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(externalFile, 0o600);
  const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest(fs.readFileSync(externalFile)), digest(f.before));
  const restoredFile = path.join(f.workspace, 'restored-fixture.json');
  fs.copyFileSync(externalFile, restoredFile, fs.constants.COPYFILE_EXCL);
  const restored = new AtomicJsonStore(restoredFile, { validate: isApplicationDb }).begin().data;
  assert.deepEqual(restored, f.data);
  assert.equal(matches(oldPassword, restored.users[0].password), true);
  assert.equal(matches(newPassword, restored.users[0].password), false);
  assert.equal(matches(newPassword, JSON.parse(fs.readFileSync(f.file, 'utf8')).users[0].password), true);
});

test('administrative recovery refuses corrupt fixture without silently replacing users', () => {
  const f = fixture();
  fs.writeFileSync(f.file, '{invalid fixture');
  assert.notEqual(f.run(true).status, 0);
  assert.equal(fs.readFileSync(f.file, 'utf8'), '{invalid fixture');
});

test('offline administrative rehearsal verifies actual HTTP login before and after recovery using only copied source and fictitious database', () => {
  const f = fixture();
  fs.cpSync(path.join(source, 'src'), path.join(f.root, 'src'), { recursive: true });
  fs.copyFileSync(path.join(source, 'server.ts'), path.join(f.root, 'server.ts'));
  fs.writeFileSync(path.join(f.root, 'package.json'), JSON.stringify({ type: 'module' }));
  fs.writeFileSync(path.join(f.root, 'firebase-applet-config.json'), JSON.stringify({ projectId: 'g360-recovery-fixture' }));
  fs.symlinkSync(path.join(source, 'node_modules'), path.join(f.root, 'node_modules'), 'dir');
  const check = (expectedOld: number, expectedNew: number) => {
    const code = `
      import assert from 'node:assert/strict';
      import { app } from './server.ts';
      const server = app.listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
      const base = 'http://127.0.0.1:' + server.address().port;
      try {
        for (const [password, expected] of [[${JSON.stringify(oldPassword)}, ${expectedOld}], [${JSON.stringify(newPassword)}, ${expectedNew}]]) {
          const response = await fetch(base + '/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email: 'admin@example.invalid', password })});
          assert.equal(response.status, expected);
          if (expected === 200) {
            const cookie = response.headers.get('set-cookie').split(';')[0];
            assert.equal((await fetch(base + '/api/projects', {headers: {Cookie: cookie}})).status, 200);
            assert.equal((await fetch(base + '/api/g360/users', {headers: {Cookie: cookie}})).status, 200);
          }
        }
      } finally { await new Promise(resolve => server.close(resolve)); }
    `;
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      cwd: f.root, encoding: 'utf8', timeout: 15_000,
      env: { PATH: process.env.PATH, NODE_ENV: 'test', G360_FIREBASE_PROJECT_ID: 'g360-recovery-fixture' },
    });
    assert.equal(result.status, 0, result.stderr);
  };
  check(200, 401);
  // No live app is running while the offline recovery script updates the fixture.
  assert.equal(f.run(true).status, 0);
  check(401, 200);
});
