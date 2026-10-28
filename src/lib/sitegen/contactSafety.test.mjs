import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSiteHtml } from "./generateSiteHtml.js";
import { waLink } from "./theme.js";

const business = { name: "Empresa Fictícia", category: "Serviços", city: "Teste", uf: "SP", photos: [], items: [], address: "Rua Teste" };
const render = (extra = {}) => generateSiteHtml({ archetype: "servicos", templateId: "atelie-val", business: { ...business, ...extra } });

test("a landline is not presented as WhatsApp; missing contact does not create a broken WhatsApp URL", () => {
  assert.equal(waLink({ phone: "(11) 3333-4444" }, "olá"), null);
  const html = render({ phone: "(11) 3333-4444" });
  assert.doesNotMatch(html, /https:\/\/wa\.me\//);
  assert.doesNotMatch(html, /WhatsApp direto/);
  assert.match(html, /href="tel:\+551133334444"/);
  assert.doesNotMatch(html, /href="tel:\+"/);
  const missing = render();
  assert.doesNotMatch(missing, /https:\/\/wa\.me\//);
  assert.doesNotMatch(missing, /href="tel:\+"|href="undefined"/);
});

test("only an explicitly supplied valid WhatsApp number creates a WhatsApp CTA", () => {
  assert.match(waLink({ whatsapp: "+55 (11) 98765-4321" }, "olá"), /^https:\/\/wa\.me\/5511987654321\?text=/);
  assert.match(waLink({ whatsapp: "(11) 98765-4321" }, "olá"), /^https:\/\/wa\.me\/5511987654321\?text=/);
  assert.equal(waLink({ whatsapp: "123" }, "olá"), null);
  assert.equal(waLink({ whatsapp: "0011999999999" }, "olá"), null);
  const html = render({ phone: "(11) 3333-4444", whatsapp: "+55 (11) 98765-4321" });
  assert.match(html, /https:\/\/wa\.me\/5511987654321/);
  assert.match(html, /href="tel:\+551133334444"/);
});

test("SEO JSON-LD cannot break out of its script and unverified ratings create no aggregate schema", () => {
  const html = render({ name: 'Teste </script><script>globalThis.__xss=1</script>', rating: 4.9, rating_count: 10 });
  assert.doesNotMatch(html, /<script>globalThis\.__xss=1<\/script>/);
  assert.doesNotMatch(html, /AggregateRating/);
  assert.doesNotMatch(html, /MedicalBusiness/);
});

test("untrusted analytics identifiers cannot inject code into exported HTML", () => {
  const html = generateSiteHtml({ archetype: "servicos", business, marketing: {
    metaPixelId: "1');globalThis.__pixel=1;//",
    ga4Id: "G-ABC');globalThis.__ga=1;//",
    gadsId: "AW-1');globalThis.__ads=1;//",
    gtmId: "GTM-X');globalThis.__gtm=1;//",
  } });
  assert.doesNotMatch(html, /globalThis\.__(?:pixel|ga|ads|gtm)=1/);
});

test("without an address or coordinates the location section does not invent directions", () => {
  const html = render({ address: "", lat: null, lng: null });
  const section = html.match(/<section class="sec" id="localizacao">[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.doesNotMatch(section, /Abrir no Google Maps|Traçar Rota no Waze|<iframe/);
  assert.match(section, /Localização não informada/);
});

test("contact fallback still has a destination when the location section is disabled", () => {
  const html = generateSiteHtml({ archetype: "servicos", business: { ...business, address: "" }, sections: [{ id: "hero", on: true }] });
  assert.match(html, /href="#localizacao"/);
  assert.match(html, /<footer[^>]*id="localizacao"/);
});

test("untrusted slug cannot break out of the click tracking script", () => {
  const html = generateSiteHtml({ archetype: "servicos", business }, { slug: "</script><script>globalThis.__track=1</script>" });
  assert.doesNotMatch(html, /<script>globalThis\.__track=1<\/script>/);
});

test("untrusted external URLs cannot become executable anchors", () => {
  const html = render({ website: "javascript:alert(1)", google_maps_uri: "javascript:alert(2)", reviews: [{ author: "Cliente Fictício", rating: 5, text: "Teste" }] });
  assert.doesNotMatch(html, /href="javascript:/);
});
