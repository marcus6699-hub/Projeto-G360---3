import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreEvidenceAudit } from "../../server/evidenceAudit.ts";
import { buildAuditReportFromEvidenceAudit } from "./auditContract.js";

const now = new Date().toISOString();

test("audit contract: never fabricates score, projection or rating without evidence", () => {
  // Own-declaration-only evidence forces score === null in the checklist.
  const audit = scoreEvidenceAudit({
    placeId: "p-1",
    name: "Negócio Fictício",
    fields: {
      ownership: { value: true, source: "owner", observedAt: now },
      website: { value: "https://exemplo.com.br", source: "owner", observedAt: now },
      category: { value: "Padaria", source: "owner", observedAt: now },
      description: { value: "x".repeat(120), source: "owner", observedAt: now },
      phone: { value: "1133334444", source: "owner", observedAt: now },
      hours: { value: [{ day: 1, open: "08:00", close: "18:00" }], source: "owner", observedAt: now },
      photoCount: { value: 6, source: "owner", observedAt: now },
    },
  });
  assert.ok(typeof audit.score === "number", "checklist scores over measured weight");
  const report = buildAuditReportFromEvidenceAudit(audit, { city: "Teste", uf: "SP" });
  assert.equal(report.overallScore, audit.score);
  assert.equal(report.evidenceProvenance, "owner-declaration-only", "owner-only evidence must be flagged");
  assert.equal(report.verified, false);
  assert.equal(report.projectedScoreAfterOptimization, null);
  assert.equal(report.projectionUnavailable, true);
  assert.equal(report.business.rating, null);
  assert.equal(report.business.rating_count, null);
  assert.equal(report.reportType, "g360-evidence-checklist");
  assert.equal(report.business.city, "Teste");
  assert.equal(report.business.uf, "SP");
  // Quando a auditoria vem do fluxo manual OSM (rota força score = null), o contrato espelha null.
  const osmAudit = { ...audit, score: null };
  const osmReport = buildAuditReportFromEvidenceAudit(osmAudit, {});
  assert.equal(osmReport.overallScore, null);
  assert.equal(osmReport.scoreUnavailable, true);
  assert.equal(osmReport.classification, "Não concluída");
});

test("audit contract: maps criteria statuses, preserves weights and shows sources", () => {
  const audit = scoreEvidenceAudit({
    placeId: "p-2",
    name: "Negócio Completo",
    fields: {
      ownership: { value: true, source: "owner", observedAt: now },
      website: { value: "https://exemplo.com.br", source: "google_places", observedAt: now },
      category: { value: "Padaria", source: "google_places", observedAt: now },
      description: { value: "x".repeat(120), source: "owner", observedAt: now },
      phone: { value: "1133334444", source: "google_places", observedAt: now },
      hours: { value: [{ day: 1, open: "08:00", close: "18:00" }], source: "google_places", observedAt: now },
      reviewCount: { value: 25, source: "google_places", observedAt: now },
      photoCount: { value: 8, source: "owner", observedAt: now },
    },
  });
  assert.ok(typeof audit.score === "number");
  const report = buildAuditReportFromEvidenceAudit(audit, {});
  assert.equal(report.overallScore, audit.score);
  assert.equal(report.scoreUnavailable, false);
  assert.equal(report.criteria.length, 8);
  for (let i = 0; i < report.criteria.length; i++) {
    assert.equal(report.criteria[i].weight, audit.criteria[i].weight, "criterion weight must be preserved");
    assert.ok(["good", "warning", "unknown"].includes(report.criteria[i].status));
    assert.ok(report.criteria[i].title.length > 3);
    assert.ok(report.criteria[i].currentValue.length > 0);
    assert.ok(report.criteria[i].recommendedValue.length > 0);
    if (report.criteria[i].source) assert.match(report.criteria[i].source, /Google Places|Responsável/);
    assert.ok(report.criteria[i].observedAt);
  }
  // reviewCount evidence is google_places: report business mirrors it is NOT allowed here.
  assert.equal(report.business.rating, null);
  assert.equal(report.business.rating_count, null);
  assert.equal(report.classification, report.overallScore < 50 ? "Fraco" : report.overallScore < 75 ? "Razoável" : "Bom");
});

test("audit contract: unknown items stay marked, never reclassified as weak/good", () => {
  const audit = scoreEvidenceAudit({
    placeId: "p-3",
    name: "Negócio Mínimo",
    fields: {
      website: { value: "https://exemplo.com.br", source: "owner", observedAt: now },
      category: { value: "Padaria", source: "owner", observedAt: now },
      description: { value: "x".repeat(120), source: "owner", observedAt: now },
      phone: { value: "1133334444", source: "owner", observedAt: now },
      hours: { value: [{ day: 1, open: "08:00", close: "18:00" }], source: "owner", observedAt: now },
      photoCount: { value: 6, source: "owner", observedAt: now },
    },
  });
  const report = buildAuditReportFromEvidenceAudit(audit, {});
  const unknown = report.criteria.filter((c) => c.status === "unknown");
  assert.ok(unknown.length >= 2, "missing evidence must stay unknown");
  for (const c of unknown) {
    assert.equal(c.verifiable, false);
    assert.equal(c.currentValue, "Não verificado");
    assert.equal(c.source, null);
    assert.equal(c.observedAt, null);
  }
  assert.match(
    report.criteria.filter((c) => c.status !== "unknown")[0].source,
    /Responsável|Google Places/
  );
});

test("audit contract: rejects malformed audit results instead of inventing a report", () => {
  assert.throws(() => buildAuditReportFromEvidenceAudit(null, {}));
  assert.throws(() => buildAuditReportFromEvidenceAudit({}, {}));
  assert.throws(() => buildAuditReportFromEvidenceAudit({ criteria: "não-sou-array" }, {}));
});
