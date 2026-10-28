import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createOsmProspectingRouter, mapOsmPlace } from "./osmProspecting.ts";

describe("manual OSM prospecting", () => {
  it("maps only observed OSM fields; missing GBP data stays null", () => {
    const place = mapOsmPlace({ type: "node", id: 12, lat: -16.3, lon: -48.9, tags: { name: "Empresa Teste", shop: "furniture" } });
    assert.equal(place?.sourceUrl, "https://www.openstreetmap.org/node/12");
    assert.equal(place?.category, "furniture");
    assert.equal(place?.rating, null);
    assert.equal(place?.verified, null);
    assert.equal(place?.address, null);
    assert.equal(place?.social?.instagram, null);
    const withSocial = mapOsmPlace({ type: "node", id: 13, lat: -16.3, lon: -48.9, tags: { name: "Empresa Social Fictícia", "contact:instagram": "@empresa", "contact:facebook": "https://facebook.com/empresa" } });
    assert.equal(withSocial?.social?.instagram, "@empresa");
    assert.equal(withSocial?.social?.facebook, "https://facebook.com/empresa");
  });

  it("requires contact and coordinates, escapes queries, caches results and never guesses on failure", async () => {
    const oldContact = process.env.G360_OSM_CONTACT;
    delete process.env.G360_OSM_CONTACT;
    let calls = 0;
    const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls++;
      assert.equal(init?.redirect, "error");
      const query = new URLSearchParams(String(init?.body)).get("data") || "";
      assert.match(query, /around:1500,-16\.3,-48\.9/);
      assert.ok(!query.includes('out body;node(0,0,0,0)'));
       return Response.json({ elements: [
         { type: "way", id: 42, center: { lat: -16.31, lon: -48.91 }, tags: { name: "Loja Teste", shop: "furniture" } },
         { type: "way", id: 42, center: { lat: -16.31, lon: -48.91 }, tags: { name: "Loja Teste duplicada", shop: "furniture" } },
         { type: "node", id: 42, lat: -16.31, lon: -48.91, tags: { name: "Outra empresa", shop: "furniture" } },
       ] });
    }) as typeof fetch;
    const app = express();
    app.use(express.json());
    app.use("/osm", createOsmProspectingRouter(fakeFetch));
    const server = app.listen(0);
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const url = `http://127.0.0.1:${address.port}/osm/search`;
      const send = (body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      assert.equal((await send({ name: "Loja", lat: -16.3, lng: -48.9 })).status, 503);
      process.env.G360_OSM_CONTACT = "owner@example.org";
      assert.equal((await send({ name: "Loja", lat: "oops", lng: -48.9 })).status, 400);
      const first = await send({ name: 'Loja\\";out body;node(0,0,0,0)', lat: -16.3, lng: -48.9 });
      assert.equal(first.status, 200);
      const result = await first.json();
       assert.equal(result.places.length, 2, "dedupe must use OSM type+id, not name or numeric id alone");
      assert.equal(result.places[0].rating_count, null);
      assert.equal(result.places[0].source, "openstreetmap-overpass");
      assert.match(result.attribution, /OpenStreetMap/);
      assert.equal((await send({ name: 'Loja\\";out body;node(0,0,0,0)', lat: -16.3, lng: -48.9 })).status, 200);
      assert.equal((await send({ name: "Outra loja", lat: -16.3, lng: -48.9 })).status, 429);
      assert.equal(calls, 1);
    } finally {
      if (oldContact === undefined) delete process.env.G360_OSM_CONTACT;
      else process.env.G360_OSM_CONTACT = oldContact;
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
  it("discovers only a whitelisted OSM category within a manual center and refuses missing coordinates", async () => {
    const old = process.env.G360_OSM_CONTACT;
    process.env.G360_OSM_CONTACT = "owner@example.org";
    let calls = 0;
    const app = express(); app.use(express.json());
    app.use("/osm", createOsmProspectingRouter((async (_url, init) => {
      calls++;
      const query = new URLSearchParams(String(init?.body)).get("data") || "";
      assert.match(query, /nwr\["name"\]\["shop"="bakery"\]\(around:1500,-16\.3,-48\.9\)/);
      return Response.json({ elements: [{ type: "node", id: 3, lat: -16.3, lon: -48.9, tags: { name: "Padaria Teste", shop: "bakery" } }] });
    }) as typeof fetch));
    const server = app.listen(0);
    try {
      const addr = server.address(); assert.ok(addr && typeof addr !== "string");
      const send = (body: unknown) => fetch(`http://127.0.0.1:${addr.port}/osm/discover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      assert.equal((await send({ city: "Teste", category: "padaria" })).status, 400);
      assert.equal((await send({ city: "Teste", category: "nwr", lat: -16.3, lng: -48.9 })).status, 400);
      const response = await send({ city: "Teste", category: "padaria", lat: -16.3, lng: -48.9 });
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.places[0].website, null);
      assert.equal(data.places[0].rating, null);
      assert.match(data.limitations, /não cobre toda a cidade/);
      assert.equal(calls, 1);
    } finally { if (old === undefined) delete process.env.G360_OSM_CONTACT; else process.env.G360_OSM_CONTACT = old; await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())); }
  });
});
