import { test } from "node:test";
import assert from "node:assert/strict";
import { filterOsmPlaces } from "./filterOsmPlaces.js";

test("OSM filters distinguish registered tags from fields not supplied by the source", () => {
  const places = [
    { place_id: "osm:node:1", website: "https://example.org", phone: null, social: { instagram: "@ficticia" } },
    { place_id: "osm:node:2", website: null, phone: "1133334444", social: { instagram: null, facebook: null } },
    { place_id: "osm:way:1", website: null, phone: null },
  ];
  const ids = (f) => filterOsmPlaces(places, { filter: "all", phoneFilter: "all", socialFilter: "all", ...f }).map((p) => p.place_id);
  assert.deepEqual(ids({ filter: "with" }), ["osm:node:1"]);
  assert.deepEqual(ids({ filter: "without" }), ["osm:node:2", "osm:way:1"]);
  assert.deepEqual(ids({ phoneFilter: "with" }), ["osm:node:2"]);
  assert.deepEqual(ids({ socialFilter: "with" }), ["osm:node:1"]);
  assert.deepEqual(ids({ filter: "without", socialFilter: "with" }), []);
});
