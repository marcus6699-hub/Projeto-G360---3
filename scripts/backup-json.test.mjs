import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { exportBackup, verifyBackup, restoreBackup } from './backup-json.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-backup-fixture-'));
  const app = path.join(root, 'app'), external = path.join(root, 'external');
  fs.mkdirSync(app, { mode: 0o700 }); fs.mkdirSync(external, { mode: 0o700 });
  const source = path.join(app, 'db.json'), backup = path.join(external, 'snapshot.g360');
  const data = { users: [{ id: 'fixture-admin', email: 'admin@example.invalid', role: 'admin' }], projects: [{ id: 'fictional-project', data: { headline: 'Fictício' } }], clicks: {}, aiSettings: {}, office: { clients: [] } };
  const bytes = Buffer.from(JSON.stringify(data, null, 2)); fs.writeFileSync(source, bytes, { mode: 0o600 });
  return { root, app, external, source, backup, bytes, options: { protectedRoot: app } };
}
const patched = overrides => Object.assign(Object.create(fs), overrides);

test('external export and restore-new preserve exact fictional bytes, SHA256 and private mode', () => {
  const f = fixture();
  const exported = exportBackup(f.source, f.backup, f.options);
  assert.match(exported.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(verifyBackup(f.backup).bytes, f.bytes);
  const restored = path.join(f.external, 'recovery-copy.json');
  assert.deepEqual(restoreBackup(f.backup, restored, f.options), exported);
  assert.deepEqual(fs.readFileSync(restored), f.bytes);
  assert.deepEqual(fs.readFileSync(f.source), f.bytes);
  for (const file of [f.backup, restored]) assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('export cannot overwrite existing backup on repeated exclusive attempts', () => {
  const f = fixture(); exportBackup(f.source, f.backup, f.options);
  const before = fs.readFileSync(f.backup);
  assert.throws(() => exportBackup(f.source, f.backup, f.options));
  assert.deepEqual(fs.readFileSync(f.backup), before);
  assert.deepEqual(fs.readFileSync(f.source), f.bytes);
});

test('two simultaneous CLI exports to one destination produce exactly one success', async () => {
  const f = fixture();
  const script = fileURLToPath(new URL('./backup-json.mjs', import.meta.url));
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, 'export', f.source, f.backup], { stdio: 'ignore' });
    child.on('error', reject); child.on('exit', code => resolve(code));
  });
  const codes = await Promise.all([run(), run()]);
  assert.deepEqual(codes.sort(), [0, 1]);
  assert.deepEqual(verifyBackup(f.backup).bytes, f.bytes);
  assert.deepEqual(fs.readFileSync(f.source), f.bytes);
});

test('restoration cannot overwrite any existing file or original source', () => {
  const f = fixture(); exportBackup(f.source, f.backup, f.options);
  assert.throws(() => restoreBackup(f.backup, f.source, f.options));
  const existing = path.join(f.external, 'existing.json'); fs.writeFileSync(existing, 'existing sentinel');
  assert.throws(() => restoreBackup(f.backup, existing, f.options));
  assert.equal(fs.readFileSync(existing, 'utf8'), 'existing sentinel');
  assert.deepEqual(fs.readFileSync(f.source), f.bytes);
});

test('backup and restoration destinations inside checkout or symlink alias are rejected', () => {
  const f = fixture();
  assert.throws(() => exportBackup(f.source, path.join(f.app, 'backup.json'), f.options));
  const alias = path.join(f.external, 'app-alias'); fs.symlinkSync(f.app, alias, 'dir');
  assert.throws(() => exportBackup(f.source, path.join(alias, 'backup.json'), f.options));
  assert.equal(fs.existsSync(path.join(f.app, 'backup.json')), false);
  exportBackup(f.source, f.backup, f.options);
  assert.throws(() => restoreBackup(f.backup, path.join(alias, 'new.json'), f.options));
});

test('corrupt, empty and structurally invalid source never creates a backup', () => {
  const f = fixture();
  for (const invalid of ['', '{broken', '{}']) {
    fs.writeFileSync(f.source, invalid);
    assert.throws(() => exportBackup(f.source, f.backup, f.options));
    assert.equal(fs.existsSync(f.backup), false);
    assert.equal(fs.readFileSync(f.source, 'utf8'), invalid);
  }
});

test('tampered checksum, content and truncated backup are rejected before restoration', () => {
  const f = fixture(); exportBackup(f.source, f.backup, f.options);
  const original = fs.readFileSync(f.backup); const parsed = JSON.parse(original);
  for (const broken of [Buffer.from('{'), Buffer.from(JSON.stringify({ ...parsed, sha256: '0'.repeat(64) })), Buffer.from(JSON.stringify({ ...parsed, byteLength: parsed.byteLength + 1 })), Buffer.from(JSON.stringify({ ...parsed, bytes: Buffer.from('{}').toString('base64') }))]) {
    fs.writeFileSync(f.backup, broken);
    assert.throws(() => restoreBackup(f.backup, path.join(f.external, 'new.json'), f.options));
    assert.equal(fs.existsSync(path.join(f.external, 'new.json')), false);
  }
});

for (const code of ['EACCES', 'ENOSPC']) {
  test(`${code} during backup does not modify source or claim success`, () => {
    const f = fixture();
    const io = patched({ openSync(file, ...args) {
      if (file === f.backup) throw Object.assign(Error('fictional fault'), { code });
      return fs.openSync(file, ...args);
    } });
    assert.throws(() => exportBackup(f.source, f.backup, { ...f.options, io }));
    assert.deepEqual(fs.readFileSync(f.source), f.bytes);
  });
}

test('interrupted partial write is not accepted as verified backup and is never overwritten', () => {
  const f = fixture(); let writes = 0;
  const io = patched({ writeSync(fd, buffer, offset, length) {
    if (writes++ > 0) throw Error('fictional interruption');
    return fs.writeSync(fd, buffer, offset, Math.min(length, 12));
  } });
  assert.throws(() => exportBackup(f.source, f.backup, { ...f.options, io }));
  assert.throws(() => verifyBackup(f.backup));
  assert.throws(() => exportBackup(f.source, f.backup, f.options));
  assert.deepEqual(fs.readFileSync(f.source), f.bytes);
});

test('failed flush reports error and preserves original, even if artifact looks complete', () => {
  const f = fixture();
  assert.throws(() => exportBackup(f.source, f.backup, { ...f.options, io: patched({ fsyncSync() { throw Error('fictional disk flush failure'); } }) }));
  assert.deepEqual(fs.readFileSync(f.source), f.bytes);
});

test('restore disk failure cannot claim success; recovery succeeds into a fresh file', () => {
  const f = fixture(); exportBackup(f.source, f.backup, f.options);
  const failed = path.join(f.external, 'failed-recovery.json');
  assert.throws(() => restoreBackup(f.backup, failed, { ...f.options, io: patched({ writeSync() { throw Object.assign(Error('fictional disk full'), { code: 'ENOSPC' }); } }) }));
  assert.throws(() => restoreBackup(f.backup, failed, f.options));
  const recovered = path.join(f.external, 'verified-recovery.json');
  restoreBackup(f.backup, recovered, f.options);
  assert.deepEqual(fs.readFileSync(recovered), f.bytes);
  assert.deepEqual(fs.readFileSync(f.source), f.bytes);
});

test('a recomputed checksum cannot make an incompatible database valid', () => {
  const f = fixture(); exportBackup(f.source, f.backup, f.options);
  const envelope = JSON.parse(fs.readFileSync(f.backup));
  const bytes = Buffer.from('{}');
  envelope.bytes = bytes.toString('base64'); envelope.byteLength = bytes.length;
  envelope.sha256 = createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(f.backup, JSON.stringify(envelope));
  assert.throws(() => verifyBackup(f.backup));
});

test('symlink backup cannot be verified and symlink destination cannot be overwritten', () => {
  const f = fixture(); const alias = path.join(f.external, 'alias'); fs.symlinkSync(f.source, alias);
  assert.throws(() => verifyBackup(alias));
  assert.throws(() => exportBackup(f.source, alias, f.options));
  assert.deepEqual(fs.readFileSync(f.source), f.bytes);
});

test('CLI verifies only fictional backup and never emits content or private account identifier', () => {
  const f = fixture(); exportBackup(f.source, f.backup, f.options);
  const script = fileURLToPath(new URL('./backup-json.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'verify', f.backup], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).ok, true);
  assert.equal(result.stdout.includes('admin@example.invalid'), false);
  assert.equal(result.stdout.includes('fixture-admin'), false);
  const invalid = spawnSync(process.execPath, [script, 'restore-new', f.backup, f.source], { encoding: 'utf8' });
  assert.notEqual(invalid.status, 0); assert.equal(invalid.stderr.includes(f.source), false);
  assert.deepEqual(fs.readFileSync(f.source), f.bytes);
});
