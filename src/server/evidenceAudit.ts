/** Independent, evidence-based checklist. Not an official Google score. */
export type AuditEvidence<T = unknown> = {
  value: T;
  source: "google_places" | "owner";
  observedAt: string;
  sourceUrl?: string;
};

export type AuditInput = {
  placeId: string;
  name: string;
  fields: Partial<Record<"ownership" | "website" | "category" | "description" | "phone" | "hours" | "reviewCount" | "photoCount", AuditEvidence>>;
};

const RULES = [
  { id: "ownership", weight: 20, sources: ["owner"], pass: (v: unknown) => v === true },
  { id: "website", weight: 15, sources: ["google_places", "owner"], pass: (v: unknown) => typeof v === "string" && /^https?:\/\/[^\s]+$/i.test(v) },
  { id: "category", weight: 15, sources: ["google_places", "owner"], pass: (v: unknown) => typeof v === "string" && v.trim().length > 0 },
  { id: "description", weight: 15, sources: ["owner"], pass: (v: unknown) => typeof v === "string" && v.trim().length >= 100 },
  { id: "phone", weight: 10, sources: ["google_places", "owner"], pass: (v: unknown) => typeof v === "string" && v.replace(/\D/g, "").length >= 10 },
  { id: "hours", weight: 10, sources: ["google_places", "owner"], pass: (v: unknown) => Array.isArray(v) && v.length > 0 },
  { id: "reviewCount", weight: 10, sources: ["google_places"], pass: (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 10 },
  { id: "photoCount", weight: 5, sources: ["owner"], pass: (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 5 },
] as const;

export function scoreEvidenceAudit(input: AuditInput) {
  let measuredWeight = 0;
  let earnedWeight = 0;
  const criteria = RULES.map((rule) => {
    const evidence = input.fields?.[rule.id];
    const valid = evidence && rule.sources.some((source) => source === evidence.source) &&
      typeof evidence.observedAt === "string" && !Number.isNaN(Date.parse(evidence.observedAt)) &&
      Date.parse(evidence.observedAt) <= Date.now();
    if (!valid) return { id: rule.id, weight: rule.weight, status: "unknown" as const, earned: null, evidence: null };
    measuredWeight += rule.weight;
    const passed = rule.pass(evidence.value);
    if (passed) earnedWeight += rule.weight;
    return { id: rule.id, weight: rule.weight, status: passed ? "good" as const : "attention" as const, earned: passed ? rule.weight : 0, evidence };
  });
  return {
    methodology: "G360 evidence checklist v1 — NÃO é nota oficial do Google",
    placeId: input.placeId,
    name: input.name,
    measuredWeight,
    coverage: measuredWeight,
    // Never advertise a confident score based on a handful of known fields.
    score: measuredWeight >= 70 ? Math.round(100 * earnedWeight / measuredWeight) : null,
    criteria: criteria.sort((a, b) => {
      const order = { attention: 0, unknown: 1, good: 2 };
      return order[a.status] - order[b.status] || b.weight - a.weight;
    }),
  };
}

export function compareEvidenceAudits(before: ReturnType<typeof scoreEvidenceAudit>, after: ReturnType<typeof scoreEvidenceAudit>) {
  const methodMatch = before.methodology === after.methodology &&
    before.criteria.length === after.criteria.length &&
    before.criteria.every((criterion) => after.criteria.some((other) => other.id === criterion.id && other.weight === criterion.weight));
  if (!methodMatch || before.placeId !== after.placeId || before.score === null || after.score === null) return { comparable: false, delta: null };
  return { comparable: true, delta: after.score - before.score };
}
