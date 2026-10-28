// All application imports run in a disposable copy with fictional records.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scryptSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-validation-'));
fs.cpSync(root, fixture, { recursive: true, filter: source => {
  const parts = path.relative(root, source).split(path.sep);
  return !parts.some(p => ['.git', 'node_modules', 'dist', 'attachments', '__pycache__'].includes(p)
    || p.startsWith('.env') || /^(db|cost-guard-metrics)\.json/.test(p));
} });
fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
const password = `scrypt:fixture-salt:${scryptSync('fixture-password', 'fixture-salt', 64).toString('hex')}`;
fs.writeFileSync(path.join(fixture, 'db.json'), JSON.stringify({
  securityPlanFixture: true,
  users: [
    { id: 'url-fixture-admin', name: 'URL Fixture', email: 'url-admin@example.invalid', role: 'admin' },
    { id: 'audit-admin', name: 'Admin Fixture', email: 'admin@example.invalid', role: 'admin', password },
    { id: 'legacy-user', name: 'Legacy Fixture', email: 'legacy@example.invalid', role: 'user', password: 'legacy-fixture-password' },
  ],
  projects: [{ id: 'fixture-project', slug: 'fixture', name: 'Fixture', status: 'active', data: {} }],
  clicks: {}, aiSettings: {},
  g360: { audits: [{ id: 'legacy-audit', business: { name: 'Legacy' } }], crmLeads: [{ id: 'legacy-lead', businessName: 'Legacy' }], packagesByBusiness: {}, financeGoals: {}, deploySettings: {} },
}), { mode: 0o600 });
// Allowlist runtime environment: no inherited provider credentials or .env copy.
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'NODE_EXTRA_CA_CERTS', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, { NODE_ENV: 'test', G360_TEST_FIXTURE: '1', G360_URL_PLAN_FIXTURE: '1' });
const files = [];
function visit(dir) {
  for (const item of fs.readdirSync(path.join(fixture, dir), { withFileTypes: true })) {
    const relative = path.join(dir, item.name);
    if (item.isDirectory() && !['node_modules', '.git', 'dist'].includes(item.name)) visit(relative);
    else if (/\.test\.(ts|mjs)$/.test(item.name) || /^(ssrf|persistence)\.contract\.mjs$/.test(item.name)) files.push(relative);
  }
}
visit('');
console.log(`Fictional fixture retained for inspection: ${fixture}`);
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1',
  '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=./scripts/test-inventory-reporter.mjs', `--test-reporter-destination=${path.join(fixture, 'test-inventory.json')}`,
  ...files.sort()], { cwd: fixture, env, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
