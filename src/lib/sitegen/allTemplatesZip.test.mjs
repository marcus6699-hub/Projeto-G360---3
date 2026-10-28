import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import JSZip from "jszip";
import { downloadSiteZip } from "./generateSiteHtml.js";

const templates = [
  ["atelie-val", "servicos"], ["zycron-barbearia", "servicos"],
  ["zycron-padaria", "gastronomia"], ["zycron-moda", "produtos"],
  ["modelo-premium", "servicos"], ["simprao", "gastronomia"],
  ["vitrine-express", "produtos"],
];

test("all seven templates export readable ZIPs and extracted HTML without private credentials", async () => {
  const originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const extracted = await mkdtemp(path.join(process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Temp", "opencode") : os.tmpdir(), "g360-zip-seven-"));
  let blob;
  let filename;
  globalThis.document = { createElement: () => ({ click() { filename = this.download; }, remove() {} }), body: { appendChild() {} } };
  URL.createObjectURL = (value) => { blob = value; return "blob:local-only"; };
  URL.revokeObjectURL = () => {};
  try {
    for (const [templateId, archetype] of templates) {
      blob = null;
      const input = { templateId, archetype, business: {
        name: `Empresa Fictícia ${templateId}`, category: "Serviços", city: "Teste", uf: "SP", address: "Rua de Teste, 1", phone: "", whatsapp: "", photos: [], items: [], reviews: [],
      } };
      await downloadSiteZip(input, templateId + ".zip");
      assert.equal(filename, templateId + ".zip");
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      assert.deepEqual(Object.keys(zip.files).sort(), ["README.md", "index.html", "site-manifest.json"]);
      const html = await zip.file("index.html").async("string");
      const file = path.join(extracted, templateId + ".html");
      await writeFile(file, html);
      const reopened = await readFile(file, "utf8");
      assert.match(reopened, /<!DOCTYPE html>/i);
      assert.ok(reopened.includes(input.business.name));
      assert.doesNotMatch(reopened, /href="null"|href="undefined"|href="tel:\+"|<img[^>]*src=""/);
      assert.doesNotMatch(reopened, /https:\/\/wa\.me\//);
      const ids = new Set([...reopened.matchAll(/\bid="([a-z][\w-]*)"/g)].map((m) => m[1]));
      const missingAnchors = [...new Set([...reopened.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1]).filter((id) => !ids.has(id)))];
      assert.deepEqual(missingAnchors, [], `${templateId}: menu/CTA links must point to real anchors`);
      assert.doesNotMatch(reopened, /VITE_\w+\s*=|GOOGLE_PLACES_API_KEY\s*=|OUTSCRAPER_API_KEY\s*=/);
      const manifest = JSON.parse(await zip.file("site-manifest.json").async("string"));
      assert.equal(manifest.name, input.business.name);
      if (templateId === "zycron-padaria") {
        assert.match(reopened, /class="wrap zycron-chat-layout"/);
        assert.match(reopened, /@media\(max-width:700px\)[\s\S]*?\.zycron-chat-layout\{grid-template-columns:minmax\(0,1fr\)/);
      }
      // Legacy templates reference Google Fonts/CDN and/or remote assets;
      // do not misrepresent this ZIP as fully offline/self-contained.
      assert.match(reopened, /https:\/\/cdn\.tailwindcss\.com/);
    }
  } finally {
    globalThis.document = originalDocument;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
