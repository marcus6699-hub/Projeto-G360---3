// Generates malicious-but-fictional inputs only; never imports the server or database.
import fs from 'node:fs';
import path from 'node:path';
import { createProjectData } from '../src/lib/sitegen/projectFactory.js';
import { generateSiteHtml } from '../src/lib/sitegen/generateSiteHtml.js';
const directory = process.argv[2];
if (!directory || !path.resolve(directory).startsWith('/tmp/g360-sitegen-browser-')) throw Error('Temporary fixture directory required');
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3l8AAAAASUVORK5CYII=';
const injection = name => `"><img src="/broken-fixture" onerror="window.__g360Marker='${name}'">`;
const cases = [
  ['control', () => {}, false],
  ['business-name-and-json', d => { d.business.name = injection('business-name'); d.business.bio = '</script><script>window.__g360Marker="json-breaking"</script>'; }, false],
  ['tracking-script', d => { for (const key of ['metaPixelId', 'ga4Id', 'gadsId', 'gadsLabel', 'gtmId']) d.marketing[key] = '</script><script>window.__g360Marker="tracking"</script>'; }, false],
  ['maps-attribute', d => { d.business.google_maps_uri = injection('maps-attribute'); }, true],
  ['maps-javascript', d => { d.business.google_maps_uri = "javascript:window.__g360Marker='maps-javascript'"; }, true],
  ['website-javascript', d => { d.business.website = "javascript:window.__g360Marker='website-javascript'"; }, true],
  ['whatsapp-attribute', d => { d.business.whatsapp = injection('whatsapp-attribute'); }, true],
  ['image-fit-attribute', d => { d.images.hero = { url: image, fit: 'cover" onload="window.__g360Marker=\'image-fit-attribute\'" data-fixture="' }; }, true],
  ['button-effect-attribute', d => { d.buttons.header_cta = { effect: injection('button-effect-attribute') }; }, true],
  ['logo-svg-onload', d => { d.logo = { url: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__g360Marker=\'logo-svg\'"><rect width="1" height="1"/></svg>') }; }, false],
  ['logo-attribute', d => { d.logo = { url: injection('logo-attribute') }; }, false],
  ['archetype-attribute', d => { d.archetype = 'servicos" onload="window.__g360Marker=\'archetype-attribute\'" data-fixture="'; }, true],
  ['template-attribute', d => { d.templateId = 'atelie-val" onload="window.__g360Marker=\'template-attribute\'" data-fixture="'; }, true],
  ['gtm-controlled-container', d => { d.marketing.gtmId = 'GTM-FIXTURE'; }, false],
];
const manifest = [];
for (const [name, mutate, candidate] of cases) {
  const data = createProjectData({ name: 'Empresa Fictícia de Segurança', category: 'Teste', city: 'Cidade Fictícia', uf: 'GO', address: 'Rua Fictícia, 0', phone: '00000000000', whatsapp: '00000000000', photos: [image], items: [], reviews: [], faqs: [], hours: [], rating: null, rating_count: null }, 'servicos');
  data.images.hero = { url: image, fit: 'cover' };
  mutate(data);
  const html = generateSiteHtml(data, { slug: 'fictional-security' });
  fs.writeFileSync(path.join(directory, `${name}.html`), html);
  // Mirror the actual PublicSite security attribute; do not weaken it in tests.
  const publicSource = fs.readFileSync(new URL('../src/pages/PublicSite.jsx', import.meta.url), 'utf8');
  const sandbox = publicSource.match(/sandbox="([^"]+)"/)?.[1];
  if (!sandbox || sandbox.split(/\s+/).includes('allow-same-origin')) throw Error('Public iframe isolation missing');
  const serialized = JSON.stringify(html).replace(/</g, '\\u003c');
  fs.writeFileSync(path.join(directory, `${name}-frame.html`), `<!doctype html><iframe id="generated" sandbox="${sandbox}" title="Fictional generated site"></iframe><script>document.getElementById('generated').srcdoc=${serialized}</script>`);
  manifest.push({ name, candidate });
}
fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
