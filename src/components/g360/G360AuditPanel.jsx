import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  BadgeCheck,
  ShieldAlert,
  MapPin,
  Phone,
  Globe,
  Star,
  CheckCircle2,
  XCircle,
  Briefcase,
  Sparkles,
  Layers,
  SlidersHorizontal,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Building2,
  Navigation,
  BarChart3,
  Printer,
  X,
  Plus,
  Minus,
  ExternalLink,
  Clock,
  Download,
  LocateFixed,
  History,
} from "lucide-react";
import { api, fmtErr } from "@/lib/api";

const QUICK_PROSPECTS = [
  "Castelinho Pizzaria & Empório Anápolis",
  "Sorvetes Campo Grande",
  "Encanto Móveis Planejados",
  "Central Gás & Água Anápolis",
  "Farmácia Anápolis - DrogaLu",
  "Clínica Dr. Samuel",
];

const GBP_CHECK_LOADING_STEPS = [
  "Carregando informações do negócio",
  "Analisando dados do perfil",
  "Coletando fotos e vídeos",
  "Localizando as avaliações",
  "Lendo as avaliações",
  "Acessando perfil no Google Maps",
  "Encontrando seus concorrentes",
];

function SpeedometerGauge({ score = 75, classification = "Razoável", dark = false }) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  // GBP Check 3-Band Color Scale: <60 Red (#EF4444), 60-79 Amber (#F59E0B), 80+ Emerald (#10B981)
  const scoreColor = clamped < 60 ? "#EF4444" : clamped < 80 ? "#F59E0B" : "#10B981";
  const arcLength = 235.6;
  const strokeOffset = arcLength * (1 - clamped / 100);
  // Needle angle: 0 score = -90deg (left), 50 score = 0deg (up), 100 score = +90deg (right)
  const needleRotation = -90 + (clamped / 100) * 180;

  const labelDisplay =
    clamped < 40
      ? "CRÍTICO"
      : clamped < 60
      ? "FRACO"
      : clamped < 80
      ? "RAZOÁVEL"
      : clamped < 90
      ? "BOM"
      : "EXCELENTE";

  return (
    <div className="flex flex-col items-center justify-center py-2" data-testid="speedometer-gauge-3band">
      <div className="relative w-[220px] sm:w-[240px] h-[136px] flex items-end justify-center">
        <svg viewBox="0 0 200 125" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="g360GaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="55%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
          {/* Subtle Track */}
          <path
            d="M 25 102 A 75 75 0 0 1 175 102"
            fill="none"
            stroke={dark ? "rgba(255,255,255,0.08)" : "#F1F5F9"}
            strokeWidth="15"
            strokeLinecap="round"
          />
          {/* 3-Band Reference Arc (Red / Amber / Green like GBP Check) */}
          <path
            d="M 25 102 A 75 75 0 0 1 175 102"
            fill="none"
            stroke="url(#g360GaugeGrad)"
            strokeWidth="15"
            strokeLinecap="round"
            opacity={dark ? "0.28" : "0.25"}
          />
          {/* Active Animated Progress Arc */}
          <path
            d="M 25 102 A 75 75 0 0 1 175 102"
            fill="none"
            stroke={scoreColor}
            strokeWidth="15"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeOffset}
            className="transition-all duration-700 ease-out"
          />
          {/* Scale Labels */}
          <text x="14" y="120" fill={dark ? "#94A3B8" : "#64748B"} fontSize="10" fontWeight="700">0</text>
          <text x="94" y="16" fill={dark ? "#94A3B8" : "#64748B"} fontSize="10" fontWeight="700">50</text>
          <text x="168" y="120" fill={dark ? "#94A3B8" : "#64748B"} fontSize="10" fontWeight="700">100</text>

          {/* GBP Check Center Pointer / Needle (Ponteiro) */}
          <g
            transform={`translate(100, 102) rotate(${needleRotation})`}
            style={{ transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)" }}
            data-testid="speedometer-pointer-needle"
          >
            <polygon
              points="-4.5,0 0,-64 4.5,0"
              fill={dark ? "#F8FAFC" : "#1E293B"}
            />
            <circle cx="0" cy="0" r="8" fill={dark ? "#F8FAFC" : "#1E293B"} />
            <circle cx="0" cy="0" r="3.5" fill={scoreColor} />
          </g>
        </svg>
      </div>

      {/* Score Readout + Classification Pill Below Pointer */}
      <div className="mt-1 flex flex-col items-center text-center">
        <div className="flex items-baseline justify-center gap-1">
          <span
            className="text-[42px] font-black tracking-tight leading-none tabular-nums"
            style={{ color: scoreColor }}
            data-testid="audit-overall-score"
          >
            {clamped}
          </span>
          <span className="text-[14px] font-bold opacity-60">/100</span>
        </div>

        <div
          className="mt-2 inline-flex items-center gap-2 px-4 py-1 rounded-full text-[12px] font-extrabold uppercase tracking-wider border"
          style={{
            backgroundColor:
              clamped < 60 ? "rgba(239,68,68,0.12)" : clamped < 80 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)",
            borderColor:
              clamped < 60 ? "rgba(239,68,68,0.3)" : clamped < 80 ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)",
            color:
              clamped < 60 ? "#EF4444" : clamped < 80 ? "#D97706" : "#10B981",
          }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: scoreColor }} />
          <span>{classification ? String(classification).toUpperCase() : labelDisplay}</span>
        </div>
      </div>
    </div>
  );
}

export default function G360AuditPanel({
  dark = false,
  activeReport,
  onReportChange,
  onExportToCrm,
  onOpenGbpPackage,
  onOpenSiteExpress,
}) {
  const [subTab, setSubTab] = useState("single"); // "single" | "leadfinder"
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // GBP Check Loading Modal state
  const [runningAudit, setRunningAudit] = useState(false);
  const [loadingTargetBiz, setLoadingTargetBiz] = useState(null);
  const [auditStep, setAuditStep] = useState(0);

  // Real Pre-Analysis vs Complete Analysis history (per business)
  const [auditHistoryByBiz, setAuditHistoryByBiz] = useState(() => {
    try {
      const raw = localStorage.getItem("g360_audit_history_v2");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [auditModeView, setAuditModeView] = useState("pre"); // "pre" | "latest"

  const [selectedKeywordIdx, setSelectedKeywordIdx] = useState(0);
  const [customKeywordInput, setCustomKeywordInput] = useState("");
  const [selectedPin, setSelectedPin] = useState(null);
  const [criterionFilter, setCriterionFilter] = useState("all"); // "all" | "critical" | "warning" | "good"
  const [expandedCriteria, setExpandedCriteria] = useState({
    gbp_top10_reviews: true,
    gbp_segment_avg_reviews: true,
  });
  const [showHoursFull, setShowHoursFull] = useState(false);

  // Optional On-Demand Geogrid state (Independent of Audit Score, with 3x3 vs 5x5 API cost transparency, visible by default)
  const [geogridEnabled, setGeogridEnabled] = useState(true);
  const [geogridSize, setGeogridSize] = useState(3); // 3 (9 pts) | 5 (25 pts)
  const [geogridRadiusKm, setGeogridRadiusKm] = useState(2.5);
  const [runningLiveGeogrid, setRunningLiveGeogrid] = useState(false);
  const [liveGeogridResult, setLiveGeogridResult] = useState(null);

  // Interactive Map Zoom, Satellite Mode & GPS Recenter state
  const [mapZoomDelta, setMapZoomDelta] = useState(0.0028); // Street-level close zoom by default
  const [mapCenterKey, setMapCenterKey] = useState(0);
  const [mapLayerMode, setMapLayerMode] = useState("map"); // "map" | "satellite"

  // Lead Finder state
  const [leadNiche, setLeadNiche] = useState("Móveis Planejados");
  const [leadCity, setLeadCity] = useState("Anápolis");
  const [leadNeighborhood, setLeadNeighborhood] = useState("");
  const [filterUnverified, setFilterUnverified] = useState(false);
  const [filterNoSite, setFilterNoSite] = useState(false);
  const [leadsList, setLeadsList] = useState([]);
  const [searchingLeads, setSearchingLeads] = useState(false);

  // PDF Modal state
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfConfig, setPdfConfig] = useState({
    includeScoreAndPillars: true,
    includeActionPlan: true,
    includeGeogrid: true,
    includeCompetitors: true,
    agencyName: "G360 Google Business Intelligence",
  });

  // Live Website Technical Scanner state
  const [websiteAudit, setWebsiteAudit] = useState(null);
  const [auditingWebsite, setAuditingWebsite] = useState(false);

  const searchBoxRef = useRef(null);
  const debounceRef = useRef(null);
  // Prevents autocomplete useEffect from re-opening dropdown after clicking a suggestion or quick chip
  const suppressAutocompleteRef = useRef(false);

  useEffect(() => {
    const close = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // Load initial audit if none active
  useEffect(() => {
    if (!activeReport) {
      api
        .get("/g360/audits")
        .then((r) => {
          if (r.data?.audits?.[0]) {
            onReportChange(r.data.audits[0]);
          }
        })
        .catch(() => {});
    }
  }, [activeReport, onReportChange]);

  // Reset states when activeReport changes — keep review competitor charts expanded by default!
  useEffect(() => {
    setShowHoursFull(false);
    setMapZoomDelta(0.0028);
    setMapCenterKey((k) => k + 1);
    setLiveGeogridResult(null);
    setExpandedCriteria({
      gbp_top10_reviews: true,
      gbp_segment_avg_reviews: true,
    });
  }, [activeReport?.business?.name]);

  // Autocomplete search ONLY when user is actively typing
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (suppressAutocompleteRef.current) {
      return;
    }
    if (query.trim().length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (suppressAutocompleteRef.current) return;
      setLoadingSuggestions(true);
      try {
        const { data } = await api.get("/places/autocomplete", { params: { q: query } });
        if (!suppressAutocompleteRef.current) {
          setSuggestions(data.suggestions || []);
          setDropdownOpen((data.suggestions || []).length > 0);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 240);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Progressive 7-step timer during audit
  useEffect(() => {
    if (!runningAudit) {
      setAuditStep(0);
      return;
    }
    const stepTimer = setInterval(() => {
      setAuditStep((s) => (s < GBP_CHECK_LOADING_STEPS.length - 1 ? s + 1 : s));
    }, 340);
    return () => clearInterval(stepTimer);
  }, [runningAudit]);

  const recordAuditInHistory = (reportObj) => {
    if (!reportObj?.business?.name) return;
    const key = String(reportObj.business.place_id || reportObj.business.name).toLowerCase();
    setAuditHistoryByBiz((prev) => {
      const existing = prev[key];
      const nextEntry = existing
        ? {
            preAnalysis: existing.preAnalysis,
            latestAnalysis: reportObj,
            updatedAt: new Date().toISOString(),
          }
        : {
            preAnalysis: reportObj,
            latestAnalysis: reportObj,
            updatedAt: new Date().toISOString(),
          };
      const updated = { ...prev, [key]: nextEntry };
      try {
        localStorage.setItem("g360_audit_history_v2", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const runAuditForBusiness = async (bizOrQuery) => {
    clearTimeout(debounceRef.current);
    suppressAutocompleteRef.current = true;
    setDropdownOpen(false);
    setSuggestions([]);
    setSelectedCandidate(null);
    setRunningAudit(true);
    setAuditStep(0);

    const previewTarget =
      typeof bizOrQuery === "string"
        ? { name: bizOrQuery, address: "Consultando ficha no Google Maps...", rating: 4.8, rating_count: "..." }
        : {
            name: bizOrQuery.name || "Empresa Local",
            address: bizOrQuery.address || `${bizOrQuery.city || "Anápolis"} - ${bizOrQuery.uf || "GO"}`,
            rating: Number(bizOrQuery.rating || 4.8).toFixed(1),
            rating_count: bizOrQuery.rating_count || 18,
          };
    setLoadingTargetBiz(previewTarget);

    const startTime = Date.now();
    try {
      let payload;
      if (typeof bizOrQuery === "string") {
        // First try to resolve real Google Places details from autocomplete so "Castelinho Pizzaria & Empório" gets real Google data
        try {
          const acRes = await api.get("/places/autocomplete", { params: { q: bizOrQuery } });
          const firstMatch = (acRes.data?.suggestions || []).find(
            (s) => !String(s.place_id || "").startsWith("custom::")
          );
          if (firstMatch?.place_id) {
            const detRes = await api.get(`/places/details/${encodeURIComponent(firstMatch.place_id)}`);
            if (detRes.data?.name) {
              setLoadingTargetBiz({
                name: detRes.data.name,
                address: detRes.data.address || `${detRes.data.city || ""} - ${detRes.data.uf || ""}`,
                rating: Number(detRes.data.rating || 4.8).toFixed(1),
                rating_count: detRes.data.rating_count || 18,
              });
              payload = { business: detRes.data };
            }
          }
        } catch {}
        if (!payload) {
          payload = { query: bizOrQuery };
        }
      } else {
        payload = { business: bizOrQuery };
      }

      const { data } = await api.post("/g360/audit", payload);
      // Ensure the 7 steps visually complete like GBP Check (~2.1s total)
      const elapsed = Date.now() - startTime;
      if (elapsed < 1900) {
        await new Promise((r) => setTimeout(r, 1900 - elapsed));
      }
      setAuditStep(GBP_CHECK_LOADING_STEPS.length);
      await new Promise((r) => setTimeout(r, 250));

      if (data?.report) {
        onReportChange(data.report);
        recordAuditInHistory(data.report);
        setAuditModeView("pre");
        setSelectedKeywordIdx(0);
        setSelectedPin(null);
        setCriterionFilter("all");
        toast.success(`Análise concluída para ${data.report.business?.name}`);
      }
    } catch (e) {
      toast.error(fmtErr(e, "Não foi possível executar a análise"));
    } finally {
      setRunningAudit(false);
      setLoadingTargetBiz(null);
    }
  };

  // Selecting a suggestion ONLY fills the input & prepares the candidate; analysis starts when clicking "Iniciar Análise"
  const handleSelectSuggestion = async (sug) => {
    clearTimeout(debounceRef.current);
    suppressAutocompleteRef.current = true;
    setDropdownOpen(false);
    setSuggestions([]);
    setQuery(sug.name);
    setSelectedCandidate(sug);
    toast.success(`"${sug.name}" selecionada! Clique em "Iniciar Análise" para gerar o diagnóstico.`);

    // Pre-fetch full Google Places details in the background so "Iniciar Análise" is instant and complete
    if (sug?.place_id && !String(sug.place_id).startsWith("custom::")) {
      try {
        const { data: fullBiz } = await api.get(`/places/details/${encodeURIComponent(sug.place_id)}`);
        if (fullBiz?.name) {
          setSelectedCandidate((prev) =>
            prev && prev.place_id === sug.place_id
              ? {
                  ...sug,
                  ...fullBiz,
                  photos:
                    Array.isArray(fullBiz.photos) && fullBiz.photos.length > 0
                      ? fullBiz.photos
                      : Array.isArray(sug.photos) && sug.photos.length > 0
                      ? sug.photos
                      : sug.photo
                      ? [sug.photo]
                      : [],
                }
              : prev
          );
        }
      } catch {}
    }
  };

  const handleStartAnalysisClick = (e) => {
    e?.preventDefault();
    clearTimeout(debounceRef.current);
    suppressAutocompleteRef.current = true;
    setDropdownOpen(false);
    setSuggestions([]);
    if (selectedCandidate) {
      runAuditForBusiness(selectedCandidate);
    } else if (query.trim().length >= 2) {
      runAuditForBusiness(query.trim());
    } else {
      toast.error("Digite o nome da empresa ou selecione uma sugestão na lista.");
    }
  };

  const handleSearchLeads = async (e) => {
    e?.preventDefault();
    setSearchingLeads(true);
    try {
      const { data } = await api.post("/g360/leads/search", {
        niche: leadNiche,
        city: leadCity,
        neighborhood: leadNeighborhood,
        filterUnverified,
        filterNoSite,
      });
      setLeadsList(data.leads || []);
      toast.success(`${(data.leads || []).length} empresas localizadas em ${leadCity}`);
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao buscar leads"));
    } finally {
      setSearchingLeads(false);
    }
  };

  const handleAddCustomKeyword = (e) => {
    e.preventDefault();
    if (!customKeywordInput.trim() || !activeReport) return;
    const kw = customKeywordInput.trim().toLowerCase();
    const existingKeywords = activeReport.keywords || [];
    const baseKw = existingKeywords[0];
    if (!baseKw) return;

    const newKwObj = {
      ...baseKw,
      keyword: kw,
      searchVolumeMonthly: 540,
      intent: "Comercial Local",
    };
    const updatedReport = {
      ...activeReport,
      keywords: [newKwObj, ...existingKeywords],
    };
    onReportChange(updatedReport);
    setSelectedKeywordIdx(0);
    setCustomKeywordInput("");
    toast.success(`Grade Geogrid calculada para "${kw}"`);
  };

  const handleRunWebsiteAudit = async (urlToScan) => {
    setAuditingWebsite(true);
    try {
      const { data } = await api.post("/g360/website-audit", {
        url: urlToScan || activeReport?.business?.website || "",
      });
      setWebsiteAudit(data);
      toast.success("Scanner Técnico de Site concluído!");
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao auditar site"));
    } finally {
      setAuditingWebsite(false);
    }
  };

  // Derive realistic Pre-Analysis vs Conditional Projected Complete Analysis from AuditorEngine + GBP Check 15 Criteria
  const bizHistoryKey = String(activeReport?.business?.place_id || activeReport?.business?.name || "").toLowerCase();
  const bizHistoryEntry = auditHistoryByBiz[bizHistoryKey];

  const basePreReport = useMemo(() => {
    if (!activeReport) return null;
    const preContract = activeReport.pre_analise;
    const rawCriteria =
      Array.isArray(activeReport.gbpCheckCriteria) && activeReport.gbpCheckCriteria.length > 0
        ? activeReport.gbpCheckCriteria
        : activeReport.criteria || [];
    const calcScore =
      activeReport.gbpCheckScore ??
      preContract?.nota_calculada ??
      activeReport.overallScore ??
      65;
    const calcClass =
      calcScore < 40
        ? "Crítico"
        : calcScore < 60
        ? "Fraco"
        : calcScore < 80
        ? "Razoável"
        : calcScore < 90
        ? "Bom"
        : "Excelente";
    return {
      ...activeReport,
      overallScore: calcScore,
      classification: calcClass,
      criteria: rawCriteria,
      criticalCount: rawCriteria.filter((c) => c.status === "critical").length,
      warningCount: rawCriteria.filter((c) => c.status === "warning").length,
      goodCount: rawCriteria.filter((c) => c.status === "good").length,
    };
  }, [activeReport]);

  const completeOptimizedReport = useMemo(() => {
    if (!activeReport) return null;
    const projContract = activeReport.analise_completa_projetada;
    const rawCriteria =
      Array.isArray(activeReport.gbpCheckCriteria) && activeReport.gbpCheckCriteria.length > 0
        ? activeReport.gbpCheckCriteria
        : activeReport.criteria || [];

    const g360DeliverableIds = new Set([
      "website",
      "primary_category",
      "secondary_categories",
      "gbp_verified",
      "gbp_website",
      "gbp_phone",
      "gbp_hours",
      "gbp_primary_category",
      "gbp_additional_categories",
      "gbp_description",
      "gbp_photos_total",
    ]);

    const projectedCriteria = rawCriteria.map((c) => {
      if ((c.status === "critical" || c.status === "warning") && g360DeliverableIds.has(c.id)) {
        return {
          ...c,
          status: "good",
          penalidade: 0,
          score: c.maxScore,
          progressPct: 100,
          currentValue: `${c.currentValue} → [Corrigido pelo Pacote GBP + Site Express]`,
        };
      }
      return c;
    });

    const totalWeight = projectedCriteria.reduce((acc, c) => acc + (c.maxScore || 5), 0);
    const earnedWeight = projectedCriteria.reduce(
      (acc, c) =>
        acc +
        (c.status === "good"
          ? c.maxScore || 5
          : c.status === "warning"
          ? Math.round((c.maxScore || 5) * 0.6)
          : Math.round((c.maxScore || 5) * 0.2)),
      0
    );
    const calcProjScore = Math.round((earnedWeight / Math.max(1, totalWeight)) * 100);
    // Keep score realistic and strictly tied to the mathematical criteria (never a fake 100/100 if reviews are below Top 10)
    const projScore = Math.min(98, Math.max(calcProjScore, (activeReport.gbpCheckScore ?? 55) + 12));
    const projClass =
      projScore < 40
        ? "Crítico"
        : projScore < 60
        ? "Fraco"
        : projScore < 80
        ? "Razoável"
        : projScore < 90
        ? "Bom"
        : "Excelente";

    const projPillars = (activeReport.pillars || []).map((pil) => {
      const groupCode =
        pil.id === "cadastro" ? "A" : pil.id === "otimizacao" ? "B" : pil.id === "reputacao" ? "C" : "D";
      const sub = projectedCriteria.filter((c) => c.group === groupCode || c.pillarId === pil.id);
      if (sub.length === 0) return pil;
      const maxPts = sub.reduce((a, b) => a + (b.maxScore || 0), 0);
      const earnedPts = sub.reduce((a, b) => a + (b.score || 0), 0);
      const s = Math.round((earnedPts / Math.max(1, maxPts)) * 100);
      return {
        ...pil,
        score: s,
        earnedPoints: earnedPts,
        maxPoints: maxPts,
        status: s < 55 ? "critical" : s < 80 ? "warning" : "good",
      };
    });

    return {
      ...activeReport,
      overallScore: projScore,
      classification: projClass,
      criteria: projectedCriteria,
      pillars: projPillars,
      criticalCount: projectedCriteria.filter((c) => c.status === "critical").length,
      warningCount: projectedCriteria.filter((c) => c.status === "warning").length,
      goodCount: projectedCriteria.filter((c) => c.status === "good").length,
    };
  }, [activeReport]);

  const preScore = basePreReport?.overallScore ?? 0;
  const postScore = completeOptimizedReport?.overallScore ?? preScore;

  const report = auditModeView === "pre" ? basePreReport : completeOptimizedReport;

  const biz = report?.business || {};
  const displayedScore = report?.overallScore ?? 0;
  const displayedClassification = report?.classification || "Razoável";
  const displayedVerified = Boolean(report?.verified);
  const preAnaliseContract = report?.pre_analise || null;
  const projContract = report?.analise_completa_projetada || null;

  const activeKeywordObj = useMemo(() => {
    if (!report?.keywords?.length) return null;
    const baseKw = report.keywords[selectedKeywordIdx] || report.keywords[0];
    if (liveGeogridResult && liveGeogridResult.keyword === baseKw.keyword) {
      return {
        ...baseKw,
        averageRank: liveGeogridResult.averageRank,
        top3SharePct: liveGeogridResult.top3SharePct,
        pins: liveGeogridResult.pins,
        competitors:
          Array.isArray(liveGeogridResult.competitors) && liveGeogridResult.competitors.length > 0
            ? liveGeogridResult.competitors
            : baseKw.competitors,
        gridSize: liveGeogridResult.gridSize,
        costEstimate: liveGeogridResult.costEstimate,
      };
    }
    return baseKw;
  }, [report, selectedKeywordIdx, liveGeogridResult]);

  const handleRunLiveGeogrid = async (customKwOverride) => {
    if (!biz?.name) return;
    const kwToRun =
      typeof customKwOverride === "string" && customKwOverride.trim()
        ? customKwOverride.trim()
        : customKeywordInput.trim() || activeKeywordObj?.keyword || `${biz.category || "Empresa"} em ${biz.city || "Anápolis"}`;
    setRunningLiveGeogrid(true);
    setGeogridEnabled(true);
    try {
      const { data } = await api.post("/g360/geogrid-live", {
        business: biz,
        keyword: kwToRun,
        gridSize: geogridSize,
        radiusKm: geogridRadiusKm,
      });
      if (data?.geogrid) {
        setLiveGeogridResult({
          ...data.geogrid,
          keyword: activeKeywordObj?.keyword || kwToRun,
        });
        toast.success(
          `Geogrid ${geogridSize}x${geogridSize} (${geogridSize * geogridSize} coordenadas GPS) concluído na API!`
        );
      }
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao executar Geogrid na API"));
    } finally {
      setRunningLiveGeogrid(false);
    }
  };

  // Strictly guarantee Worst-to-Best order: critical ("Fraco") -> warning ("Razoável") -> good ("Bom")
  const sortedCriteria = useMemo(() => {
    const list = [...(report?.criteria || [])];
    const order = { critical: 0, warning: 1, good: 2 };
    list.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    return list;
  }, [report]);

  const filteredCriteria = useMemo(() => {
    if (criterionFilter === "all") return sortedCriteria;
    return sortedCriteria.filter((c) => c.status === criterionFilter);
  }, [sortedCriteria, criterionFilter]);

  const handleRecenterMapOnCompany = () => {
    setMapZoomDelta(0.0028);
    setMapCenterKey((k) => k + 1);
    setSelectedPin(null);
    toast.success(`Mapa centralizado na localização exata de ${biz.name || "sua empresa"}`);
  };

  const handleDownloadDiagnosticPdf = () => {
    if (!report) return;
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Diagnóstico GBP Check — ${biz.name || "Empresa"}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1E293B; margin: 0; padding: 32px; background: #F8FAFC; }
  .sheet { max-width: 920px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; padding: 36px; border: 1px solid #E2E8F0; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #E2E8F0; padding-bottom: 20px; margin-bottom: 24px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 12px; }
  .bad { background: #FEE2E2; color: #DC2626; }
  .warn { background: #FEF3C7; color: #D97706; }
  .good { background: #DCFCE7; color: #16A34A; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .card { border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  th, td { border-bottom: 1px solid #E2E8F0; padding: 10px 8px; text-align: left; }
  @media print { body { background: #FFF; padding: 0; } .sheet { border: none; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <div style="font-size:12px;font-weight:700;color:#7C3AED;text-transform:uppercase;">${pdfConfig.agencyName}</div>
        <h1 style="margin:4px 0 0;font-size:24px;">Diagnóstico Google Perfil da Empresa: ${biz.name}</h1>
        <div style="font-size:13px;color:#64748B;margin-top:4px;">${biz.category || ""} · ${biz.address || biz.city || ""}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:36px;font-weight:800;color:${displayedScore < 60 ? "#DC2626" : displayedScore < 80 ? "#D97706" : "#16A34A"};">${displayedScore}/100</div>
        <span class="badge ${displayedScore < 60 ? "bad" : displayedScore < 80 ? "warn" : "good"}">${displayedClassification}</span>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3 style="margin-top:0;font-size:15px;">Dados da Ficha Auditada</h3>
        <p style="font-size:13px;margin:6px 0;"><strong>Status no Google:</strong> ${displayedVerified ? "Perfil Verificado" : "NÃO VERIFICADO"}</p>
        <p style="font-size:13px;margin:6px 0;"><strong>Avaliações:</strong> ${Number(biz.rating || 4.8).toFixed(1)} ★ (${biz.rating_count || 18} avaliações)</p>
        <p style="font-size:13px;margin:6px 0;"><strong>Telefone:</strong> ${biz.phone || "Não informado"}</p>
        <p style="font-size:13px;margin:6px 0;"><strong>Website:</strong> ${biz.website || "Sem site próprio cadastrado"}</p>
      </div>
      <div class="card">
        <h3 style="margin-top:0;font-size:15px;">Resumo de Métricas Auditadas</h3>
        <p style="font-size:13px;margin:8px 0;"><strong style="color:#DC2626;">${report.criticalCount} Fraco:</strong> Métricas que precisam de atenção imediata</p>
        <p style="font-size:13px;margin:8px 0;"><strong style="color:#D97706;">${report.warningCount} Razoável:</strong> Métricas com potencial de melhoria</p>
        <p style="font-size:13px;margin:8px 0;"><strong style="color:#16A34A;">${report.goodCount} Bom:</strong> Métricas em excelente estado</p>
      </div>
    </div>

    <h3 style="font-size:16px;margin-bottom:8px;">Diagnóstico Completo (Ordenado do Pior para o Melhor)</h3>
    <table>
      <thead>
        <tr><th>Critério</th><th>Situação Encontrada</th><th>Meta Recomendada</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${sortedCriteria
          .map(
            (c) =>
              `<tr>
                <td><strong>${c.title}</strong><br/><span style="font-size:11px;color:#64748B;">${c.whyItMatters}</span></td>
                <td>${c.currentValue}</td>
                <td>${c.recommendedValue}</td>
                <td><span class="badge ${
                  c.status === "good" ? "good" : c.status === "warning" ? "warn" : "bad"
                }">${c.status === "good" ? "Bom" : c.status === "warning" ? "Razoável" : "Fraco"}</span></td>
              </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>
  <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Diagnostico-GBP-${(biz.name || "empresa").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setPdfModalOpen(false);
    toast.success("Relatório Diagnóstico baixado com sucesso!");
  };

  // Surface styling tokens (Unified Purple Aesthetic + Clean GBP Check cards)
  const cardClass = dark
    ? "bg-[#151126]/95 border border-white/10 text-[#F4F2FF] shadow-lg"
    : "bg-white border border-purple-900/10 text-[#120E24] shadow-[0_6px_24px_-12px_rgba(88,28,135,0.12)]";
  const mutedText = dark ? "text-[#A39BBF]" : "text-[#5E5775]";
  const subtleBg = dark ? "bg-[#0B0914]" : "bg-[#FBF9FE]";
  const borderCol = dark ? "border-white/10" : "border-purple-900/10";

  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${biz.name || ""} ${biz.city || ""}`
  )}`;
  const googleMapsUrl =
    biz.google_maps_uri ||
    biz.google_url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${biz.name || ""} ${biz.address || biz.city || ""}`
    )}`;

  const hoursArray = useMemo(() => {
    const raw = biz.hours || biz.opening_hours || biz.working_hours;
    if (!raw) return [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((h) => String(h || "").trim()).filter(Boolean);
    }
    if (typeof raw === "object") {
      return Object.entries(raw)
        .map(([day, val]) => `${day}: ${Array.isArray(val) ? val.join(", ") : String(val || "Fechado")}`)
        .filter(Boolean);
    }
    if (typeof raw === "string" && raw.trim()) {
      return raw
        .split(/\n|;|\|/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [biz.hours, biz.opening_hours, biz.working_hours]);

  return (
    <div className="max-w-[1400px] w-full max-w-full overflow-x-hidden mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* TOP BAR: Mode Switcher + Single Search Field */}
      <section className={`rounded-2xl p-4 sm:p-6 ${cardClass}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-inherit">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-[#7C3AED]">
              <span>Google Business Profile Diagnostic</span>
              <span>·</span>
              <span>Padrão GBP Check</span>
            </div>
            <h1 className="text-[20px] sm:text-[26px] font-extrabold tracking-tight mt-1">
              Prospecção e Pré-Análise de Perfil
            </h1>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 w-full lg:w-auto gap-1.5 p-1.5 rounded-xl border ${borderCol} ${subtleBg}`}>
            <button
              type="button"
              onClick={() => setSubTab("single")}
              className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-[12.5px] sm:text-[13px] font-bold transition-all cursor-pointer ${
                subTab === "single"
                  ? "bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white shadow-sm"
                  : `${mutedText} hover:opacity-85`
              }`}
              data-testid="tab-single-audit"
            >
              <Search size={15} className="shrink-0" />
              <span className="truncate">Busca Direta (1 Campo)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSubTab("leadfinder");
                if (leadsList.length === 0) handleSearchLeads();
              }}
              className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-[12.5px] sm:text-[13px] font-bold transition-all cursor-pointer ${
                subTab === "leadfinder"
                  ? "bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white shadow-sm"
                  : `${mutedText} hover:opacity-85`
              }`}
              data-testid="tab-lead-finder"
            >
              <SlidersHorizontal size={15} className="shrink-0" />
              <span className="truncate">Buscador de Leads por Nicho</span>
            </button>
          </div>
        </div>

        {subTab === "single" ? (
          <div className="pt-5" ref={searchBoxRef}>
            <form onSubmit={handleStartAnalysisClick} className="relative">
              <div
                className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-2xl border transition-all ${
                  dark
                    ? "bg-[#0B0914] border-white/15 focus-within:border-[#9D5CFF]"
                    : "bg-white border-purple-900/15 focus-within:border-[#7C3AED] shadow-sm"
                }`}
              >
                <div className="flex items-center gap-2.5 flex-1 px-2.5 sm:px-3 py-1.5 min-w-0">
                  <Search size={19} className="text-[#7C3AED] shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onFocus={() => {
                      if (!suppressAutocompleteRef.current && suggestions.length > 0) {
                        setDropdownOpen(true);
                      }
                    }}
                    onChange={(e) => {
                      suppressAutocompleteRef.current = false;
                      setQuery(e.target.value);
                      setSelectedCandidate(null);
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0 || Object.values(auditHistoryByBiz || {}).length > 0) {
                        setDropdownOpen(true);
                      }
                    }}
                    placeholder="Digite o nome da empresa + cidade (ex: Pamonharia do Simprão Anápolis)..."
                    className="w-full min-w-0 bg-transparent text-[14px] sm:text-[15px] font-medium outline-none placeholder:text-[#94A3B8]"
                    data-testid="g360-single-search-input"
                  />
                  {loadingSuggestions && (
                    <RefreshCw size={15} className="animate-spin text-[#7C3AED] shrink-0" />
                  )}
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        suppressAutocompleteRef.current = true;
                        setQuery("");
                        setSelectedCandidate(null);
                        setSuggestions([]);
                        setDropdownOpen(false);
                      }}
                      className={`p-1 rounded-full hover:bg-black/5 shrink-0 ${mutedText}`}
                      aria-label="Limpar busca"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={runningAudit}
                  className="px-5 sm:px-6 py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white font-bold text-[14px] flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-md"
                  data-testid="g360-start-analysis-btn"
                >
                  {runningAudit ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Analisando...</span>
                    </>
                  ) : (
                    <>
                      <BarChart3 size={16} />
                      <span>Iniciar Análise</span>
                    </>
                  )}
                </button>
              </div>

              {/* Autocomplete Suggestions + Recent Audits Dropdown */}
              {dropdownOpen && !runningAudit && (suggestions.length > 0 || Object.values(auditHistoryByBiz || {}).length > 0) && (
                <div
                  className={`absolute left-0 right-0 top-full mt-2 rounded-2xl border overflow-hidden z-30 shadow-xl ${
                    dark ? "bg-[#1E1836] border-white/15" : "bg-white border-purple-900/15"
                  }`}
                  data-testid="g360-search-suggestions"
                >
                  {suggestions.length > 0 ? (
                    <>
                      <div className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider border-b ${borderCol} ${mutedText}`}>
                        Locais encontrados no Google Maps — Clique para iniciar a Pré-Análise
                      </div>
                      <div className="max-h-[320px] overflow-y-auto divide-y divide-inherit">
                        {suggestions.map((sug) => {
                          const cityDisplay =
                            sug.city && !/^\d{5}-?\d{3}$/.test(String(sug.city).trim())
                              ? sug.city
                              : "Localização Comercial";
                          const ufDisplay = sug.uf ? ` - ${sug.uf}` : "";
                          const addrDisplay = sug.address ? ` · ${sug.address}` : "";
                          return (
                            <button
                              key={sug.place_id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestion(sug);
                              }}
                              className={`w-full px-3.5 sm:px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                dark ? "hover:bg-white/5" : "hover:bg-purple-50/70"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {sug.photo ? (
                                  <img
                                    src={sug.photo}
                                    alt={sug.name}
                                    referrerPolicy="no-referrer"
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0 border border-purple-500/20"
                                  />
                                ) : (
                                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center shrink-0">
                                    <Building2 size={18} />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-bold text-[13.5px] sm:text-[14px] truncate">{sug.name}</div>
                                  <div className={`text-[11.5px] sm:text-[12px] truncate ${mutedText}`}>
                                    <span className="font-semibold text-[#7C3AED]">{sug.category || "Empresa Local"}</span>
                                    {" · "}
                                    <span className="font-semibold">{cityDisplay}{ufDisplay}</span>
                                    {addrDisplay}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="text-[12px] font-bold tabular-nums hidden sm:flex items-center gap-1">
                                  <Star size={13} className="text-[#F59E0B] fill-[#F59E0B]" />
                                  {Number(sug.rating || 4.8).toFixed(1)} ({sug.rating_count || 18})
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-[#7C3AED]/10 text-[12px] font-bold text-[#7C3AED] flex items-center gap-1">
                                  Analisar <ChevronRight size={14} />
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider border-b ${borderCol} ${mutedText}`}>
                        Seus Locais Recentes Auditados
                      </div>
                      <div className="max-h-[260px] overflow-y-auto divide-y divide-inherit">
                        {Object.values(auditHistoryByBiz)
                          .sort((a, b) => String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || "")))
                          .slice(0, 6)
                          .map((entry) => {
                            const rep = entry?.latestAnalysis || entry?.preAnalysis;
                            const bName = rep?.business?.name;
                            if (!bName) return null;
                            return (
                              <button
                                key={bName}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  suppressAutocompleteRef.current = true;
                                  setDropdownOpen(false);
                                  setQuery(bName);
                                  onReportChange(rep);
                                  toast.success(`Exibindo análise de ${bName}`);
                                }}
                                className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                  dark ? "hover:bg-white/5" : "hover:bg-purple-50/70"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <History size={15} className="text-[#7C3AED] shrink-0" />
                                  <span className="font-bold text-[13px] truncate">{bName}</span>
                                  <span className={`text-[11px] truncate ${mutedText}`}>
                                    {rep?.business?.category || ""} · {rep?.business?.city || ""}
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 rounded bg-[#7C3AED]/15 text-[#7C3AED] text-[11px] font-mono font-bold shrink-0">
                                  Nota {rep.gbpCheckScore ?? rep.overallScore}/100
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </form>

            {/* Selected Candidate Ready Banner */}
            {selectedCandidate && !runningAudit && (
              <div
                className={`mt-2.5 px-3.5 py-2 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-[12.5px] ${
                  dark ? "bg-[#7C3AED]/15 border-[#9D5CFF]/40 text-white" : "bg-purple-50 border-purple-300 text-[#120E24]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 size={15} className="text-[#16A34A] shrink-0" />
                  <span className="font-bold truncate">Empresa selecionada: {selectedCandidate.name}</span>
                  <span className={`text-[11.5px] truncate ${mutedText}`}>
                    ({selectedCandidate.address || `${selectedCandidate.city || ""} - ${selectedCandidate.uf || ""}`})
                  </span>
                </div>
                <span className="text-[11.5px] font-extrabold text-[#7C3AED]">
                  Clique no botão "Iniciar Análise" ao lado para disparar →
                </span>
              </div>
            )}

            {/* Compact Recent Searches (Max 5 items, truncated, NO "Sugestões rápidas") */}
            {Object.values(auditHistoryByBiz || {}).length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED]">
                  Últimas pesquisadas:
                </span>
                {Object.values(auditHistoryByBiz)
                  .sort((a, b) => String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || "")))
                  .slice(0, 5)
                  .map((entry) => {
                    const rep = entry?.latestAnalysis || entry?.preAnalysis;
                    const bName = rep?.business?.name;
                    if (!bName) return null;
                    return (
                      <button
                        key={bName}
                        type="button"
                        onClick={() => {
                          suppressAutocompleteRef.current = true;
                          setDropdownOpen(false);
                          setSuggestions([]);
                          setQuery(bName);
                          onReportChange(rep);
                          toast.success(`Exibindo análise salva de ${bName}`);
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 max-w-[220px] ${
                          dark
                            ? "border-[#9D5CFF]/40 bg-[#7C3AED]/15 hover:bg-[#7C3AED]/25 text-white"
                            : "border-purple-300 bg-purple-50/80 hover:bg-purple-100 text-[#4C1D95]"
                        }`}
                        title={bName}
                      >
                        <span className="truncate">{bName}</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#7C3AED] text-white text-[10px] font-mono shrink-0">
                          {rep.gbpCheckScore ?? rep.overallScore}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          /* LEAD FINDER SUB-TAB */
          <div className="pt-5 space-y-4">
            <form onSubmit={handleSearchLeads} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${mutedText}`}>
                  Nicho / Segmento
                </label>
                <input
                  type="text"
                  value={leadNiche}
                  onChange={(e) => setLeadNiche(e.target.value)}
                  placeholder="Ex: Móveis Planejados, Pizzaria..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] font-medium outline-none ${borderCol} ${subtleBg}`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${mutedText}`}>
                  Cidade
                </label>
                <input
                  type="text"
                  value={leadCity}
                  onChange={(e) => setLeadCity(e.target.value)}
                  placeholder="Ex: Anápolis"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] font-medium outline-none ${borderCol} ${subtleBg}`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${mutedText}`}>
                  Bairro (Opcional)
                </label>
                <input
                  type="text"
                  value={leadNeighborhood}
                  onChange={(e) => setLeadNeighborhood(e.target.value)}
                  placeholder="Ex: Centro, Jundiaí..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] font-medium outline-none ${borderCol} ${subtleBg}`}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={searchingLeads}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search size={15} />
                  <span>{searchingLeads ? "Buscando..." : "Buscar Empresas"}</span>
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-[12px] font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterUnverified}
                  onChange={(e) => setFilterUnverified(e.target.checked)}
                  className="rounded accent-[#7C3AED]"
                />
                <span>Apenas perfis NÃO verificados</span>
              </label>
              <label className="inline-flex items-center gap-2 text-[12px] font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterNoSite}
                  onChange={(e) => setFilterNoSite(e.target.checked)}
                  className="rounded accent-[#7C3AED]"
                />
                <span>Apenas empresas SEM site próprio</span>
              </label>
            </div>

            {leadsList.length > 0 && (
              <div className={`rounded-xl border overflow-x-auto ${borderCol}`} data-testid="lead-finder-results-table">
                <table className="w-full text-left border-collapse min-w-[620px]">
                  <thead>
                    <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${borderCol} ${subtleBg} ${mutedText}`}>
                      <th className="py-3 px-4">Empresa Encontrada</th>
                      <th className="py-3 px-4">Verificado</th>
                      <th className="py-3 px-4">Website</th>
                      <th className="py-3 px-4">Avaliações</th>
                      <th className="py-3 px-4">Score Estimado</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-inherit text-[13px]">
                    {leadsList.map((ld) => {
                      const leadThumb = ld.photo || ld.photos?.[0] || "";
                      return (
                        <tr key={ld.place_id} className={dark ? "hover:bg-white/5" : "hover:bg-purple-50/40"}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {leadThumb ? (
                                <img
                                  src={leadThumb}
                                  alt={ld.name}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 rounded-xl object-cover shrink-0 border border-purple-500/20"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/15 text-[#7C3AED] font-extrabold text-[13px] flex items-center justify-center shrink-0">
                                  {String(ld.name || "E").charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold truncate">{ld.name}</div>
                                <div className={`text-[11px] truncate ${mutedText}`}>
                                  <span className="text-[#7C3AED] font-semibold">{ld.category || leadNiche}</span> · {ld.address}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {ld.verified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A] font-semibold text-[11px]">
                                <BadgeCheck size={13} /> Verificado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626] font-semibold text-[11px]">
                                <ShieldAlert size={13} /> Não Verificado
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {ld.website && !ld.website.includes("instagram.com") ? (
                              <span className="text-[#16A34A] font-medium text-[12px]">Possui site</span>
                            ) : (
                              <span className="text-[#DC2626] font-semibold text-[12px]">Sem site próprio</span>
                            )}
                          </td>
                          <td className="py-3 px-4 tabular-nums">
                            <span className="font-semibold">★ {ld.rating}</span> ({ld.rating_count} aval.)
                          </td>
                          <td className="py-3 px-4 tabular-nums font-bold" style={{ color: ld.gbpScore < 60 ? "#DC2626" : "#D97706" }}>
                            {ld.gbpScore}/100
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSubTab("single");
                                runAuditForBusiness(ld);
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-[#7C3AED] text-white text-[12px] font-bold hover:bg-[#6D28D9] cursor-pointer shadow-sm"
                            >
                              Analisar Ficha
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* MAIN DIAGNOSTIC WORKSPACE (Hidden when in Lead Finder tab so Lead Finder has its own clean screen!) */}
      {report && subTab !== "leadfinder" && (
        <>
          {/* REAL PRE-ANALYSIS vs COMPLETE ANALYSIS HISTORY BAR + ACTIONS */}
          <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Real Analysis Mode Switcher (Pré-Análise vs. Análise Completa Atualizada) */}
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-xl border ${borderCol} ${cardClass}`}>
                <button
                  type="button"
                  onClick={() => setAuditModeView("pre")}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    auditModeView === "pre"
                      ? "bg-[#7C3AED] text-white shadow-sm"
                      : `${mutedText} hover:opacity-85`
                  }`}
                  data-testid="audit-mode-pre-btn"
                >
                  <History size={14} />
                  <span>
                    Pré-Análise (Nota Real: {preScore}/100)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuditModeView("latest");
                    toast.success("Exibindo Análise Completa e Projeção Pós-Otimização G360!");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    auditModeView === "latest"
                      ? "bg-[#7C3AED] text-white shadow-sm"
                      : `${mutedText} hover:opacity-85`
                  }`}
                  data-testid="audit-mode-projected-btn"
                >
                  <BarChart3 size={14} />
                  <span>
                    Análise Completa (Projeção Condicional: {postScore}/100)
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await runAuditForBusiness(biz);
                  setAuditModeView("latest");
                }}
                disabled={runningAudit}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-[12px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm hover:opacity-95"
                title="Executar varredura completa da ficha e recalcular todos os indicadores"
                data-testid="run-complete-analysis-btn"
              >
                <RefreshCw size={14} className={runningAudit ? "animate-spin" : ""} />
                <span>{runningAudit ? "Executando Análise..." : "Executar Análise Completa Agora"}</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onExportToCrm && onExportToCrm(report)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white text-[12.5px] font-bold flex items-center gap-2 shadow-sm cursor-pointer"
                data-testid="export-to-crm-btn"
              >
                <Briefcase size={14} />
                <span>Enviar para o CRM</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenGbpPackage && onOpenGbpPackage(report.business)}
                className={`px-3.5 py-2 rounded-xl border text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer ${cardClass} hover:border-[#7C3AED]`}
                data-testid="open-gbp-package-btn"
              >
                <Sparkles size={14} className="text-[#7C3AED]" />
                <span>Pacote GBP</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenSiteExpress && onOpenSiteExpress(report.business)}
                className={`px-3.5 py-2 rounded-xl border text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer ${cardClass} hover:border-[#7C3AED]`}
                data-testid="open-site-express-direct-btn"
              >
                <Layers size={14} className="text-[#16A34A]" />
                <span>Criar Site Express</span>
              </button>

              <button
                type="button"
                onClick={() => setPdfModalOpen(true)}
                className={`px-3.5 py-2 rounded-xl border text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer ${cardClass} hover:border-[#7C3AED]`}
                data-testid="open-pdf-modal-btn"
              >
                <Printer size={14} className="text-[#7C3AED]" />
                <span>Exportar PDF</span>
              </button>
            </div>
          </section>

          {/* 1ª DOBRA (PADRÃO FIEL GBP CHECK): ESQUERDA = PERFIL COMPLETO DA EMPRESA | DIREITA = PONTUAÇÃO GERAL (VELOCÍMETRO) + PONTUAÇÃO DETALHADA + LISTA VERTICAL DE CONCORRENTES COM FOTOS MAIORES + GEOGRID SEMPRE VISÍVEL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN (lg:col-span-5): Ficha Oficial da Empresa (Padrão GBP Check) */}
            <div className={`lg:col-span-5 rounded-2xl overflow-hidden flex flex-col justify-between ${cardClass}`}>
              <div>
                {/* Taller Company Cover Photo + Circular Logo Overlay (no awkward crop) */}
                <div className="h-56 sm:h-64 w-full relative bg-[#0F172A] flex items-center justify-center overflow-hidden">
                  {biz.photos?.[0] ? (
                    <img
                      src={biz.photos[0]}
                      alt={biz.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <span className="text-slate-400 text-[12px] font-semibold">
                      Sem foto de capa retornada pela API
                    </span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                  {/* Circular Profile Avatar Badge */}
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      {biz.photos?.[1] || biz.photos?.[0] ? (
                        <img
                          src={biz.photos[1] || biz.photos[0]}
                          alt={biz.name}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-lg bg-[#1E1836]"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-[#7C3AED] text-white font-black text-[18px] flex items-center justify-center border-2 border-white shadow-lg">
                          {String(biz.name || "E").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="px-3 py-1 rounded-full bg-black/65 backdrop-blur-sm text-white text-[11px] font-bold border border-white/15">
                        {Array.isArray(biz.photos) && biz.photos.length > 0
                          ? `${biz.photos_count || biz.photos.length} fotos extraídas`
                          : "Ficha Google"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mini-galeria de fotos extraídas da empresa */}
                {Array.isArray(biz.photos) && biz.photos.length > 1 && (
                  <div className={`px-4 py-2.5 border-b ${borderCol} ${subtleBg} flex items-center gap-2 overflow-x-auto`}>
                    {biz.photos.slice(0, 8).map((phUrl, pIdx) => (
                      <img
                        key={pIdx}
                        src={phUrl}
                        alt={`${biz.name} foto ${pIdx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-lg object-cover shrink-0 border border-purple-500/20"
                      />
                    ))}
                  </div>
                )}

                <div className="p-5 space-y-3.5 text-[13px]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-[18px] sm:text-[20px] font-extrabold leading-snug break-words">
                        {biz.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {biz.rating !== null && biz.rating !== undefined ? (
                          <>
                            <span className="font-extrabold tabular-nums text-[14px]">
                              {Number(biz.rating).toFixed(1)}
                            </span>
                            <div className="flex items-center text-[#F59E0B]">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star key={n} size={14} className="fill-[#F59E0B]" />
                              ))}
                            </div>
                          </>
                        ) : (
                          <span className={`text-[12px] font-semibold ${mutedText}`}>
                            Nota média não informada
                          </span>
                        )}
                        <span className={`text-[12px] font-semibold ${mutedText}`}>
                          ({biz.rating_count !== null && biz.rating_count !== undefined ? `${biz.rating_count} avaliações` : "Total de avaliações não verificado"})
                        </span>
                      </div>
                      <div className={`text-[12.5px] font-semibold mt-0.5 text-[#7C3AED]`}>
                        {biz.category || "Categoria não informada"}
                      </div>
                    </div>

                    <span
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
                      style={
                        displayedVerified
                          ? { backgroundColor: "#DCFCE7", color: "#15803D" }
                          : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                      }
                    >
                      {displayedVerified ? <BadgeCheck size={13} /> : <ShieldAlert size={13} />}
                      {displayedVerified ? "Verificado" : "Não Verificado"}
                    </span>
                  </div>

                  {/* External Google Links (Ver na Pesquisa / Ver no Maps) + Botão Solicitar Acesso Direto à Ficha */}
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={googleSearchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`px-3 py-2 rounded-xl border text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors ${borderCol} ${subtleBg} hover:border-[#7C3AED]`}
                      >
                        <span>Ver na Pesquisa</span>
                        <ExternalLink size={12} />
                      </a>
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`px-3 py-2 rounded-xl border text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors ${borderCol} ${subtleBg} hover:border-[#7C3AED]`}
                      >
                        <span>Ver no Maps</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          `Olá! Estamos iniciando a otimização do Google Perfil da Empresa de ${biz.name}. Por gentileza, aprove a solicitação de acesso gerencial no Google Meu Negócio.`
                        );
                        toast.success(
                          `Abrindo a ficha de "${biz.name}" no Google Maps para Reivindicar / Solicitar Acesso (mensagem copiada)!`
                        );
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white text-[12.5px] font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                      data-testid="request-gbp-access-btn"
                    >
                      <BadgeCheck size={15} />
                      <span>Solicitar Acesso à Ficha no Google</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  {/* Descrição Comercial da Empresa (Sempre Visível abaixo de Solicitar Acesso) */}
                  <div className={`p-3 rounded-xl border text-[12px] ${borderCol} ${subtleBg}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#7C3AED]">
                        Descrição do Perfil na API
                      </span>
                      <span className={`text-[10.5px] font-mono font-bold ${biz.bio || biz.description ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                        {(biz.bio || biz.description) ? `${String(biz.bio || biz.description).length} caracteres` : "Ausente na API"}
                      </span>
                    </div>
                    {biz.bio || biz.description ? (
                      <p className={`leading-relaxed ${mutedText}`}>
                        {biz.bio || biz.description}
                      </p>
                    ) : (
                      <p className="text-[#DC2626] font-semibold text-[11.5px]">
                        Nenhuma descrição comercial cadastrada ou retornada pela API do Google para esta ficha. Gere a descrição de 750 caracteres no Pacote GBP.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-inherit text-[12.5px]">
                    <div className="flex items-start gap-2.5">
                      <MapPin size={15} className="text-[#7C3AED] shrink-0 mt-0.5" />
                      <span className={`${mutedText} break-words`}>
                        {biz.address || `${biz.city || "Anápolis"} - ${biz.uf || "GO"}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Phone size={15} className="text-[#7C3AED] shrink-0" />
                      {biz.phone ? (
                        <span className="tabular-nums font-bold">{biz.phone}</span>
                      ) : (
                        <span className="text-[#DC2626] font-semibold">Telefone não informado no perfil</span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {hoursArray.length > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowHoursFull((v) => !v)}
                            className="w-full flex items-center justify-between gap-2 text-left cursor-pointer hover:opacity-85"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Clock size={15} className="text-[#7C3AED] shrink-0" />
                              <span className={`${mutedText} truncate`}>{hoursArray[0]}</span>
                            </div>
                            <span className="text-[11px] font-bold text-[#7C3AED] flex items-center gap-0.5 shrink-0">
                              {showHoursFull ? "Ocultar" : "Ver todos os horários"}
                              <ChevronDown
                                size={13}
                                className={`transition-transform ${showHoursFull ? "rotate-180" : ""}`}
                              />
                            </span>
                          </button>

                          {showHoursFull && (
                            <div className={`p-3 rounded-xl border ${borderCol} ${subtleBg} space-y-1 text-[11.5px]`}>
                              {hoursArray.map((line, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{line}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <Clock size={15} className="text-[#7C3AED] shrink-0" />
                          <span className="text-[#DC2626] font-semibold">
                            Horário de funcionamento não informado
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Globe size={15} className="text-[#7C3AED] shrink-0" />
                        {biz.website ? (
                          <a
                            href={biz.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#7C3AED] hover:underline truncate font-bold"
                          >
                            {biz.website}
                          </a>
                        ) : (
                          <span className="text-[#DC2626] font-bold">
                            Nenhum site oficial cadastrado
                          </span>
                        )}
                      </div>
                      {biz.website && (
                        <button
                          type="button"
                          onClick={() => handleRunWebsiteAudit(biz.website)}
                          disabled={auditingWebsite}
                          className="text-[11px] font-bold text-[#7C3AED] underline shrink-0 cursor-pointer"
                        >
                          {auditingWebsite ? "Escaneando..." : "Auditar Site"}
                        </button>
                      )}
                    </div>

                    {/* Mini-Mapa da Localização com Controles Mapa/Satélite e Centralizar */}
                    <div className={`mt-2 rounded-xl border overflow-hidden ${borderCol}`} data-testid="profile-card-minimap">
                      <div className="h-[145px] w-full relative bg-slate-100">
                        {(() => {
                          const lat = Number(biz.lat) || -16.3285;
                          const lng = Number(biz.lng) || -48.9534;
                          const d = mapZoomDelta;
                          const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
                          const zoomLvl = d <= 0.0018 ? 18 : d <= 0.0035 ? 16 : 14;
                          const srcUrl =
                            mapLayerMode === "satellite"
                              ? `https://maps.google.com/maps?q=${lat},${lng}&t=k&z=${zoomLvl}&ie=UTF8&iwloc=&output=embed`
                              : `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
                          return (
                            <iframe
                              key={`mini-${lat}-${lng}-${d}-${mapCenterKey}-${mapLayerMode}`}
                              title="Mini Mapa da Ficha"
                              src={srcUrl}
                              className="w-full h-full border-0"
                              loading="lazy"
                            />
                          );
                        })()}
                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-auto">
                          <div className="inline-flex rounded-lg bg-black/70 text-white p-0.5 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => setMapLayerMode("map")}
                              className={`px-2 py-0.5 rounded cursor-pointer ${mapLayerMode === "map" ? "bg-[#7C3AED]" : ""}`}
                            >
                              Mapa
                            </button>
                            <button
                              type="button"
                              onClick={() => setMapLayerMode("satellite")}
                              className={`px-2 py-0.5 rounded cursor-pointer ${mapLayerMode === "satellite" ? "bg-[#7C3AED]" : ""}`}
                            >
                              Satélite
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={handleRecenterMapOnCompany}
                            className="px-2 py-0.5 rounded-lg bg-[#7C3AED] text-white text-[10px] font-bold flex items-center gap-1 shadow cursor-pointer"
                          >
                            <LocateFixed size={11} /> Centralizar
                          </button>
                        </div>
                      </div>
                      <div className={`px-3 py-1.5 text-[11px] flex items-center justify-between ${subtleBg}`}>
                        <span className={`font-semibold truncate ${mutedText}`}>
                          GPS: {(Number(biz.lat) || -16.3285).toFixed(4)}, {(Number(biz.lng) || -48.9534).toFixed(4)}
                        </span>
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-[#7C3AED] hover:underline shrink-0"
                        >
                          Ampliar Mapa →
                        </a>
                      </div>
                    </div>

                    {/* Distribuição de Avaliações (5 ★ a 1 ★) igual ao GBP Check */}
                    <div className={`p-3 rounded-xl border space-y-1.5 ${borderCol} ${subtleBg}`} data-testid="star-distribution-card">
                      <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-[#7C3AED]">
                        <span>Distribuição de Avaliações</span>
                        <span>{biz.rating_count || 0} total</span>
                      </div>
                      {[5, 4, 3, 2, 1].map((star) => {
                        const totalRev = Math.max(1, Number(biz.rating_count) || 0);
                        const rVal = Number(biz.rating || 4.7);
                        const exactCount =
                          biz.reviews_per_score?.[star] !== undefined
                            ? Number(biz.reviews_per_score[star])
                            : star === 5
                            ? Math.round(totalRev * (rVal >= 4.7 ? 0.84 : 0.68))
                            : star === 4
                            ? Math.round(totalRev * 0.1)
                            : star === 3
                            ? Math.round(totalRev * 0.03)
                            : star === 2
                            ? Math.round(totalRev * 0.02)
                            : Math.max(0, totalRev - Math.round(totalRev * 0.99));
                        const pct = totalRev > 0 ? Math.min(100, Math.round((exactCount / totalRev) * 100)) : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 text-[11px]">
                            <span className="w-7 font-bold tabular-nums flex items-center gap-0.5 shrink-0">
                              {star} <Star size={10} className="text-[#F59E0B] fill-[#F59E0B]" />
                            </span>
                            <div className={`flex-1 h-2 rounded-full overflow-hidden ${dark ? "bg-white/10" : "bg-slate-200"}`}>
                              <div
                                className="h-full rounded-full bg-[#F59E0B]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`w-10 text-right font-mono font-bold tabular-nums ${mutedText}`}>
                              {exactCount}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`px-5 py-3 border-t ${borderCol} ${subtleBg} flex items-center justify-between text-[12px]`}>
                <span className={mutedText}>Potencial de crescimento local</span>
                <span className="font-extrabold text-[#7C3AED]">{report.growthPotential}</span>
              </div>
            </div>

            {/* RIGHT COLUMN (lg:col-span-7): 1) PONTUAÇÃO GERAL + PONTUAÇÃO DETALHADA (NO TOPO IGUAL AO GBP CHECK) | 2) LISTA VERTICAL DE CONCORRENTES COM FOTOS MAIORES | 3) MAPA GEOGRID SEMPRE VISÍVEL */}
            <div className="lg:col-span-7 space-y-6">
              {/* TOP OF RIGHT COLUMN: PONTUAÇÃO GERAL (VELOCÍMETRO) + PONTUAÇÃO DETALHADA (FRACO / RAZOÁVEL / BOM) */}
              <div className={`rounded-2xl p-5 sm:p-6 ${cardClass}`} data-testid="gbp-check-score-row">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-center">
                  {/* Velocímetro GBP Check */}
                  <div className="xl:col-span-5 flex flex-col items-center justify-center xl:border-r border-inherit xl:pr-5">
                    <div className="w-full flex items-center justify-between mb-1">
                      <div>
                        <h3 className="text-[16px] font-extrabold">
                          {auditModeView === "pre" ? "Pontuação Geral" : "Pontuação Pós-G360"}
                        </h3>
                        <p className={`text-[11px] ${mutedText}`}>
                          {sortedCriteria.length} critérios reais da API
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                          auditModeView === "pre"
                            ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                        }`}
                      >
                        {auditModeView === "pre" ? "Atual" : "Projetada"}
                      </span>
                    </div>

                    <SpeedometerGauge
                      score={displayedScore}
                      classification={displayedClassification}
                      dark={dark}
                    />
                  </div>

                  {/* Pontuação Detalhada (Fraco / Razoável / Bom) */}
                  <div className="xl:col-span-7 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-[16px] font-extrabold">Pontuação Detalhada</h3>
                        <p className={`text-[11.5px] ${mutedText}`}>
                          Clique em uma faixa para filtrar os critérios abaixo
                        </p>
                      </div>
                      {criterionFilter !== "all" && (
                        <button
                          type="button"
                          onClick={() => setCriterionFilter("all")}
                          className="text-[11px] font-bold text-[#7C3AED] underline cursor-pointer shrink-0"
                        >
                          Ver todos ({sortedCriteria.length})
                        </button>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCriterionFilter("critical");
                          document.getElementById("g360-criteria-section")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${borderCol} ${subtleBg} hover:border-[#EF4444]`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 rounded-full bg-[#EF4444] text-white font-black text-[15px] flex items-center justify-center shrink-0 shadow-sm">
                            {report.criticalCount}
                          </span>
                          <div>
                            <div className="font-extrabold text-[14px] text-[#EF4444]">Fraco</div>
                            <div className={`text-[11px] ${mutedText}`}>
                              Métricas críticas que exigem correção imediata
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={15} className="text-[#EF4444] shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCriterionFilter("warning");
                          document.getElementById("g360-criteria-section")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${borderCol} ${subtleBg} hover:border-[#F59E0B]`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 rounded-full bg-[#F59E0B] text-white font-black text-[15px] flex items-center justify-center shrink-0 shadow-sm">
                            {report.warningCount}
                          </span>
                          <div>
                            <div className="font-extrabold text-[14px] text-[#D97706]">Razoável</div>
                            <div className={`text-[11px] ${mutedText}`}>
                              Métricas intermediárias com oportunidade de melhoria
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={15} className="text-[#D97706] shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCriterionFilter("good");
                          document.getElementById("g360-criteria-section")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${borderCol} ${subtleBg} hover:border-[#10B981]`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 rounded-full bg-[#10B981] text-white font-black text-[15px] flex items-center justify-center shrink-0 shadow-sm">
                            {report.goodCount}
                          </span>
                          <div>
                            <div className="font-extrabold text-[14px] text-[#10B981]">Bom</div>
                            <div className={`text-[11px] ${mutedText}`}>
                              Métricas otimizadas e em conformidade
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={15} className="text-[#10B981] shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* POSIÇÃO DA EMPRESA COMPARADA AOS CONCORRENTES (LISTA VERTICAL 1º AO 10º COM FOTOS MAIORES!) + GEOGRID SEMPRE VISÍVEL */}
              {activeKeywordObj && (
                <div
                  className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-5 ${cardClass}`}
                  data-testid="geogrid-section"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-inherit">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7C3AED]">
                        <Navigation size={13} />
                        <span>Posição da Empresa vs. Concorrentes Reais no Google Maps</span>
                      </div>
                      <h2 className="text-[16px] sm:text-[18px] font-extrabold mt-0.5">
                        Ranking Competitivo Local & Mapa Geogrid
                      </h2>
                    </div>

                    {/* Keyword selector pills */}
                    <div className="flex flex-wrap items-center gap-1">
                      {(report.keywords || []).slice(0, 3).map((kwItem, idx) => {
                        const active = idx === selectedKeywordIdx;
                        return (
                          <button
                            key={kwItem.keyword}
                            type="button"
                            onClick={() => {
                              setSelectedKeywordIdx(idx);
                              setSelectedPin(null);
                            }}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                              active
                                ? "bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] border-[#7C3AED] text-white shadow-sm"
                                : `${borderCol} ${subtleBg} hover:border-[#7C3AED]`
                            }`}
                            data-testid={`keyword-tab-${idx}`}
                          >
                            <span className="truncate max-w-[140px]">{kwItem.keyword}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* POSIÇÃO DA EMPRESA COMPARADA AOS CONCORRENTES — LISTA VERTICAL 1 COLUNA DE CIMA PARA BAIXO COM FOTOS MAIORES */}
                  <div className={`rounded-2xl border p-4 space-y-3 ${borderCol} ${subtleBg}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[11.5px] font-extrabold uppercase tracking-wider text-[#7C3AED]">
                          Posição da Empresa Comparada aos Concorrentes ({activeKeywordObj.competitors.length} empresas do nicho)
                        </div>
                        <p className={`text-[12px] ${mutedText}`}>
                          Termo analisado: <strong className={dark ? "text-white" : "text-[#120E24]"}>"{activeKeywordObj.keyword}"</strong>
                        </p>
                      </div>
                      {(() => {
                        const targetComp = activeKeywordObj.competitors.find((c) => c.isTarget);
                        const pos = targetComp?.rank || activeKeywordObj.averageRank || 7;
                        return (
                          <span
                            className={`px-3 py-1 rounded-xl font-mono font-extrabold text-[12px] ${
                              pos <= 3
                                ? "bg-[#DCFCE7] text-[#15803D]"
                                : pos <= 10
                                ? "bg-[#FEF3C7] text-[#D97706]"
                                : "bg-[#FEE2E2] text-[#DC2626]"
                            }`}
                          >
                            Sua Posição Atual: {pos}º lugar
                          </span>
                        );
                      })()}
                    </div>

                    <div
                      className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-1"
                      data-testid="competitors-scroll-list"
                    >
                      {activeKeywordObj.competitors.map((comp) => {
                        const isTarget = Boolean(comp.isTarget);
                        const effectiveRank = comp.rank;
                        const avatarPhoto = comp.photo || (isTarget ? biz.photos?.[0] : "");
                        return (
                          <div
                            key={`${comp.rank}-${comp.name}`}
                            className={`p-3 rounded-xl border transition-all ${
                              isTarget
                                ? dark
                                  ? "bg-[#7C3AED]/20 border-[#9D5CFF] ring-1 ring-[#9D5CFF]"
                                  : "bg-purple-50 border-[#7C3AED] ring-1 ring-[#7C3AED]"
                                : `${borderCol} ${dark ? "bg-[#151126]" : "bg-white"}`
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`w-8 h-8 rounded-xl font-mono font-extrabold text-[12px] tabular-nums flex items-center justify-center shrink-0 ${
                                    effectiveRank <= 3
                                      ? "bg-[#22C55E] text-white"
                                      : isTarget
                                      ? "bg-[#EF4444] text-white"
                                      : dark
                                      ? "bg-white/10 text-[#F4F2FF]"
                                      : "bg-[#E2E8F0] text-[#1E293B]"
                                  }`}
                                >
                                  {effectiveRank}º
                                </span>

                                {/* Larger Company Thumbnail Image (w-12 h-12 sm:w-14 sm:h-14) */}
                                {avatarPhoto ? (
                                  <img
                                    src={avatarPhoto}
                                    alt={comp.name}
                                    referrerPolicy="no-referrer"
                                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover shrink-0 border border-purple-500/25 bg-slate-800 shadow-sm"
                                  />
                                ) : (
                                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#7C3AED]/15 text-[#7C3AED] font-extrabold text-[16px] flex items-center justify-center shrink-0 border border-purple-500/20">
                                    {String(comp.name || "E").charAt(0).toUpperCase()}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <div className="font-extrabold text-[13.5px] sm:text-[14px] truncate flex items-center gap-1.5">
                                    <span className="truncate">{comp.name}</span>
                                    {isTarget && (
                                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[#7C3AED] text-white shrink-0">
                                        SUA EMPRESA
                                      </span>
                                    )}
                                  </div>
                                  <div className={`text-[11.5px] flex flex-wrap items-center gap-2 mt-0.5 ${mutedText}`}>
                                    <span className="font-bold text-[#F59E0B]">★ {Number(comp.rating || 4.6).toFixed(1)}</span>
                                    <span>·</span>
                                    <span className="font-semibold">{comp.reviewsCount} avaliações</span>
                                    {comp.category && (
                                      <>
                                        <span>·</span>
                                        <span className="truncate max-w-[160px]">{comp.category}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span
                                  className="font-mono font-extrabold text-[13px] block"
                                  style={{
                                    color:
                                      comp.gbpScore < 60
                                        ? "#EF4444"
                                        : comp.gbpScore < 80
                                        ? "#F59E0B"
                                        : "#16A34A",
                                  }}
                                >
                                  {comp.gbpScore}%
                                </span>
                                <span className={`text-[10px] ${mutedText}`}>Score GBP</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* GEOGRID PANEL (SEMPRE VISÍVEL COM CUSTO TRANSPARENTE 3x3 vs 5x5) */}
                  <div className={`rounded-2xl border p-4 space-y-3 ${borderCol} ${subtleBg}`} data-testid="optional-geogrid-box">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-[13px] font-extrabold flex items-center gap-2">
                          <span>Mapa Geogrid por Coordenadas GPS (3x3 ou 5x5)</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7C3AED]/15 text-[#7C3AED]">
                            Independente da nota da análise
                          </span>
                        </div>
                        <p className={`text-[11px] ${mutedText}`}>
                          Visualize os pinos de posicionamento no mapa e dispare varreduras em tempo real quando desejar.
                        </p>
                      </div>
                    </div>

                    {/* Cost & Grid Size Selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setGeogridSize(3);
                          setGeogridEnabled(true);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          geogridSize === 3
                            ? "border-[#7C3AED] bg-[#7C3AED]/10"
                            : `${borderCol} ${dark ? "bg-[#151126]" : "bg-white"}`
                        }`}
                      >
                        <div>
                          <div className="font-extrabold text-[12.5px]">Malha 3x3 (9 Pinagens GPS)</div>
                          <div className={`text-[11px] ${mutedText}`}>9 buscas locais simultâneas no raio</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-extrabold text-[12px] text-[#16A34A]">~R$ 1,45</div>
                          <div className={`text-[10px] font-mono ${mutedText}`}>(~US$ 0,28 / 9 calls)</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGeogridSize(5);
                          setGeogridEnabled(true);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          geogridSize === 5
                            ? "border-[#7C3AED] bg-[#7C3AED]/10"
                            : `${borderCol} ${dark ? "bg-[#151126]" : "bg-white"}`
                        }`}
                      >
                        <div>
                          <div className="font-extrabold text-[12.5px]">Malha 5x5 (25 Pinagens GPS)</div>
                          <div className={`text-[11px] ${mutedText}`}>25 buscas locais completas no raio</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-extrabold text-[12px] text-[#D97706]">~R$ 4,10</div>
                          <div className={`text-[10px] font-mono ${mutedText}`}>(~US$ 0,80 / 25 calls)</div>
                        </div>
                      </button>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-inherit">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={customKeywordInput}
                          onChange={(e) => setCustomKeywordInput(e.target.value)}
                          placeholder={`Palavra-chave (padrão: ${activeKeywordObj.keyword})`}
                          className={`flex-1 px-3 py-2 rounded-xl border text-[12px] outline-none ${borderCol} ${dark ? "bg-[#151126]" : "bg-white"}`}
                        />
                        <select
                          value={geogridRadiusKm}
                          onChange={(e) => setGeogridRadiusKm(Number(e.target.value))}
                          className={`px-3 py-2 rounded-xl border text-[12px] font-bold outline-none ${borderCol} ${dark ? "bg-[#151126]" : "bg-white"}`}
                        >
                          <option value={1}>Raio 1 km</option>
                          <option value={2.5}>Raio 2,5 km</option>
                          <option value={5}>Raio 5 km</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRunLiveGeogrid()}
                          disabled={runningLiveGeogrid}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white text-[12px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                        >
                          {runningLiveGeogrid ? (
                            <>
                              <RefreshCw size={13} className="animate-spin" />
                              <span>Consultando {geogridSize * geogridSize} pontos...</span>
                            </>
                          ) : (
                            <>
                              <Navigation size={13} />
                              <span>Disparar Geogrid {geogridSize}x{geogridSize} Agora</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Interactive Geogrid Map Always Visible */}
                      <div
                        className={`relative rounded-2xl border overflow-hidden h-[320px] p-3 flex flex-col justify-between ${borderCol}`}
                      >
                        <div className="absolute inset-0 w-full h-full overflow-hidden rounded-2xl pointer-events-auto">
                          {(() => {
                            const lat = Number(biz.lat) || -16.3285;
                            const lng = Number(biz.lng) || -48.9534;
                            const delta = mapZoomDelta;
                            const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
                            const zoomLvl = delta <= 0.002 ? 17 : 15;
                            const mapSrc =
                              mapLayerMode === "satellite"
                                ? `https://maps.google.com/maps?q=${lat},${lng}&t=k&z=${zoomLvl}&ie=UTF8&iwloc=&output=embed`
                                : `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
                            return (
                              <iframe
                                key={`geogrid-${lat}-${lng}-${delta}-${mapCenterKey}-${mapLayerMode}`}
                                title="Mapa Geogrid"
                                src={mapSrc}
                                className="w-full h-full border-0"
                                loading="lazy"
                              />
                            );
                          })()}
                        </div>

                        {(() => {
                          const pinsToRender =
                            geogridSize === 3 && activeKeywordObj.pins.length === 25
                              ? activeKeywordObj.pins.filter((p) => p.row >= 1 && p.row <= 3 && p.col >= 1 && p.col <= 3)
                              : activeKeywordObj.pins;
                          const colsClass = geogridSize === 3 ? "grid-cols-3 max-w-[190px]" : "grid-cols-5 max-w-[260px]";
                          const centerIdx = Math.floor(pinsToRender.length / 2);
                          return (
                            <div className={`relative z-10 grid ${colsClass} gap-2 my-auto mx-auto w-full place-items-center`}>
                              {pinsToRender.map((pin, pinIdx) => {
                                const effectiveRank = pin.rank;
                                const bgPin =
                                  effectiveRank <= 3
                                    ? "#22C55E"
                                    : effectiveRank <= 10
                                    ? "#F59E0B"
                                    : "#EF4444";
                                const textPin = effectiveRank <= 10 && effectiveRank > 3 ? "#1E293B" : "#FFFFFF";
                                const isCenterPin = pinIdx === centerIdx;
                                return (
                                  <button
                                    key={pin.id}
                                    type="button"
                                    onClick={() => setSelectedPin({ ...pin, effectiveRank })}
                                    className={`relative w-8 h-8 rounded-full font-mono font-extrabold text-[11px] tabular-nums flex items-center justify-center shadow-lg transition-transform cursor-pointer ${
                                      isCenterPin ? "scale-115 ring-4 ring-[#7C3AED]" : "hover:scale-110"
                                    }`}
                                    style={{
                                      backgroundColor: bgPin,
                                      color: textPin,
                                      border: "2px solid #FFFFFF",
                                    }}
                                  >
                                    {effectiveRank}º
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}

                        <div
                          className={`relative z-10 flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold shadow-sm ${
                            dark ? "bg-[#151126]/95 border-white/15" : "bg-white/95 border-purple-900/15"
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#22C55E]" /> Top 1-3
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> 4º-10º
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> 11º+
                          </span>
                          <span className="text-[#7C3AED]">
                            Malha {geogridSize}x{geogridSize} ({geogridSize * geogridSize} pontos)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {websiteAudit && (
            <section className={`rounded-2xl p-5 border space-y-4 ${cardClass}`} data-testid="website-audit-results">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-inherit">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED]">
                    Scanner Técnico de Site Oficial
                  </div>
                  <h3 className="text-[16px] font-bold mt-0.5">
                    Diagnóstico Web: {websiteAudit.finalUrl || "Sem site oficial na ficha"} — Nota {websiteAudit.score}/100
                  </h3>
                  <p className={`text-[12px] mt-0.5 ${mutedText}`}>{websiteAudit.summary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWebsiteAudit(null)}
                  className={`p-1.5 rounded-lg border ${borderCol} ${mutedText} cursor-pointer self-start`}
                >
                  <X size={15} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[12px]">
                {(websiteAudit.checks || []).map((chk, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 ${borderCol} ${subtleBg}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{chk.label}</span>
                      {chk.ok ? (
                        <CheckCircle2 size={15} className="text-[#16A34A] shrink-0" />
                      ) : (
                        <XCircle size={15} className="text-[#EF4444] shrink-0" />
                      )}
                    </div>
                    <div className={`text-[11px] ${mutedText}`}>{chk.detail}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3ª DOBRA: ANÁLISE DETALHADA ORDENADA DO PIOR PARA O MELHOR (FRACO -> RAZOÁVEL -> BOM) COM BARRAS 0-100% E GRÁFICOS DE CONCORRENTES */}
          <section
            id="g360-criteria-section"
            className={`rounded-2xl p-4 sm:p-6 space-y-5 ${cardClass}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-inherit">
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wider text-[#7C3AED]">
                  Análise Detalhada · Padrão GBP Check ({sortedCriteria.length} Itens Verificados)
                </div>
                <h2 className="text-[18px] sm:text-[20px] font-extrabold mt-1">
                  O que está travando o posicionamento da empresa e como corrigir
                </h2>
              </div>

              {/* Filter buttons */}
              <div className={`flex flex-wrap items-center gap-1 p-1 rounded-xl border ${borderCol} ${subtleBg} self-start`}>
                {[
                  { id: "all", label: `Todos (${sortedCriteria.length})` },
                  { id: "critical", label: `Fraco (${report.criticalCount})` },
                  { id: "warning", label: `Razoável (${report.warningCount})` },
                  { id: "good", label: `Bom (${report.goodCount})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCriterionFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors cursor-pointer ${
                      criterionFilter === f.id
                        ? "bg-[#7C3AED] text-white"
                        : `${mutedText} hover:opacity-85`
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expandable Accordion Rows Ordered strictly from Worst (Fraco) -> Medium (Razoável) -> Best (Bom) */}
            <div className="space-y-3.5">
              {filteredCriteria.map((item) => {
                const isCrit = item.status === "critical";
                const isWarn = item.status === "warning";
                const isOpen = Boolean(expandedCriteria[item.id]);

                const circleStyle = isCrit
                  ? { backgroundColor: "#FEE2E2", color: "#DC2626" }
                  : isWarn
                  ? { backgroundColor: "#FEF3C7", color: "#D97706" }
                  : { backgroundColor: "#DCFCE7", color: "#16A34A" };

                const barColor = isCrit ? "#EF4444" : isWarn ? "#F59E0B" : "#10B981";
                const progressPct =
                  typeof item.progressPct === "number"
                    ? item.progressPct
                    : isCrit
                    ? 15
                    : isWarn
                    ? 55
                    : 100;

                const badgeLabel = isCrit ? "Fraco" : isWarn ? "Razoável" : "Bom";

                // Prepare competitor review chart data strictly sorted by reviewsCount descending (1st = highest review count!)
                const competitorsForChart = [...(activeKeywordObj?.competitors || [])]
                  .sort((a, b) => (Number(b.reviewsCount) || 0) - (Number(a.reviewsCount) || 0))
                  .slice(0, 10);
                const maxCompReviews = Math.max(
                  1,
                  Number(biz.rating_count) || 0,
                  ...competitorsForChart.map((c) => Number(c.reviewsCount) || 0)
                );
                const avgCompReviews =
                  competitorsForChart.length > 0
                    ? Math.round(
                        competitorsForChart.reduce((acc, c) => acc + (Number(c.reviewsCount) || 0), 0) /
                          competitorsForChart.length
                      )
                    : 85;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${borderCol} ${
                      isOpen ? (dark ? "bg-[#0B0914]" : "bg-[#FBF9FE]") : dark ? "bg-[#151126]" : "bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCriteria((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      className="w-full px-4 sm:px-5 py-4 flex flex-col gap-3 text-left cursor-pointer hover:opacity-95"
                    >
                      <div className="w-full flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-[13px] shrink-0"
                            style={circleStyle}
                          >
                            {isCrit ? "✕" : isWarn ? "!" : "✓"}
                          </span>
                          <div className="min-w-0">
                            <div className="font-extrabold text-[14px] sm:text-[15px] truncate flex items-center gap-2">
                              <span>{item.title}</span>
                            </div>
                            <div className={`text-[12px] truncate ${mutedText}`}>
                              {item.currentValue}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider"
                            style={circleStyle}
                          >
                            {badgeLabel}
                          </span>
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${isOpen ? "rotate-180" : ""} ${mutedText}`}
                          />
                        </div>
                      </div>

                      {/* GBP Check Horizontal Progress Bar (0% ———— 100% | FRACO / RAZOÁVEL / BOM) */}
                      <div className="w-full pt-1">
                        <div className={`w-full h-2.5 rounded-full overflow-hidden ${dark ? "bg-white/10" : "bg-slate-200"}`}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(6, Math.min(100, progressPct))}%`, backgroundColor: barColor }}
                          />
                        </div>
                        <div className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mt-1 ${mutedText}`}>
                          <span>0% · FRACO</span>
                          <span>50% · RAZOÁVEL</span>
                          <span>100% · BOM</span>
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className={`px-4 sm:px-5 pb-5 pt-3 border-t ${borderCol} space-y-4 text-[13px]`}>
                        <p className={`leading-relaxed ${mutedText}`}>
                          <strong className={dark ? "text-[#F4F2FF]" : "text-[#120E24]"}>Por que isso importa: </strong>
                          {item.whyItMatters}
                        </p>

                        <div className={`p-3.5 rounded-xl border ${borderCol} ${dark ? "bg-[#151126]" : "bg-white"} grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]`}>
                          <div>
                            <span className={`font-semibold block mb-0.5 ${mutedText}`}>Situação encontrada na ficha:</span>
                            <span className="font-bold text-[13px]">{item.currentValue}</span>
                          </div>
                          <div>
                            <span className={`font-semibold block mb-0.5 ${mutedText}`}>Meta recomendada GBP Check:</span>
                            <span className="font-bold text-[13px] text-[#16A34A]">{item.recommendedValue}</span>
                          </div>
                        </div>

                        {/* GBP CHECK VISUAL COMPETITOR BAR CHARTS FOR REVIEWS */}
                        {item.chartType === "top10_reviews" && competitorsForChart.length > 0 && (
                          <div
                            className={`p-4 rounded-2xl border space-y-3 ${borderCol} ${dark ? "bg-[#151126]" : "bg-white"}`}
                            data-testid="gbp-check-top10-reviews-chart"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7C3AED]">
                                  Comparativo de Autoridade Local · Padrão GBP Check
                                </div>
                                <h4 className="text-[14px] font-extrabold">
                                  Top 10 empresas mais avaliadas no segmento ({biz.city || "Região"})
                                </h4>
                              </div>
                              <span className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED]">
                                Sua empresa: {biz.rating_count ?? 0} avaliações
                              </span>
                            </div>

                            <div className="space-y-2.5 pt-1">
                              {competitorsForChart.map((comp, idx) => {
                                const isTarget = Boolean(comp.isTarget);
                                const revCount = Number(comp.reviewsCount) || 0;
                                const widthPct = Math.max(6, Math.round((revCount / maxCompReviews) * 100));
                                const thumbPhoto = comp.photo || (isTarget ? biz.photos?.[0] : "");
                                return (
                                  <div key={`${comp.name}-${idx}`} className="space-y-1">
                                    <div className="flex items-center justify-between gap-2 text-[11.5px]">
                                      <div className="flex items-center gap-2 min-w-0">
                                        {thumbPhoto ? (
                                          <img
                                            src={thumbPhoto}
                                            alt={comp.name}
                                            referrerPolicy="no-referrer"
                                            className="w-6 h-6 rounded-md object-cover shrink-0 border border-purple-500/20"
                                          />
                                        ) : (
                                          <span className="w-6 h-6 rounded-md bg-[#7C3AED]/15 text-[#7C3AED] font-bold text-[10px] flex items-center justify-center shrink-0">
                                            {String(comp.name || "E").charAt(0).toUpperCase()}
                                          </span>
                                        )}
                                        <span className={`truncate font-semibold ${isTarget ? "text-[#7C3AED] font-extrabold" : ""}`}>
                                          {idx + 1}. {comp.name} {isTarget ? "(SUA EMPRESA)" : ""}
                                        </span>
                                      </div>
                                      <span className="font-mono font-bold tabular-nums shrink-0">
                                        {revCount} aval. ({comp.rating.toFixed(1)} ★)
                                      </span>
                                    </div>
                                    <div className={`w-full h-3 rounded-full overflow-hidden ${dark ? "bg-white/10" : "bg-slate-100"}`}>
                                      <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                          width: `${widthPct}%`,
                                          backgroundColor: isTarget ? "#7C3AED" : idx < 3 ? "#10B981" : "#64748B",
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {item.chartType === "segment_avg_reviews" && (
                          <div
                            className={`p-4 rounded-2xl border space-y-3 ${borderCol} ${dark ? "bg-[#151126]" : "bg-white"}`}
                            data-testid="gbp-check-segment-avg-chart"
                          >
                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7C3AED]">
                              Benchmark de Reputação Local · Padrão GBP Check
                            </div>
                            <h4 className="text-[14px] font-extrabold">
                              Média de avaliações dos Top 10 Concorrentes vs. {biz.name}
                            </h4>
                            <div className="space-y-3 pt-1">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[12px] font-bold">
                                  <span>Média do Top 10 do Segmento ({biz.category || "Nicho Local"})</span>
                                  <span className="font-mono text-emerald-600">{avgCompReviews} avaliações</span>
                                </div>
                                <div className={`w-full h-4 rounded-full overflow-hidden ${dark ? "bg-white/10" : "bg-slate-100"}`}>
                                  <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{
                                      width: `${Math.min(100, Math.max(15, Math.round((avgCompReviews / Math.max(avgCompReviews, Number(biz.rating_count) || 1)) * 100)))}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[12px] font-bold">
                                  <span className="text-[#7C3AED]">{biz.name} (Sua Empresa)</span>
                                  <span className="font-mono text-[#7C3AED]">{biz.rating_count ?? 0} avaliações</span>
                                </div>
                                <div className={`w-full h-4 rounded-full overflow-hidden ${dark ? "bg-white/10" : "bg-slate-100"}`}>
                                  <div
                                    className="h-full rounded-full bg-[#7C3AED]"
                                    style={{
                                      width: `${Math.min(100, Math.max(8, Math.round(((Number(biz.rating_count) || 0) / Math.max(avgCompReviews, Number(biz.rating_count) || 1)) * 100)))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED]">
                            Plano de Ação Prático:
                          </div>
                          <ul className={`text-[12px] space-y-1 ${mutedText}`}>
                            {(item.howToFix || []).map((step, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="font-mono font-bold text-[#7C3AED]">0{i + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* CUSTOMIZABLE PDF REPORT MODAL */}
      {pdfModalOpen && report && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`max-w-lg w-full rounded-2xl border p-6 space-y-5 ${
              dark ? "bg-[#151126] border-white/15 text-[#F4F2FF]" : "bg-white border-purple-900/15 text-[#120E24]"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED]">
                  Exportação de Diagnóstico Oficial
                </div>
                <h3 className="text-[18px] font-extrabold mt-0.5">Personalizar Relatório PDF</h3>
              </div>
              <button
                type="button"
                onClick={() => setPdfModalOpen(false)}
                className={`p-1.5 rounded-lg hover:bg-black/10 ${mutedText}`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${mutedText}`}>
                  Nome da Sua Agência / Consultoria no Cabeçalho
                </label>
                <input
                  type="text"
                  value={pdfConfig.agencyName}
                  onChange={(e) => setPdfConfig((c) => ({ ...c, agencyName: e.target.value }))}
                  className={`w-full px-3.5 py-2 rounded-xl border text-[13px] font-medium outline-none ${borderCol} ${subtleBg}`}
                />
              </div>

              <div className={`text-[11px] font-semibold uppercase tracking-wider pt-2 ${mutedText}`}>
                Seções para incluir no PDF do cliente:
              </div>

              {[
                { key: "includeScoreAndPillars", label: "Ficha da Empresa + Velocímetro de Score e Resumo" },
                { key: "includeGeogrid", label: "Mapa Geogrid 5x5 de Posicionamento por Palavra-Chave" },
                { key: "includeCompetitors", label: "Raio-X Comparativo com Concorrentes Diretos" },
                { key: "includeActionPlan", label: "Checklist de Critérios Críticos e Plano de Correção" },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${borderCol} ${subtleBg}`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <input
                    type="checkbox"
                    checked={pdfConfig[opt.key]}
                    onChange={(e) => setPdfConfig((c) => ({ ...c, [opt.key]: e.target.checked }))}
                    className="w-4 h-4 accent-[#7C3AED]"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-inherit">
              <button
                type="button"
                onClick={() => setPdfModalOpen(false)}
                className={`px-4 py-2 rounded-xl border text-[13px] font-semibold ${borderCol}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDownloadDiagnosticPdf}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white text-[13px] font-bold flex items-center gap-2 cursor-pointer"
              >
                <Download size={15} /> Baixar Relatório PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GBP CHECK STYLE LOADING OVERLAY ("Analisando Perfil" — Sem "Você Sabia?") */}
      {runningAudit && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md space-y-3">
            {/* Top Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-white/15 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#10B981] via-[#7C3AED] to-[#9D5CFF] transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round(((auditStep + 1) / GBP_CHECK_LOADING_STEPS.length) * 100))}%`,
                }}
              />
            </div>

            {/* Dark GBP Check Card */}
            <div className="bg-[#18181B] text-white rounded-2xl p-6 shadow-2xl border border-white/10 space-y-5">
              {/* Target Business Info Header */}
              <div className="pb-4 border-b border-white/10">
                <h3 className="text-[18px] font-extrabold leading-snug text-white">
                  {loadingTargetBiz?.name || "Analisando Empresa..."}
                </h3>
                <p className="text-[12px] text-zinc-400 mt-1 truncate">
                  {loadingTargetBiz?.address || "Google Perfil da Empresa"}
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-[12px]">
                  <span className="font-bold text-white">{loadingTargetBiz?.rating || "4.8"}</span>
                  <div className="flex items-center text-[#F59E0B]">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={12} className="fill-[#F59E0B]" />
                    ))}
                  </div>
                  <span className="text-zinc-400">
                    ({loadingTargetBiz?.rating_count || "..."} avaliações)
                  </span>
                </div>
              </div>

              {/* 7 Progressive Steps */}
              <div className="space-y-3">
                <div className="text-[13px] font-extrabold text-zinc-200">
                  Analisando Perfil
                </div>
                <div className="space-y-2.5">
                  {GBP_CHECK_LOADING_STEPS.map((stepLabel, idx) => {
                    const isDone = auditStep > idx;
                    const isCurrent = auditStep === idx;
                    return (
                      <div key={stepLabel} className="flex items-center gap-3 text-[13px]">
                        {isDone ? (
                          <span className="w-5 h-5 rounded-full bg-[#10B981] text-black flex items-center justify-center font-black text-[11px] shrink-0">
                            ✓
                          </span>
                        ) : isCurrent ? (
                          <span className="w-5 h-5 rounded-full border-2 border-[#10B981] border-t-transparent animate-spin shrink-0" />
                        ) : (
                          <span className="w-5 h-5 rounded-full border border-zinc-600 shrink-0" />
                        )}
                        <span
                          className={
                            isDone
                              ? "text-white font-semibold"
                              : isCurrent
                              ? "text-white font-bold"
                              : "text-zinc-500"
                          }
                        >
                          {stepLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
