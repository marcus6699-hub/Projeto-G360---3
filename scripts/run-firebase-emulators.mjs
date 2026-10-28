// Isolated local Firebase suite: never uses a real Firebase project or credentials.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'auth';
if (!['auth', 'all'].includes(mode)) throw Error('Use auth ou all.');
const cli = process.env.G360_FIREBASE_CLI_PATH;
if (!cli || !fs.statSync(cli).isFile()) throw Error('Informe G360_FIREBASE_CLI_PATH para firebase-tools/lib/bin/firebase.js instalado separadamente.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-emulators-'));
const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'NODE_EXTRA_CA_CERTS'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
async function port() {
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const value = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return value;
}
const authPort = await port();
const firestorePort = await port();
const hubPort = await port();
const loggingPort = await port();
const cache = process.env.G360_FIREBASE_EMULATOR_CACHE || path.join(directory, 'cache');
if (mode === 'all' && !fs.existsSync(path.join(cache, 'cloud-firestore-emulator-v1.19.8.jar'))) {
  throw Error('Firestore exige o JAR oficial 1.19.8 já disponível no cache autorizado. Nenhum download automático será iniciado.');
}
fs.copyFileSync(path.join(root, 'firestore.rules'), path.join(directory, 'firestore.rules'));
const emulators = { auth: { host: '127.0.0.1', port: authPort }, hub: { host: '127.0.0.1', port: hubPort }, logging: { host: '127.0.0.1', port: loggingPort }, ui: { enabled: false }, singleProjectMode: true };
if (mode === 'all') emulators.firestore = { host: '127.0.0.1', port: firestorePort };
fs.writeFileSync(path.join(directory, 'firebase.json'), JSON.stringify({ firestore: { rules: 'firestore.rules' }, emulators }), { mode: 0o600 });
Object.assign(env, {
  CI: 'true', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true', GCE_METADATA_DISABLED: 'true',
  GOOGLE_CLOUD_PROJECT: 'demo-g360-codex', GCLOUD_PROJECT: 'demo-g360-codex',
  FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${authPort}`, FIREBASE_EMULATORS_PATH: cache,
  G360_EMULATOR_MODE: mode, G360_EMULATOR_FIXTURE: '1', XDG_CONFIG_HOME: path.join(directory, 'config'),
});
if (mode === 'all') env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${firestorePort}`;
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
console.log(`Local Firebase fixture retained: ${directory}`);
const child = spawn(process.execPath, [cli, 'emulators:exec', '--project', 'demo-g360-codex', '--only', mode === 'all' ? 'auth,firestore' : 'auth', '--config', path.join(directory, 'firebase.json'), '--non-interactive', `${quote(process.execPath)} --test ${quote(path.join(root, 'scripts/firebase-emulator.contract.mjs'))}`], { cwd: directory, env, stdio: 'inherit' });
child.once('error', () => { process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => child.kill(signal));
