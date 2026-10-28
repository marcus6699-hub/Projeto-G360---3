import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWhatsappScripts, generateContractHtml } from "./zycronCatalog.js";

test("sales scripts never fabricate a site URL or claim a preview exists without one", () => {
  const scripts = buildWhatsappScripts({ name: "Empresa Fictícia", city: "Teste" }, "");
  for (const item of scripts) assert.doesNotMatch(item.reply, /seusite\.com\.br|Montei uma prévia|link \(https?:/i);
});

test("contract HTML escapes customer data and does not promise unprovided assets", () => {
  const html = generateContractHtml({ clientName: '<script>globalThis.__contract=1</script>', clientCity: "Teste", clientPhone: "", providerName: "Agência Fictícia" });
  assert.doesNotMatch(html, /<script>globalThis\.__contract=1<\/script>/);
  assert.doesNotMatch(html, /avaliações reais do Google|horários de funcionamento atualizados/);
});
