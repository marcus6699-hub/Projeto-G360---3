import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { AtomicJsonStore, JsonPersistenceError, scopedDocument, commitDocument, persistenceContext, persistenceErrorHandler, protectPrivateJsonFiles, asyncRoute } from './jsonPersistence.mjs';
import { CostGuardService } from './costGuard.ts';

const fixture = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-json-unit-'));
  const file = path.join(directory, 'fixture.json');
  fs.writeFileSync(file, JSON.stringify({ records: ['original'], extra: { preserve: true } }));
  return { directory, file, original: fs.readFileSync(file) };
};
const failure = (code: string) => Object.assign(new Error('Fictional IO failure'), { code });
const rejected = (status: number) => (error: any) => error instanceof JsonPersistenceError && error.status === status;

for (const bytes of ['', ' ', '{broken', 'null', '[]']) {
  test(`invalid/empty JSON is never replaced by an initial value (${JSON.stringify(bytes)})`, () => {
    const { file } = fixture(); fs.writeFileSync(file, bytes);
    const store = new AtomicJsonStore(file, { allowMissing: true, initial: () => ({ records: ['demo'] }) });
    assert.throws(() => store.begin(), rejected(503));
    assert.equal(fs.readFileSync(file, 'utf8'), bytes);
    assert.equal(fs.existsSync(store.backup), false);
  });
}
test('missing application data fails closed; explicitly missing auxiliary file can initialize', () => {
  const { directory } = fixture(); const file = path.join(directory, 'absent.json');
  assert.throws(() => new AtomicJsonStore(file).begin(), rejected(503));
  const store = new AtomicJsonStore(file, { allowMissing: true, initial: { records: [] } });
  const start = store.begin(); assert.equal(fs.existsSync(file), false);
  store.commit(start.data, start.revision); assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { records: [] });
});
test('read permission failure does not seed or overwrite data', () => {
  const { file, original } = fixture();
  const store = new AtomicJsonStore(file, { io: { ...fs, readFileSync: () => { throw failure('EACCES'); } }, allowMissing: true, initial: {} });
  assert.throws(() => store.begin(), rejected(503)); assert.deepEqual(fs.readFileSync(file), original);
});
for (const stage of ['open', 'write', 'disk', 'flush', 'rename']) {
  test(`failed ${stage} preserves the previous file and allows retry`, () => {
    const { file, original } = fixture(); let fail = true;
    const io = { ...fs,
      openSync: ((...args: any[]) => { if (fail && stage === 'open' && String(args[0]).includes('.tmp-')) throw failure('EACCES'); return (fs.openSync as any)(...args); }) as any,
      writeSync: ((...args: any[]) => { if (fail && ['write', 'disk'].includes(stage)) throw failure(stage === 'disk' ? 'ENOSPC' : 'EIO'); return (fs.writeSync as any)(...args); }) as any,
      fsyncSync: (fd: number) => { if (fail && stage === 'flush' && fs.fstatSync(fd).isFile()) throw failure('EIO'); fs.fsyncSync(fd); },
      renameSync: (from: any, to: any) => { if (fail && stage === 'rename' && to === file) throw failure('EIO'); fs.renameSync(from, to); },
    };
    const store = new AtomicJsonStore(file, { io }); const transaction = store.begin(); transaction.data.records.push('new');
    assert.throws(() => store.commit(transaction.data, transaction.revision), rejected(503));
    assert.deepEqual(fs.readFileSync(file), original); assert.equal(fs.existsSync(store.lock), false);
    fail = false; store.commit(transaction.data, transaction.revision);
    assert.deepEqual(store.begin().data.records, ['original', 'new']);
    assert.deepEqual(store.previous().bytes, original);
  });
}
test('partial system writes are completed before atomic replacement', () => {
  const { file } = fixture();
  const io = { ...fs, writeSync: ((fd: number, buffer: Buffer, offset: number, length: number) => fs.writeSync(fd, buffer, offset, Math.min(7, length))) as any };
  const store = new AtomicJsonStore(file, { io }); const state = store.begin(); state.data.records.push('partial-write-fixture');
  store.commit(state.data, state.revision); assert.equal(store.begin().data.records[1], 'partial-write-fixture');
});
test('atomic save preserves file access mode', () => {
  const { file } = fixture(); fs.chmodSync(file, 0o640);
  const store = new AtomicJsonStore(file); const state = store.begin(); store.commit(state.data, state.revision);
  assert.equal(fs.statSync(file).mode & 0o777, 0o640);
});
test('stale writers are rejected instead of losing a committed update', () => {
  const { file } = fixture(); const first = new AtomicJsonStore(file), second = new AtomicJsonStore(file);
  const a = first.begin(), b = second.begin(); a.data.records.push('first'); b.data.records.push('second');
  first.commit(a.data, a.revision);
  assert.throws(() => second.commit(b.data, b.revision), rejected(409));
  const retry = second.begin(); retry.data.records.push('second'); second.commit(retry.data, retry.revision);
  assert.deepEqual(first.begin().data.records, ['original', 'first', 'second']);
});
test('existing writer lock blocks a competing save without touching data', () => {
  const { file, original } = fixture(); const store = new AtomicJsonStore(file); const state = store.begin();
  fs.mkdirSync(store.lock);
  assert.throws(() => store.commit(state.data, state.revision), rejected(503));
  assert.deepEqual(fs.readFileSync(file), original); assert.equal(fs.existsSync(store.lock), true);
});
test('backup integrity is checked; unknown/corrupt backups are not overwritten', () => {
  const { file, original } = fixture(); const store = new AtomicJsonStore(file); const state = store.begin();
  fs.writeFileSync(store.backup, 'unknown backup');
  assert.throws(() => store.commit(state.data, state.revision), rejected(503));
  assert.deepEqual(fs.readFileSync(file), original); assert.equal(fs.readFileSync(store.backup, 'utf8'), 'unknown backup');
});
test('post-rename sync failure is explicit and blocks further use until verified', () => {
  const { file, original } = fixture(); let renamed = false;
  const io = { ...fs, renameSync: (from: any, to: any) => { fs.renameSync(from, to); if (to === file) renamed = true; }, fsyncSync: (fd: number) => { if (renamed) throw failure('EIO'); fs.fsyncSync(fd); } };
  const store = new AtomicJsonStore(file, { io }); const state = store.begin(); state.data.records.push('possibly-committed');
  assert.throws(() => store.commit(state.data, state.revision), (e: any) => rejected(503)(e) && e.uncertain);
  assert.deepEqual(store.previous().bytes, original);
  assert.throws(() => store.begin(), (e: any) => rejected(503)(e) && e.uncertain);
  assert.ok(JSON.parse(fs.readFileSync(file, 'utf8')).records.includes('possibly-committed'));
});
test('abrupt process interruption before replacement leaves original and recoverable backup', () => {
  const { file, original } = fixture();
  const module = new URL('./jsonPersistence.mjs', import.meta.url).href;
  const source = `import fs from 'node:fs'; import { AtomicJsonStore } from ${JSON.stringify(module)}; const file=process.argv[1]; const io={...fs,renameSync:(a,b)=>{if(b===file)process.exit(23); fs.renameSync(a,b)}}; const store=new AtomicJsonStore(file,{io});const t=store.begin();t.data.records.push('interrupted');store.commit(t.data,t.revision);`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source, file]);
  assert.equal(child.status, 23); assert.deepEqual(fs.readFileSync(file), original);
  const store = new AtomicJsonStore(file); assert.deepEqual(store.previous().bytes, original);
  assert.equal(fs.existsSync(store.lock), true);
  // Explicit operator cleanup of this dead TEST process lock, never automatic production recovery.
  fs.rmdirSync(store.lock);
  const state = store.begin(); state.data.records.push('retry'); store.commit(state.data, state.revision);
  assert.deepEqual(store.begin().data.records, ['original', 'retry']);
});
test('recovery can be verified in a new temporary file without overwriting a corrupt original', () => {
  const { file, directory } = fixture(); const store = new AtomicJsonStore(file); const state = store.begin();
  state.data.records.push('saved'); store.commit(state.data, state.revision);
  fs.writeFileSync(file, '{corrupt'); assert.throws(() => store.begin(), rejected(503));
  const backup = store.previous(); const recovery = path.join(directory, 'recovered.json');
  fs.writeFileSync(recovery, backup.bytes, { flag: 'wx' });
  assert.deepEqual(new AtomicJsonStore(recovery).begin().data.records, ['original']);
  assert.equal(fs.readFileSync(file, 'utf8'), '{corrupt');
});
test('old metrics retain configured limits and lifetime counts across a day change', () => {
  const { file } = fixture();
  fs.writeFileSync(file, JSON.stringify({ date: '2000-01-01', config: { enabled: true, strictFreeMode: true, services: { gemini_text: { dailyLimit: 7 } } }, usage: { gemini_text: { dailyCount: 6, totalCount: 30, lastUsed: null, historyByMinute: {} } }, cacheStats: {} }));
  const guard = new CostGuardService(file); const value = guard.getMetrics();
  assert.equal(value.config.services.gemini_text.dailyLimit, 7); assert.equal(value.usage.gemini_text.dailyCount, 0); assert.equal(value.usage.gemini_text.totalCount, 30);
});
test('metrics IO failure rolls memory back and retries without replacing previous counters', () => {
  const { file } = fixture(); fs.writeFileSync(file, JSON.stringify({ date: new Date().toISOString().slice(0, 10), config: { enabled: true, strictFreeMode: true, services: {} }, usage: {}, cacheStats: {} }));
  let broken = true;
  const io = { ...fs, writeSync: ((...args: any[]) => { if (broken) throw failure('ENOSPC'); return (fs.writeSync as any)(...args); }) as any };
  const guard = new CostGuardService(file, io);
  assert.throws(() => guard.recordCall('gemini_text'), rejected(503));
  assert.equal(guard.getMetrics().usage.gemini_text, undefined);
  broken = false; guard.recordCall('gemini_text'); assert.equal(guard.getMetrics().usage.gemini_text.dailyCount, 1);
});

function request(server: any, route: string, method = 'GET'): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method }, res => {
      const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) })); res.on('error', reject);
    }); req.on('error', reject); req.end();
  });
}
test('swallowed IO errors cannot return HTTP success or leak uncommitted state', async () => {
  const { file, original } = fixture(); let broken = true;
  const io = { ...fs, writeSync: ((...args: any[]) => { if (broken) throw failure('ENOSPC'); return (fs.writeSync as any)(...args); }) as any };
  const store = new AtomicJsonStore(file, { io }); const db: any = scopedDocument(store);
  const app = express(); app.use(persistenceContext);
  app.post('/save', asyncRoute(async (_req, res) => {
    try { db.records.push('uncommitted'); commitDocument(store, db); } catch { /* simulate a legacy fallback */ }
    res.json({ ok: true });
  }));
  app.get('/read', (_req, res) => res.json(db)); app.use(persistenceErrorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    assert.equal((await request(server, '/save', 'POST')).status, 503);
    assert.deepEqual(fs.readFileSync(file), original);
    assert.deepEqual((await request(server, '/read')).body.records, ['original']);
    broken = false; assert.equal((await request(server, '/save', 'POST')).status, 200);
    assert.deepEqual((await request(server, '/read')).body.records, ['original', 'uncommitted']);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('simultaneous HTTP drafts yield one commit and an explicit conflict, never lost data', async () => {
  const { file } = fixture(); const store = new AtomicJsonStore(file); const db: any = scopedDocument(store);
  const app = express(); app.use(persistenceContext); let arrivals = 0, release: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  app.post('/save', asyncRoute(async (_req, res) => { db.records.push('request'); if (++arrivals === 2) release(); await gate; commitDocument(store, db); res.json({ ok: true }); }));
  app.use(persistenceErrorHandler); const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const values = await Promise.all([request(server, '/save', 'POST'), request(server, '/save', 'POST')]);
    assert.deepEqual(values.map(v => v.status).sort(), [200, 409]); assert.deepEqual(store.begin().data.records, ['original', 'request']);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('backup write failure leaves the original intact', () => {
  const { file, original } = fixture(); const opened = new Map<number, string>();
  const io = { ...fs,
    openSync: ((target: any, ...args: any[]) => { const fd = (fs.openSync as any)(target, ...args); opened.set(fd, String(target)); return fd; }) as any,
    writeSync: ((fd: number, ...args: any[]) => { if (opened.get(fd)?.includes('.g360-previous.json.tmp-')) throw failure('ENOSPC'); return (fs.writeSync as any)(fd, ...args); }) as any,
  };
  const store = new AtomicJsonStore(file, { io }); const state = store.begin(); state.data.records.push('new');
  assert.throws(() => store.commit(state.data, state.revision), rejected(503)); assert.deepEqual(fs.readFileSync(file), original);
});
test('zero-byte disk write is an error instead of an infinite loop or successful save', () => {
  const { file, original } = fixture();
  const store = new AtomicJsonStore(file, { io: { ...fs, writeSync: () => 0 } }); const state = store.begin();
  assert.throws(() => store.commit(state.data, state.revision), rejected(503)); assert.deepEqual(fs.readFileSync(file), original);
});
test('process interruption DURING temporary writing never truncates the original', () => {
  const { file, original } = fixture();
  const module = new URL('./jsonPersistence.mjs', import.meta.url).href;
  const source = `import fs from 'node:fs'; import {AtomicJsonStore} from ${JSON.stringify(module)}; const file=process.argv[1];const io={...fs,writeSync:(fd,b,o,n)=>{fs.writeSync(fd,b,o,Math.min(3,n));process.exit(24)}};const s=new AtomicJsonStore(file,{io});const t=s.begin();s.commit(t.data,t.revision);`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source, file]);
  assert.equal(child.status, 24); assert.deepEqual(fs.readFileSync(file), original); assert.ok(JSON.parse(fs.readFileSync(file, 'utf8')));
});
test('corrupt or unsafe metrics cannot silently reset safety settings', () => {
  const { file } = fixture();
  for (const bytes of ['', '{broken', JSON.stringify({ date: '2026-10-27', config: { enabled: 'false', services: {} }, usage: {}, cacheStats: {} })]) {
    fs.writeFileSync(file, bytes); assert.throws(() => new CostGuardService(file), rejected(503)); assert.equal(fs.readFileSync(file, 'utf8'), bytes);
  }
});
test('a streamed response aborts instead of completing successfully after persistence failure', async () => {
  const { file } = fixture(); const io = { ...fs, writeSync: () => { throw failure('ENOSPC'); } };
  const store = new AtomicJsonStore(file, { io }); const app = express(); app.use(persistenceContext);
  app.get('/stream', (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream'); res.write('data: progress\n\n');
    const state = store.begin(); try { store.commit(state.data, state.revision); } catch { /* legacy fallback */ }
    res.end('data: SUCCESS\n\n');
  });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const result = await new Promise<string>((resolve, reject) => {
      const req = http.get({ hostname: '127.0.0.1', port: (server.address() as any).port, path: '/stream' }, res => {
        res.resume(); res.on('aborted', () => resolve('aborted')); res.on('end', () => resolve('completed')); res.on('error', () => resolve('aborted'));
      }); req.on('error', (e: any) => e.code === 'ECONNRESET' ? resolve('aborted') : reject(e));
    });
    assert.equal(result, 'aborted');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('invalid UTF-8 is rejected instead of silently replacing damaged characters', () => {
  const { file } = fixture(); const bytes = Buffer.concat([Buffer.from('{"text":"'), Buffer.from([255]), Buffer.from('"}')]);
  fs.writeFileSync(file, bytes); assert.throws(() => new AtomicJsonStore(file).begin(), rejected(503)); assert.deepEqual(fs.readFileSync(file), bytes);
});
test('a data symlink is never followed or replaced', () => {
  const { file, directory, original } = fixture(); const link = path.join(directory, 'link.json'); fs.symlinkSync(file, link);
  const store = new AtomicJsonStore(link); assert.throws(() => store.begin(), rejected(503));
  assert.throws(() => store.commit({ records: [] }, null), rejected(503));
  assert.ok(fs.lstatSync(link).isSymbolicLink()); assert.deepEqual(fs.readFileSync(file), original);
});
test('failure to release a writer lock is explicit even if data was committed', () => {
  const { file, original } = fixture(); const io = { ...fs, rmdirSync: () => { throw failure('EACCES'); } };
  const store = new AtomicJsonStore(file, { io }); const state = store.begin(); state.data.records.push('saved');
  assert.throws(() => store.commit(state.data, state.revision), (e: any) => rejected(503)(e) && e.uncertain);
  assert.deepEqual(store.previous().bytes, original); assert.ok(fs.existsSync(store.lock));
  assert.throws(() => store.begin(), rejected(503));
});
test('actual server startup never recreates a missing, empty or corrupt database', () => {
  const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-startup-json-'));
  fs.copyFileSync(path.join(project, 'server.ts'), path.join(root, 'server.ts'));
  fs.copyFileSync(path.join(project, 'package.json'), path.join(root, 'package.json'));
  fs.cpSync(path.join(project, 'src'), path.join(root, 'src'), { recursive: true });
  fs.symlinkSync(path.join(project, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(root, 'firebase-applet-config.json'), JSON.stringify({ projectId: 'fixture-no-real-service' }));
  for (const bytes of ['', '{corrupt']) {
    const file = path.join(root, 'db.json'); fs.writeFileSync(file, bytes);
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', "import('./server.ts').then(()=>process.exit(99)).catch(e=>process.exit(e.status===503?42:98))"], { cwd: root, env: { ...process.env, NODE_ENV: 'test' } });
    assert.equal(result.status, 42, result.stderr.toString()); assert.equal(fs.readFileSync(file, 'utf8'), bytes);
    assert.equal(fs.existsSync(`${file}.g360-previous.json`), false);
  }
  // A separate project copy exercises absence without deleting any fixture record.
  const absent = path.join(root, 'absent'); fs.mkdirSync(absent);
  fs.copyFileSync(path.join(root, 'server.ts'), path.join(absent, 'server.ts'));
  fs.copyFileSync(path.join(root, 'package.json'), path.join(absent, 'package.json'));
  fs.copyFileSync(path.join(root, 'firebase-applet-config.json'), path.join(absent, 'firebase-applet-config.json'));
  fs.cpSync(path.join(root, 'src'), path.join(absent, 'src'), { recursive: true });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(absent, 'node_modules'), 'dir');
  const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', "import('./server.ts').then(()=>process.exit(99)).catch(e=>process.exit(e.status===503?42:98))"], { cwd: absent, env: { ...process.env, NODE_ENV: 'test' } });
  assert.equal(result.status, 42, result.stderr.toString()); assert.equal(fs.existsSync(path.join(absent, 'db.json')), false);
});
test('a caught persistence error aborts the entire request even if IO recovers immediately', async () => {
  const { file, original } = fixture(); let broken = true;
  const io = { ...fs, writeSync: ((...args: any[]) => {
    if (broken) { broken = false; throw failure('ENOSPC'); }
    return (fs.writeSync as any)(...args);
  }) as any };
  const store = new AtomicJsonStore(file, { io }); const db: any = scopedDocument(store);
  const app = express(); app.use(persistenceContext);
  app.post('/save', asyncRoute(async (_req, res) => {
    db.records.push('pending');
    try { commitDocument(store, db); } catch { try { commitDocument(store, db); } catch {} }
    res.json({ ok: true });
  }));
  app.use(persistenceErrorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    assert.equal((await request(server, '/save', 'POST')).status, 503); assert.deepEqual(fs.readFileSync(file), original);
    assert.equal((await request(server, '/save', 'POST')).status, 200);
    assert.deepEqual(store.begin().data.records, ['original', 'pending']);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('static/dev middleware cannot deliver data files, backups or encoded aliases', async () => {
  const app = express(); app.use(protectPrivateJsonFiles);
  app.use((_req, res) => res.json({ wouldExposePrivateFile: true }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    for (const route of ['/db.json', '/db.json.g360-previous.json', '/db.json.tmp-fixture', '/cost-guard-metrics.json', '/@fs/workspace/project/db.json?raw', '/%64b%2ejson?import', '/%2564b%252ejson', '/DB.JSON', '/folder/db.json.g360-lock/owner']) {
      const status = await new Promise<number>((resolve, reject) => {
        const req = http.get({ hostname: '127.0.0.1', port: (server.address() as any).port, path: route }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); }); req.on('error', reject);
      });
      assert.equal(status, 404, route);
    }
    assert.equal((await request(server, '/public-page')).status, 200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
