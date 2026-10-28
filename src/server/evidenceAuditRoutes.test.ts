import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createEvidenceAuditRouter } from "./evidenceAuditRoutes.ts";

describe("authenticated evidence history", () => {
  it("rejects forged Google evidence and isolates client/history by user", async () => {
    let db: any = {};
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => { if (req.headers["x-test-user"]) req.user = { uid: req.headers["x-test-user"] }; next(); });
    app.use("/evidence", createEvidenceAuditRouter(() => db, (saved) => { db = structuredClone(saved); }));
    const server = app.listen(0);
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const url = `http://127.0.0.1:${address.port}/evidence`;
      const send = (path: string, uid: string | null, body?: unknown) => fetch(url + path, { method: body ? "POST" : "GET", headers: { ...(uid ? { "x-test-user": uid } : {}), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      assert.equal((await send("/audits", null)).status, 401);
      const subject = { placeId: "osm:node:42", name: "Fictícia Teste" };
      assert.equal((await send("/audits", "A", { ...subject, fields: { reviewCount: { value: 100, source: "google_places", observedAt: new Date().toISOString() } } })).status, 400);
      const collected = await send("/audits", "A", { ...subject, fields: { ownership: { value: true, source: "owner", observedAt: new Date().toISOString() } } });
      assert.equal(collected.status, 201);
      const saved = await collected.json();
      assert.equal(saved.audit.report.score, null);
      assert.equal(saved.audit.report.coverage, 20);
      assert.equal((await (await send("/audits", "B")).json()).audits.length, 0);
      assert.equal((await (await send("/audits", "A")).json()).audits.length, 1);
      assert.equal((await send("/clients", "A", subject)).status, 201);
      assert.equal((await (await send("/clients", "B")).json()).clients.length, 0);
      assert.equal((await send("/clients", "A", subject)).status, 200);
    } finally { await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())); }
  });
});
