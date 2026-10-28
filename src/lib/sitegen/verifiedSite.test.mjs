import { describe, it } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { buildVerifiedSiteHtml, downloadVerifiedSiteZip } from "./verifiedSite.js";

describe("approved static site export", () => {
  const input = { name: "Padaria Fictícia", category: "Padaria", city: "Cidade Teste", phone: "", description: "Atendimento sob consulta.", color: "#243b4a", approved: true };
  it("requires approval, escapes content and has no invented metrics or external assets", () => {
    assert.throws(() => buildVerifiedSiteHtml({ ...input, approved: false }));
    const html = buildVerifiedSiteHtml({ ...input, name: '<script>alert(1)</script>' });
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /avaliações|anos de experiência|https?:\/\//);
    assert.match(html, /<meta name="viewport"/);
  });
  it("normalizes Brazilian dialing and omits malformed phone links", () => {
    assert.match(buildVerifiedSiteHtml({ ...input, phone: "(11) 3333-4444" }), /href="tel:\+551133334444"/);
    assert.match(buildVerifiedSiteHtml({ ...input, phone: "+55 (11) 3333-4444" }), /href="tel:\+551133334444"/);
    assert.doesNotMatch(buildVerifiedSiteHtml({ ...input, phone: "12345" }), /href="tel:/);
  });
  it("exports exactly offline HTML and README without uploading", async () => {
    const originalDocument = globalThis.document;
    const create = URL.createObjectURL;
    const revoke = URL.revokeObjectURL;
    let blob, filename;
    globalThis.document = { createElement: () => ({ click() { filename = this.download; }, remove() {} }), body: { appendChild() {} } };
    URL.createObjectURL = (value) => { blob = value; return "blob:offline-test"; };
    URL.revokeObjectURL = () => {};
    try {
      await downloadVerifiedSiteZip(input);
      assert.equal(filename, "site-revisado.zip");
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      assert.deepEqual(Object.keys(zip.files).sort(), ["README.md", "index.html"]);
      assert.match(await zip.file("index.html").async("string"), /Padaria Fictícia/);
    } finally { globalThis.document = originalDocument; URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
  });
});
