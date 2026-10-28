import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AuthRequest } from "../middleware/auth.ts";
import { compareEvidenceAudits, scoreEvidenceAudit, type AuditEvidence, type AuditInput } from "./evidenceAudit.ts";

const OWNER_FIELDS = ["ownership", "website", "category", "description", "phone", "hours", "photoCount"] as const;
type OwnerField = (typeof OWNER_FIELDS)[number];
const maxLength: Record<OwnerField, number> = { ownership: 0, website: 500, category: 150, description: 3000, phone: 40, hours: 100, photoCount: 0 };

function parseFields(raw: unknown): AuditInput["fields"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Campos inválidos.");
  const fields: AuditInput["fields"] = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!OWNER_FIELDS.includes(key as OwnerField) || !value || typeof value !== "object" || Array.isArray(value)) throw new Error("Apenas declarações do responsável são aceitas.");
    const candidate = value as Record<string, unknown>;
    if (candidate.source !== "owner" || typeof candidate.observedAt !== "string" || !Number.isFinite(Date.parse(candidate.observedAt)) || Date.parse(candidate.observedAt) > Date.now()) throw new Error("Fonte ou data de evidência inválida.");
    const field = key as OwnerField;
    const valid = field === "ownership" ? typeof candidate.value === "boolean"
      : field === "photoCount" ? Number.isSafeInteger(candidate.value) && Number(candidate.value) >= 0 && Number(candidate.value) <= 10000
      : field === "hours" ? Array.isArray(candidate.value) && candidate.value.length <= 7 && candidate.value.every((x: unknown) => typeof x === "string" && x.length <= 100)
      : typeof candidate.value === "string" && candidate.value.length <= maxLength[field];
    if (!valid) throw new Error("Valor de evidência inválido.");
    fields[field] = { value: candidate.value, source: "owner", observedAt: candidate.observedAt } as AuditEvidence;
  }
  return fields;
}

type SavedAudit = { id: string; uid: string; createdAt: string; report: ReturnType<typeof scoreEvidenceAudit> };
export function createEvidenceAuditRouter(getDb: () => any, saveDb: (db: any) => void) {
  const router = Router();
  router.get("/audits", (req: AuthRequest, res) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Autenticação necessária." });
    const history: SavedAudit[] = getDb().evidenceAudits || [];
    return res.json({ audits: history.filter((entry) => entry.uid === uid) });
  });
  router.post("/audits", (req: AuthRequest, res) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Autenticação necessária." });
    const placeId = req.body?.placeId;
    const name = req.body?.name;
    if (typeof placeId !== "string" || !/^(?:osm:(?:node|way|relation):[1-9]\d{0,15}|manual:[a-zA-Z0-9_-]{1,80})$/.test(placeId) || typeof name !== "string" || !name.trim() || name.length > 160) return res.status(400).json({ error: "Identificador de origem e nome válidos são necessários." });
    let fields: AuditInput["fields"];
    try { fields = parseFields(req.body?.fields); } catch (error) { return res.status(400).json({ error: (error as Error).message }); }
    const report = scoreEvidenceAudit({ placeId, name: name.trim(), fields });
    // OSM does not provide GBP verification or Google reviews; never label a self-report as a verified GBP score.
    report.score = null;
    const db = getDb();
    const history: SavedAudit[] = Array.isArray(db.evidenceAudits) ? db.evidenceAudits : [];
    const previous = history.find((entry) => entry.uid === uid && entry.report.placeId === placeId);
    const entry: SavedAudit = { id: randomUUID(), uid, createdAt: new Date().toISOString(), report };
    db.evidenceAudits = [entry, ...history];
    saveDb(db);
    return res.status(201).json({ audit: entry, comparison: previous ? compareEvidenceAudits(previous.report, report) : null });
  });
  router.get("/clients", (req: AuthRequest, res) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Autenticação necessária." });
    return res.json({ clients: (getDb().evidenceClients || []).filter((entry: { uid: string }) => entry.uid === uid) });
  });
  router.post("/clients", (req: AuthRequest, res) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Autenticação necessária." });
    const placeId = req.body?.placeId;
    const name = req.body?.name;
    if (typeof placeId !== "string" || !/^(?:osm:(?:node|way|relation):[1-9]\d{0,15}|manual:[a-zA-Z0-9_-]{1,80})$/.test(placeId) || typeof name !== "string" || !name.trim() || name.length > 160) return res.status(400).json({ error: "Identificador da empresa inválido." });
    const db = getDb();
    const list = Array.isArray(db.evidenceClients) ? db.evidenceClients : [];
    const previous = list.find((entry: { uid: string; placeId: string }) => entry.uid === uid && entry.placeId === placeId);
    if (previous) return res.json({ client: previous, alreadyRegistered: true });
    const client = { id: randomUUID(), uid, placeId, name: name.trim(), sourceUrl: placeId.startsWith("osm:") ? `https://www.openstreetmap.org/${placeId.split(":")[1]}/${placeId.split(":")[2]}` : null, createdAt: new Date().toISOString() };
    db.evidenceClients = [client, ...list];
    saveDb(db);
    return res.status(201).json({ client, alreadyRegistered: false });
  });
  return router;
}
