import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { verifiedDataUnavailable } from "./verifiedDataGuard.ts";
import { createG360Router } from "./g360Engine.ts";

describe("verified data safety boundary", () => {
  it("returns an explicit unavailable result without invoking the upstream provider", async () => {
    const app = express();
    let upstreamCalled = false;
    app.get("/api/places/autocomplete", verifiedDataUnavailable, () => { upstreamCalled = true; });
    app.post("/api/g360/audit", verifiedDataUnavailable, () => { upstreamCalled = true; });
    const server = app.listen(0);
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      for (const [method, path] of [["GET", "/api/places/autocomplete"], ["POST", "/api/g360/audit"]]) {
        const httpResponse: Response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method });
        assert.equal(httpResponse.status, 503);
        const body = await httpResponse.json();
        assert.equal(body.ok, false);
        assert.equal(body.code, "VERIFIED_DATA_UNAVAILABLE");
        assert.match(body.error, /saldo|cota|verific/i);
      }
      assert.equal(upstreamCalled, false);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

describe("G360 route boundary", () => {
  it("does not seed demo audits, resolve businesses or return fabricated leads", async () => {
    let databaseReads = 0;
    const app = express();
    app.use(express.json());
    app.use("/g360", createG360Router(() => { databaseReads++; return {}; }, () => { throw Error("unexpected write"); }, []));
    const server = app.listen(0);
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      for (const [method, path] of [["GET", "/audits"], ["POST", "/audit"], ["POST", "/leads/search"], ["POST", "/test-engines"]]) {
        const response: Response = await fetch(`http://127.0.0.1:${address.port}/g360${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          ...(method === "POST" ? { body: JSON.stringify({ query: "Empresa Teste", niche: "Teste", city: "Teste" }) } : {}),
        });
        assert.equal(response.status, 401, `${method} ${path}`);
        assert.ok(await response.json());
      }
      assert.equal(databaseReads, 0);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
