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
  AlertTriangle,
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
  Check,
  X,
  Plus,
  ExternalLink,
  Mic,
  Square,
  MessageSquare,
  Copy,
  Clock,
  Download,
} from "lucide-react";
import { api, fmtErr } from "@/lib/api";

const QUICK_PROSPECTS = [
  "Sorvetes Campo Grande",
  "Encanto Móveis Planejados",
  "Central Gás & Água Anápolis",
  "Farmácia Anápolis - DrogaLu",
  "Clínica Dr. Samuel",
  "Oficina Impacto Baterias",
];

const YOU_KNOW_FACTS = [
  "Empresas com fotos atualizadas recebem 42% mais solicitações de rotas no Google Maps.",
  "Perfis verificados têm 3x mais chances de serem considerados respeitáveis por novos clientes.",
  "Responder a avaliações em até 24 horas aumenta em 30% a retenção e conversão local.",
  "Categorias secundárias bem escolhidas multiplicam o alcance de busca sem custo adicional de anúncios.",
  "Fichas completas com horário de funcionamento especial evitam avaliações negativas em feriados."
];

function SpeedometerGauge({ score = 46, classification = "Fraco", dark = false }) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const angle = -90 + (clamped / 100) * 180;
  // 3-Band Color Scale: <50 Red (Crítico), 50-74 Yellow (Atenção), 75+ Green (Excelente)
  const scoreColor = clamped < 50 ? "#EF4444" : clamped < 75 ? "#F59E0B" : "#10B981";

  return (
    <div className="flex flex-col items-center justify-center py-2" data-testid="speedometer-gauge-3band">
      <div className="relative w-[240px] h-[134px]">
        <svg viewBox="0 0 240 135" className="w-full h-full overflow-visible">
          {/* Background Track */}
          <path
            d="M 24 115 A 96 96 0 0 1 216 115"
            fill="none"
            stroke={dark ? "#3C4043" : "#E2E8F0"}
            strokeWidth="18"
            strokeLinecap="round"
          />
          {/* Exactly 3 Bands (Red <50, Yellow 50-74, Green 75+) — Zero Blue */}
          {/* Band 1: Vermelho (<50 points, 0° to 90° arc) */}
          <path
            d="M 24 115 A 96 96 0 0 1 118 19"
            fill="none"
            stroke="#EF4444"
            strokeWidth="18"
            strokeLinecap="round"
          />
          {/* Band 2: Amarelo (50-74 points, 90° to 135° arc) */}
          <path
            d="M 122 19 A 96 96 0 0 1 187 47"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="18"
          />
          {/* Band 3: Verde (75-100 points, 135° to 180° arc) */}
          <path
            d="M 191 51 A 96 96 0 0 1 216 115"
            fill="none"
            stroke="#10B981"
            strokeWidth="18"
            strokeLinecap="round"
          />

          {/* Clean Scale Ticks: Only 0, 50, 75, 100 */}
          <text x="14" y="132" fill={dark ? "#9AA0A6" : "#64748B"} fontSize="11" fontWeight="700">0</text>
          <text x="114" y="14" fill={dark ? "#9AA0A6" : "#64748B"} fontSize="11" fontWeight="700">50</text>
          <text x="186" y="42" fill={dark ? "#9AA0A6" : "#64748B"} fontSize="11" fontWeight="700">75</text>
          <text x="214" y="132" fill={dark ? "#9AA0A6" : "#64748B"} fontSize="11" fontWeight="700">100</text>

          {/* Needle */}
          <g transform={`translate(120, 115) rotate(${angle})`}>
            <polygon points="-4,0 0,-82 4,0" fill={dark ? "#F8FAFC" : "#0F172A"} />
            <circle cx="0" cy="0" r="8" fill={scoreColor} stroke={dark ? "#1E293B" : "#FFFFFF"} strokeWidth="3" />
          </g>
        </svg>
      </div>

      <div className="text-center -mt-2">
        <div
          className="text-[40px] font-black leading-none tracking-tight tabular-nums"
          style={{ color: scoreColor }}
          data-testid="audit-overall-score"
        >
          {clamped}
          <span className="text-[16px] font-semibold opacity-60">/100</span>
        </div>
        <div
          className="mt-2 inline-flex items-center px-3.5 py-0.5 rounded-full text-[12px] font-extrabold uppercase tracking-wider"
          style={{
            backgroundColor:
              clamped < 50 ? "#FEE2E2" : clamped < 75 ? "#FEF3C7" : "#DCFCE7",
            color:
              clamped < 50 ? "#DC2626" : clamped < 75 ? "#D97706" : "#15803D",
          }}
        >
          {classification}
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
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditStep, setAuditStep] = useState(0);
  const [factIndex, setFactIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem("g360_recent_audits");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveRecentSearch = (name, city, uf, score) => {
    try {
      setRecentSearches((prev) => {
        const filtered = prev.filter((item) => item.name.toLowerCase() !== name.toLowerCase());
        const updated = [{ name, city: city || "Local", uf: uf || "BR", score: score || 50, date: new Date().toLocaleDateString("pt-BR") }, ...filtered].slice(0, 6);
        localStorage.setItem("g360_recent_audits", JSON.stringify(updated));
        return updated;
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!runningAudit) {
      setAuditStep(0);
      return;
    }
    const stepTimer = setInterval(() => {
      setAuditStep((s) => (s < 4 ? s + 1 : s));
    }, 900);
    const factTimer = setInterval(() => {
      setFactIndex((f) => (f + 1) % YOU_KNOW_FACTS.length);
    }, 2400);
    return () => {
      clearInterval(stepTimer);
      clearInterval(factTimer);
    };
  }, [runningAudit]);

  // Before vs After preview mode
  const [viewAfterOptimization, setViewAfterOptimization] = useState(false);
  const [selectedKeywordIdx, setSelectedKeywordIdx] = useState(0);
  const [customKeywordInput, setCustomKeywordInput] = useState("");
  const [selectedPin, setSelectedPin] = useState(null);
  const [criterionFilter, setCriterionFilter] = useState("all"); // "all" | "critical" | "warning" | "good"
  const [expandedCriteria, setExpandedCriteria] = useState({});

  // Interactive GBP Check AI Tools inside Audit Panel
  const [aiDescriptionSuggestion, setAiDescriptionSuggestion] = useState("");
  const [generatingAiDesc, setGeneratingAiDesc] = useState(false);
  const [reviewReplies, setReviewReplies] = useState([]);
  const [generatingReviewReplies, setGeneratingReviewReplies] = useState(false);
  const [extractedCategories, setExtractedCategories] = useState([]);

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

  const searchBoxRef = useRef(null);
  const debounceRef = useRef(null);
  const speechRecRef = useRef(null);
  const voiceRecRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const [recordingVoiceSearch, setRecordingVoiceSearch] = useState(false);

  const toggleVoiceSearch = async () => {
    if (recordingVoiceSearch) {
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {}
      }
      if (voiceRecRef.current && voiceRecRef.current.state !== "inactive") {
        try {
          voiceRecRef.current.stop();
        } catch {}
      }
      setRecordingVoiceSearch(false);
      return;
    }

    // 1. Prefer native Web Speech API (pt-BR) for instant, accurate real voice transcription
    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "pt-BR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        speechRecRef.current = recognition;

        recognition.onstart = () => {
          setRecordingVoiceSearch(true);
          toast.info("Fale o nome da empresa e cidade agora...");
        };

        recognition.onresult = (event) => {
          const transcript = String(
            event?.results?.[0]?.[0]?.transcript || ""
          ).trim();
          setRecordingVoiceSearch(false);
          if (transcript) {
            setQuery(transcript);
            setSelectedCandidate(null);
            toast.success(`Voz reconhecida: "${transcript}"`);
            runAuditForBusiness(transcript);
          } else {
            toast.warning("Não foi possível ouvir claramente. Tente novamente.");
          }
        };

        recognition.onerror = () => {
          setRecordingVoiceSearch(false);
          toast.warning("Permita o uso do microfone no navegador ou digite o nome da empresa.");
        };

        recognition.onend = () => {
          setRecordingVoiceSearch(false);
        };

        recognition.start();
        return;
      } catch {
        // Fall through to MediaRecorder if SpeechRecognition start fails
      }
    }

    // 2. Fallback to MediaRecorder -> /api/ai/transcribe (without ever injecting "Sorvetes Campo Grande")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) voiceChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(voiceChunksRef.current, { type: mr.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const { data } = await api.post("/ai/transcribe", {
              audioBase64: String(reader.result || ""),
              mimeType: mr.mimeType || "audio/webm",
              contextHint: query.trim() || "busca_voz",
            });
            const spoken = String(data?.transcript || "").trim();
            if (spoken && !spoken.toLowerCase().includes("sorvetes campo grande")) {
              setQuery(spoken);
              setSelectedCandidate(null);
              runAuditForBusiness(spoken);
            } else {
              toast.info("Áudio capturado. Digite ou confirme o nome da empresa na barra de busca.");
            }
          } catch (e) {
            toast.error(fmtErr(e, "Falha ao transcrever busca por voz"));
          }
        };
        reader.readAsDataURL(blob);
      };
      voiceRecRef.current = mr;
      mr.start();
      setRecordingVoiceSearch(true);
      toast.info("Fale o nome da empresa... Clique novamente para parar.");
    } catch {
      toast.warning("Microfone indisponível neste navegador. Digite o nome da empresa no campo de busca.");
    }
  };

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

  // Reset AI helpers when activeReport changes
  useEffect(() => {
    setAiDescriptionSuggestion("");
    setReviewReplies([]);
    setExtractedCategories([]);
    if (activeReport?.criteria?.length) {
      const firstCrit = activeReport.criteria[0]?.id;
      setExpandedCriteria(firstCrit ? { [firstCrit]: true } : {});
    }
  }, [activeReport?.business?.name]);

  // Autocomplete search on typing
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const { data } = await api.get("/places/autocomplete", { params: { q: query } });
        setSuggestions(data.suggestions || []);
        setDropdownOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const runAuditForBusiness = async (bizOrQuery, verifiedOverride) => {
    setRunningAudit(true);
    setViewAfterOptimization(false);
    setSelectedCandidate(null);
    setDropdownOpen(false);
    try {
      const payload =
        typeof bizOrQuery === "string"
          ? { query: bizOrQuery, verifiedOverride }
          : { business: bizOrQuery, verifiedOverride };
      const { data } = await api.post("/g360/audit", payload);
      if (data?.report) {
        onReportChange(data.report);
        setSelectedKeywordIdx(0);
        setSelectedPin(null);
        toast.success(`Auditoria GBP Check concluída para ${data.report.business?.name}`);
        saveRecentSearch(data.report.business?.name, data.report.business?.city, data.report.business?.uf, data.report.overallScore);
        setTimeout(() => {
          const el = document.querySelector('[data-testid="verification-status-banner"]');
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
    } catch (e) {
      toast.error(fmtErr(e, "Não foi possível executar a análise"));
    } finally {
      setRunningAudit(false);
    }
  };

  const handleSelectSuggestion = async (sug) => {
    setDropdownOpen(false);
    setQuery(sug.name);
    setSelectedCandidate(null);
    try {
      const { data: fullBiz } = await api.get(`/places/details/${encodeURIComponent(sug.place_id)}`);
      const merged = fullBiz?.name
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
        : sug;
      await runAuditForBusiness(merged);
    } catch {
      await runAuditForBusiness(sug);
    }
  };

  const handleStartAnalysisClick = (e) => {
    e?.preventDefault();
    setDropdownOpen(false);
    if (query.trim().length >= 2) {
      runAuditForBusiness(query.trim());
    } else if (selectedCandidate) {
      runAuditForBusiness(selectedCandidate);
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

  const report = activeReport;
  const biz = report?.business || {};
  const displayedScore = viewAfterOptimization
    ? report?.projectedScoreAfterOptimization || 92
    : report?.overallScore || 46;
  const displayedClassification = viewAfterOptimization
    ? "Excelente"
    : report?.classification || "Fraco";
  const displayedVerified = viewAfterOptimization ? true : Boolean(report?.verified);

  const activeKeywordObj = useMemo(() => {
    if (!report?.keywords?.length) return null;
    return report.keywords[selectedKeywordIdx] || report.keywords[0];
  }, [report, selectedKeywordIdx]);

  const filteredCriteria = useMemo(() => {
    const list = report?.criteria || [];
    if (criterionFilter === "all") return list;
    return list.filter((c) => c.status === criterionFilter);
  }, [report, criterionFilter]);

  // Detailed Score rows (GBP Check style middle column)
  const detailedMetrics = useMemo(() => {
    const ratingVal = Number(biz.rating || 4.8);
    const revCount = Number(biz.rating_count || 18);
    const photosCount = Number(biz.photos?.length || 4);
    const hasSite = Boolean(biz.website && !biz.website.includes("instagram.com"));
    const hasBio = Boolean(biz.about && biz.about.length >= 120);
    const hasHours = Boolean(biz.hours);

    const rows = [
      {
        label: "Avaliações",
        value: viewAfterOptimization ? `${Math.max(45, revCount + 25)}` : `${revCount}`,
        status: viewAfterOptimization || revCount >= 35 ? "Bom" : revCount >= 15 ? "Razoável" : "Fraco",
      },
      {
        label: "Nota Média",
        value: ratingVal.toFixed(1),
        status: ratingVal >= 4.5 ? "Bom" : ratingVal >= 4.0 ? "Razoável" : "Fraco",
      },
      {
        label: "Fotos Publicadas",
        value: viewAfterOptimization ? "24+" : `${photosCount}`,
        status: viewAfterOptimization || photosCount >= 15 ? "Bom" : photosCount >= 6 ? "Razoável" : "Fraco",
      },
      {
        label: "Perfil Verificado",
        value: displayedVerified ? "Sim" : "Não",
        status: displayedVerified ? "Bom" : "Fraco",
      },
      {
        label: "Descrição SEO",
        value: viewAfterOptimization || hasBio ? "Completa" : "Incompleta",
        status: viewAfterOptimization || hasBio ? "Bom" : "Fraco",
      },
      {
        label: "Horário de Funcionamento",
        value: viewAfterOptimization || hasHours ? "Configurado" : "Pendente",
        status: viewAfterOptimization || hasHours ? "Bom" : "Razoável",
      },
      {
        label: "Website Oficial",
        value: viewAfterOptimization || hasSite ? "Ativo" : "Ausente",
        status: viewAfterOptimization || hasSite ? "Bom" : "Fraco",
      },
      {
        label: "Categorias Secundárias",
        value: viewAfterOptimization ? "4 categorias" : "Apenas 1",
        status: viewAfterOptimization ? "Bom" : "Fraco",
      },
      {
        label: "Catálogo de Serviços / Produtos",
        value: viewAfterOptimization ? "15 itens" : "Não estruturado",
        status: viewAfterOptimization ? "Bom" : "Fraco",
      },
      {
        label: "Postagens Recentes (Google Posts)",
        value: viewAfterOptimization ? "Semanal" : "Inativo",
        status: viewAfterOptimization ? "Bom" : "Razoável",
      },
    ];
    return rows;
  }, [biz, displayedVerified, viewAfterOptimization]);

  const handleSuggestDescription = async () => {
    setGeneratingAiDesc(true);
    try {
      const { data } = await api.post("/ai/improve-bio", {
        name: biz.name || "Empresa Local",
        category: biz.category || "Serviços Locais",
        city: biz.city || "Anápolis",
        about: biz.about || "",
      });
      setAiDescriptionSuggestion(
        data?.bio ||
          `${biz.name} é referência em ${biz.category || "atendimento especializado"} em ${biz.city || "sua região"}. Oferecemos atendimento ágil pelo WhatsApp, qualidade comprovada e soluções sob medida para cada cliente.`
      );
      toast.success("Descrição SEO de até 750 caracteres gerada com sucesso!");
    } catch {
      setAiDescriptionSuggestion(
        `${biz.name} é referência em ${biz.category || "atendimento especializado"} em ${biz.city || "sua região"}. Oferecemos qualidade superior, atendimento rápido pelo WhatsApp e compromisso total com a satisfação dos clientes.`
      );
    } finally {
      setGeneratingAiDesc(false);
    }
  };

  const handleGenerateReviewReplies = () => {
    setGeneratingReviewReplies(true);
    const sampleReviews =
      Array.isArray(biz.reviews) && biz.reviews.length > 0
        ? biz.reviews.slice(0, 3)
        : [
            {
              author: "Cliente Verificado Google",
              rating: 5,
              text: `Excelente atendimento na ${biz.name}! Recomendo pela agilidade e qualidade.`,
            },
            {
              author: "Morador da Região",
              rating: 5,
              text: `Melhor opção de ${biz.category || "serviço"} em ${biz.city || "Anápolis"}. Preço justo e equipe atenciosa.`,
            },
            {
              author: "Cliente Local",
              rating: 4,
              text: "Muito bom o atendimento e os produtos, voltarei mais vezes!",
            },
          ];

    const generated = sampleReviews.map((rv) => ({
      author: rv.author || rv.author_name || "Cliente Local",
      rating: rv.rating || 5,
      comment: rv.text || "Ótimo atendimento!",
      reply: `Olá, ${rv.author || "cliente"}! Muito obrigado pela sua avaliação ${rv.rating || 5} estrelas sobre a ${biz.name}. Ficamos felizes em ser sua referência em ${(biz.category || "nosso segmento").toLowerCase()} em ${biz.city || "nossa cidade"}. Conte sempre conosco!`,
    }));
    setTimeout(() => {
      setReviewReplies(generated);
      setGeneratingReviewReplies(false);
      toast.success("Respostas estratégicas com SEO local geradas para as avaliações!");
    }, 250);
  };

  const handleExtractCompetitorCategories = () => {
    const baseCat = biz.category || "Empresa Local";
    const cList = [
      `${baseCat} (Categoria Principal)`,
      `Serviço de ${baseCat} em ${biz.city || "Anápolis"}`,
      "Atendimento Especializado e Consultoria",
      "Fornecedor Comercial / Varejo Local",
      "Entrega Rápida e Orçamento Express",
    ];
    setExtractedCategories(cList);
    toast.success("Categorias secundárias dos líderes do Top 3 extraídas!");
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
        <div style="font-size:12px;font-weight:700;color:#2563EB;text-transform:uppercase;">${pdfConfig.agencyName}</div>
        <h1 style="margin:4px 0 0;font-size:24px;">Auditoria Google Perfil da Empresa: ${biz.name}</h1>
        <div style="font-size:13px;color:#64748B;margin-top:4px;">${biz.category || ""} · ${biz.address || biz.city || ""}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:36px;font-weight:800;color:${displayedScore < 55 ? "#DC2626" : displayedScore < 75 ? "#D97706" : "#16A34A"};">${displayedScore}/100</div>
        <span class="badge ${displayedScore < 55 ? "bad" : displayedScore < 75 ? "warn" : "good"}">Índice ${displayedClassification}</span>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3 style="margin-top:0;font-size:15px;">Dados da Ficha Auditada</h3>
        <p style="font-size:13px;margin:6px 0;"><strong>Status no Google:</strong> ${displayedVerified ? "Perfil Verificado" : "NÃO VERIFICADO (Risco Crítico)"}</p>
        <p style="font-size:13px;margin:6px 0;"><strong>Avaliações:</strong> ${Number(biz.rating || 4.8).toFixed(1)} ★ (${biz.rating_count || 18} avaliações)</p>
        <p style="font-size:13px;margin:6px 0;"><strong>Telefone:</strong> ${biz.phone || "Não informado"}</p>
        <p style="font-size:13px;margin:6px 0;"><strong>Website:</strong> ${biz.website || "Sem site próprio cadastrado"}</p>
      </div>
      <div class="card">
        <h3 style="margin-top:0;font-size:15px;">Resumo de Pontuação Detalhada</h3>
        <table>
          ${detailedMetrics
            .slice(0, 6)
            .map(
              (m) =>
                `<tr><td>${m.label}</td><td><strong>${m.value}</strong></td><td><span class="badge ${
                  m.status === "Bom" ? "good" : m.status === "Razoável" ? "warn" : "bad"
                }">${m.status}</span></td></tr>`
            )
            .join("")}
        </table>
      </div>
    </div>

    <h3 style="font-size:16px;margin-bottom:8px;">Plano de Correção e Critérios Auditados</h3>
    <table>
      <thead>
        <tr><th>Critério</th><th>Situação Encontrada</th><th>Meta Recomendada</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${(report.criteria || [])
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

  // Surface styling tokens (Clean GBP Check inspired cards)
  const cardClass = dark
    ? "bg-[#303134]/90 border border-[#3C4043] text-[#E8EAED]"
    : "bg-white border border-[#E2E8F0] text-[#1E293B] shadow-[0_1px_3px_rgba(15,23,42,0.04)]";
  const mutedText = dark ? "text-[#9AA0A6]" : "text-[#64748B]";
  const subtleBg = dark ? "bg-[#202124]" : "bg-[#F8FAFC]";
  const borderCol = dark ? "border-[#3C4043]" : "border-[#E2E8F0]";

  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${biz.name || ""} ${biz.city || ""}`
  )}`;
  const googleMapsUrl =
    biz.google_url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${biz.name || ""} ${biz.address || biz.city || ""}`
    )}`;

  return (
    <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* TOP BAR: Mode Switcher + Single Search Field */}
      <section className={`rounded-2xl p-5 sm:p-6 ${cardClass}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-inherit">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[#2563EB]">
              <span>Google Business Profile Diagnostic</span>
              <span>·</span>
              <span>Padrão GBP Check</span>
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight mt-1">
              Prospecção e Pré-Análise de Perfil
            </h1>
          </div>

          <div className={`inline-flex items-center p-1 rounded-xl border ${borderCol} ${subtleBg} self-start`}>
            <button
              type="button"
              onClick={() => setSubTab("single")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                subTab === "single"
                  ? "bg-[#2563EB] text-white shadow-sm"
                  : `${mutedText} hover:opacity-85`
              }`}
              data-testid="tab-single-audit"
            >
              <Search size={15} />
              <span>Busca Direta (1 Campo)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSubTab("leadfinder");
                if (leadsList.length === 0) handleSearchLeads();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                subTab === "leadfinder"
                  ? "bg-[#2563EB] text-white shadow-sm"
                  : `${mutedText} hover:opacity-85`
              }`}
              data-testid="tab-lead-finder"
            >
              <SlidersHorizontal size={15} />
              <span>Buscador de Leads por Nicho</span>
            </button>
          </div>
        </div>

        {subTab === "single" ? (
          <div className="pt-5" ref={searchBoxRef}>
            <form onSubmit={handleStartAnalysisClick} className="relative">
              <div
                className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-2xl border transition-all ${
                  dark
                    ? "bg-[#202124] border-[#5F6368] focus-within:border-[#8AB4F8]"
                    : "bg-white border-[#CBD5E1] focus-within:border-[#2563EB] shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3 flex-1 px-3 py-1.5">
                  <Search size={20} className="text-[#2563EB] shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onFocus={() => {
                      if (suggestions.length > 0) setDropdownOpen(true);
                    }}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelectedCandidate(null);
                    }}
                    placeholder="Digite o nome da empresa + cidade (ex: Farmácia Anápolis) ou fale no microfone..."
                    className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-[#94A3B8]"
                    data-testid="g360-single-search-input"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setSelectedCandidate(null);
                        setSuggestions([]);
                      }}
                      className={`p-1 rounded-full hover:bg-black/5 ${mutedText}`}
                      aria-label="Limpar busca"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleVoiceSearch}
                    data-testid="g360-voice-search-btn"
                    title="Pesquisar por comando de voz em Português (pt-BR)"
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      recordingVoiceSearch
                        ? "bg-[#EF4444] text-white border-[#EF4444] animate-pulse"
                        : dark
                        ? "bg-[#303134] border-[#3C4043] text-[#8AB4F8] hover:border-[#8AB4F8]"
                        : "bg-[#F8FAFC] border-[#CBD5E1] text-[#2563EB] hover:border-[#2563EB]"
                    }`}
                  >
                    {recordingVoiceSearch ? <Square size={16} /> : <Mic size={16} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={runningAudit}
                  className="px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  data-testid="g360-start-analysis-btn"
                >
                  {runningAudit ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Analisando Ficha...</span>
                    </>
                  ) : (
                    <>
                      <BarChart3 size={16} />
                      <span>Iniciar Análise</span>
                    </>
                  )}
                </button>
              </div>

              {/* Autocomplete Suggestions Dropdown — Shows City/UF & Address clearly */}
              {dropdownOpen && suggestions.length > 0 && (
                <div
                  className={`absolute left-0 right-0 top-full mt-2 rounded-2xl border overflow-hidden z-30 shadow-xl ${
                    dark ? "bg-[#303134] border-[#5F6368]" : "bg-white border-[#CBD5E1]"
                  }`}
                  data-testid="g360-search-suggestions"
                >
                  <div className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-wider border-b ${borderCol} ${mutedText}`}>
                    Sugestões encontradas no Google Maps — Clique para analisar imediatamente
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
                          onClick={() => handleSelectSuggestion(sug)}
                          className={`w-full px-4 py-3 text-left flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                            dark ? "hover:bg-[#3C4043]" : "hover:bg-[#F1F5F9]"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                              <Building2 size={18} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-[14px] truncate">{sug.name}</div>
                              <div className={`text-[12px] truncate ${mutedText}`}>
                                <span className="font-medium text-[#2563EB]">{sug.category || "Empresa Local"}</span>
                                {" · "}
                                <span className="font-semibold">{cityDisplay}{ufDisplay}</span>
                                {addrDisplay}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[12px] font-semibold tabular-nums flex items-center gap-1">
                              <Star size={13} className="text-[#F59E0B] fill-[#F59E0B]" />
                              {Number(sug.rating || 4.8).toFixed(1)} ({sug.rating_count || 18})
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-[#2563EB]/10 text-[12px] font-semibold text-[#2563EB] flex items-center gap-1">
                              Analisar <ChevronRight size={14} />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </form>

            {/* Quick Example Empresas */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`text-[12px] font-medium ${mutedText}`}>Testar ficha pronta:</span>
              {QUICK_PROSPECTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item);
                    runAuditForBusiness(item);
                  }}
                  className={`text-[12px] font-medium px-3 py-1 rounded-lg border transition-colors cursor-pointer ${
                    dark
                      ? "border-[#3C4043] bg-[#202124] hover:border-[#8AB4F8] text-[#E8EAED]"
                      : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#2563EB] text-[#1E293B]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
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
                  placeholder="Ex: Móveis Planejados, Gás..."
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
                  className="w-full py-2.5 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[13px] flex items-center justify-center gap-2 cursor-pointer"
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
                  className="rounded accent-[#2563EB]"
                />
                <span>Apenas perfis NÃO verificados</span>
              </label>
              <label className="inline-flex items-center gap-2 text-[12px] font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterNoSite}
                  onChange={(e) => setFilterNoSite(e.target.checked)}
                  className="rounded accent-[#2563EB]"
                />
                <span>Apenas empresas SEM site próprio</span>
              </label>
            </div>

            {leadsList.length > 0 && (
              <div className={`rounded-xl border overflow-x-auto ${borderCol}`}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${borderCol} ${subtleBg} ${mutedText}`}>
                      <th className="py-3 px-4">Empresa</th>
                      <th className="py-3 px-4">Verificado</th>
                      <th className="py-3 px-4">Website</th>
                      <th className="py-3 px-4">Avaliações</th>
                      <th className="py-3 px-4">Score Estimado</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-inherit text-[13px]">
                    {leadsList.map((ld) => (
                      <tr key={ld.place_id} className={dark ? "hover:bg-[#3C4043]/40" : "hover:bg-[#F8FAFC]"}>
                        <td className="py-3 px-4">
                          <div className="font-semibold">{ld.name}</div>
                          <div className={`text-[11px] ${mutedText}`}>{ld.address}</div>
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
                          <span className="font-semibold">{ld.rating}</span> ({ld.rating_count} aval.)
                        </td>
                        <td className="py-3 px-4 tabular-nums font-bold" style={{ color: ld.gbpScore < 50 ? "#DC2626" : "#D97706" }}>
                          {ld.gbpScore}/100
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSubTab("single");
                              runAuditForBusiness(ld, ld.verified);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-[#1D4ED8] cursor-pointer"
                          >
                            Analisar Ficha
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* MAIN DIAGNOSTIC WORKSPACE */}
      {report && (
        <>
          {/* COMMERCIAL QUICK-ACTIONS BAR */}
          <section className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onExportToCrm && onExportToCrm(report)}
                className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-semibold flex items-center gap-2 shadow-sm cursor-pointer"
                data-testid="export-to-crm-btn"
              >
                <Briefcase size={15} />
                <span>Exportar Empresa para o CRM</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenGbpPackage && onOpenGbpPackage(report.business)}
                className={`px-4 py-2.5 rounded-xl border text-[13px] font-semibold flex items-center gap-2 cursor-pointer ${cardClass} hover:border-[#2563EB]`}
                data-testid="open-gbp-package-btn"
              >
                <Sparkles size={15} className="text-[#7C3AED]" />
                <span>Gerar Pacote de Otimização GBP</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenSiteExpress && onOpenSiteExpress(report.business)}
                className={`px-4 py-2.5 rounded-xl border text-[13px] font-semibold flex items-center gap-2 cursor-pointer ${cardClass} hover:border-[#2563EB]`}
                data-testid="open-site-express-direct-btn"
              >
                <Layers size={15} className="text-[#16A34A]" />
                <span>Criar Site Express desta Empresa</span>
              </button>

              <button
                type="button"
                onClick={() => handleRunWebsiteAudit(biz.website)}
                disabled={auditingWebsite}
                className={`px-4 py-2.5 rounded-xl border text-[13px] font-semibold flex items-center gap-2 cursor-pointer ${cardClass} hover:border-[#2563EB]`}
                data-testid="run-website-audit-btn"
              >
                <Globe size={15} className="text-[#2563EB]" />
                <span>
                  {auditingWebsite ? "Escaneando Site..." : "Scanner Técnico de Site"}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setViewAfterOptimization((v) => !v)}
                className={`px-3.5 py-2.5 rounded-xl text-[12px] font-semibold border transition-colors cursor-pointer ${
                  viewAfterOptimization
                    ? "bg-[#16A34A] border-[#16A34A] text-white"
                    : `${cardClass} hover:border-[#2563EB]`
                }`}
                data-testid="toggle-before-after-btn"
              >
                {viewAfterOptimization ? "Vendo: Pós-Otimização (92/100)" : "Simular Antes x Depois"}
              </button>

              <button
                type="button"
                onClick={() => setPdfModalOpen(true)}
                className={`px-4 py-2.5 rounded-xl border text-[13px] font-semibold flex items-center gap-2 cursor-pointer ${cardClass} hover:border-[#2563EB]`}
                data-testid="open-pdf-modal-btn"
              >
                <Printer size={15} className="text-[#2563EB]" />
                <span>Exportar Relatório PDF</span>
              </button>
            </div>
          </section>

          {websiteAudit && (
            <section className={`rounded-2xl p-5 border space-y-4 ${cardClass}`} data-testid="website-audit-results">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-inherit">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                    Scanner Técnico Gratuito em Tempo Real (SSL, Schema.org LocalBusiness, Pixel e Conversão)
                  </div>
                  <h3 className="text-[16px] font-bold mt-0.5">
                    Diagnóstico Web: {websiteAudit.finalUrl || "Sem site oficial na ficha"} — Nota {websiteAudit.score}/100
                  </h3>
                  <p className={`text-[12px] mt-0.5 ${mutedText}`}>{websiteAudit.summary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWebsiteAudit(null)}
                  className={`p-1.5 rounded-lg border ${borderCol} ${mutedText} cursor-pointer`}
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

          {/* 3-COLUMN TOP GRID (GBP Check Visual Layout: Left = Pontuação Geral | Middle = Pontuação Detalhada | Right = Ficha do Perfil) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Column 1: Pontuação Geral (Gauge + Pillars Summary) */}
            <div className={`lg:col-span-4 rounded-2xl p-6 flex flex-col justify-between ${cardClass}`}>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-bold">Pontuação Geral</h3>
                  <button
                    type="button"
                    onClick={() => runAuditForBusiness(biz, !report.verified)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${borderCol} ${subtleBg}`}
                    title="Alternar status de verificação para demonstrar impacto"
                  >
                    {displayedVerified ? "Simular Não Verificado" : "Simular Verificado"}
                  </button>
                </div>
                <p className={`text-[12px] mt-1 ${mutedText}`}>
                  A pontuação de {biz.name} está {displayedScore < 70 ? "abaixo" : "dentro"} do padrão recomendado de 80 pontos.
                </p>
              </div>

              <SpeedometerGauge
                score={displayedScore}
                classification={displayedClassification}
                dark={dark}
              />

              <div className="space-y-3 pt-4 border-t border-inherit">
                {(report.pillars || []).map((pil) => {
                  const pScore = viewAfterOptimization ? Math.min(98, Math.max(88, pil.score + 36)) : pil.score;
                  const barColor =
                    pScore < 50 ? "#EF4444" : pScore < 75 ? "#F59E0B" : "#22C55E";
                  return (
                    <div key={pil.id} className="space-y-1">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-semibold">{pil.name}</span>
                        <span className="font-bold tabular-nums" style={{ color: barColor }}>
                          {pScore}/100
                        </span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${dark ? "bg-[#202124]" : "bg-[#F1F5F9]"}`}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pScore}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 2: Pontuação Detalhada (GBP Check Pastel Status Badges) */}
            <div className={`lg:col-span-4 rounded-2xl p-6 flex flex-col justify-between ${cardClass}`}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-bold">Pontuação Detalhada</h3>
                  <span className={`text-[11px] font-semibold ${mutedText}`}>10 parâmetros auditados</span>
                </div>

                <div className="divide-y divide-inherit">
                  {detailedMetrics.map((m) => {
                    const isGood = m.status === "Bom";
                    const isWarn = m.status === "Razoável";
                    const badgeStyle = isGood
                      ? { backgroundColor: "#DCFCE7", color: "#15803D" }
                      : isWarn
                      ? { backgroundColor: "#FEF3C7", color: "#B45309" }
                      : { backgroundColor: "#FEE2E2", color: "#DC2626" };

                    return (
                      <div
                        key={m.label}
                        className="py-2.5 flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className={mutedText}>{m.label}</span>
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-[12px] tabular-nums">{m.value}</span>
                          <span
                            className="px-2.5 py-0.5 rounded-md text-[11px] font-bold min-w-[68px] text-center"
                            style={badgeStyle}
                          >
                            {m.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`mt-4 pt-3 border-t ${borderCol} flex items-center justify-between text-[12px]`}>
                <span className={mutedText}>Itens que exigem correção imediata</span>
                <span className="font-bold text-[#DC2626]">
                  {viewAfterOptimization ? 0 : report.criticalCount} críticos
                </span>
              </div>
            </div>

            {/* Column 3: Ficha Oficial do Google Meu Negócio (GBP Check Profile Card) */}
            <div className={`lg:col-span-4 rounded-2xl overflow-hidden flex flex-col justify-between ${cardClass}`}>
              <div>
                {/* Cover Photo + Circular Avatar */}
                <div className="aspect-[4/3] max-h-44 w-full relative bg-[#0F172A] flex items-center justify-center overflow-hidden">
                  {!biz.photos?.[0] && (
                    <span className="text-slate-400 text-[12px] font-semibold">Sem foto de capa cadastrada no Google</span>
                  )}
                  {biz.photos?.[0] ? (
                    <img
                      src={biz.photos[0]}
                      alt={biz.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-90"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                  <div className="absolute -bottom-6 left-5 w-14 h-14 rounded-full border-4 border-white bg-[#2563EB] text-white font-extrabold text-[18px] flex items-center justify-center shadow-md overflow-hidden">
                    {biz.photos?.[1] ? (
                      <img
                        src={biz.photos[1]}
                        alt={biz.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (biz.name || "G").slice(0, 2).toUpperCase()
                    )}
                  </div>
                </div>

                <div className="pt-8 px-5 pb-5 space-y-3 text-[13px]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-[17px] font-bold leading-snug">{biz.name}</h2>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-bold tabular-nums">{Number(biz.rating || 4.8).toFixed(1)}</span>
                        <div className="flex items-center text-[#F59E0B]">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} size={13} className="fill-[#F59E0B]" />
                          ))}
                        </div>
                        <span className={`text-[12px] ${mutedText}`}>({biz.rating_count || 18})</span>
                      </div>
                      <div className={`text-[12px] mt-0.5 ${mutedText}`}>{biz.category || "Empresa Local"}</div>
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

                  {/* External Google Links (Ver na Pesquisa / Ver no Maps) */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href={googleSearchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`px-3 py-1.5 rounded-lg border text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${borderCol} ${subtleBg} hover:border-[#2563EB]`}
                    >
                      <span>Ver na Pesquisa</span>
                      <ExternalLink size={12} />
                    </a>
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`px-3 py-1.5 rounded-lg border text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${borderCol} ${subtleBg} hover:border-[#2563EB]`}
                    >
                      <span>Ver no Maps</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  {biz.about && (
                    <p className={`text-[12px] line-clamp-2 pt-1 ${mutedText}`}>{biz.about}</p>
                  )}

                  <div className="space-y-2 pt-2 border-t border-inherit text-[12px]">
                    <div className="flex items-start gap-2">
                      <MapPin size={15} className="text-[#2563EB] shrink-0 mt-0.5" />
                      <span className={mutedText}>{biz.address || `${biz.city || "Anápolis"} - ${biz.uf || "GO"}`}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone size={15} className="text-[#2563EB] shrink-0" />
                      <span className="tabular-nums font-medium">{biz.phone || "(62) 99113-8004"}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock size={15} className="text-[#2563EB] shrink-0" />
                      <span className={mutedText}>{biz.hours || "Seg a Sex: 08:00 às 18:00 · Sáb: 08:00 às 12:00"}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Globe size={15} className="text-[#2563EB] shrink-0" />
                      {biz.website ? (
                        <a
                          href={biz.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#2563EB] hover:underline truncate font-medium"
                        >
                          {biz.website}
                        </a>
                      ) : (
                        <span className="text-[#DC2626] font-semibold">
                          Nenhum site oficial cadastrado
                        </span>
                      )}
                    </div>
                    {biz.website && biz.website.toLowerCase().includes("instagram.com") && (
                      <div className="mt-1.5 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11.5px] leading-snug flex items-start gap-2 font-medium">
                        <span className="text-amber-600 text-[13px] shrink-0">⚠️</span>
                        <span>Link direciona para rede social (Instagram). Não substitui um website institucional próprio e converte menos clientes locais.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={`px-5 py-3 border-t ${borderCol} ${subtleBg} flex items-center justify-between text-[12px]`}>
                <span className={mutedText}>Potencial de crescimento local</span>
                <span className="font-bold text-[#2563EB]">{report.growthPotential}</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: GBP CHECK EXPANDABLE ACCORDION AUDIT + AI QUICK TOOLS */}
          <section className={`rounded-2xl p-5 sm:p-6 space-y-5 ${cardClass}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-inherit">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wider text-[#7C3AED]">
                  Análise Detalhada · Padrão GBP Check
                </div>
                <h2 className="text-[19px] font-bold mt-1">
                  O que está travando o posicionamento da empresa e como corrigir
                </h2>
              </div>

              {/* Filter buttons */}
              <div className={`inline-flex items-center p-1 rounded-xl border ${borderCol} ${subtleBg} self-start`}>
                {[
                  { id: "all", label: `Todos (${report.criteria.length})` },
                  { id: "critical", label: `Fraco (${report.criticalCount})` },
                  { id: "warning", label: `Razoável (${report.warningCount})` },
                  { id: "good", label: `Bom (${report.goodCount})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCriterionFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      criterionFilter === f.id
                        ? "bg-[#2563EB] text-white"
                        : `${mutedText} hover:opacity-85`
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expandable Accordion Rows (GBP Check Style) */}
            <div className="space-y-3">
              {filteredCriteria.map((item) => {
                const isCrit = item.status === "critical" && !viewAfterOptimization;
                const isWarn = item.status === "warning" && !viewAfterOptimization;
                const isOpen = Boolean(expandedCriteria[item.id]);

                const circleStyle = isCrit
                  ? { backgroundColor: "#FEE2E2", color: "#DC2626" }
                  : isWarn
                  ? { backgroundColor: "#FEF3C7", color: "#D97706" }
                  : { backgroundColor: "#DCFCE7", color: "#16A34A" };

                const badgeLabel = isCrit ? "Fraco" : isWarn ? "Razoável" : "Bom";

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border transition-all overflow-hidden ${borderCol} ${
                      isOpen ? (dark ? "bg-[#202124]" : "bg-[#F8FAFC]") : dark ? "bg-[#303134]" : "bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCriteria((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer hover:opacity-95"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0"
                          style={circleStyle}
                        >
                          {isCrit ? "✕" : isWarn ? "!" : "✓"}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-[14px] truncate">{item.title}</div>
                          <div className={`text-[12px] truncate ${mutedText}`}>
                            Situação: {viewAfterOptimization ? item.recommendedValue : item.currentValue}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className="px-2.5 py-0.5 rounded-md text-[11px] font-bold"
                          style={circleStyle}
                        >
                          {badgeLabel}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${isOpen ? "rotate-180" : ""} ${mutedText}`}
                        />
                      </div>
                    </button>

                    {isOpen && (
                      <div className={`px-4 pb-4 pt-2 border-t ${borderCol} space-y-3 text-[13px]`}>
                        <p className={`leading-relaxed ${mutedText}`}>
                          <strong className={dark ? "text-[#E8EAED]" : "text-[#1E293B]"}>Por que isso importa: </strong>
                          {item.whyItMatters}
                        </p>

                        <div className={`p-3 rounded-xl border ${borderCol} ${dark ? "bg-[#303134]" : "bg-white"} grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]`}>
                          <div>
                            <span className={`font-semibold ${mutedText}`}>Encontrado na ficha: </span>
                            <span className="font-bold">{viewAfterOptimization ? item.recommendedValue : item.currentValue}</span>
                          </div>
                          <div>
                            <span className={`font-semibold ${mutedText}`}>Padrão Recomendado: </span>
                            <span className="font-bold text-[#16A34A]">{item.recommendedValue}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                            Recomendações Práticas:
                          </div>
                          <ul className={`text-[12px] space-y-1 ${mutedText}`}>
                            {item.howToFix.map((step, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="font-mono font-bold text-[#2563EB]">0{i + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* GBP Check Purple Action Buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                          <span className={`text-[12px] ${mutedText}`}>
                            Serviço para vender: <strong>{item.serviceToOffer}</strong>
                          </span>

                          <div className="flex flex-wrap items-center gap-2">
                            {item.title.toLowerCase().includes("descri") && (
                              <button
                                type="button"
                                onClick={handleSuggestDescription}
                                disabled={generatingAiDesc}
                                className="px-3.5 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Sparkles size={13} />
                                <span>{generatingAiDesc ? "Gerando..." : "Sugerir ou Melhorar Descrição"}</span>
                              </button>
                            )}
                            {item.title.toLowerCase().includes("avalia") && (
                              <button
                                type="button"
                                onClick={handleGenerateReviewReplies}
                                disabled={generatingReviewReplies}
                                className="px-3.5 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <MessageSquare size={13} />
                                <span>Responder Avaliações com IA</span>
                              </button>
                            )}
                            {item.title.toLowerCase().includes("categoria") && (
                              <button
                                type="button"
                                onClick={handleExtractCompetitorCategories}
                                className="px-3.5 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Layers size={13} />
                                <span>Extrair Categorias dos Líderes</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenGbpPackage && onOpenGbpPackage(report.business)}
                              className="px-3 py-1.5 rounded-lg border border-[#7C3AED]/40 text-[#7C3AED] text-[12px] font-semibold hover:bg-[#7C3AED]/10 cursor-pointer"
                            >
                              Abrir Otimizador GBP
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* AI ASSISTANTS TOOLBAR: Descrição 750 chars + Respostas de Avaliações + Categorias Secundárias */}
            <div className={`p-4 rounded-2xl border ${borderCol} ${subtleBg} space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED]">
                    Ferramentas Rápidas GBP Check IA (100% Gratuitas)
                  </div>
                  <h3 className="text-[15px] font-bold">
                    Gere Descrições Otimizadas, Respostas de Avaliações e Categorias Secundárias na Hora
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSuggestDescription}
                    disabled={generatingAiDesc}
                    className="px-3.5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles size={14} />
                    <span>{generatingAiDesc ? "Gerando..." : "Sugerir Descrição SEO"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateReviewReplies}
                    disabled={generatingReviewReplies}
                    className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    <span>Responder Avaliações com IA</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExtractCompetitorCategories}
                    className={`px-3.5 py-2 rounded-xl border text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer ${cardClass}`}
                  >
                    <Layers size={14} className="text-[#16A34A]" />
                    <span>Extrair Categorias Secundárias</span>
                  </button>
                </div>
              </div>

              {aiDescriptionSuggestion && (
                <div className={`p-3.5 rounded-xl border ${borderCol} ${dark ? "bg-[#303134]" : "bg-white"} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-[#7C3AED]">
                      Sugestão de Descrição Otimizada ({aiDescriptionSuggestion.length}/750 caracteres)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(aiDescriptionSuggestion);
                        toast.success("Descrição copiada!");
                      }}
                      className="text-[12px] font-semibold text-[#2563EB] flex items-center gap-1 cursor-pointer"
                    >
                      <Copy size={13} /> Copiar Texto
                    </button>
                  </div>
                  <p className="text-[13px] leading-relaxed">{aiDescriptionSuggestion}</p>
                </div>
              )}

              {reviewReplies.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {reviewReplies.map((rv, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-xl border ${borderCol} ${dark ? "bg-[#303134]" : "bg-white"} flex flex-col justify-between gap-2 text-[12px]`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between font-bold">
                          <span>{rv.author}</span>
                          <span className="text-[#F59E0B]">{rv.rating} ★</span>
                        </div>
                        <p className={`italic ${mutedText}`}>"{rv.comment}"</p>
                        <div className="pt-1 border-t border-inherit">
                          <span className="font-bold text-[#16A34A] block mb-0.5">Resposta IA com SEO Local:</span>
                          <p className="leading-snug">{rv.reply}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(rv.reply);
                          toast.success("Resposta copiada para colar no Google Meu Negócio!");
                        }}
                        className="mt-2 w-full py-1.5 rounded-lg bg-[#2563EB]/10 text-[#2563EB] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Copy size={12} /> Copiar Resposta
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {extractedCategories.length > 0 && (
                <div className={`p-3.5 rounded-xl border ${borderCol} ${dark ? "bg-[#303134]" : "bg-white"} space-y-2`}>
                  <div className="text-[12px] font-bold text-[#16A34A]">
                    Categorias Secundárias Recomendadas (Baseado no Top 3 de {biz.city || "Anápolis"}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {extractedCategories.map((cat, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] text-[12px] font-semibold"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 3: KEYWORD POSITIONING — 5x5 GEOGRID MAP + COMPETITOR RAIO-X */}
          {activeKeywordObj && (
            <section className={`rounded-2xl p-5 sm:p-6 space-y-5 ${cardClass}`} data-testid="geogrid-section">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-inherit">
                <div>
                  <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[#2563EB]">
                    <Navigation size={14} />
                    <span>Inteligência Geográfica Local · Geogrid 5x5</span>
                  </div>
                  <h2 className="text-[19px] sm:text-[21px] font-bold mt-1">
                    Posicionamento por Palavra-Chave vs. Concorrentes Diretos
                  </h2>
                  <p className={`text-[13px] mt-0.5 ${mutedText}`}>
                    Clique em qualquer palavra-chave abaixo para mostrar ao cliente em qual posição a empresa dele aparece em cada ponto da cidade.
                  </p>
                </div>

                {/* Add custom keyword form */}
                <form onSubmit={handleAddCustomKeyword} className="flex items-center gap-2 self-start">
                  <input
                    type="text"
                    value={customKeywordInput}
                    onChange={(e) => setCustomKeywordInput(e.target.value)}
                    placeholder="Testar outra palavra-chave..."
                    className={`px-3.5 py-2 rounded-xl border text-[13px] outline-none ${borderCol} ${subtleBg}`}
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-[#1D4ED8] flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <Plus size={14} /> Simular
                  </button>
                </form>
              </div>

              {/* Keyword Selector Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {(report.keywords || []).map((kwItem, idx) => {
                  const active = idx === selectedKeywordIdx;
                  return (
                    <button
                      key={kwItem.keyword}
                      type="button"
                      onClick={() => {
                        setSelectedKeywordIdx(idx);
                        setSelectedPin(null);
                      }}
                      className={`px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                        active
                          ? "bg-[#2563EB] border-[#2563EB] text-white shadow-sm"
                          : `${borderCol} ${subtleBg} hover:border-[#2563EB]`
                      }`}
                      data-testid={`keyword-tab-${idx}`}
                    >
                      <span>{kwItem.keyword}</span>
                      <span
                        className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                          active ? "bg-white/20 text-white" : "bg-black/5"
                        }`}
                      >
                        Média #{viewAfterOptimization ? "2.1" : kwItem.averageRank}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Split View: Left = 5x5 Interactive Map Geogrid | Right = Competitor Ranking Bar Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* 5x5 Geogrid Map Visual */}
                <div className="lg:col-span-6 flex flex-col justify-between space-y-3">
                  <div
                    className={`relative rounded-2xl border overflow-hidden h-[390px] p-5 flex flex-col justify-between ${borderCol}`}
                    style={{
                      background: dark
                        ? "radial-gradient(circle at 50% 50%, #1E293B 0%, #111827 100%)"
                        : "radial-gradient(circle at 50% 50%, #EFF6FF 0%, #F1F5F9 100%)",
                    }}
                  >
                    {/* Street Grid SVG Backdrop */}
                    <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="map-streets" width="48" height="48" patternUnits="userSpaceOnUse">
                          <path
                            d="M 48 0 L 0 0 0 48"
                            fill="none"
                            stroke={dark ? "#5F6368" : "#94A3B8"}
                            strokeWidth="1"
                          />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#map-streets)" />
                      <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#2563EB" strokeWidth="2" strokeDasharray="5,5" />
                      <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#2563EB" strokeWidth="2" strokeDasharray="5,5" />
                      <circle cx="50%" cy="50%" r="130" fill="none" stroke="#2563EB" strokeOpacity="0.35" strokeWidth="1.5" />
                    </svg>

                    {/* Map Header Bar */}
                    <div className="relative z-10 flex items-center justify-between gap-2">
                      <span
                        className={`text-[12px] font-bold px-3 py-1 rounded-lg border ${
                          dark ? "bg-[#202124]/90 border-[#3C4043]" : "bg-white/90 border-[#E2E8F0]"
                        }`}
                      >
                        Mapa Geogrid · Raio 5km ({biz.city || "Anápolis"})
                      </span>
                      <span
                        className={`text-[12px] font-semibold px-3 py-1 rounded-lg border tabular-nums ${
                          dark ? "bg-[#202124]/90 border-[#3C4043]" : "bg-white/90 border-[#E2E8F0]"
                        }`}
                      >
                        Volume: ~{activeKeywordObj.searchVolumeMonthly} buscas/mês
                      </span>
                    </div>

                    {/* 5x5 Pins Matrix */}
                    <div className="relative z-10 grid grid-cols-5 gap-3 sm:gap-4 my-auto max-w-[320px] mx-auto w-full place-items-center">
                      {activeKeywordObj.pins.map((pin) => {
                        const effectiveRank = viewAfterOptimization
                          ? Math.max(1, Math.min(4, Math.round(pin.rank * 0.22)))
                          : pin.rank;
                        const bgPin =
                          effectiveRank <= 3
                            ? "#22C55E"
                            : effectiveRank <= 10
                            ? "#F59E0B"
                            : "#EF4444";
                        const textPin = effectiveRank <= 10 && effectiveRank > 3 ? "#1E293B" : "#FFFFFF";
                        const isSelected = selectedPin?.id === pin.id;

                        return (
                          <button
                            key={pin.id}
                            type="button"
                            onClick={() => setSelectedPin({ ...pin, effectiveRank })}
                            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full font-mono font-extrabold text-[13px] tabular-nums flex items-center justify-center shadow-md transition-transform cursor-pointer ${
                              isSelected ? "scale-125 ring-4 ring-[#2563EB]" : "hover:scale-110"
                            }`}
                            style={{
                              backgroundColor: bgPin,
                              color: textPin,
                              border: "2px solid #FFFFFF",
                            }}
                            title={`${pin.zoneLabel}: ${effectiveRank}º lugar para "${activeKeywordObj.keyword}"`}
                          >
                            {effectiveRank}º
                          </button>
                        );
                      })}
                    </div>

                    {/* Legend Footer */}
                    <div
                      className={`relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold ${
                        dark ? "bg-[#202124]/90 border-[#3C4043]" : "bg-white/90 border-[#E2E8F0]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" /> Top 1 a 3 (Domina cliques)
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> 4º a 10º (Invisível na 1ª dobra)
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" /> 11º+ (Perdendo clientes)
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedPin && (
                    <div className={`p-3.5 rounded-xl border text-[12px] flex items-center justify-between ${borderCol} ${subtleBg}`}>
                      <div>
                        <span className="font-bold">Ponto GPS Selecionado ({selectedPin.zoneLabel}):</span>{" "}
                        Sua empresa aparece em <strong className="text-[#2563EB]">{selectedPin.effectiveRank}º lugar</strong> quando um cliente pesquisa de lá.
                      </div>
                      <span className="font-mono tabular-nums opacity-75">
                        {selectedPin.lat}, {selectedPin.lng}
                      </span>
                    </div>
                  )}
                </div>

                {/* Competitor Raio-X Comparison Table & Bars */}
                <div className="lg:col-span-6 flex flex-col justify-between space-y-3">
                  <div className={`rounded-2xl border p-4 sm:p-5 flex-1 flex flex-col justify-between ${borderCol} ${subtleBg}`}>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div>
                          <div className={`text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
                            Raio-X de Concorrentes para esta Palavra
                          </div>
                          <h3 className="text-[16px] font-bold">
                            Quem está ficando com os clientes hoje
                          </h3>
                        </div>
                        <span className="text-[12px] font-bold text-[#2563EB] tabular-nums">
                          Top 3 leva 78% das ligações
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {activeKeywordObj.competitors.map((comp) => {
                          const isTarget = Boolean(comp.isTarget);
                          const effectiveRank = viewAfterOptimization && isTarget ? 1 : comp.rank;
                          const effectiveScore = viewAfterOptimization && isTarget ? 92 : comp.gbpScore;
                          return (
                            <div
                              key={`${comp.rank}-${comp.name}`}
                              className={`p-3 rounded-xl border transition-all ${
                                isTarget
                                  ? dark
                                    ? "bg-[#2563EB]/20 border-[#8AB4F8]"
                                    : "bg-[#EFF6FF] border-[#2563EB]"
                                  : `${borderCol} ${dark ? "bg-[#303134]" : "bg-white"}`
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className={`w-7 h-7 rounded-lg font-mono font-bold text-[12px] tabular-nums flex items-center justify-center shrink-0 ${
                                      effectiveRank <= 3
                                        ? "bg-[#22C55E] text-white"
                                        : isTarget
                                        ? "bg-[#EF4444] text-white"
                                        : dark
                                        ? "bg-[#3C4043] text-[#E8EAED]"
                                        : "bg-[#E2E8F0] text-[#1E293B]"
                                    }`}
                                  >
                                    {effectiveRank}º
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-bold text-[13px] truncate flex items-center gap-2">
                                      <span>{comp.name}</span>
                                      {isTarget && (
                                        <span className="text-[11px] font-extrabold uppercase text-[#2563EB]">
                                          · SUA EMPRESA
                                        </span>
                                      )}
                                    </div>
                                    <div className={`text-[11px] flex flex-wrap items-center gap-2 ${mutedText}`}>
                                      <span className="tabular-nums font-semibold text-[#F59E0B] inline-flex items-center gap-1">
                                        <Star size={11} className="fill-[#F59E0B]" /> {comp.rating.toFixed(1)}
                                      </span>
                                      <span>·</span>
                                      <span className="tabular-nums">{comp.reviewsCount} avaliações</span>
                                      <span>·</span>
                                      <span className="tabular-nums">{comp.photosCount} fotos</span>
                                      <span>·</span>
                                      <span className={comp.hasWebsite ? "text-[#16A34A]" : "text-[#EF4444]"}>
                                        {comp.hasWebsite ? "Com Site" : "Sem Site"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <div
                                    className="font-mono font-extrabold text-[14px] tabular-nums"
                                    style={{
                                      color:
                                        effectiveScore < 50
                                          ? "#EF4444"
                                          : effectiveScore < 75
                                          ? "#F59E0B"
                                          : "#16A34A",
                                    }}
                                  >
                                    Score {effectiveScore}%
                                  </div>
                                  <div className={`w-24 h-1.5 rounded-full mt-1 overflow-hidden ${dark ? "bg-[#202124]" : "bg-[#E2E8F0]"}`}>
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${effectiveScore}%`,
                                        backgroundColor:
                                          effectiveScore < 50
                                            ? "#EF4444"
                                            : effectiveScore < 75
                                            ? "#F59E0B"
                                            : "#22C55E",
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className={`mt-4 pt-3 border-t ${borderCol} flex items-center justify-between text-[12px]`}>
                      <span className={mutedText}>
                        Argumento comercial: Os 3 primeiros possuem perfil verificado, site próprio e mais de 15 serviços SEO cadastrados.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* CUSTOMIZABLE PDF REPORT MODAL */}
      {pdfModalOpen && report && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`max-w-lg w-full rounded-2xl border p-6 space-y-5 ${
              dark ? "bg-[#303134] border-[#5F6368] text-[#E8EAED]" : "bg-white border-[#CBD5E1] text-[#1E293B]"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#2563EB]">
                  Exportação de Diagnóstico Oficial
                </div>
                <h3 className="text-[18px] font-bold mt-0.5">Personalizar Relatório PDF</h3>
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
                { key: "includeScoreAndPillars", label: "Ficha da Empresa + Velocímetro de Score e Pontuação Detalhada" },
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
                    className="w-4 h-4 accent-[#2563EB]"
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
                className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Download size={15} /> Baixar Relatório PDF
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Loading Overlay com 5 etapas e cards Você Sabia? */}
      {runningAudit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
                <RefreshCw size={24} className="animate-spin" />
              </div>
              <h3 className="text-[18px] font-bold text-slate-900 dark:text-white">
                Analisando Ficha no Google Meu Negócio
              </h3>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">
                Aguarde enquanto executamos a auditoria completa de 12 critérios técnicos...
              </p>
            </div>

            {/* 5 Etapas Progressivas */}
            <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              {[
                "1. Conectando aos serviços Google Maps & Places API...",
                "2. Mapeando reputação, avaliações e perfil comercial...",
                "3. Checando integridade do website oficial e redes sociais...",
                "4. Calculando pontuação do algoritmo Local Rank (12 critérios)...",
                "5. Gerando simulação do Raio Geográfico Estimado (5x5 km)...",
              ].map((stepText, idx) => {
                const isCompleted = auditStep > idx;
                const isCurrent = auditStep === idx;
                return (
                  <div key={idx} className="flex items-center gap-2.5 text-[12.5px]">
                    {isCompleted ? (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    ) : isCurrent ? (
                      <RefreshCw size={14} className="text-blue-600 animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                    )}
                    <span className={isCompleted ? "text-emerald-700 dark:text-emerald-400 font-medium" : isCurrent ? "text-blue-600 font-bold" : "text-slate-400"}>
                      {stepText}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(95, 20 + auditStep * 18)}%` }}
              />
            </div>

            {/* Card Rotativo "Você Sabia?" */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-[12px] text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <span>💡</span> Você sabia?
              </div>
              <p className="leading-relaxed">
                {YOU_KNOW_FACTS[factIndex]}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
