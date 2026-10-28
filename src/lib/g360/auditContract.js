/**
 * CONTRATO DE INTEGRAÇÃO — checklist G360 verificado → painel de auditoria.
 *
 * Este adaptador converte o resultado do checklist independente
 * (src/server/evidenceAudit.ts, metodologia "G360 evidence checklist v1 — NÃO é
 * nota oficial do Google") no formato de `report` consumido pela interface de
 * auditoria. Ele NUNCA inventa nota, classificação ou valor de campo: o que não
 * tem evidência verificável sai como `null` com status explícito.
 *
 * Regras do contrato (testadas em auditContract.test.mjs):
 *  - `overallScore` espelha `score` do checklist; quando `null` (cobertura < 70),
 *    o relatório traz `scoreUnavailable: true` e NÃO define valor padrão.
 *  - `projectedScoreAfterOptimization` é sempre `null`: projeção de melhoria é
 *    vedada pela metodologia até nova medição real.
 *  - Status dos critérios: `good` → "good", `attention` → "warning",
 *    `unknown` → "unknown" (a interface precisa tratar "unknown" como
 *    "Não verificado"; usá-lo como nota "Fraco" seria distorção).
 *  - Campos do negócio só entram quando confirmados; `rating`/`rating_count`
 *    só quando a fonte é `google_places` com `observedAt` válido.
 */

const CRITERION_LICENSE = {
  ownership: {
    title: "Perfil reivindicado pelo responsável",
    whyItMatters: "Perfis não reivindicados podem ser editados por terceiros e não permitem resposta pública.",
    recommended: "Concluir o processo de reivindicação do perfil e documentar a data.",
  },
  website: {
    title: "Site oficial no perfil",
    whyItMatters: "O site é o destino principal de clientes vindos da busca e do mapa.",
    recommended: "Publicar um site com contato direto e registrar o link no perfil.",
  },
  category: {
    title: "Categoria principal preenchida",
    whyItMatters: "A categoria define em quais buscas o perfil aparece.",
    recommended: "Escolher a categoria mais específica que descreva o negócio.",
  },
  description: {
    title: "Descrição de negócio (mín. 100 caracteres)",
    whyItMatters: "A descrição ajuda o cliente a entender o que é oferecido antes de ligar.",
    recommended: "Escrever ao menos 100 caracteres sobre serviços, diferenciais e horário.",
  },
  phone: {
    title: "Telefone com DDD válido",
    whyItMatters: "Telefone errado é a principal causa de contato perdido.",
    recommended: "Manter um número com DDD, testado por ligação ou WhatsApp.",
  },
  hours: {
    title: "Horário de funcionamento",
    whyItMatters: "Horário desatualizado gera deslocamento sem atendimento.",
    recommended: "Cadastrar horário completo, incluindo feriados e pausas.",
  },
  reviewCount: {
    title: "Volume de avaliações no Google",
    whyItMatters: "Avaliações recentes mantêm a reputação VISÍVEL e atualizada.",
    recommended: "Pedir avaliação a clientes reais e responder as existentes.",
  },
  photoCount: {
    title: "Fotos do próprio estabelecimento",
    whyItMatters: "Fotos fachada/interior reduzem dúvida sobre o que encontrar.",
    recommended: "Incluir ao menos 5 fotos reais: fachada, interior, produtos e equipe.",
  },
};

const STATUS_MAP = { good: "good", attention: "warning", unknown: "unknown" };
const SOURCE_LABEL = {
  google_places: "Google Places (dados públicos do perfil)",
  owner: "Responsável pelo perfil (declaração)",
};

function onlyFulfilled(evidence) {
  return evidence && typeof evidence.observedAt === "string" && !Number.isNaN(Date.parse(evidence.observedAt));
}

function criterionToReport(c) {
  const license = CRITERION_LICENSE[c.id] || {};
  if (c.status === "unknown" || !c.evidence) {
    return {
      id: c.id,
      weight: c.weight ?? null,
      title: license.title || c.id,
      whyItMatters: license.whyItMatters || "",
      currentValue: "Não verificado",
      recommendedValue: license.recommended || "Coletar evidência real e reauditar.",
      status: "unknown",
      verifiable: false,
      source: null,
      observedAt: null,
    };
  }
  const value = c.evidence.value;
  const currentValue =
    typeof value === "boolean"
      ? value
        ? "Confirmado"
        : "Não confirmado"
      : Array.isArray(value)
      ? `${value.length} item(ns) informado(s)`
      : typeof value === "number"
      ? String(value)
      : value === "" || value == null
      ? "Não registrado"
      : String(value);
  return {
    id: c.id,
    weight: c.weight ?? null,
    title: license.title || c.id,
    whyItMatters: license.whyItMatters || "",
    currentValue,
    recommendedValue: license.recommended || "Reauditar com evidência verificável.",
    status: STATUS_MAP[c.status],
    verifiable: true,
    source: SOURCE_LABEL[c.evidence.source] || c.evidence.source,
    observedAt: c.evidence.observedAt,
  };
}

function classificationFor(score, criteria) {
  if (score === null) return "Não concluída";
  if (score < 50) return "Fraco";
  if (score < 75) return "Razoável";
  return "Bom";
}

/**
 * @param {{score:number|null, measuredWeight:number, criteria:Array, name:string, placeId:string, methodology:string}} auditResult
 *        resultado de scoreEvidenceAudit (src/server/evidenceAudit.ts).
 * @param {{city?:string|null, uf?:string|null}} meta metadados contextuais (nunca nota).
 */
export function buildAuditReportFromEvidenceAudit(auditResult, meta = {}) {
  if (!auditResult || !Array.isArray(auditResult.criteria)) {
    throw new Error("auditContract: resultado de auditoria inválido ou ausente.");
  }
  const score = typeof auditResult.score === "number" && Number.isFinite(auditResult.score) && auditResult.score >= 0 && auditResult.score <= 100 ? auditResult.score : null;
  const criteria = [...auditResult.criteria].map(criterionToReport);
  const fulfilled = auditResult.criteria.filter((c) => c.status !== "unknown" && c.evidence && onlyFulfilled(c.evidence));
  const evidenceProvenance = fulfilled.length === 0
    ? "no-verifiable-evidence"
    : fulfilled.every((c) => c.evidence.source === "owner")
    ? "owner-declaration-only"
    : "google-places-corroborated";
  const report = {
    reportType: "g360-evidence-checklist",
    methodology: auditResult.methodology || "G360 evidence checklist v1 — NÃO é nota oficial do Google",
    evidenceProvenance,
    business: {
      name: auditResult.name,
      placeId: auditResult.placeId,
      city: meta.city ?? null,
      uf: meta.uf ?? null,
      // Campos sensíveis não são repassados sem evidência real preenchida em outro módulo.
      rating: null,
      rating_count: null,
    },
    overallScore: score,
    scoreUnavailable: score === null,
    classification: classificationFor(score, criteria),
    // Vedação metodológica: nenhuma projeção simulada de nota futura.
    projectedScoreAfterOptimization: null,
    projectionUnavailable: true,
    verified: false,
    criteria,
    coverage: {
      measuredWeight: auditResult.measuredWeight,
      totalWeight: auditResult.criteria.reduce((acc, c) => acc + (Number(c.weight) || 0), 0),
    },
  };
  return report;
}

/**
 * G360 Audit Contract — OpenCode & Antigravity Canonical Bridge
 * Single source of truth for GBP Audit data representation.
 * Strictly avoids fabricated fallback scores, artificial ratings, or simulated rankings.
 */

export const AUDIT_STATUS = {
  VERIFIED: "verified",
  UNAVAILABLE: "unavailable",
  PARTIAL: "partial",
  FAILED: "failed",
  PENDING: "pending",
};

export const CRITERION_STATUS = {
  GOOD: "good",
  WARNING: "warning",
  CRITICAL: "critical",
  UNKNOWN: "unknown",
  NOT_APPLICABLE: "na",
};

/**
 * Extracts and validates the overall audit score without artificial fallbacks.
 * @param {Object} report - Raw audit report from g360Engine / OpenCode
 * @returns {number|null} Valid score 0-100 or null if unavailable.
 */
export function getVerifiedScore(report) {
  if (!report) return null;
  const raw = report.overallScore;
  if (typeof raw === "number" && !isNaN(raw) && raw >= 0 && raw <= 100) {
    return Math.round(raw);
  }
  return null;
}

/**
 * Formats overall score for display with clear distinction between real and unavailable.
 * @param {number|null} score
 * @param {string} rawClassification
 * @returns {{ displayScore: string, classification: string, isAvailable: boolean, color: string }}
 */
export function formatScoreDisplay(score, rawClassification) {
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
    return {
      displayScore: "--",
      classification: "Aguardando Auditoria",
      isAvailable: false,
      color: "#94A3B8", // slate-400
    };
  }

  const clamped = Math.max(0, Math.min(100, score));
  let color = "#EF4444"; // < 50
  let defaultClassification = "Crítico";

  if (clamped >= 75) {
    color = "#10B981"; // Emerald
    defaultClassification = "Excelente";
  } else if (clamped >= 50) {
    color = "#F59E0B"; // Amber
    defaultClassification = "Regular · Oportunidades";
  } else if (clamped >= 30) {
    color = "#EF4444"; // Rose / Red
    defaultClassification = "Fraco · Ação Necessária";
  }

  return {
    displayScore: String(clamped),
    classification: rawClassification || defaultClassification,
    isAvailable: true,
    color,
  };
}

/**
 * Extracts projected score after optimization without hardcoding 92.
 * @param {Object} report
 * @returns {number|null}
 */
export function getProjectedScore(report) {
  // Future gains are not measurements. Keep unavailable until a new audit.
  return null;
}

/**
 * Extracts real rating and review counts without artificial fallbacks (e.g. 4.8 or 18).
 * @param {Object} business
 * @returns {{ rating: number|null, ratingCount: number, hasRating: boolean, displayRating: string, displayReviews: string }}
 */
export function getRatingAndReviews(business) {
  if (!business || typeof business !== "object") {
    return {
      rating: null,
      ratingCount: null,
      hasRating: false,
      displayRating: "Sem nota",
      displayReviews: "Avaliações não informadas",
    };
  }

  const rawRating = business.rating;
  const rawCount = business.rating_count;

  const hasRating = typeof rawRating === "number" && Number.isFinite(rawRating) && rawRating > 0 && rawRating <= 5;
  const ratingCount = Number.isInteger(rawCount) && rawCount >= 0 ? rawCount : null;

  return {
    rating: hasRating ? Number(rawRating) : null,
    ratingCount,
    hasRating,
    displayRating: hasRating ? Number(rawRating).toFixed(1) : "Sem nota",
    displayReviews: ratingCount === null ? "Avaliações não informadas" : `${ratingCount} avaliações`,
  };
}

/**
 * Normalizes criteria list and marks unknown/missing evidence correctly.
 * @param {Array} criteriaList
 * @returns {Array} Normalized criteria with valid status and flags
 */
export function normalizeCriteria(criteriaList) {
  if (!Array.isArray(criteriaList)) return [];

  return criteriaList.filter(crit => crit && typeof crit === "object").map((crit) => {
    let status = crit.status;
    if (!["good", "warning", "critical", "na"].includes(status)) {
      status = "unknown";
    }

    const isEvidenceMissing =
      crit.currentValue == null ||
      crit.currentValue === "Pendente" ||
      crit.currentValue === "Não verificado" ||
      crit.currentValue === "Não aplicável";

    return {
      ...crit,
      status,
      isEvidenceMissing,
      displayValue: crit.currentValue == null ? "Dado não coletado" : crit.currentValue,
      displayRecommended: crit.recommendedValue || "Conforme boas práticas Google",
    };
  });
}

/**
 * Validates whether Geogrid rankings are real from API or uncollected.
 * @param {Object} keywordObj
 * @returns {{ isAvailable: boolean, pins: Array, averageRank: number|null, message: string }}
 */
export function validateGeogrid(keywordObj) {
  if (!keywordObj || !Array.isArray(keywordObj.pins) || keywordObj.pins.length === 0) {
    return {
      isAvailable: false,
      pins: [],
      averageRank: null,
      message: "Grade Geogrid aguardando consulta oficial de coordenadas.",
    };
  }

  // Check if pins have real rankings (> 0 and not placeholder 0)
  const hasValidRanks = keywordObj.pins.length > 0 && keywordObj.pins.every((p) =>
    p && typeof p === "object" && Number.isInteger(p.rank) && p.rank > 0 && p.rank <= 100 &&
    ["google_places", "serper", "authorized-ranking-provider"].includes(p.source) && typeof p.query === "string" && p.query.trim() && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    typeof p.observedAt === "string" && Number.isFinite(Date.parse(p.observedAt)) && Date.parse(p.observedAt) <= Date.now()
  );

  return {
    isAvailable: hasValidRanks,
    pins: hasValidRanks ? keywordObj.pins : keywordObj.pins.filter(p => p && typeof p === "object").map(p => ({ ...p, rank: null })),
    averageRank: hasValidRanks ? keywordObj.pins.reduce((sum, p) => sum + p.rank, 0) / keywordObj.pins.length : null,
    message: hasValidRanks
      ? "Dados de ranking local verificados para a coordenada central."
      : "Coordenadas mapeadas. Consulta de posições ao vivo pendente.",
  };
}
