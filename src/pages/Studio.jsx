import { useCallback, useEffect, useState } from "react";
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
import G360FreeAiHub from "@/components/g360/G360FreeAiHub";
import { createProjectData } from "@/lib/sitegen/projectFactory";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

  // Product Mode: "g360" (Full G360 Platform) vs "site-express-standalone" (Standalone Site Express Product)
  const [productMode, setProductMode] = useState("g360");

  // Active G360 View: "audit" | "gbp-package" | "crm" | "site-express-direct" | "saas-settings" | "templates" | "editor"
  const [view, setView] = useState("audit");
  const [crmSubView, setCrmSubView] = useState("kanban");

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
      toast.success("Site oficial gerado! Edite à vontade no canvas.");
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
    if (biz) {
      const enriched = pkgBriefing
        ? {
            ...biz,
            bio: pkgBriefing.description750 || biz.bio,
            category: pkgBriefing.primaryCategory || biz.category,
          }
        : biz;
      setActiveBusiness(enriched);
    }
    setView("site-express-direct");
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, productMode]);

  const bgCanvas = dark ? "#202124" : "#F8F9FA";
  const headerClass = dark
    ? "bg-[#202124]/90 border-[#3C4043] text-[#E8EAED]"
    : "bg-white/90 border-[#DADCE0] text-[#202124]";

  return (
    <div
      className={`${view === "editor" ? "h-screen overflow-hidden" : "min-h-screen"} flex flex-col transition-colors duration-200`}
      data-testid="studio-root"
      style={{ background: bgCanvas, color: dark ? "#E8EAED" : "#202124" }}
    >
      {/* STRICT 3-ZONE GOOGLE MATERIAL + FROSTED GLASS TOP BAR */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${headerClass}`}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
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

          {/* Zone 2: Concise Single-Line Navigation Links */}
          {productMode === "g360" ? (
            <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
              {[
                { id: "audit", label: "Pre-Analise", icon: BarChart3, testId: "nav-g360-audit" },
                { id: "gbp-package", label: "Pacote GBP", icon: Sparkles, testId: "nav-g360-package" },
                { id: "crm", label: "CRM e Propostas", icon: Briefcase, testId: "nav-g360-crm" },
                { id: "site-express-direct", label: "Site Express", icon: Layers, testId: "nav-g360-site-express" },
                { id: "free-ai", label: "IA Gratuita e Voz", icon: Bot, testId: "nav-g360-free-ai" },
                { id: "saas-settings", label: "Acessos e Deploy", icon: Settings2, testId: "nav-g360-settings" },
              ].map((navItem) => {
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
                        ? "bg-[#1A73E8] text-white shadow-sm"
                        : dark
                        ? "text-[#9AA0A6] hover:text-[#E8EAED] hover:bg-[#303134]"
                        : "text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4]"
                    }`}
                  >
                    <Icon size={15} />
                    <span>{navItem.label}</span>
                  </button>
                );
              })}
            </nav>
          ) : (
            /* Standalone Site Express Navigation */
            <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                data-testid="nav-new-site"
                onClick={() => setView("home")}
                className={`flex items-center gap-2 text-[13px] font-semibold px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  view === "home"
                    ? "bg-[#1A73E8] text-white"
                    : dark
                    ? "text-[#9AA0A6] hover:bg-[#303134]"
                    : "text-[#5F6368] hover:bg-[#F1F3F4]"
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
                    ? "bg-[#1A73E8] text-white"
                    : dark
                    ? "text-[#9AA0A6] hover:bg-[#303134]"
                    : "text-[#5F6368] hover:bg-[#F1F3F4]"
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
                    ? "bg-[#1A73E8] text-white"
                    : dark
                    ? "text-[#9AA0A6] hover:bg-[#303134]"
                    : "text-[#5F6368] hover:bg-[#F1F3F4]"
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
                className="flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-xl border border-[#1A73E8] text-[#1A73E8] hover:bg-[#1A73E8] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeftRight size={14} /> <span>Voltar ao G360 Completo</span>
              </button>
            </nav>
          )}

          {/* Zone 3: Day/Night Toggle + User Profile Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="theme-day-night-toggle"
              aria-label={dark ? "Ativar Modo Dia" : "Ativar Modo Noite"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dark
                  ? "bg-[#303134] border-[#3C4043] text-[#E8EAED] hover:border-[#8AB4F8]"
                  : "bg-[#F8F9FA] border-[#DADCE0] text-[#202124] hover:border-[#1A73E8]"
              }`}
            >
              {dark ? (
                <>
                  <Sun size={15} className="text-[#FBBC04]" />
                  <span className="hidden md:inline">Modo Dia</span>
                </>
              ) : (
                <>
                  <Moon size={15} className="text-[#1A73E8]" />
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
                      ? "border-[#3C4043] bg-[#303134] hover:bg-[#3C4043]"
                      : "border-[#DADCE0] bg-white hover:bg-[#F8F9FA]"
                  }`}
                >
                  <span className="w-7 h-7 rounded-full bg-[#1A73E8] text-white text-[11px] font-bold grid place-items-center">
                    {(user?.name || "U")
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <ChevronDown size={14} className={dark ? "text-[#9AA0A6]" : "text-[#5F6368]"} />
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
                  <ArrowLeftRight size={14} className="mr-2 text-[#1A73E8]" />
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
      <main className="flex-1 flex flex-col min-h-0">
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
    </div>
  );
}
