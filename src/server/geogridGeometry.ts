/** Geodesic sampling points only. No search, billing or inferred ranking. */
import { Router } from "express";

export function makeOptionalGrid(lat: number, lng: number, spacingMeters = 500) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180 || !Number.isFinite(spacingMeters) || spacingMeters <= 0 || spacingMeters > 2000) {
    throw new RangeError("Centro geográfico ou espaçamento inválido.");
  }
  const radians = lat * Math.PI / 180;
  const metersPerDegreeLat = 111132.92 - 559.82 * Math.cos(2 * radians) + 1.175 * Math.cos(4 * radians);
  const metersPerDegreeLng = 111412.84 * Math.cos(radians) - 93.5 * Math.cos(3 * radians);
  return Array.from({ length: 25 }, (_, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    return {
      row, col,
      lat: lat + (2 - row) * spacingMeters / metersPerDegreeLat,
      lng: lng + (col - 2) * spacingMeters / metersPerDegreeLng,
      rank: null,
      source: "geometry-only" as const,
    };
  });
}

export function createGeogridPreviewRouter() {
  const router = Router();
  router.post("/preview", (req, res) => {
    try {
      // Explicit action only; an untrusted client cannot request a live rank.
      const { lat, lng, spacingMeters = 500 } = req.body || {};
      if (typeof lat !== "number" || typeof lng !== "number" || typeof spacingMeters !== "number") throw new RangeError("Coordenadas inválidas.");
      return res.json({ ok: true, points: makeOptionalGrid(lat, lng, spacingMeters),
        rankingAvailable: false, queryExecuted: false, estimatedCost: null, creditsRequired: null, creditsBalance: null,
        message: "Prévia geométrica, não um ranking. Consultas de posições permanecem bloqueadas até custo e saldo verificáveis." });
    } catch {
      return res.status(400).json({ ok: false, error: "Informe coordenadas numéricas válidas." });
    }
  });
  return router;
}
