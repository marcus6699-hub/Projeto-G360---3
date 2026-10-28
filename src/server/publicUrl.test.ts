import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { PublicUrlClient, PublicUrlError, isPublicAddress, MAPS_HOSTS } from './publicUrl.ts';

const publicIP = '93.184.216.34'; // Logical fixture only: no actual connections to it.
const page = (text = '<html>Fixture</html>', headers = {}) => ({ status: 200, headers: { 'content-type': 'text/html', ...headers }, body: Readable.from([Buffer.from(text)]) });
function simulated(config: ConstructorParameters<typeof PublicUrlClient>[0] = {}) {
  const client = new PublicUrlClient({ proxy: '', ...config });
  let requests = 0;
  client.resolve = async () => [{ address: publicIP, family: 4 }];
  client.request = async () => { requests++; return page(); };
  return { client, requests: () => requests };
}
const rejected = (status: number) => (error: unknown) => error instanceof PublicUrlError && error.status === status;

for (const host of ['localhost', 'sub.localhost', 'metadata.google.internal', '127.0.0.1', '127.1', '2130706433', '0x7f000001', '0177.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.100.100.200', '0.0.0.0', '192.0.2.1', '198.18.0.1', '224.0.0.1', '[::1]', '[::]', '[fd00:ec2::254]', '[fe80::1]', '[::ffff:127.0.0.1]', '[::ffff:7f00:1]', '[64:ff9b::7f00:1]', '[2001:db8::1]', '[2002:7f00:1::]']) {
  test(`blocks non-public or alternative host ${host} before DNS/transport`, async () => {
    const { client, requests } = simulated(); let dns = 0;
    client.resolve = async () => { dns++; return [{ address: publicIP, family: 4 }]; };
    await assert.rejects(client.fetchHtml(`http://${host}/`), rejected(403));
    assert.equal(requests(), 0); assert.equal(dns, 0);
  });
}
test('public IPv4 and IPv6 classification; special IPv6 ranges fail closed', () => {
  assert.ok(isPublicAddress('8.8.8.8')); assert.ok(isPublicAddress('2606:4700:4700::1111'));
  assert.equal(isPublicAddress('2001::1'), false); assert.equal(isPublicAddress('3fff::1'), false);
});
test('schemes, credentials and nonstandard ports are denied', async () => {
  const { client, requests } = simulated();
  for (const url of ['file:///tmp/fixture', 'data:text/html,test', 'ftp://example.invalid/', 'gopher://example.invalid/', 'https://user:pass@example.invalid/', 'https://example.invalid:8443/']) await assert.rejects(client.fetchHtml(url), rejected(403));
  await assert.rejects(client.fetchHtml('https://['), rejected(400));
  assert.equal(requests(), 0);
});
test('all DNS answers must be public; errors and empty DNS fail closed', async () => {
  const { client, requests } = simulated();
  for (const address of ['127.0.0.1', '10.0.0.1', 'fd00::1', '169.254.169.254']) {
    client.resolve = async () => [{ address: publicIP, family: 4 }, { address, family: net.isIP(address) }];
    await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(403));
  }
  client.resolve = async () => []; await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(403));
  client.resolve = async () => { throw Error('fixture DNS unavailable'); }; await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(502));
  assert.equal(requests(), 0);
});
test('public HTTPS, shorthand and raw-HTML validation stay available', async () => {
  const { client, requests } = simulated();
  assert.equal((await client.fetchHtml('example.invalid')).url, 'https://example.invalid/');
  assert.equal(await client.validateOnly('https://example.invalid/'), 'https://example.invalid/');
  assert.equal((await client.fetchHtml('example.invalid:443/path')).url, 'https://example.invalid/path');
  assert.equal(requests(), 2);
});
for (const status of [301, 302, 303, 307, 308]) {
  test(`validates relative redirect ${status} and keeps original hostname`, async () => {
    const { client } = simulated(); const urls: string[] = [];
    client.request = async target => { urls.push(target.url.href); return urls.length === 1 ? { status, headers: { location: '/final' }, body: Readable.from([]) } : page(); };
    assert.equal((await client.fetchHtml('https://example.invalid/start')).url, 'https://example.invalid/final');
    assert.deepEqual(urls, ['https://example.invalid/start', 'https://example.invalid/final']);
  });
}
test('blocks private redirect, HTTPS downgrade and redirect loops', async () => {
  for (const location of ['https://127.0.0.1/', 'https://[fd00::1]/', 'http://example.invalid/']) {
    const { client } = simulated(); let calls = 0;
    client.request = async () => { calls++; return { status: 302, headers: { location }, body: Readable.from([]) }; };
    await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(403)); assert.equal(calls, 1);
  }
  const { client } = simulated(); let calls = 0;
  client.request = async () => { calls++; return { status: 302, headers: { location: '/again' }, body: Readable.from([]) }; };
  await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(502)); assert.equal(calls, 4);
});
test('validates DNS again on a redirect before opening its connection', async () => {
  const { client } = simulated(); let lookups = 0, calls = 0;
  client.resolve = async () => [{ address: ++lookups === 1 ? publicIP : '10.0.0.1', family: 4 }];
  client.request = async () => { calls++; return { status: 302, headers: { location: '/next' }, body: Readable.from([]) }; };
  await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(403)); assert.equal(calls, 1);
});
test('Maps hostname allowlist applies to every hop, not suffix lookalikes', async () => {
  const { client } = simulated();
  client.request = async () => ({ status: 302, headers: { location: 'https://google.com.evil.invalid/' }, body: Readable.from([]) });
  await assert.rejects(client.fetchHtml('https://maps.app.goo.gl/fixture', { allowedHosts: MAPS_HOSTS }), rejected(403));
});
test('wire, decoded and advertised size limits; HTML type required', async () => {
  const { client } = simulated({ maxBytes: 512 });
  client.request = async () => page('fixture', { 'content-length': '513' });
  await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(413));
  client.request = async () => page('x'.repeat(513));
  await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(413));
  client.request = async () => ({ ...page(), headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' }, body: Readable.from([gzipSync(Buffer.alloc(4096))]) });
  await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(413));
  client.request = async () => page('fixture', { 'content-type': 'application/octet-stream' });
  await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(415));
});
test('valid compressed HTML remains usable', async () => {
  const { client } = simulated();
  client.request = async () => ({ ...page(), headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' }, body: Readable.from([gzipSync('<html>Fixture</html>')]) });
  assert.equal((await client.fetchHtml('https://example.invalid/')).html, '<html>Fixture</html>');
});
test('deadline covers DNS, transport, and a body that never finishes', async () => {
  const { client, requests } = simulated({ timeoutMs: 30 });
  client.resolve = () => new Promise(() => {});
  await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(504)); assert.equal(requests(), 0);
  client.resolve = async () => [{ address: publicIP, family: 4 }];
  client.request = () => new Promise(() => {});
  await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(504));
  client.request = async () => ({ ...page(), body: new Readable({ read() {} }) });
  await assert.rejects(client.fetchHtml('https://example.invalid/'), rejected(504));
});

test('direct transport connects to the validated IP once, retaining Host (controlled local server)', async () => {
  const origin = http.createServer((req, res) => {
    assert.equal(req.headers.host, 'example.invalid'); assert.equal(req.headers.authorization, undefined);
    res.setHeader('content-type', 'text/html'); res.end('<html>Controlled origin</html>');
  });
  await new Promise<void>(resolve => origin.listen(0, '127.0.0.1', resolve));
  const realConnect = net.connect; const seen: any[] = [];
  const patch = mock.method(net, 'connect', ((options: any) => {
    seen.push(options); assert.equal(options.host, publicIP); assert.equal(options.port, 80);
    return realConnect({ host: '127.0.0.1', port: (origin.address() as any).port, signal: options.signal });
  }) as any);
  try {
    const client = new PublicUrlClient({ proxy: '' }); let dns = 0;
    client.resolve = async () => [{ address: ++dns === 1 ? publicIP : '127.0.0.1', family: 4 }];
    assert.equal((await client.fetchHtml('http://example.invalid/')).html, '<html>Controlled origin</html>');
    assert.equal(dns, 1); assert.equal(seen.length, 1);
  } finally { patch.mock.restore(); await new Promise<void>(resolve => origin.close(() => resolve())); }
});

test('proxy uses numeric CONNECT, retains Host and never forwards proxy credentials to origin', async () => {
  let connectTarget = '', originRequest = '';
  const proxy = http.createServer();
  proxy.on('connect', (req, socket) => {
    connectTarget = req.url!;
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    socket.once('data', chunk => {
      originRequest = chunk.toString();
      socket.end('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 20\r\nConnection: close\r\n\r\n<html>Fixture</html>');
    });
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  try {
    const client = new PublicUrlClient({ proxy: `http://fixture:fictional@127.0.0.1:${(proxy.address() as any).port}` });
    client.resolve = async () => [{ address: publicIP, family: 4 }];
    assert.equal((await client.fetchHtml('http://example.invalid/')).html, '<html>Fixture</html>');
    assert.equal(connectTarget, `${publicIP}:80`); assert.match(originRequest, /Host: example\.invalid/i);
    assert.doesNotMatch(originRequest, /proxy-authorization|fictional|fixture:/i);
  } finally { await new Promise<void>(resolve => proxy.close(() => resolve())); }
});
test('proxy denial fails closed without a direct fallback', async () => {
  const proxy = http.createServer(); let connects = 0;
  proxy.on('connect', (_req, socket) => { connects++; socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n'); });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const direct = mock.method(net, 'connect', () => { throw Error('No direct connection is permitted'); });
  try {
    const client = new PublicUrlClient({ proxy: `http://127.0.0.1:${(proxy.address() as any).port}`, timeoutMs: 500 });
    client.resolve = async () => [{ address: publicIP, family: 4 }];
    await assert.rejects(client.fetchHtml('http://example.invalid/'), rejected(502));
    assert.equal(connects, 1); assert.equal(direct.mock.callCount(), 0);
  } finally { direct.mock.restore(); await new Promise<void>(resolve => proxy.close(() => resolve())); }
});
test('HTTPS requires TLS handshake and original-host certificate verification through a proxy', async () => {
  const { client } = simulated();
  // Exercise the real openSocket policy with a fake TCP socket and intercepted TLS.
  const socket = new net.Socket();
  const proxy = http.createServer();
  proxy.on('connect', (_req, tunnel) => { tunnel.on('end', () => tunnel.destroy()); tunnel.write('HTTP/1.1 200 Connection Established\r\n\r\n'); });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  let config: any;
  const patch = mock.method(tls, 'connect', ((options: any) => {
    config = options;
    options.socket.destroy();
    queueMicrotask(() => socket.emit('error', Error('fixture invalid certificate')));
    return socket;
  }) as any);
  try {
    const real = new PublicUrlClient({ proxy: `http://127.0.0.1:${(proxy.address() as any).port}` });
    real.resolve = client.resolve;
    await assert.rejects(real.fetchHtml('https://example.invalid/'), rejected(502));
    assert.equal(config.servername, 'example.invalid'); assert.equal(config.rejectUnauthorized, true);
    assert.ok(config.checkServerIdentity('ignored', { subjectaltname: 'DNS:wrong.invalid' }));
    assert.equal(config.checkServerIdentity('ignored', { subjectaltname: 'DNS:example.invalid' }), undefined);
  } finally { patch.mock.restore(); socket.destroy(); await new Promise<void>(resolve => proxy.close(() => resolve())); }
});

test('IPv6 public target stays pinned and bracketed through CONNECT (controlled proxy)', async () => {
  const proxy = http.createServer(); let authority = '';
  proxy.on('connect', (req, socket) => {
    authority = req.url!;
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    socket.once('data', () => socket.end('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 20\r\nConnection: close\r\n\r\n<html>Fixture</html>'));
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  try {
    const client = new PublicUrlClient({ proxy: `http://127.0.0.1:${(proxy.address() as any).port}` });
    let queries = 0;
    client.resolve = async () => { queries++; return [{ address: '2606:4700:4700::1111', family: 6 }]; };
    assert.equal((await client.fetchHtml('http://example.invalid/')).status, 200);
    assert.equal(authority, '[2606:4700:4700::1111]:80'); assert.equal(queries, 1);
  } finally { await new Promise<void>(resolve => proxy.close(() => resolve())); }
});

test('environment proxy is honored despite NO_PROXY; unsupported proxies never use direct transport', async () => {
  const names = ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const proxy = http.createServer(); let connections = 0;
  proxy.on('connect', (_req, socket) => {
    connections++; socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    socket.once('data', () => socket.end('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 20\r\nConnection: close\r\n\r\n<html>Fixture</html>'));
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const direct = mock.method(net, 'connect', () => { throw Error('Direct connection forbidden in proxy test'); });
  try {
    for (const name of names) delete process.env[name];
    process.env.HTTPS_PROXY = `http://127.0.0.1:${(proxy.address() as any).port}`;
    process.env.NO_PROXY = '*';
    const client = new PublicUrlClient();
    client.resolve = async () => [{ address: publicIP, family: 4 }];
    assert.equal((await client.fetchHtml('http://example.invalid/')).status, 200);
    assert.equal(connections, 1); assert.equal(direct.mock.callCount(), 0);
    delete process.env.HTTPS_PROXY; process.env.ALL_PROXY = 'socks5://127.0.0.1:12345';
    await assert.rejects(client.fetchHtml('http://example.invalid/'), rejected(502));
    assert.equal(direct.mock.callCount(), 0);
  } finally {
    for (const name of names) { if (original[name] === undefined) delete process.env[name]; else process.env[name] = original[name]; }
    direct.mock.restore(); await new Promise<void>(resolve => proxy.close(() => resolve()));
  }
});
