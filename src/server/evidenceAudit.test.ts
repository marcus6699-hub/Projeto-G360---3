import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreEvidenceAudit, compareEvidenceAudits, type AuditInput } from "./evidenceAudit.ts";

describe("evidence-based local profile checklist", () => {
  const observedAt = "2025-01-01T00:00:00.000Z";
  it("does not claim a score from missing data or infer ownership from reviews", () => {
    const report = scoreEvidenceAudit({ placeId: "test", name: "Fictícia", fields: {
      reviewCount: { value: 500, source: "google_places", observedAt },
      ownership: { value: true, source: "google_places", observedAt },
    } });
    assert.equal(report.score, null);
    assert.equal(report.coverage, 10);
    assert.equal(report.criteria.find((c) => c.id === "ownership")?.status, "unknown");
  });

  it("uses identical rules for before and after, orders problems first and records evidence", () => {
    const fields: AuditInput["fields"] = {
      ownership: { value: false, source: "owner", observedAt },
      website: { value: "", source: "google_places", observedAt },
      category: { value: "Loja", source: "google_places", observedAt },
      description: { value: "A".repeat(101), source: "owner", observedAt },
      phone: { value: "(11) 99999-9999", source: "google_places", observedAt },
      hours: { value: ["Seg 8:00-18:00"], source: "google_places", observedAt },
      reviewCount: { value: 9, source: "google_places", observedAt },
      photoCount: { value: 5, source: "owner", observedAt },
    };
    const before = scoreEvidenceAudit({ placeId: "test", name: "Fictícia", fields });
    const after = scoreEvidenceAudit({ placeId: "test", name: "Fictícia", fields: { ...fields, ownership: { value: true, source: "owner", observedAt } } });
    assert.equal(before.coverage, 100);
    assert.equal(before.score, 55);
    assert.equal(after.score, 75);
    assert.deepEqual(compareEvidenceAudits(before, after), { comparable: true, delta: 20 });
    assert.equal(before.criteria[0].id, "ownership");
    assert.equal(before.criteria[0].status, "attention");
    assert.equal(before.criteria[0].evidence?.source, "owner");
    assert.deepEqual(compareEvidenceAudits(before, scoreEvidenceAudit({ placeId: "other", name: "Outra", fields })), { comparable: false, delta: null });
    assert.deepEqual(compareEvidenceAudits(before, { ...after, methodology: "metodologia alterada" }), { comparable: false, delta: null });
    assert.deepEqual(compareEvidenceAudits(before, { ...after, criteria: after.criteria.slice(1) }), { comparable: false, delta: null });
  });
});
