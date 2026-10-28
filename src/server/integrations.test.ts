import test from 'node:test';
import assert from 'node:assert/strict';
import { googlePhotoLocation } from './googlePhoto.ts';
import { integrationStatus, publicDeploySettings } from './integrationRegistry.ts';

test('integration metadata never discloses keys or invents credit balances', () => {
  const status = integrationStatus({ GEMINI_API_KEY: 'fictional-secret-only' });
  assert.equal(status.find(p => p.id === 'gemini')!.configured, true);
  assert.equal(JSON.stringify(status).includes('fictional-secret-only'), false);
  assert.ok(status.every(p => p.balance === null && p.creditType === 'unknown' && !p.paidUseAuthorized));
  assert.equal(integrationStatus({ GEMINI_API_KEY: 'MY_GEMINI_API_KEY' })[0].configured, false);
  const settings = publicDeploySettings({ agencyName: 'Fixture', vercelToken: 'fictional-token', netlifyToken: 'fictional-netlify' });
  assert.equal(settings.vercelConfigured, true);
  assert.equal(JSON.stringify(settings).includes('fictional-'), false);
});

test('Google photo uses fixed API and key in header, browser receives only CDN URL', async () => {
  let count = 0;
  const transport: typeof fetch = async (input, init) => {
    count++;
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://places.googleapis.com');
    assert.equal(url.searchParams.get('skipHttpRedirect'), 'true');
    assert.equal(url.searchParams.has('key'), false);
    assert.equal((init!.headers as any)['X-Goog-Api-Key'], 'fictional-key');
    assert.equal(init!.redirect, 'error');
    return new Response(JSON.stringify({ photoUri: 'https://lh3.googleusercontent.com/fictional-image' }));
  };
  assert.equal(await googlePhotoLocation('places/fixture/photos/image_1', '600', 'fictional-key', transport), 'https://lh3.googleusercontent.com/fictional-image');
  assert.equal(count, 1);
});

test('invalid photo resources never trigger transport', async () => {
  let count = 0; const transport: typeof fetch = async () => { count++; throw Error('Forbidden'); };
  for (const resource of ['places/../../internal', 'http://127.0.0.1', 'places/fixture/photos/a?key=secret', 'places/a/photos/b/extra']) {
    await assert.rejects(googlePhotoLocation(resource, '600', 'fictional-key', transport));
  }
  for (const width of ['0', '-1', '4801', 'NaN', '1.5']) await assert.rejects(googlePhotoLocation('places/a/photos/b', width, 'fictional-key', transport));
  assert.equal(count, 0);
});

test('unsafe or credential-bearing photo locations and unbounded metadata are rejected', async () => {
  for (const photoUri of ['http://lh3.googleusercontent.com/img', 'https://127.0.0.1/img', 'https://lh3.googleusercontent.com.attacker.invalid/img', 'https://user:pass@lh3.googleusercontent.com/img', 'https://lh3.googleusercontent.com/img?key=x', 'https://lh3.googleusercontent.com/fictional-key']) {
    await assert.rejects(googlePhotoLocation('places/a/photos/b', '600', 'fictional-key', async () => new Response(JSON.stringify({ photoUri }))));
  }
  await assert.rejects(googlePhotoLocation('places/a/photos/b', '600', 'fictional-key', async () => new Response('x'.repeat(33000))));
  await assert.rejects(googlePhotoLocation('places/a/photos/b', '600', 'fictional-key', async () => new Response('', { status: 403 })));
});
