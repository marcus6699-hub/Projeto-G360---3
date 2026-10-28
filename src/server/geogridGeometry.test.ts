import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeOptionalGrid } from "./geogridGeometry.ts";
import { createGeogridPreviewRouter } from "./geogridGeometry.ts";
import express from "express";

describe("optional 5x5 coordinate grid", () => {
  it("preserves true supplied center and never invents ranking", () => {
    const grid = makeOptionalGrid(-16.3285, -48.9534, 500);
    assert.equal(grid.length, 25);
    assert.equal(grid[12].lat, -16.3285);
    assert.equal(grid[12].lng, -48.9534);
    assert.equal(grid[0].row, 0);
    assert.equal(grid[24].col, 4);
    assert.ok(grid[0].lat > grid[12].lat);
    assert.ok(grid[24].lng > grid[12].lng);
    assert.ok(grid.every((point) => point.rank === null && point.source === "geometry-only"));
    assert.throws(() => makeOptionalGrid(99, -48), RangeError);
  });
  it("creates a preview only when asked and reports unavailable cost/rank", async () => {
    const app = express();
    app.use(express.json());
    app.use("/grid", createGeogridPreviewRouter());
    const server = app.listen(0);
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const response = await fetch(`http://127.0.0.1:${address.port}/grid/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: -16.3, lng: -48.9 }),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.queryExecuted, false);
      assert.equal(body.rankingAvailable, false);
      assert.equal(body.estimatedCost, null);
      assert.equal(body.points.length, 25);
      assert.ok(body.points.every((point: { rank: null }) => point.rank === null));
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
