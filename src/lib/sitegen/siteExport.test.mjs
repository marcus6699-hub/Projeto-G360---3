import { describe, it } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { downloadSiteZip, generateSiteHtml } from "./generateSiteHtml.js";

describe("Site Express ZIP export (offline fixture)", () => {
  it("does not fabricate rating, review volume, years or a broken hero photo when input lacks them", () => {
    const html = generateSiteHtml({ archetype: "servicos", business: {
      name: "Empresa Fictícia", category: "Serviços", city: "Teste", uf: "SP", photos: [], items: [],
    }, sections: [{ id: "hero", on: true }] });
    assert.doesNotMatch(html, /50\+ avaliações|20\+ anos|5,0 \/ 5/);
    assert.match(html, /data:image\/svg\+xml/);
    assert.doesNotMatch(html, /<img[^>]*src=""/);
  });
  it("includes a renderable HTML document and manifest without uploading", async () => {
    const originalDocument = globalThis.document;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    let exportedBlob;
    let filename;
    globalThis.document = {
      createElement: () => ({ click() { filename = this.download; }, remove() {} }),
      body: { appendChild() {} },
    };
    URL.createObjectURL = (blob) => { exportedBlob = blob; return "blob:offline-test"; };
    URL.revokeObjectURL = () => {};
    try {
      await downloadSiteZip({
        archetype: "servicos",
        sections: [],
        business: { name: "Empresa Fictícia", category: "Serviços", city: "Teste", uf: "SP", photos: [], items: [] },
      }, "empresa-teste.zip", "empresa-teste");
      assert.equal(filename, "empresa-teste.zip");
      const zip = await JSZip.loadAsync(await exportedBlob.arrayBuffer());
      assert.deepEqual(Object.keys(zip.files).sort(), ["README.md", "index.html", "site-manifest.json"]);
      const html = await zip.file("index.html").async("string");
      assert.match(html, /<!DOCTYPE html>/i);
      assert.match(html, /Empresa Fictícia/);
      assert.match(html, /<meta name="viewport"/);
      const manifest = JSON.parse(await zip.file("site-manifest.json").async("string"));
      assert.equal(manifest.name, "Empresa Fictícia");
      assert.match(await zip.file("README.md").async("string"), /dependem de conectividade/);
    } finally {
      globalThis.document = originalDocument;
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
