import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { scryptSync } from 'node:crypto';

const root = fileURLToPath(new URL('../../', import.meta.url));
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-startup-'));
  fs.cpSync(path.join(root, 'src'), path.join(directory, 'src'), { recursive: true });
  for (const name of ['server.ts', 'package.json']) fs.copyFileSync(path.join(root, name), path.join(directory, name));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(directory, 'firebase-applet-config.json'), JSON.stringify({ projectId: 'g360-startup-fixture' }));
  const db = JSON.stringify({ users: [], projects: [], clicks: {}, aiSettings: {} });
  fs.writeFileSync(path.join(directory, 'db.json'), db);
  return { directory, db };
}
function run(directory: string, args: string[]) {
  return spawnSync(process.execPath, args, {
    cwd: directory, timeout: 15000, encoding: 'utf8',
    // Intentionally no real credentials, environment files, database configuration or AI keys.
    env: { PATH: process.env.PATH, NODE_ENV: 'test' },
  });
}

test('runtime loader is a production dependency and npm start uses it', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.start, 'node --import tsx server.ts');
  assert.ok(pkg.dependencies.tsx);
  assert.equal(pkg.devDependencies.tsx, undefined);
});

test('Firebase JSON config loads through native Node without missing import attribute', () => {
  const { directory } = fixture();
  const child = run(directory, ['--input-type=module', '-e', "await import('./src/lib/firebase-admin.ts')"]);
  assert.equal(child.status, 0, child.stderr);
});

test('backend bootstrap works without external-service credentials and preserves fictional data', () => {
  const { directory, db } = fixture();
  const child = run(directory, ['--import', 'tsx', 'server.ts']);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(fs.readFileSync(path.join(directory, 'db.json'), 'utf8'), db);
  assert.equal(fs.existsSync(path.join(directory, 'cost-guard-metrics.json')), false);
});
test('production rejects emulator authentication configuration before accepting requests', () => {
  for (const variable of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
    const { directory, db } = fixture();
    const child = spawnSync(process.execPath, ['--import', 'tsx', 'server.ts'], {
      cwd: directory, timeout: 15000, encoding: 'utf8',
      env: { PATH: process.env.PATH, NODE_ENV: 'production', [variable]: '127.0.0.1:19099' },
    });
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /Emulator configuration is not permitted/);
    assert.equal(fs.readFileSync(path.join(directory, 'db.json'), 'utf8'), db);
  }
});
test('dotenv configuration is available before Firebase startup validation', () => {
  const { directory, db } = fixture();
  fs.writeFileSync(path.join(directory, '.env'), 'NODE_ENV=production\nFIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:19099\n');
  const child = spawnSync(process.execPath, ['--import', 'tsx', 'server.ts'], { cwd: directory, timeout: 15000, encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Emulator configuration is not permitted/);
  assert.equal(fs.readFileSync(path.join(directory, 'db.json'), 'utf8'), db);
});
test('configured private data directory is shared by server, authentication and metrics without migrating the original', () => {
  const { directory, db } = fixture();
  const privateData = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-private-data-fixture-'));
  const password = `scrypt:fixture-salt:${scryptSync('fictional-private-password', 'fixture-salt', 64).toString('hex')}`;
  const externalDb = { users: [{ id: 'fixture-private-admin', name: 'Fixture', email: 'private@example.invalid', password, role: 'admin' }], projects: [], clicks: {}, aiSettings: {} };
  fs.writeFileSync(path.join(privateData, 'db.json'), JSON.stringify(externalDb), { mode: 0o600 });
  const code = `
    const { app } = await import('./server.ts');
    const { costGuard } = await import('./src/server/costGuard.ts');
    const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
    try {
      const base = 'http://127.0.0.1:' + server.address().port;
      const login = await fetch(base + '/api/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'private@example.invalid',password:'fictional-private-password'})});
      if (login.status !== 200) throw Error('Fictional login failed');
      const me = await fetch(base + '/api/auth/me', {headers:{Cookie:login.headers.get('set-cookie').split(';')[0]}});
      if (me.status !== 200 || (await me.json()).id !== 'fixture-private-admin') throw Error('Different data authority');
      costGuard.recordCall('gemini_text'); console.log('private-data-fixture-ok');
    } finally { await new Promise(r => server.close(r)); }
  `;
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { cwd: directory, timeout: 15000, encoding: 'utf8', env: { PATH: process.env.PATH, NODE_ENV: 'test', G360_DATA_DIR: privateData } });
  assert.equal(child.status, 0, child.stderr); assert.match(child.stdout, /private-data-fixture-ok/);
  assert.equal(fs.readFileSync(path.join(directory, 'db.json'), 'utf8'), db);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(privateData, 'db.json'), 'utf8')), externalDb);
  assert.equal(fs.existsSync(path.join(privateData, 'cost-guard-metrics.json')), true);
  assert.equal(fs.existsSync(path.join(directory, 'cost-guard-metrics.json')), false);
});

test('absent Firebase config fails closed without altering the database', () => {
  const { directory, db } = fixture();
  fs.renameSync(path.join(directory, 'firebase-applet-config.json'), path.join(directory, 'fixture-config.saved.json'));
  const child = run(directory, ['--import', 'tsx', 'server.ts']);
  assert.notEqual(child.status, 0);
  assert.equal(fs.readFileSync(path.join(directory, 'db.json'), 'utf8'), db);
});

test('missing Firebase project cannot silently select a project from ambient credentials', () => {
  const { directory, db } = fixture();
  fs.writeFileSync(path.join(directory, 'firebase-applet-config.json'), JSON.stringify({}));
  const child = run(directory, ['--import', 'tsx', 'server.ts']);
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Firebase project configuration is invalid/);
  assert.equal(fs.readFileSync(path.join(directory, 'db.json'), 'utf8'), db);
});

test('corrupt Firebase config fails closed and can recover with a valid fictional config', () => {
  const { directory, db } = fixture();
  const config = path.join(directory, 'firebase-applet-config.json');
  fs.writeFileSync(config, '{invalid');
  assert.notEqual(run(directory, ['--import', 'tsx', 'server.ts']).status, 0);
  assert.equal(fs.readFileSync(path.join(directory, 'db.json'), 'utf8'), db);
  fs.writeFileSync(config, JSON.stringify({ projectId: 'g360-startup-fixture' }));
  const restored = run(directory, ['--import', 'tsx', 'server.ts']);
  assert.equal(restored.status, 0, restored.stderr);
});

async function reservePort() {
  const listener = net.createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  return { listener, port: (listener.address() as net.AddressInfo).port };
}

test('production starts over HTTP with a fictional build and denies private data and anonymous APIs', async () => {
  const { directory, db } = fixture();
  fs.mkdirSync(path.join(directory, 'dist'));
  fs.writeFileSync(path.join(directory, 'dist/index.html'), '<!doctype html><title>Fictional G360 build</title>');
  const reservation = await reservePort();
  await new Promise<void>(resolve => reservation.listener.close(() => resolve()));
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: directory, env: { PATH: process.env.PATH, NODE_ENV: 'production', PORT: String(reservation.port), BIND_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Fictional production startup timed out')), 15000);
      child.stdout.on('data', chunk => { output += chunk; if (output.includes('[Startup] G360 backend ready')) { clearTimeout(timer); resolve(); } });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Fictional backend exited before ready: ${code}`)); });
    });
    const base = `http://127.0.0.1:${reservation.port}`;
    const index = await fetch(base);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /Fictional G360 build/);
    assert.equal((await fetch(base + '/api/projects')).status, 401);
    assert.equal((await fetch(base + '/db.json')).status, 404);
    assert.equal((await fetch(base + '/db.json.g360-previous.json')).status, 404);
    assert.equal(fs.readFileSync(path.join(directory, 'db.json'), 'utf8'), db);
  } finally {
    child.kill('SIGTERM');
    await closed;
  }
});

for (const mode of ['missing build', 'invalid port', 'occupied port']) {
  test(`production ${mode} fails clearly without data changes or raw startup diagnostics`, async () => {
    const { directory, db } = fixture();
    if (mode !== 'missing build') {
      fs.mkdirSync(path.join(directory, 'dist'));
      fs.writeFileSync(path.join(directory, 'dist/index.html'), '<title>Fictional build</title>');
    }
    const reservation = await reservePort();
    try {
      const child = spawnSync(process.execPath, ['--import', 'tsx', 'server.ts'], {
        cwd: directory, timeout: 15000, encoding: 'utf8',
        env: { PATH: process.env.PATH, NODE_ENV: 'production', PORT: mode === 'invalid port' ? '99999' : String(reservation.port), BIND_HOST: '127.0.0.1' },
      });
      assert.equal(child.status, 1, child.stderr);
      assert.match(child.stderr, /\[Startup\] Backend could not start/);
      assert.doesNotMatch(child.stderr, /at startServer|EADDRINUSE|ENOENT/);
      assert.equal(fs.readFileSync(path.join(directory, 'db.json'), 'utf8'), db);
    } finally {
      await new Promise<void>(resolve => reservation.listener.close(() => resolve()));
    }
  });
}
