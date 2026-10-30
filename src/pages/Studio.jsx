import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LogOut,
  Plus,
  Users,
  Settings2,
  ChevronDown,
  ChevronUp,
  Layers,
  Sun,
  Moon,
  BarChart3,
  Sparkles,
  Briefcase,
  ArrowLeftRight,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, fmtErr } from "@/lib/api";
import { Logo } from "@/components/Logo";
import SearchHome from "@/components/SearchHome";
import GmbModal from "@/components/GmbModal";
import TemplateSelector from "@/components/TemplateSelector";
import Editor from "@/components/Editor";
import ClientsPanel from "@/components/ClientsPanel";
import SalesHubPanel from "@/components/SalesHubPanel";
import AiSettingsPanel from "@/components/AiSettingsPanel";
import G360AuditPanel from "@/components/g360/G360AuditPanel";
import G360GbpPackagePanel from "@/components/g360/G360GbpPackagePanel";
import G360CrmFinancePanel from "@/components/g360/G360CrmFinancePanel";
import G360SiteExpressDirectPanel from "@/components/g360/G360SiteExpressDirectPanel";
import G360SaaSSettingsPanel from "@/components/g360/G360SaaSSettingsPanel";
import StudioSidebar from "@/components/StudioSidebar";
import {
  parseSidebarState,
  serializeSidebarState,
  resolveTargetStateForSection,
  resolveTargetStateForNavItem,
  resolveSectionFromView,
} from "@/lib/studioNavigation";
import { createProjectData } from "@/lib/sitegen/projectFactory";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const NAV_STORAGE_KEY = "g360_studio_nav_state_v1";

export default function Studio() {
  const { user, logout } = useAuth();

  // Day & Night Mode (persisted)
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("g360_theme") === "dark";
    } catch {
      return false;
    }
  });

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("g360_theme", next ? "dark" : "light");
      } catch {}
      return next;
    });
  };

  // Persistent Studio Sidebar & View Navigation State
  const [navState, setNavState] = useState(() => {
    try {
      return parseSidebarState(localStorage.getItem(NAV_STORAGE_KEY));
    } catch {
      return parseSidebarState(null);
    }
  });
  const [topHeaderCollapsed, setTopHeaderCollapsed] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_STORAGE_KEY, serializeSidebarState(navState));
    } catch {}
  }, [navState]);

  const productMode = navState.productMode;
  const view = navState.view;
  const crmSubView = navState.crmSubView;
  const leftNavExpanded = navState.sidebarExpanded;
  const activeSection = resolveSectionFromView(view, productMode);

  const setView = useCallback((nextView) => {
    setNavState((prev) => resolveTargetStateForNavItem(nextView, prev));
  }, []);

  const setCrmSubView = useCallback((nextSubView) => {
    setNavState((prev) => ({
      ...prev,
      crmSubView: nextSubView === "folders" ? "folders" : "kanban",
    }));
  }, []);

  const setProductMode = useCallback((nextMode) => {
    setNavState((prev) => {
      const mode = nextMode === "site-express-standalone" ? "site-express-standalone" : "g360";
      const defaultView = mode === "site-express-standalone" ? "home" : "audit";
      return {
        ...prev,
        productMode: mode,
        activeSection: "workspace",
        view: defaultView,
      };
    });
  }, []);

  const setLeftNavExpanded = useCallback((updater) => {
    setNavState((prev) => {
      const nextExpanded = typeof updater === "function" ? updater(prev.sidebarExpanded) : Boolean(updater);
      return {
        ...prev,
        sidebarExpanded: nextExpanded,
      };
    });
  }, []);

  const handleSelectSection = useCallback((sectionId) => {
    setNavState((prev) => resolveTargetStateForSection(sectionId, prev));
  }, []);

  const handleSelectNavItem = useCallback((itemId) => {
    setNavState((prev) => resolveTargetStateForNavItem(itemId, prev));
  }, []);

  // Global AI Health Check Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiHealthReport, setAiHealthReport] = useState(null);

  // Zero-Cost Shield Modal (Escudo R$ 0,00)
  const [shieldModalOpen, setShieldModalOpen] = useState(false);
  const [shieldReport, setShieldReport] = useState(null);
  const [loadingShield, setLoadingShield] = useState(false);

  const loadZeroCostShield = useCallback(async () => {
    setLoadingShield(true);
    try {
      const { data } = await api.get("/g360/zero-cost-shield");
      setShieldReport(data);
    } catch {
      // silent fallback
    } finally {
      setLoadingShield(false);
    }
  }, []);

  useEffect(() => {
    loadZeroCostShield();
  }, [loadZeroCostShield]);

  const handleToggleZeroCostShield = async (enableFreeMode) => {
    setLoadingShield(true);
    try {
      await api.post("/g360/zero-cost-shield", {
        strictFreeMode: enableFreeMode,
        blockPaidGoogleSkus: enableFreeMode,
      });
      await loadZeroCostShield();
      toast.success(
        enableFreeMode
          ? "Escudo Custo Zero (R$ 0,00) ATIVADO! Todas as chamadas pagas do Google Cloud estão bloqueadas."
          : "Modo de APIs pagas do Google Cloud liberado manualmente."
      );
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao atualizar o Escudo Custo Zero"));
    } finally {
      setLoadingShield(false);
    }
  };

  const handleRunGlobalAiTest = async () => {
    setAiModalOpen(true);
    setTestingAi(true);
    try {
      const { data } = await api.post("/g360/ai-health-check", {});
      setAiHealthReport(data);
      if (data?.activeCount > 0) {
        toast.success(`${data.activeCount} provedor(es) de IA ativos e respondendo em tempo real (Custo R$ 0,00)!`);
      } else {
        toast.error("Nenhum provedor de IA respondeu. Verifique as chaves em Acessos e Deploy.");
      }
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao testar conexão com as IAs"));
    } finally {
      setTestingAi(false);
    }
  };

  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [checking, setChecking] = useState(null);
  const [templateBiz, setTemplateBiz] = useState(null);
  const [selectedTplId, setSelectedTplId] = useState("");
  const [activeAuditReport, setActiveAuditReport] = useState(null);
  const [activeBusiness, setActiveBusiness] = useState(null);

  const loadProjects = useCallback(async () => {
    try {
      const { data } = await api.get("/projects");
      setProjects(data.projects || []);
    } catch (e) {
      toast.error(fmtErr(e, "Não foi possível carregar os projetos"));
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const pickSuggestion = async (sug) => {
    try {
      const { data } = await api.get(`/places/details/${encodeURIComponent(sug.place_id)}`);
      setChecking(data);
    } catch (e) {
      toast.error(fmtErr(e, "Falha ao carregar a ficha da empresa"));
    }
  };

  const confirmGenerate = async (business, archetype, templateId = "") => {
    const data = createProjectData(business, archetype, templateId);
    try {
      const { data: created } = await api.post("/projects", {
        name: business.name,
        archetype: data.archetype,
        data,
      });
      try {
        await api.post("/g360/gbp-package/sync-site", {
          businessName: business.name,
          websiteUrl: `${window.location.origin}/site/${created.slug}`,
          projectSlug: created.slug,
        });
      } catch {
        // non-blocking sync
      }
      try {
        const { auth: fbAuth, saveLandingPageToFirestore } = await import("@/firebase");
        if (fbAuth.currentUser) {
          await saveLandingPageToFirestore(created);
        }
      } catch (fbErr) {
        console.warn("Firestore landing page auto-sync skipped:", fbErr);
      }
      setChecking(null);
      setTemplateBiz(null);
      setProject(created);
      setView("editor");
      loadProjects();
      toast.success("Site oficial gerado e sincronizado com o Pacote GBP!");
    } catch (e) {
      toast.error(fmtErr(e, "Falha ao criar o projeto"));
    }
  };

  const openTemplatesForBusiness = (biz, tplId) => {
    setChecking(null);
    setTemplateBiz(biz);
    setSelectedTplId(tplId || "");
    setView("templates");
  };

  const saveProject = useCallback(async (proj) => {
    try {
      const { data: saved } = await api.put(`/projects/${proj.id}`, {
        data: proj.data,
        name: proj.name,
        status: proj.status,
      });
      setProjects((ps) => ps.map((p) => (p.id === saved.id ? saved : p)));
      try {
        await api.post("/g360/gbp-package/sync-site", {
          businessName: saved.name || saved.data?.business?.name,
          websiteUrl: `${window.location.origin}/site/${saved.slug}`,
          projectSlug: saved.slug,
        });
      } catch {
        // non-blocking sync
      }
      try {
        const { auth: fbAuth, saveLandingPageToFirestore } = await import("@/firebase");
        if (fbAuth.currentUser) {
          await saveLandingPageToFirestore(saved);
        }
      } catch (fbErr) {
        console.warn("Firestore landing page update skipped:", fbErr);
      }
      return saved;
    } catch (e) {
      toast.error(fmtErr(e, "Falha ao salvar"));
      throw e;
    }
  }, []);

  const handleExportAuditToCrm = async (report) => {
    const biz = report?.business || {};
    try {
      await api.post("/g360/crm/leads", {
        businessName: biz.name || "Empresa Auditada",
        contactName: "Proprietário / Responsável",
        phone: biz.phone || "(62) 99113-8004",
        whatsapp: biz.whatsapp || "",
        city: `${biz.city || "Anápolis"}${biz.uf ? ` - ${biz.uf}` : ""}`,
        address: biz.address || "",
        category: biz.category || "Negócio Local",
        stage: "prospeccao",
        gbpScoreBefore: report?.overallScore || 44,
        gbpScoreAfter: report?.projectedScoreAfterOptimization || 92,
        verified: Boolean(report?.verified),
        hasWebsite: Boolean(biz.website),
        dealValue: 1390,
        notes: `Exportado da Pré-Análise G360 com Score ${report?.overallScore || 44}/100 (${report?.criticalCount || 3} pontos críticos).`,
      });
      toast.success(`${biz.name} exportada para o Funil CRM!`);
      setCrmSubView("kanban");
      setView("crm");
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao exportar para o CRM"));
    }
  };

  const handleOpenGbpPackage = (biz) => {
    if (biz) setActiveBusiness(biz);
    setView("gbp-package");
  };

  const handleOpenSiteExpressDirect = (biz, pkgBriefing) => {
    if (biz || pkgBriefing) {
      const base = biz || {
        name: pkgBriefing?.businessName || "Encanto Móveis Planejados",
        category: pkgBriefing?.primaryCategory || "Negócio Local",
        city: pkgBriefing?.city || "Anápolis",
        uf: pkgBriefing?.uf || "GO",
        phone: pkgBriefing?.phone || "(62) 99113-8004",
      };
      const approvedProducts = Array.isArray(pkgBriefing?.products)
        ? pkgBriefing.products.filter(
            (p) => p?.selectedForSite !== false && !String(p?.name || "").includes("[PENDENTE]")
          )
        : [];
      const approvedServices = Array.isArray(pkgBriefing?.services)
        ? pkgBriefing.services.filter((s) => s?.selectedForSite !== false)
        : [];
      const customPhotosUrls = Array.isArray(pkgBriefing?.customPhotos)
        ? pkgBriefing.customPhotos
            .map((c) => (typeof c === "string" ? c : c?.included !== false ? c?.url : null))
            .filter(Boolean)
        : [];
      const mergedPhotos =
        customPhotosUrls.length > 0
          ? customPhotosUrls
          : Array.isArray(base.photos)
          ? base.photos
          : [];

      const enriched = pkgBriefing
        ? {
            ...base,
            bio: pkgBriefing.siteBriefing?.heroSubheadline || pkgBriefing.description750 || base.bio,
            about: pkgBriefing.description750 || base.about,
            heroHeadline: pkgBriefing.siteBriefing?.heroHeadline || base.heroHeadline,
            heroSubheadline: pkgBriefing.siteBriefing?.heroSubheadline || base.heroSubheadline,
            category: pkgBriefing.primaryCategory || base.category,
            photos: mergedPhotos,
            services: approvedServices.length > 0 ? approvedServices : base.services,
            items:
              approvedProducts.length > 0
                ? approvedProducts.map((p, idx) => ({
                    name: p.name,
                    description: p.description,
                    price: p.priceLabel || "Sob consulta",
                    badge: p.category || "Destaque",
                    image: mergedPhotos[idx + 1] || mergedPhotos[0] || undefined,
                  }))
                : base.items,
          }
        : base;
      setActiveBusiness(enriched);
    }
    setView("site-express-direct");
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, productMode]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", dark);
    }
  }, [dark]);

  const bgCanvas = dark ? "#0B0914" : "#F7F4FB";
  const headerClass = dark
    ? "bg-[#120E24]/95 border-white/10 text-[#F4F2FF]"
    : "bg-white/95 border-purple-900/10 text-[#120E24]";

  const g360NavItems = [
    { id: "audit", label: "Prospecção e Auditoria", icon: BarChart3, testId: "nav-g360-audit" },
    { id: "gbp-package", label: "Pacote GBP", icon: Sparkles, testId: "nav-g360-package" },
    { id: "crm-folders", label: "Pastas de Clientes & Vencimentos", icon: FolderOpen, testId: "nav-g360-folders" },
    { id: "crm", label: "Funil CRM & Contratos", icon: Briefcase, testId: "nav-g360-crm" },
    { id: "site-express-direct", label: "Site Express", icon: Layers, testId: "nav-g360-site-express" },
    { id: "saas-settings", label: "Acessos e Deploy", icon: Settings2, testId: "nav-g360-settings" },
  ];

  return (
    <div
      className={`${view === "editor" ? "h-screen overflow-hidden" : "min-h-screen"} w-full max-w-full overflow-x-hidden flex flex-col transition-colors duration-200`}
      data-testid="studio-root"
      style={{ background: bgCanvas, color: dark ? "#F4F2FF" : "#120E24" }}
    >
      {/* COLLAPSIBLE TOP BAR (HIDDEN IN FULL-SCREEN SITE EDITOR) */}
      {!topHeaderCollapsed && view !== "editor" ? (
        <header className={`sticky top-0 z-40 w-full max-w-full backdrop-blur-xl border-b shadow-sm ${headerClass}`}>
          <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Sidebar Toggle + Brand Wordmark */}
            <div className="flex items-center gap-2 shrink-0">
              {view !== "editor" && (
                <button
                  type="button"
                  onClick={() => setLeftNavExpanded((v) => !v)}
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    dark ? "border-white/10 hover:bg-white/5 text-[#A39BBF]" : "border-purple-900/10 hover:bg-purple-50 text-[#5E5775]"
                  }`}
                  title={leftNavExpanded ? "Recolher Menu Lateral" : "Expandir Menu Lateral"}
                  data-testid="toggle-left-sidebar-btn"
                >
                  {leftNavExpanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (productMode === "site-express-standalone") {
                    setView("home");
                  } else {
                    setView("audit");
                  }
                }}
                className="hover:opacity-85 transition-opacity shrink-0 cursor-pointer"
              >
                <Logo light={dark} mode={productMode === "site-express-standalone" ? "site-express" : "g360"} />
              </button>
            </div>

            {/* Center: Concise Single-Line Navigation Links */}
            {productMode === "g360" ? (
              <nav className="flex-1 min-w-0 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
                {g360NavItems.map((navItem) => {
                  const Icon = navItem.icon;
                  const active =
                    navItem.id === "crm-folders"
                      ? view === "crm" && crmSubView === "folders"
                      : navItem.id === "crm"
                      ? view === "crm" && crmSubView !== "folders"
                      : view === navItem.id;
                  return (
                    <button
                      key={navItem.id}
                      type="button"
                      data-testid={navItem.testId}
                      onClick={() => {
                        if (navItem.id === "crm-folders") {
                          handleSelectNavItem("crm-folders");
                        } else if (navItem.id === "crm") {
                          handleSelectNavItem("crm");
                        } else {
                          handleSelectNavItem(navItem.id);
                        }
                      }}
                      className={`flex items-center gap-1.5 text-[12px] sm:text-[12.5px] font-bold px-2.5 sm:px-3 py-1.5 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? "bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white shadow-md"
                          : dark
                          ? "text-[#A39BBF] hover:text-white hover:bg-white/5"
                          : "text-[#5E5775] hover:text-[#120E24] hover:bg-purple-50"
                      }`}
                    >
                      <Icon size={14} />
                      <span>{navItem.label}</span>
                    </button>
                  );
                })}
              </nav>
            ) : (
              /* Standalone Site Express Navigation */
              <nav className="flex-1 min-w-0 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  data-testid="nav-new-site"
                  onClick={() => setView("home")}
                  className={`flex items-center gap-2 text-[12.5px] font-bold px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    view === "home"
                      ? "bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white"
                      : dark
                      ? "text-[#A39BBF] hover:bg-white/5"
                      : "text-[#5E5775] hover:bg-purple-50"
                  }`}
                >
                  <Plus size={14} /> <span>Novo Site</span>
                </button>
                <button
                  type="button"
                  data-testid="nav-templates"
                  onClick={() => setView("templates")}
                  className={`flex items-center gap-2 text-[12.5px] font-bold px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    view === "templates"
                      ? "bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white"
                      : dark
                      ? "text-[#A39BBF] hover:bg-white/5"
                      : "text-[#5E5775] hover:bg-purple-50"
                  }`}
                >
                  <Layers size={14} /> <span>Modelos (7)</span>
                </button>
                <button
                  type="button"
                  data-testid="nav-clients"
                  onClick={() => {
                    setView("clients");
                    loadProjects();
                  }}
                  className={`flex items-center gap-2 text-[12.5px] font-bold px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    view === "clients"
                      ? "bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white"
                      : dark
                      ? "text-[#A39BBF] hover:bg-white/5"
                      : "text-[#5E5775] hover:bg-purple-50"
                  }`}
                >
                  <Users size={14} /> <span>Meus Sites</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProductMode("g360");
                    setView("audit");
                  }}
                  className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-xl border border-[#7C3AED] text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowLeftRight size={13} /> <span>Voltar ao G360 Completo</span>
                </button>
              </nav>
            )}

            {/* Right: Escudo R$ 0,00 + Testar IAs + Day/Night Toggle + Collapse Top Bar + User Menu */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShieldModalOpen(true);
                  loadZeroCostShield();
                }}
                data-testid="zero-cost-shield-btn"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-[11.5px] font-extrabold transition-colors cursor-pointer shadow-sm"
                title="Escudo Custo Zero (R$ 0,00) — Bloqueia cobranças do Google Cloud (My Project 11343)"
              >
                <ShieldCheck size={14} />
                <span>Escudo R$ 0,00</span>
              </button>

              <button
                type="button"
                onClick={handleRunGlobalAiTest}
                data-testid="global-ai-test-btn"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 text-[11.5px] font-extrabold transition-colors cursor-pointer"
                title="Testar conexão em tempo real com Gemini Free, Groq, OpenRouter, NVIDIA e Outscraper (R$ 0,00)"
              >
                <Activity size={14} />
                <span className="hidden xl:inline">Testar IAs</span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                data-testid="theme-day-night-toggle"
                aria-label={dark ? "Ativar Modo Dia" : "Ativar Modo Noite"}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11.5px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  dark
                    ? "bg-[#151126] border-white/10 text-[#F4F2FF] hover:border-[#9D5CFF]"
                    : "bg-[#FBF9FE] border-purple-900/10 text-[#120E24] hover:border-[#7C3AED]"
                }`}
              >
                {dark ? (
                  <>
                    <Sun size={14} className="text-[#FBBC04]" />
                    <span className="hidden md:inline">Modo Dia</span>
                  </>
                ) : (
                  <>
                    <Moon size={14} className="text-[#7C3AED]" />
                    <span className="hidden md:inline">Modo Noite</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setTopHeaderCollapsed(true)}
                className={`p-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${
                  dark ? "border-white/10 text-[#A39BBF] hover:bg-white/5" : "border-purple-900/10 text-[#5E5775] hover:bg-purple-50"
                }`}
                title="Recolher barra superior para ganhar mais espaço de tela"
                data-testid="collapse-top-header-btn"
              >
                <ChevronUp size={15} />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid="user-menu-button"
                    aria-label="Menu do usuário"
                    className={`flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full border transition-colors cursor-pointer ${
                      dark
                        ? "border-white/10 bg-[#151126] hover:bg-white/10"
                        : "border-purple-900/10 bg-white hover:bg-purple-50"
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] text-white text-[10.5px] font-bold grid place-items-center">
                      {(user?.name || "U")
                        .split(" ")
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")}
                    </span>
                    <ChevronDown size={13} className={dark ? "text-[#A39BBF]" : "text-[#5E5775]"} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <div className="px-3 py-2.5">
                    <div className="text-[13px] font-bold text-slate-900" data-testid="user-menu-name">
                      {user?.name}
                    </div>
                    <div className="text-[11.5px] text-slate-500 truncate">{user?.email}</div>
                  </div>
                  <DropdownMenuItem
                    onClick={() => {
                      if (productMode === "g360") {
                        setProductMode("site-express-standalone");
                      } else {
                        setProductMode("g360");
                      }
                    }}
                    className="cursor-pointer font-medium"
                  >
                    <ArrowLeftRight size={14} className="mr-2 text-[#7C3AED]" />
                    {productMode === "g360"
                      ? "Alternar p/ Site Express Separado"
                      : "Alternar p/ G360 Completo"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="logout-button"
                    onClick={logout}
                    className="text-red-600 focus:text-red-600 cursor-pointer"
                  >
                    <LogOut size={14} className="mr-2" /> Sair da Conta
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
      ) : view !== "editor" ? (
        /* Ultra-slim floating expand bar when top header is collapsed */
        <div className="fixed top-2 right-3 z-50 flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="px-2.5 py-1 rounded-full bg-slate-900/90 text-white text-[11px] font-bold flex items-center gap-1 shadow-lg border border-white/15 cursor-pointer"
          >
            {dark ? <Sun size={12} className="text-amber-400" /> : <Moon size={12} className="text-purple-400" />}
            <span>{dark ? "Dia" : "Noite"}</span>
          </button>
          <button
            type="button"
            onClick={() => setTopHeaderCollapsed(false)}
            className="px-3 py-1 rounded-full bg-[#7C3AED] text-white text-[11px] font-extrabold flex items-center gap-1 shadow-lg cursor-pointer"
            data-testid="expand-top-header-btn"
          >
            <ChevronDown size={13} />
            <span>Mostrar Menu Topo</span>
          </button>
        </div>
      ) : null}

      {/* WORKSPACE BODY WITH PERSISTENT STUDIO SIDEBAR */}
      <div className="flex-1 flex min-h-0 relative" data-active-section={activeSection}>
        {view !== "editor" && (
          <StudioSidebar
            dark={dark}
            navState={navState}
            projectsCount={projects.length}
            activeBusinessName={activeBusiness?.name || activeAuditReport?.business?.name}
            onSelectSection={handleSelectSection}
            onSelectNavItem={(itemId) => {
              if (itemId === "clients") {
                loadProjects();
              }
              handleSelectNavItem(itemId);
            }}
            onToggleExpand={() => setLeftNavExpanded((v) => !v)}
            onRunGlobalAiTest={handleRunGlobalAiTest}
            onToggleProductMode={() => {
              if (productMode === "g360") {
                setProductMode("site-express-standalone");
                toast.success("Modo Site Express Separado ativado.");
              } else {
                setProductMode("g360");
                toast.success("Modo G360 Completo ativado.");
              }
            }}
          />
        )}

        {/* MAIN WORKSPACE CONTENT */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {productMode === "g360" ? (
            <>
              {view === "audit" && (
                <G360AuditPanel
                  dark={dark}
                  activeReport={activeAuditReport}
                  onReportChange={(rep) => {
                    setActiveAuditReport(rep);
                    if (rep?.business) setActiveBusiness(rep.business);
                  }}
                  onExportToCrm={handleExportAuditToCrm}
                  onOpenGbpPackage={handleOpenGbpPackage}
                  onOpenSiteExpress={handleOpenSiteExpressDirect}
                />
              )}

              {view === "gbp-package" && (
                <G360GbpPackagePanel
                  dark={dark}
                  activeBusiness={activeBusiness || activeAuditReport?.business}
                  onOpenSiteExpressWithBriefing={handleOpenSiteExpressDirect}
                />
              )}

              {view === "crm" && (
                <G360CrmFinancePanel
                  dark={dark}
                  initialSubView={crmSubView}
                  onOpenGbpPackage={handleOpenGbpPackage}
                  onOpenSiteExpress={handleOpenSiteExpressDirect}
                />
              )}

              {view === "site-express-direct" && (
                <G360SiteExpressDirectPanel
                  dark={dark}
                  activeBusiness={activeBusiness || activeAuditReport?.business}
                  projects={projects}
                  onQuickGenerate={confirmGenerate}
                  onOpenEditor={(p) => {
                    setProject(p);
                    setView("editor");
                  }}
                  onOpenTemplates={openTemplatesForBusiness}
                  onOpenVisualBriefing={(b) => setChecking(b)}
                  onProjectsChanged={loadProjects}
                  onSwitchToStandaloneSiteExpress={() => {
                    setProductMode("site-express-standalone");
                    toast.success("Modo Site Express Separado (Produto Independente) ativado.");
                  }}
                />
              )}

              {view === "clients" && (
                <ClientsPanel
                  projects={projects}
                  onChanged={loadProjects}
                  onEdit={(p) => {
                    setProject(p);
                    setView("editor");
                  }}
                  onNew={() => setView("site-express-direct")}
                  onOpenSalesHub={() => setView("crm")}
                />
              )}

              {view === "saas-settings" && <G360SaaSSettingsPanel dark={dark} />}

              {view === "templates" && (
                <TemplateSelector
                  business={templateBiz || activeBusiness || project?.data?.business || projects[0]?.data?.business}
                  selectedTemplateId={selectedTplId || project?.data?.templateId}
                  onSelectTemplate={confirmGenerate}
                  onBack={() => setView("site-express-direct")}
                />
              )}

              {view === "editor" && project && (
                <Editor
                  project={project}
                  onProject={setProject}
                  onSave={saveProject}
                  dark={dark}
                  onToggleTheme={toggleTheme}
                  onExit={() => {
                    setView("site-express-direct");
                    loadProjects();
                  }}
                />
              )}
            </>
          ) : (
            /* STANDALONE SITE EXPRESS PRODUCT MODE */
            <>
              {view === "home" && (
                <SearchHome
                  onPick={pickSuggestion}
                  onClone={(b) => setChecking(b)}
                  onQuickGenerate={confirmGenerate}
                  onOpenTemplates={openTemplatesForBusiness}
                />
              )}
              {view === "templates" && (
                <TemplateSelector
                  business={templateBiz || project?.data?.business || projects[0]?.data?.business}
                  selectedTemplateId={selectedTplId || project?.data?.templateId}
                  onSelectTemplate={confirmGenerate}
                  onBack={() => {
                    if (templateBiz) setChecking(templateBiz);
                    setView("home");
                  }}
                />
              )}
              {view === "sales" && <SalesHubPanel projects={projects} />}
              {view === "clients" && (
                <ClientsPanel
                  projects={projects}
                  onChanged={loadProjects}
                  onEdit={(p) => {
                    setProject(p);
                    setView("editor");
                  }}
                  onNew={() => setView("home")}
                  onOpenSalesHub={() => setView("sales")}
                />
              )}
              {view === "ai" && <AiSettingsPanel />}
              {view === "saas-settings" && <G360SaaSSettingsPanel dark={dark} />}
              {view === "editor" && project && (
                <Editor
                  project={project}
                  onProject={setProject}
                  onSave={saveProject}
                  dark={dark}
                  onToggleTheme={toggleTheme}
                  onExit={() => {
                    setView("clients");
                    loadProjects();
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* GLOBAL AI HEALTH CHECK MODAL */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`max-w-2xl w-full rounded-2xl border p-6 space-y-4 shadow-2xl ${
              dark ? "bg-[#151126] border-white/15 text-[#F4F2FF]" : "bg-white border-purple-900/15 text-[#120E24]"
            }`}
            data-testid="global-ai-health-modal"
          >
            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <div className="flex items-center gap-2.5">
                <Activity size={20} className="text-emerald-500" />
                <div>
                  <h3 className="text-[17px] font-extrabold">Diagnóstico de Conexão das IAs em Tempo Real</h3>
                  <p className="text-[12px] opacity-75">
                    Teste de ping real nos modelos Gemini 3.8 Flash, Gemini 3.1 Flash-Lite, Groq, OpenRouter, NVIDIA NIM e Google Maps API
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-black/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {testingAi ? (
              <div className="py-10 flex flex-col items-center justify-center gap-3">
                <RefreshCw size={28} className="animate-spin text-[#7C3AED]" />
                <p className="text-[13.5px] font-bold">Disparando chamada real para cada provedor de IA...</p>
              </div>
            ) : aiHealthReport ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[12.5px]">
                  <span className="font-bold">
                    Provedores Online:{" "}
                    <strong className="text-emerald-500">{aiHealthReport.activeCount ?? 0}</strong> de{" "}
                    {aiHealthReport.totalTested ?? aiHealthReport.totalCount ?? (aiHealthReport.providers || []).length}
                  </span>
                  <button
                    type="button"
                    onClick={handleRunGlobalAiTest}
                    className="px-3 py-1 rounded-lg bg-[#7C3AED] text-white text-[11.5px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={12} /> Testar Novamente
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {(aiHealthReport.providers || []).map((p) => {
                    const isOnline = Boolean(p.active ?? p.ok);
                    const sampleText = p.sampleOutput ?? p.sample ?? "OK";
                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl border text-[12px] space-y-1 ${
                          isOnline ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold flex items-center gap-1.5">
                            {isOnline ? (
                              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle size={14} className="text-rose-500 shrink-0" />
                            )}
                            {p.name}
                          </span>
                          <span className="font-mono text-[10.5px] opacity-75">{p.latencyMs}ms</span>
                        </div>
                        <div className="text-[11px] font-mono opacity-75">Modelo: {p.model}</div>
                        <div
                          className={`text-[11px] truncate ${
                            isOnline ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-rose-500"
                          }`}
                        >
                          {isOnline ? `Resposta: "${sampleText}"` : `Status: ${p.error || "Não configurado"}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ESCUDO CUSTO ZERO (R$ 0,00) MODAL */}
      {shieldModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border p-6 space-y-5 shadow-2xl ${
              dark ? "bg-[#151126] border-white/15 text-[#F4F2FF]" : "bg-white border-purple-900/15 text-[#120E24]"
            }`}
            data-testid="zero-cost-shield-modal"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-inherit">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[18px] font-extrabold">Escudo Custo Zero Ativo — Garantia R$ 0,00</h3>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10.5px] font-black uppercase">
                      Bloqueio Total de SKUs Pagos
                    </span>
                  </div>
                  <p className="text-[12.5px] opacity-80">
                    Proteção imediata contra cobranças do Google Cloud Billing (como a fatura de R$ 102,85 no projeto <strong>My Project 11343</strong>).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShieldModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-black/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Por que cobrou R$ 102,85 e o que foi bloqueado */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-[12.5px]">
              <div className="font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <span>🔍 Por que o Google Cloud cobrou R$ 102,85 no seu projeto &ldquo;My Project 11343&rdquo;?</span>
              </div>
              <p className="leading-relaxed opacity-90">
                Quando uma chave do Google está vinculada a um projeto com <strong>Faturamento (Cartão/Billing) ativo</strong> no Google Cloud Console, o Google cobra automaticamente 3 serviços caros (SKUs Enterprise):
              </p>
              <ul className="list-disc pl-5 space-y-1 opacity-90">
                <li>
                  <strong>1. Places API (New) Enterprise Text Search ($35 / 1.000 chamadas):</strong> disparado quando a busca pede telefone, horário, site e avaliações diretamente da API paga do Google Maps.
                </li>
                <li>
                  <strong>2. Places Photo Media API ($7 / 1.000 fotos):</strong> disparado ao carregar fotos de empresas e miniaturas de concorrentes pela rota oficial do Google Maps.
                </li>
                <li>
                  <strong>3. Gemini Google Search Grounding ($35 / 1.000 buscas):</strong> disparado quando o modelo Gemini usa a ferramenta <code>googleSearch: &#123;&#125;</code> em um projeto com Billing ativado.
                </li>
              </ul>
            </div>

            {/* Status dos Bloqueios na Ferramenta */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[13.5px] font-extrabold uppercase tracking-wider opacity-85">
                  1. Bloqueio Automático no Código da Ferramenta (Já Ativo)
                </h4>
                <span className="text-[11.5px] font-bold text-emerald-500">
                  Cache Inteligente 7 dias: {shieldReport?.cachedBusinessesCount ?? 0} buscas salvas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-extrabold">Google Places Enterprise</span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-500 text-[10px] font-black">BLOQUEADO</span>
                  </div>
                  <p className="text-[11px] opacity-80">
                    Substituído por <strong>Outscraper v3 Free Tier</strong> + <strong>Cache 7 Dias</strong>. Custo no GCP: <strong>R$ 0,00</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-extrabold">Google Place Photos SKU</span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-500 text-[10px] font-black">BLOQUEADO</span>
                  </div>
                  <p className="text-[11px] opacity-80">
                    Fotos carregadas direto das URLs públicas (<code>lh3.googleusercontent.com</code>) via Outscraper sem pagar mídia do Maps.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-extrabold">Gemini Search Grounding</span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-500 text-[10px] font-black">BLOQUEADO</span>
                  </div>
                  <p className="text-[11px] opacity-80">
                    A ferramenta paga <code>googleSearch</code> ($35/1k) foi desativada. Usa apenas <strong>Gemini 3.1 Flash-Lite</strong> puro + <strong>Groq/OpenRouter/NVIDIA</strong> gratuitos.
                  </p>
                </div>
              </div>
            </div>

            {/* Passo a Passo no Google Cloud Console do Usuário */}
            <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-2.5 text-[12.5px]">
              <h4 className="text-[13.5px] font-extrabold text-[#7C3AED] dark:text-[#A78BFA]">
                2. Como travar a cobrança lá no seu Google Cloud Console (Em 1 Minuto)
              </h4>
              <p className="opacity-90">
                Além do bloqueio que já ativamos aqui no sistema, faça estes 2 passos na sua conta Google para garantir que o projeto <strong>My Project 11343</strong> nunca mais possa gerar fatura:
              </p>
              <ol className="list-decimal pl-5 space-y-1.5 opacity-95">
                <li>
                  Acesse <strong>console.cloud.google.com/billing</strong> no celular ou computador, toque nos 3 pontinhos ao lado de <strong>My Project 11343</strong> e clique em <strong>&ldquo;Desativar faturamento do projeto&rdquo; (Disable billing)</strong>.
                </li>
                <li>
                  Em <strong>aistudio.google.com/apikey</strong>, crie uma chave em um projeto <strong>SEM conta de faturamento vinculada</strong> (nível <em>Free of charge</em>). Assim, mesmo usando o Gemini 24h por dia, o Google <strong>jamais</strong> pode cobrar cartão.
                </li>
              </ol>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-inherit">
              <div className="text-[11.5px] opacity-75">
                Status atual:{" "}
                <strong className="text-emerald-500">
                  {shieldReport?.strictFreeMode !== false ? "100% Gratuito (SKUs Pagos Bloqueados)" : "Personalizado"}
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingShield}
                  onClick={() => handleToggleZeroCostShield(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-extrabold cursor-pointer"
                >
                  Garantir Bloqueio Total (R$ 0,00)
                </button>
                <button
                  type="button"
                  onClick={() => setShieldModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-inherit text-[12px] font-bold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {checking && (
        <GmbModal
          business={checking}
          onClose={() => setChecking(null)}
          onConfirm={confirmGenerate}
          onOpenTemplates={openTemplatesForBusiness}
        />
      )}
    </div>
  );
}
