import { providerFetch } from "./externalAccess.ts";
/** Uses only Google's fixed API endpoint, returning a credential-free image location. */
export async function googlePhotoLocation(name: string, width: string, key: string, transport: (input: string, init?: RequestInit) => Promise<Response> = providerFetch): Promise<string> {
  if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_=-]+$/.test(name)) throw Error('Invalid photo resource');
  const size = Number(width);
  if (!Number.isInteger(size) || size < 1 || size > 4800) throw Error('Invalid photo size');
  const endpoint = new URL(`https://places.googleapis.com/v1/${name}/media`);
  endpoint.searchParams.set('maxWidthPx', String(size));
  endpoint.searchParams.set('skipHttpRedirect', 'true');
  const response = await transport(endpoint.href, { headers: { 'X-Goog-Api-Key': key }, redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!response.ok || !response.body) throw Error('Photo unavailable');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 32768) throw Error('Photo metadata too large'); chunks.push(value); }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const metadata = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const location = new URL(metadata.photoUri);
  if (location.protocol !== 'https:' || !/^lh[0-9]+\.googleusercontent\.com$/.test(location.hostname)
    || location.username || location.password || location.port || location.href.includes(key)
    || [...location.searchParams.keys()].some(k => /key|token|secret/i.test(k))) throw Error('Unsafe photo location');
  return location.href;
}
