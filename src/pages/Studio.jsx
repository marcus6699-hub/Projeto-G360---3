import Dashboard from "@/components/g360/Dashboard";
import Office from "@/components/g360/Office";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  LogOut,
  Plus,
  Users,
  Settings2,
  ChevronDown,
  Layers,
  Calculator,
  Sun,
  Moon,
  BarChart3,
  Sparkles,
  Briefcase,
  Globe,
  ArrowLeftRight,
  Bot,
  MoreHorizontal,
  X,
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
import VerifiedProspectingWorkbench from "@/components/g360/VerifiedProspectingWorkbench";
import VerifiedSiteReview from "@/components/g360/VerifiedSiteReview";
import G360AuditPanel from "@/components/g360/G360AuditPanel";
import G360GbpPackagePanel from "@/components/g360/G360GbpPackagePanel";
import G360CrmFinancePanel from "@/components/g360/G360CrmFinancePanel";
import G360SiteExpressDirectPanel from "@/components/g360/G360SiteExpressDirectPanel";
import G360SaaSSettingsPanel from "@/components/g360/G360SaaSSettingsPanel";
import G360FreeAiHub from "@/components/g360/G360FreeAiHub";
import { createProjectData } from "@/lib/sitegen/projectFactory";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Studio() {
  const { user, logout } = useAuth();
  const identityRef = useRef(user?.id || user?.uid);
  identityRef.current = user?.id || user?.uid;

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

  // Product Mode: "g360" (Full G360 Platform) vs "site-express-standalone" (Standalone Site Express Product)
  const [productMode, setProductMode] = useState("g360");

  // Active G360 View: "audit" | "gbp-package" | "crm" | "site-express-direct" | "saas-settings" | "templates" | "editor"
  const [view, setView] = useState("dashboard");
  const [crmSubView, setCrmSubView] = useState("kanban");
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [checking, setChecking] = useState(null);
  const [templateBiz, setTemplateBiz] = useState(null);
  const [selectedTplId, setSelectedTplId] = useState("");
  const [activeAuditReport, setActiveAuditReport] = useState(null);
  const [activeBusiness, setActiveBusiness] = useState(null);
  const [verifiedSiteBusiness, setVerifiedSiteBusiness] = useState(null);

  useEffect(() => { setActiveBusiness(null); setActiveAuditReport(null); setVerifiedSiteBusiness(null); setProject(null); setProjects([]); setChecking(null); setTemplateBiz(null); }, [user?.id, user?.uid]);
  const loadProjects = useCallback(async () => {
    const identity = user?.id || user?.uid;
    try {
      const { data } = await api.get("/projects");
      if (identityRef.current === identity) setProjects(data.projects || []);
    } catch (e) {
      toast.error(fmtErr(e, "Não foi possível carregar os projetos"));
    }
  }, [user?.id, user?.uid]);

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
      toast.success("Site local gerado. Revise o conteúdo antes de publicar.");
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
        gbpScoreBefore: typeof report?.overallScore === "number" ? report.overallScore : null,
        gbpScoreAfter: typeof report?.projectedScoreAfterOptimization === "number" ? report.projectedScoreAfterOptimization : null,
        verified: Boolean(report?.verified),
        hasWebsite: Boolean(biz.website),
        dealValue: 1390,
        notes: typeof report?.overallScore === "number"
          ? `Exportado da Pré-Análise G360 com Score ${report.overallScore}/100 (${report.criticalCount || 0} pontos críticos identificados).`
          : `Exportado da Pré-Análise G360 para acompanhamento no CRM.`,
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
    if (biz) {
      const enriched = pkgBriefing
        ? {
            ...biz,
            bio: pkgBriefing.approvedDescription || biz.bio,
            services: pkgBriefing.approvedServices || biz.services,
            items: pkgBriefing.approvedProducts || biz.items,
            approvedGbpBriefing: pkgBriefing,
            approvedBranding: pkgBriefing.approvedBranding || null,
            photos: pkgBriefing.approvedMedia || biz.photos,
            category: pkgBriefing.primaryCategory || biz.category,
          }
        : biz;
      setActiveBusiness(enriched);
    }
    setView("site-express-direct");
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    setMobileMoreOpen(false);
  }, [view, productMode]);

  const bgCanvas = dark ? "#12101C" : "#F5F3FF";
  const headerClass = dark
    ? "bg-[#12101C]/95 border-[#2D2547] text-[#EDE9FE]"
    : "bg-white/95 border-[rgba(124,58,237,0.12)] text-[#1A1033]";

  return (
    <div
      className={`${view === "editor" ? "h-screen overflow-hidden" : "min-h-screen overflow-x-hidden"} flex flex-col transition-colors duration-200`}
      data-testid="studio-root"
      style={{ background: bgCanvas, color: dark ? "#EDE9FE" : "#1A1033" }}
    >
      {/* STRICT 3-ZONE GOOGLE MATERIAL + FROSTED GLASS TOP BAR */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${headerClass}`}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
          {/* Zone 1: Brand Wordmark */}
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

          {/* Zone 2: Concise Single-Line Navigation Links (Desktop) */}
          {productMode === "g360" ? (
            <nav className="hidden lg:flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
              {[
                { id: "dashboard", label: "Dashboard", icon: BarChart3, testId: "nav-g360-dashboard" },
                { id: "audit", label: "Prospecção", icon: BarChart3, testId: "nav-g360-audit" },
                { id: "gbp-package", label: "Pacote GBP", icon: Sparkles, testId: "nav-g360-package" },
                { id: "crm", label: "CRM", icon: Briefcase, testId: "nav-g360-crm" },
                { id: "office", label: "Escritório", icon: Calculator, testId: "nav-g360-office" },
                { id: "site-express-direct", label: "Sites", icon: Layers, testId: "nav-g360-site-express" },
                { id: "free-ai", label: "Central de IA", icon: Bot, testId: "nav-g360-free-ai" },
                { id: "saas-settings", label: "Acessos e Deploy", icon: Settings2, testId: "nav-g360-settings" },
              ].filter(item => !["free-ai", "saas-settings"].includes(item.id)).map((navItem) => {
                const Icon = navItem.icon;
                const active = view === navItem.id;
                return (
                  <button
                    key={navItem.id}
                    type="button"
                    data-testid={navItem.testId}
                    onClick={() => setView(navItem.id)}
                    className={`flex items-center gap-2 text-[13px] font-semibold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? "bg-[#7C3AED] text-white shadow-sm"
                        : dark
                        ? "text-[#C4B5FD] hover:text-[#EDE9FE] hover:bg-[#2D2547]"
                        : "text-[#4A3F6B] hover:text-[#1A1033] hover:bg-[#EDE9FE]"
                    }`}
                  >
                    <Icon size={15} />
                    <span>{navItem.label}</span>
                  </button>
                );
              })}
              <DropdownMenu><DropdownMenuTrigger asChild><button data-testid="nav-g360-more" className="px-3 py-2 text-sm font-semibold rounded-xl flex items-center gap-1 shrink-0">Mais <ChevronDown size={14}/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem data-testid="nav-g360-free-ai" onSelect={()=>setView("free-ai")}>Central de IA</DropdownMenuItem>{user?.role==="admin" && <DropdownMenuItem data-testid="nav-g360-settings" onSelect={()=>setView("saas-settings")}>Administração</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
            </nav>
          ) : (
            /* Standalone Site Express Navigation (Desktop) */
            <nav className="hidden lg:flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                data-testid="nav-new-site"
                onClick={() => setView("home")}
                className={`flex items-center gap-2 text-[13px] font-semibold px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  view === "home"
                    ? "bg-[#7C3AED] text-white"
                    : dark
                    ? "text-[#C4B5FD] hover:bg-[#2D2547]"
                    : "text-[#4A3F6B] hover:bg-[#EDE9FE]"
                }`}
              >
                <Plus size={15} /> <span>Novo Site</span>
              </button>
              <button
                type="button"
                data-testid="nav-templates"
                onClick={() => setView("templates")}
                className={`flex items-center gap-2 text-[13px] font-semibold px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  view === "templates"
                    ? "bg-[#7C3AED] text-white"
                    : dark
                    ? "text-[#C4B5FD] hover:bg-[#2D2547]"
                    : "text-[#4A3F6B] hover:bg-[#EDE9FE]"
                }`}
              >
                <Layers size={15} /> <span>Modelos (7)</span>
              </button>
              <button
                type="button"
                data-testid="nav-clients"
                onClick={() => {
                  setView("clients");
                  loadProjects();
                }}
                className={`flex items-center gap-2 text-[13px] font-semibold px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  view === "clients"
                    ? "bg-[#7C3AED] text-white"
                    : dark
                    ? "text-[#C4B5FD] hover:bg-[#2D2547]"
                    : "text-[#4A3F6B] hover:bg-[#EDE9FE]"
                }`}
              >
                <Users size={15} /> <span>Meus Sites</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductMode("g360");
                  setView("audit");
                }}
                className="flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-xl border border-[#7C3AED] text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeftRight size={14} /> <span>Voltar ao G360 Completo</span>
              </button>
            </nav>
          )}

          {/* Zone 3: Day/Night Toggle + User Profile Menu */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="theme-day-night-toggle"
              aria-label={dark ? "Ativar Modo Dia" : "Ativar Modo Noite"}
              className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border text-[12px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dark
                  ? "bg-[#1E1A2E] border-[#2D2547] text-[#EDE9FE] hover:border-[#A78BFA]"
                  : "bg-[#F5F3FF] border-[rgba(124,58,237,0.2)] text-[#1A1033] hover:border-[#7C3AED]"
              }`}
            >
              {dark ? (
                <>
                  <Sun size={15} className="text-[#FBBC04]" />
                  <span className="hidden md:inline">Modo Dia</span>
                </>
              ) : (
                <>
                  <Moon size={15} className="text-[#7C3AED]" />
                  <span className="hidden md:inline">Modo Noite</span>
                </>
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="user-menu-button"
                  aria-label="Menu do usuário"
                  className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full border transition-colors cursor-pointer ${
                    dark
                      ? "border-[#2D2547] bg-[#1E1A2E] hover:bg-[#2D2547]"
                      : "border-[rgba(124,58,237,0.15)] bg-white hover:bg-[#F5F3FF]"
                  }`}
                >
                  <span className="w-7 h-7 rounded-full bg-[#7C3AED] text-white text-[11px] font-bold grid place-items-center">
                    {(user?.name || "U")
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <ChevronDown size={14} className={dark ? "text-[#C4B5FD]" : "text-[#7C6FAE]"} />
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
                      setView("home");
                    } else {
                      setProductMode("g360");
                      setView("audit");
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

      {/* MAIN WORKSPACE CONTENT */}
      <main className={`flex-1 flex flex-col min-h-0 ${view === "editor" ? "" : "pb-20 lg:pb-0"}`}>
        {productMode === "g360" ? (
          <>
            {view === "dashboard" && <Dashboard key={user?.id || user?.uid} dark={dark} onOpen={setView}/> }
            {view === "audit" && <div className="p-3 sm:p-6 space-y-4"><VerifiedProspectingWorkbench key={user?.id || user?.uid} userId={user?.id || user?.uid} onBusinessChange={setActiveBusiness} onAuditReport={setActiveAuditReport} onOpenSite={(biz) => { setVerifiedSiteBusiness(biz); setView("verified-site"); }} />
              {activeBusiness && <div className="flex gap-3 flex-wrap"><button className="g360-btn-primary" onClick={() => handleOpenGbpPackage(activeBusiness)}>Preparar Pacote GBP</button><button className="g360-btn-primary" onClick={() => handleOpenSiteExpressDirect(activeBusiness)}>Abrir Site Express</button>{activeAuditReport && <button className="g360-btn-primary" onClick={() => setView("audit-report")}>Ver relatório detalhado</button>}</div>}
            </div>}
            {view === "audit-report" && activeAuditReport && <G360AuditPanel key={user?.id || user?.uid} ownerUid={user?.id || user?.uid} dark={dark} activeReport={activeAuditReport} onReportChange={setActiveAuditReport} onExportToCrm={handleExportAuditToCrm} onOpenGbpPackage={handleOpenGbpPackage} onOpenSiteExpress={handleOpenSiteExpressDirect} />}
            {view === "verified-site" && <VerifiedSiteReview business={verifiedSiteBusiness} onBack={() => setView("audit")} />}

            {view === "gbp-package" && (
              <G360GbpPackagePanel
                key={`${user?.id || user?.uid}:${activeBusiness?.place_id || activeBusiness?.id || activeBusiness?.name || "none"}`}
                ownerUid={user?.id || user?.uid}
                dark={dark}
                activeBusiness={activeBusiness || activeAuditReport?.business}
                onOpenSiteExpressWithBriefing={handleOpenSiteExpressDirect}
              />
            )}

            {view === "office" && <Office key={user?.id || user?.uid} dark={dark} />}
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
                onProjectsChanged={loadProjects}
                onSwitchToStandaloneSiteExpress={() => {
                  setProductMode("site-express-standalone");
                  setView("home");
                  toast.success("Modo Site Express Separado (Produto Independente) ativado.");
                }}
              />
            )}

            {view === "free-ai" && (
              <G360FreeAiHub
                key={`${user?.id || user?.uid}:${activeBusiness?.place_id || activeBusiness?.id || activeBusiness?.name || "none"}`}
                dark={dark}
                activeBusiness={activeBusiness || activeAuditReport?.business}
                onOpenGbpPackage={handleOpenGbpPackage}
                onOpenCrm={() => setView("crm")}
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
            {view === "editor" && project && (
              <Editor
                project={project}
                onProject={setProject}
                onSave={saveProject}
                onExit={() => {
                  setView("clients");
                  loadProjects();
                }}
              />
            )}
          </>
        )}
      </main>

      {checking && (
        <GmbModal
          business={checking}
          onClose={() => setChecking(null)}
          onConfirm={confirmGenerate}
          onOpenTemplates={openTemplatesForBusiness}
        />
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR (FIXED DEDICATED MOBILE-FIRST ERGONOMIC BAR) */}
      {view !== "editor" && (
        <nav
          className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t backdrop-blur-xl transition-colors duration-200 ${
            dark
              ? "bg-[#12101C]/98 border-[#2D2547] text-[#7C6FAE]"
              : "bg-white/97 border-[rgba(124,58,237,0.12)] text-[#8B7FA8]"
          }`}
          data-testid="mobile-bottom-nav"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div
            className="grid h-16 w-full items-center px-1"
            style={{ gridTemplateColumns: productMode === "g360" ? "repeat(5, 1fr)" : "repeat(4, 1fr)" }}
          >
            {productMode === "g360" ? (
              <>
                <button
                  type="button"
                  data-testid="mobile-nav-audit"
                  onClick={() => setView("audit")}
                  className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
                    view === "audit"
                      ? "text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                      : "hover:text-[#7C3AED] dark:hover:text-[#A78BFA]"
                  }`}
                >
                  <BarChart3 size={20} className={view === "audit" ? "stroke-[2.5]" : "stroke-[1.75]"} />
                  <span className="text-[10.5px] tracking-tight">Análise</span>
                </button>
                <button
                  type="button"
                  data-testid="mobile-nav-package"
                  onClick={() => setView("gbp-package")}
                  className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
                    view === "gbp-package"
                      ? "text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                      : "hover:text-[#7C3AED] dark:hover:text-[#A78BFA]"
                  }`}
                >
                  <Sparkles size={20} className={view === "gbp-package" ? "stroke-[2.5]" : "stroke-[1.75]"} />
                  <span className="text-[10.5px] tracking-tight">GBP</span>
                </button>
                <button
                  type="button"
                  data-testid="mobile-nav-crm"
                  onClick={() => setView("crm")}
                  className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
                    view === "crm"
                      ? "text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                      : "hover:text-[#7C3AED] dark:hover:text-[#A78BFA]"
                  }`}
                >
                  <Briefcase size={20} className={view === "crm" ? "stroke-[2.5]" : "stroke-[1.75]"} />
                  <span className="text-[10.5px] tracking-tight">CRM</span>
                </button>
                <button
                  type="button"
                  data-testid="mobile-nav-site-express"
                  onClick={() => setView("site-express-direct")}
                  className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
                    view === "site-express-direct"
                      ? "text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                      : "hover:text-[#7C3AED] dark:hover:text-[#A78BFA]"
                  }`}
                >
                  <Layers size={20} className={view === "site-express-direct" ? "stroke-[2.5]" : "stroke-[1.75]"} />
                  <span className="text-[10.5px] tracking-tight">Sites</span>
                </button>
                <button
                  type="button"
                  data-testid="mobile-nav-more"
                  onClick={() => setMobileMoreOpen(true)}
                  className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
                    mobileMoreOpen || view === "free-ai" || view === "saas-settings" || view === "templates"
                      ? "text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                      : "hover:text-[#7C3AED] dark:hover:text-[#A78BFA]"
                  }`}
                >
                  <MoreHorizontal
                    size={20}
                    className={
                      mobileMoreOpen || view === "free-ai" || view === "saas-settings" || view === "templates"
                        ? "stroke-[2.5]"
                        : "stroke-[1.75]"
                    }
                  />
                  <span className="text-[10.5px] tracking-tight">Mais</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  data-testid="mobile-nav-home"
                  onClick={() => setView("home")}
                  className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
                    view === "home"
                      ? "text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                      : "hover:text-[#7C3AED] dark:hover:text-[#A78BFA]"
                  }`}
                >
                  <Plus size={20} className={view === "home" ? "stroke-[2.5]" : "stroke-[1.75]"} />
                  <span className="text-[10.5px] tracking-tight">Novo</span>
                </button>
                <button
                  type="button"
                  data-testid="mobile-nav-templates"
                  onClick={() => setView("templates")}
                  className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
                    view === "templates"
                      ? "text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                      : "hover:text-[#7C3AED] dark:hover:text-[#A78BFA]"
                  }`}
                >
                  <Layers size={20} className={view === "templates" ? "stroke-[2.5]" : "stroke-[1.75]"} />
                  <span className="text-[10.5px] tracking-tight">Modelos</span>
                </button>
                <button
                  type="button"
                  data-testid="mobile-nav-clients"
                  onClick={() => {
                    setView("clients");
                    loadProjects();
                  }}
                  className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
                    view === "clients"
                      ? "text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                      : "hover:text-[#7C3AED] dark:hover:text-[#A78BFA]"
                  }`}
                >
                  <Users size={20} className={view === "clients" ? "stroke-[2.5]" : "stroke-[1.75]"} />
                  <span className="text-[10.5px] tracking-tight">Meus Sites</span>
                </button>
                <button
                  type="button"
                  data-testid="mobile-nav-more-standalone"
                  onClick={() => setMobileMoreOpen(true)}
                  className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
                    mobileMoreOpen || view === "sales" || view === "ai"
                      ? "text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                      : "hover:text-[#7C3AED] dark:hover:text-[#A78BFA]"
                  }`}
                >
                  <MoreHorizontal
                    size={20}
                    className={mobileMoreOpen || view === "sales" || view === "ai" ? "stroke-[2.5]" : "stroke-[1.75]"}
                  />
                  <span className="text-[10.5px] tracking-tight">Mais</span>
                </button>
              </>
            )}
          </div>
        </nav>
      )}

      {/* MOBILE "MAIS" BOTTOM SHEET DRAWER */}
      {mobileMoreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
            onClick={() => setMobileMoreOpen(false)}
            data-testid="mobile-more-backdrop"
          />

          {/* Slide-Up Panel */}
          <div
            className={`relative z-10 w-full rounded-t-3xl border-t p-5 pb-8 max-h-[85vh] overflow-y-auto shadow-2xl transition-all duration-300 ease-out ${
              dark
                ? "bg-[#1A1630] border-[#2D2547] text-[#EDE9FE]"
                : "bg-white border-[rgba(124,58,237,0.12)] text-[#1A1033]"
            }`}
            data-testid="mobile-more-sheet"
          >
            {/* Pill Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mb-4" />

            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <div>
                <h3 className="text-[16px] font-bold">Mais Recursos & Ferramentas</h3>
                <p className="text-[11.5px] opacity-70">
                  {productMode === "g360" ? "Plataforma G360 Business" : "Site Express Standalone"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                  dark
                    ? "border-[#2D2547] bg-[#2D2547] hover:bg-[#3D3060]"
                    : "border-[rgba(124,58,237,0.15)] bg-[#F5F3FF] hover:bg-[#EDE9FE]"
                }`}
                aria-label="Fechar menu"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-3 space-y-1.5">
              {productMode === "g360" ? (
                <>
                  <button type="button" data-testid="mobile-menu-dashboard" onClick={() => { setView("dashboard"); setMobileMoreOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl hover:bg-purple-50">Dashboard</button>
                  <button type="button" data-testid="mobile-menu-office" onClick={() => { setView("office"); setMobileMoreOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl hover:bg-purple-50"><Calculator size={18}/>Escritório G360</button>
                  <button
                    type="button"
                    data-testid="mobile-menu-free-ai"
                    onClick={() => {
                      setView("free-ai");
                      setMobileMoreOpen(false);
                    }}
                    className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-colors text-left cursor-pointer ${
                      view === "free-ai"
                        ? "bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                        : dark
                        ? "hover:bg-[#2D2547]"
                        : "hover:bg-[#F5F3FF]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] grid place-items-center shrink-0">
                      <Bot size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold">IA Gratuita e Voz</div>
                      <div className="text-[11.5px] opacity-70 truncate">Modelos Gemini 3.8 Flash, transcrição e radar Google</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    data-testid="mobile-menu-saas-settings"
                    onClick={() => {
                      setView("saas-settings");
                      setMobileMoreOpen(false);
                    }}
                    className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-colors text-left cursor-pointer ${
                      view === "saas-settings"
                        ? "bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                        : dark
                        ? "hover:bg-[#2D2547]"
                        : "hover:bg-[#F5F3FF]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] grid place-items-center shrink-0">
                      <Settings2 size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold">Acessos, Finanças e Deploy</div>
                      <div className="text-[11.5px] opacity-70 truncate">Gestão SaaS, chave Pix, metas e usuários</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    data-testid="mobile-menu-templates"
                    onClick={() => {
                      setView("templates");
                      setMobileMoreOpen(false);
                    }}
                    className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-colors text-left cursor-pointer ${
                      view === "templates"
                        ? "bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                        : dark
                        ? "hover:bg-[#2D2547]"
                        : "hover:bg-[#F5F3FF]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] grid place-items-center shrink-0">
                      <Layers size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold">Modelos Oficiais de Site (7)</div>
                      <div className="text-[11.5px] opacity-70 truncate">Explorar os 7 arquétipos com prévias ao vivo</div>
                    </div>
                  </button>

                  <div className="my-2 border-t border-inherit" />

                  <button
                    type="button"
                    onClick={() => {
                      setProductMode("site-express-standalone");
                      setView("home");
                      setMobileMoreOpen(false);
                      toast.success("Modo Site Express Separado ativado.");
                    }}
                    className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-colors text-left cursor-pointer ${
                      dark ? "hover:bg-[#2D2547]" : "hover:bg-[#F5F3FF]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 grid place-items-center shrink-0">
                      <ArrowLeftRight size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold">Alternar p/ Site Express Separado</div>
                      <div className="text-[11.5px] opacity-70 truncate">Produto independente com home comercial</div>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="mobile-menu-sales"
                    onClick={() => {
                      setView("sales");
                      setMobileMoreOpen(false);
                    }}
                    className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-colors text-left cursor-pointer ${
                      view === "sales"
                        ? "bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                        : dark
                        ? "hover:bg-[#2D2547]"
                        : "hover:bg-[#F5F3FF]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center shrink-0">
                      <Calculator size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold">Calculadora & Scripts de Venda</div>
                      <div className="text-[11.5px] opacity-70 truncate">Scripts de WhatsApp e metas de faturamento</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    data-testid="mobile-menu-ai-settings"
                    onClick={() => {
                      setView("ai");
                      setMobileMoreOpen(false);
                    }}
                    className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-colors text-left cursor-pointer ${
                      view === "ai"
                        ? "bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] font-bold"
                        : dark
                        ? "hover:bg-[#2D2547]"
                        : "hover:bg-[#F5F3FF]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center shrink-0">
                      <Bot size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold">Configurações de IA</div>
                      <div className="text-[11.5px] opacity-70 truncate">Gerenciamento de API Keys do Google</div>
                    </div>
                  </button>

                  <div className="my-2 border-t border-inherit" />

                  <button
                    type="button"
                    onClick={() => {
                      setProductMode("g360");
                      setView("audit");
                      setMobileMoreOpen(false);
                      toast.success("Retornando ao G360 Completo.");
                    }}
                    className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-colors text-left cursor-pointer ${
                      dark ? "hover:bg-[#2D2547]" : "hover:bg-[#F5F3FF]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] grid place-items-center shrink-0">
                      <ArrowLeftRight size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold">Voltar ao G360 Completo</div>
                      <div className="text-[11.5px] opacity-70 truncate">Pré-Análise GBP, CRM e Geogrid 5x5</div>
                    </div>
                  </button>
                </>
              )}

              {/* Theme toggle option */}
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                }}
                className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-colors text-left cursor-pointer ${
                  dark ? "hover:bg-[#2D2547]" : "hover:bg-[#F5F3FF]"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-[#FBBC04] grid place-items-center shrink-0">
                  {dark ? <Sun size={20} /> : <Moon size={20} className="text-[#7C3AED]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold">{dark ? "Ativar Modo Dia" : "Ativar Modo Noite"}</div>
                  <div className="text-[11.5px] opacity-70 truncate">
                    {dark ? "Tema claro de alto contraste" : "Tema escuro relaxante para os olhos"}
                  </div>
                </div>
              </button>

              {/* Logout Option */}
              <button
                type="button"
                onClick={() => {
                  setMobileMoreOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-3.5 p-3 rounded-2xl transition-colors text-left text-red-600 hover:bg-red-500/10 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 grid place-items-center shrink-0">
                  <LogOut size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold">Sair da Conta</div>
                  <div className="text-[11.5px] opacity-70 truncate">{user?.name || user?.email || "Encerrar sessão"}</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
