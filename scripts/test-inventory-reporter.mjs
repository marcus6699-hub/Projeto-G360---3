import path from 'node:path';
const unitFiles = new Set([
  'firestore.rules.test.ts', 'src/db/users.test.ts', 'src/lib/auth/logoutCoordinator.test.ts', 'src/lib/firestoreSchemas.test.ts',
  'src/lib/sitegen/masterImagePrompt.test.ts', 'src/lib/sitegen/sitegen.test.ts', 'src/lib/sitegen/siteSecurity.test.ts',
  'src/server/authPolicy.test.ts', 'src/server/blindagem.test.ts', 'src/server/externalAccess.test.ts',
  'src/server/integrations.test.ts', 'src/server/paymentSimulation.test.ts',
]);
export default async function* inventory(source) {
  const files = new Map();
  for await (const event of source) {
    if (!['test:pass', 'test:fail'].includes(event.type) || event.data.details?.type === 'suite') continue;
    const file = event.data.file ? path.relative(process.cwd(), event.data.file) : '(unknown)';
    const record = files.get(file) || { file, focus: unitFiles.has(file) ? 'unit_or_mock' : 'local_integration_or_mixed', passed: 0, failed: 0, skipped: 0 };
    if (event.data.skip) record.skipped++;
    else if (event.type === 'test:pass') record.passed++;
    else record.failed++;
    files.set(file, record);
  }
  yield JSON.stringify({ method: 'Classification by primary file focus; mixed filesystem/HTTP/controlled transport suites count as local integration. Firestore JS models and mocked SDK/SQL are NOT real service validation.', files: [...files.values()].sort((a, b) => a.file.localeCompare(b.file)) }, null, 2) + '\n';
}
