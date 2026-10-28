import path from 'node:path';
import { fileURLToPath } from 'node:url';
const checkout = fileURLToPath(new URL('../../', import.meta.url));

/** Optional location only: never creates, copies, initializes or migrates data. */
export function dataDirectory(env = process.env) {
  const configured = env.G360_DATA_DIR;
  if (configured === undefined) return checkout;
  if (typeof configured !== 'string' || !configured.trim() || !path.isAbsolute(configured) || configured.includes('\0')) throw Error('Invalid private data directory configuration');
  return path.resolve(configured);
}
export function dataFile(name, env = process.env) {
  if (!['db.json', 'cost-guard-metrics.json'].includes(name)) throw Error('Unknown private data document');
  return path.join(dataDirectory(env), name);
}
