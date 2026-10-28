import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectData } from './projectFactory.js';
import { generateSiteHtml, buildCtx } from './generateSiteHtml.js';
const fixture = (): any => createProjectData({ name: 'Fictitious business', category: 'Fixture', city: 'Fixture', uf: 'GO', whatsapp: '5562999990000', photos: [], items: [] }, 'servicos');
test('attribute payloads in maps, WhatsApp, image fit, button effect and body classes cannot create executable HTML attributes', () => {
  const injection = '\"><img src="/broken-fixture" onerror="window.__securityMarker=1">';
  const cases = [
    (d: any) => { d.business.google_maps_uri = injection; },
    (d: any) => { d.business.whatsapp = injection; },
    (d: any) => { d.images.hero = { url: '/image.png', fit: 'cover" onload="window.__securityMarker=1' }; },
    (d: any) => { d.buttons.header_cta = { effect: injection }; },
    (d: any) => { d.archetype = 'servicos" onload="window.__securityMarker=1'; },
    (d: any) => { d.templateId = 'atelie-val" onload="window.__securityMarker=1'; },
  ];
  for (const mutate of cases) {
    const data = fixture(); mutate(data); const html = generateSiteHtml(data);
    assert.equal(html.includes('onerror="window.__securityMarker'), false);
    assert.equal(html.includes('onload="window.__securityMarker'), false);
  }
});
test('dangerous link protocols are removed while legitimate links, media, fit and button effects survive', () => {
  const data = fixture();
  data.business.google_maps_uri = 'javascript:alert(1)'; data.business.website = 'data:text/html,<script>alert(1)</script>';
  const denied = buildCtx(data); assert.equal(denied.b.google_maps_uri, ''); assert.equal(denied.b.website, '');
  data.business.google_maps_uri = 'https://www.google.com/maps?query=Fixture'; data.business.website = 'https://example.invalid/path';
  data.business.whatsapp = '+55 (62) 99999-0000'; data.buttons.header_cta = { effect: 'shimmer' };
  data.images.hero = { url: '/api/places/photo?name=fixture', fit: 'contain' };
  const safe = buildCtx(data); assert.equal(safe.b.whatsapp, '5562999990000'); assert.equal(safe.buttons.header_cta.effect, 'shimmer'); assert.equal(safe.img('hero').fit, 'contain');
  assert.equal(safe.b.website, data.business.website); assert.ok(safe.img('hero').url.includes('/api/places/photo'));
});
test('invalid coordinate and media collections do not become HTML attributes', () => {
  const data = fixture(); data.business.lat = '1" onload="bad'; data.business.lng = 181;
  data.business.photos = 'not-an-array'; data.business.items = [null];
  const ctx = buildCtx(data); assert.equal(ctx.b.lat, null); assert.equal(ctx.b.lng, null); assert.deepEqual(ctx.b.photos, []); assert.deepEqual(ctx.b.items, []);
});
test('editor preview does not load tenant-controlled tracking scripts; standalone output retains configured tracking', () => {
  const data = fixture(); data.marketing = { gtmId: 'GTM-FIXTURE', metaPixelId: '123456789', ga4Id: 'G-FIXTURE' };
  const preview = generateSiteHtml(data, { editor: true });
  assert.equal(preview.includes('googletagmanager.com'), false); assert.equal(preview.includes('connect.facebook.net'), false);
  const standalone = generateSiteHtml(data, { editor: false });
  assert.ok(standalone.includes('googletagmanager.com/gtm.js')); assert.ok(standalone.includes('connect.facebook.net'));
});
