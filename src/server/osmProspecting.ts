import { providerFetch } from "./externalAccess.ts";
import { Router } from "express";

type OSMElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const ATTRIBUTION = "© OpenStreetMap contributors (ODbL) — https://www.openstreetmap.org/copyright";
const CATEGORIES: Record<string, string> = {
  padaria: '["shop"="bakery"]', farmacia: '["amenity"="pharmacy"]', restaurante: '["amenity"="restaurant"]',
  cafe: '["amenity"="cafe"]', salao: '["shop"="hairdresser"]', oficina: '["shop"="car_repair"]',
};

export function mapOsmPlace(element: OSMElement) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!(["node", "way", "relation"].includes(element.type) && Number.isSafeInteger(element.id) && element.id > 0 && tags.name && Number.isFinite(lat) && Number.isFinite(lng))) return null;
  const address = [tags["addr:street"], tags["addr:housenumber"], tags["addr:suburb"], tags["addr:city"], tags["addr:state"]].filter(Boolean).join(", ");
  return {
    place_id: `osm:${element.type}:${element.id}`,
    source: "openstreetmap-overpass",
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    name: tags.name,
    category: tags.amenity || tags.shop || tags.office || tags.craft || null,
    address: address || null,
    city: tags["addr:city"] || null,
    uf: tags["addr:state"] || null,
    phone: tags["contact:phone"] || tags.phone || null,
    website: tags["contact:website"] || tags.website || null,
    // Tags omitted by OSM mean "unknown", not confirmed social absence.
    social: {
      instagram: tags["contact:instagram"] || tags.instagram || null,
      facebook: tags["contact:facebook"] || tags.facebook || null,
    },
    lat,
    lng,
    rating: null,
    rating_count: null,
    verified: null,
    photos_count: null,
    gbpScore: null,
  };
}

export function createOsmProspectingRouter(fetcher: typeof fetch = ((input, init) => providerFetch(String(input), init)) as typeof fetch) {
  const router = Router();
  const cache = new Map<string, { at: number; places: ReturnType<typeof mapOsmPlace>[] }>();
  let nextRequestAt = 0;

  // Deliberate, user-triggered lookup ONLY. Never use for autocomplete or bulk prospecting.
  router.post(["/search", "/discover"], async (req, res) => {
    const discover = req.path === "/discover";
    const contact = process.env.G360_OSM_CONTACT;
    if (!contact || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(contact)) return res.status(503).json({ ok: false, error: "Configure um contato válido em G360_OSM_CONTACT antes de consultar o serviço público OSM." });
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const category = typeof req.body?.category === "string" ? req.body.category.trim().toLowerCase() : "";
    const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
    const lat = req.body?.lat === "" || req.body?.lat == null ? NaN : Number(req.body.lat);
    const lng = req.body?.lng === "" || req.body?.lng == null ? NaN : Number(req.body.lng);
    if ((discover ? (!CATEGORIES[category] || city.length < 2 || city.length > 80) : (name.length < 3 || name.length > 80)) || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: discover ? "Escolha uma categoria, informe cidade e coordenadas do centro." : "Informe nome (3–80 caracteres) e coordenadas válidas." });
    }
    const key = JSON.stringify([discover ? category + city.toLocaleLowerCase("pt-BR") : name.toLocaleLowerCase("pt-BR"), lat, lng]);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 3600_000) {
      return res.json({ ok: true, places: hit.places, source: "openstreetmap-overpass", attribution: ATTRIBUTION, collectedAt: new Date(hit.at).toISOString(), cached: true, limitations: "Centro e cidade informados pelo usuário; raio de 1,5 km, não cobre toda a cidade. Dados OSM não comprovam propriedade, avaliação ou posição no Google." });
    }
    if (Date.now() < nextRequestAt) return res.status(429).json({ ok: false, error: "Aguarde antes de realizar outra consulta externa." });
    nextRequestAt = Date.now() + 5_000;
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const selector = discover ? `["name"]${CATEGORIES[category]}` : `["name"~${JSON.stringify(escapedName)},i]`;
    const query = `[out:json][timeout:12];nwr${selector}(around:1500,${lat},${lng});out center 20;`;
    try {
      const response = await fetcher(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "User-Agent": `G360Business/1.0 (contact: ${contact})` },
        body: new URLSearchParams({ data: query }),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return res.status(503).json({ ok: false, error: "Fonte OpenStreetMap temporariamente indisponível; nenhuma empresa foi inferida." });
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !Array.isArray((data as { elements?: unknown }).elements)) throw new Error("Invalid Overpass response");
      const seen = new Set<string>();
      const places = (data as { elements: OSMElement[] }).elements.map(mapOsmPlace).filter((p) => {
        if (!p || seen.has(p.place_id)) return false;
        seen.add(p.place_id);
        return true;
      }).slice(0, 20);
      const at = Date.now();
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { at, places });
      return res.json({ ok: true, places, source: "openstreetmap-overpass", attribution: ATTRIBUTION, collectedAt: new Date(at).toISOString(), cached: false, limitations: "Centro e cidade informados pelo usuário; raio de 1,5 km, não cobre toda a cidade. Dados OSM não comprovam propriedade, avaliação ou posição no Google." });
    } catch {
      return res.status(503).json({ ok: false, error: "Falha na consulta OpenStreetMap; nenhuma empresa foi inferida." });
    }
  });
  return router;
}
