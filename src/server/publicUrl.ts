import dns from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';

export class PublicUrlError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const denied = () => new PublicUrlError(403, 'Destino de URL não permitido.');
const expired = () => new PublicUrlError(504, 'Tempo limite da consulta de URL excedido.');

function v6Number(address: string): bigint {
  const halves = address.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const parts = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return parts.reduce((n, p) => (n << 16n) | BigInt(`0x${p}`), 0n);
}
export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) {
    const n = address.split('.').reduce((v, part) => v * 256 + Number(part), 0);
    const ranges: [string, number][] = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
      ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
    ];
    return !ranges.some(([base, bits]) => {
      const b = base.split('.').reduce((v, p) => v * 256 + Number(p), 0);
      return Math.floor(n / 2 ** (32 - bits)) === Math.floor(b / 2 ** (32 - bits));
    });
  }
  if (family !== 6 || address.includes('.') || address.includes('%')) return false;
  const n = v6Number(address);
  // Permit global unicast only, excluding special-purpose/tunnel/documentation ranges.
  const inRange = (base: string, bits: number) => (n >> BigInt(128 - bits)) === (v6Number(base) >> BigInt(128 - bits));
  return inRange('2000::', 3) && !inRange('2001::', 23) && !inRange('2001:db8::', 32)
    && !inRange('2002::', 16) && !inRange('3fff::', 20);
}

export function normalizePublicUrl(input: string): URL {
  const value = input.trim();
  if (!value || value.length > 4096 || /[\x00-\x20\x7f\\]/.test(value)) throw new PublicUrlError(400, 'URL inválida.');
  let url: URL;
  const hostAndPort = /^(?:\[[0-9a-f:]+\]|[a-z\d.-]+):\d+(?:[/?#]|$)/i.test(value);
  try { url = new URL(!hostAndPort && /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`); }
  catch { throw new PublicUrlError(400, 'URL inválida.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw denied();
  url.hash = '';
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host || host === 'localhost' || /\.(localhost|local|internal|home\.arpa)$/.test(host)) throw denied();
  if (net.isIP(host)) { if (!isPublicAddress(host)) throw denied(); }
  else if (!host.includes('.')) throw denied();
  return url;
}

export interface PublicTarget { url: URL; address: string; family: number; }
export interface PublicResponse { status: number; headers: Record<string, string>; body: Readable; }
export const MAPS_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'maps.google.com', 'www.google.com', 'google.com'];

function deadline<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(expired());
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export class PublicUrlClient {
  constructor(private config: { timeoutMs?: number; maxBytes?: number; proxy?: string } = {}) {}
  async resolve(host: string) { return dns.lookup(host, { all: true, verbatim: true }); }
  async validate(input: string, signal: AbortSignal, allowedHosts?: string[]): Promise<PublicTarget> {
    const url = normalizePublicUrl(input);
    const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (allowedHosts && !allowedHosts.includes(host)) throw denied();
    const family = net.isIP(host);
    const addresses = family ? [{ address: host, family }] : await deadline(this.resolve(host), signal);
    if (!addresses.length || addresses.some(a => net.isIP(a.address) !== a.family || !isPublicAddress(a.address))) throw denied();
    if (signal.aborted) throw expired();
    const target = [...addresses].sort((a, b) => a.family - b.family)[0];
    return { url, ...target };
  }
  async validateOnly(input: string): Promise<string> {
    return this.budget(async signal => (await this.validate(input, signal)).url.href);
  }
  private async budget<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10000);
    try { return await deadline(work(controller.signal), controller.signal); }
    catch (e) {
      if (controller.signal.aborted) throw expired();
      if (e instanceof PublicUrlError) throw e;
      throw new PublicUrlError(502, 'Não foi possível consultar a URL com segurança.');
    } finally { clearTimeout(timer); controller.abort(); }
  }

  // The proxy is trusted infrastructure, never user input. CONNECT uses a numeric
  // target so it cannot independently resolve the origin hostname. No NO_PROXY or
  // direct-connection fallback is applied. Proxy denials fail closed.
  async openSocket(target: PublicTarget, signal: AbortSignal): Promise<net.Socket> {
    const port = target.url.protocol === 'https:' ? 443 : 80;
    const proxyValue = this.config.proxy ?? (target.url.protocol === 'https:'
      ? process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || process.env.ALL_PROXY || process.env.all_proxy
      : process.env.HTTP_PROXY || process.env.http_proxy || process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy);
    let socket: net.Socket;
    if (proxyValue) {
      const proxy = new URL(proxyValue);
      if (!['http:', 'https:'].includes(proxy.protocol)) throw new PublicUrlError(502, 'Proxy incompatível com consulta segura.');
      socket = await new Promise<net.Socket>((resolve, reject) => {
        const authority = `${target.family === 6 ? `[${target.address}]` : target.address}:${port}`;
        const headers: Record<string, string> = { Host: authority };
        if (proxy.username || proxy.password) headers['Proxy-Authorization'] = `Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString('base64')}`;
        const request = (proxy.protocol === 'https:' ? https : http).request({
          protocol: proxy.protocol, hostname: proxy.hostname.replace(/^\[|\]$/g, ''),
          port: proxy.port || (proxy.protocol === 'https:' ? 443 : 80),
          method: 'CONNECT', path: authority, headers, signal,
        });
        request.once('error', reject);
        request.once('connect', (response, tunnel, head) => {
          if (response.statusCode !== 200 || head.length) { tunnel.destroy(); reject(new PublicUrlError(502, 'Proxy recusou o túnel ao IP validado.')); return; }
          resolve(tunnel);
        });
        request.end();
      });
    } else {
      socket = await new Promise<net.Socket>((resolve, reject) => {
        const connection = net.connect({ host: target.address, port, family: target.family, signal });
        connection.once('error', reject);
        connection.once('connect', () => resolve(connection));
      });
    }
    const abort = () => socket.destroy(expired());
    signal.addEventListener('abort', abort, { once: true });
    socket.once('close', () => signal.removeEventListener('abort', abort));
    if (signal.aborted) { socket.destroy(); throw expired(); }
    if (target.url.protocol !== 'https:') return socket;
    return new Promise<net.Socket>((resolve, reject) => {
      const host = target.url.hostname.replace(/^\[|\]$/g, '');
      const secure = tls.connect({ socket, servername: net.isIP(host) ? undefined : host,
        rejectUnauthorized: true, checkServerIdentity: (_name, cert) => tls.checkServerIdentity(host, cert) });
      secure.once('error', reject);
      secure.once('secureConnect', () => resolve(secure));
    });
  }

  async request(target: PublicTarget, signal: AbortSignal): Promise<PublicResponse> {
    const socket = await this.openSocket(target, signal);
    // HTTP framing over the already connected (and, for HTTPS, verified TLS) socket.
    const agent = new http.Agent({ keepAlive: false });
    agent.createConnection = () => socket;
    try {
      return await new Promise<PublicResponse>((resolve, reject) => {
        const request = http.request({ hostname: target.address, port: target.url.protocol === 'https:' ? 443 : 80,
          path: `${target.url.pathname}${target.url.search}`, method: 'GET', agent, signal,
          headers: { Host: target.url.host, 'User-Agent': 'G360-PublicWebsiteAudit/1.0', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'gzip, deflate, br' },
          maxHeaderSize: 16384,
        }, response => {
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(response.headers)) if (typeof value === 'string') headers[key] = value;
          resolve({ status: response.statusCode || 502, headers, body: response });
        });
        request.once('error', reject); request.end();
      });
    } catch (e) { socket.destroy(); agent.destroy(); throw e; }
  }

  async fetchHtml(input: string, options: { allowedHosts?: string[] } = {}): Promise<{ url: string; html: string; status: number }> {
    return this.budget(async signal => {
      let next = input;
      for (let hop = 0; hop <= 3; hop++) {
        const target = await this.validate(next, signal, options.allowedHosts);
        const response = await this.request(target, signal);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          response.body.destroy();
          if (!response.headers.location || hop === 3) throw new PublicUrlError(502, 'Redirecionamento inválido ou em excesso.');
          let redirected: URL;
          try { redirected = new URL(response.headers.location, target.url); } catch { throw new PublicUrlError(400, 'Redirecionamento inválido.'); }
          if (target.url.protocol === 'https:' && redirected.protocol === 'http:') throw denied();
          next = redirected.href; continue;
        }
        const max = this.config.maxBytes ?? 2 * 1024 * 1024;
        const abortBody = () => response.body.destroy(expired());
        signal.addEventListener('abort', abortBody, { once: true });
        let decoder: ReturnType<typeof createGunzip> | undefined;
        try {
          if (Number(response.headers['content-length']) > max) throw new PublicUrlError(413, 'Resposta excede o limite permitido.');
          if (!/^text\/html\b|^application\/xhtml\+xml\b/i.test(response.headers['content-type'] || '')) throw new PublicUrlError(415, 'A URL não retornou HTML.');
          const encoding = (response.headers['content-encoding'] || 'identity').toLowerCase();
          if (encoding === 'gzip') decoder = createGunzip();
          else if (encoding === 'deflate') decoder = createInflate();
          else if (encoding === 'br') decoder = createBrotliDecompress();
          else if (encoding !== 'identity') throw new PublicUrlError(415, 'Codificação de resposta não permitida.');
          let wire = 0;
          response.body.on('data', chunk => {
            wire += chunk.length;
            if (wire > max) response.body.destroy(new PublicUrlError(413, 'Resposta excede o limite permitido.'));
          });
          if (decoder) response.body.on('error', error => decoder!.destroy(error));
          const stream = decoder ? response.body.pipe(decoder) : response.body;
          const chunks: Buffer[] = [];
          let bytes = 0;
          for await (const chunk of stream) {
            const buffer = Buffer.from(chunk); bytes += buffer.length;
            if (bytes > max) throw new PublicUrlError(413, 'Resposta excede o limite permitido.');
            chunks.push(buffer);
          }
          return { url: target.url.href, html: Buffer.concat(chunks).toString('utf8'), status: response.status };
        } finally {
          signal.removeEventListener('abort', abortBody);
          response.body.destroy(); decoder?.destroy();
        }
      }
      throw denied();
    });
  }
}
export const publicUrlClient = new PublicUrlClient();

export function publicUrlRoute(handler: (req: any, res: any, next: any) => Promise<unknown>): import('express').RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(error => {
      if (error instanceof PublicUrlError) res.status(error.status).json({ ok: false, detail: error.message });
      else next(error);
    });
  };
}
