import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Globe,
  Download,
  ExternalLink,
  Building2,
  Rocket,
  Edit3,
  ChevronRight,
  Trash2,
  Database,
  Save,
  UserCheck,
  RefreshCw,
  CloudUpload,
  Copy,
  FileText,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { api, fmtErr } from "@/lib/api";
import { SITE_TEMPLATES } from "@/lib/sitegen/theme";
import { generateSiteHtml } from "@/lib/sitegen/generateSiteHtml";
import { createProjectData } from "@/lib/sitegen/projectFactory";
import {
  buildCompanyImageDataJson,
  buildSiteImagePlanningTable,
  buildMasterImagePromptMarkdown,
} from "@/lib/sitegen/masterImagePrompt";
import {
  auth,
  googleSignIn,
  saveUserProfileToFirestore,
  getUserProfileFromFirestore,
  saveLandingPageToFirestore,
  listUserLandingPagesFromFirestore,
  deleteLandingPageFromFirestore,
} from "@/firebase";
import { GoogleSignInButton } from "./GoogleWorkspacePanel";

export default function G360SiteExpressDirectPanel({
  dark = false,
  activeBusiness,
  projects = [],
  onQuickGenerate,
  onOpenEditor,
  onOpenTemplates,
  onProjectsChanged,
  onSwitchToStandaloneSiteExpress,
}) {
  const [query, setQuery] = useState(activeBusiness?.name || "");
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedBiz, setSelectedBiz] = useState(activeBusiness || null);
  const [selectedTplId, setSelectedTplId] = useState(
    activeBusiness?.recommended_template || SITE_TEMPLATES[0]?.id || "vitrine-express"
  );
  const [deployingId, setDeployingId] = useState("");
  const [vercelToken, setVercelToken] = useState("");
  const [deployUrlMap, setDeployUrlMap] = useState({});
  const boxRef = useRef(null);
  const timerRef = useRef(null);

  // Firestore Persistence State (UserProfile & LandingPages)
  const [fbUser, setFbUser] = useState(null);
  const [fbAuthBusy, setFbAuthBusy] = useState(false);
  const [firestorePages, setFirestorePages] = useState([]);
  const [loadingFirestore, setLoadingFirestore] = useState(false);
  const [savingPageId, setSavingPageId] = useState("");
  const [syncingAll, setSyncingAll] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    agencyName: "G360 Google Business Intelligence",
    phone: "(62) 99113-8004",
    plan: "g360_full",
  });

  const loadFirestoreData = async (currentUser) => {
    const activeUser = currentUser || auth.currentUser;
    if (!activeUser) {
      setFirestorePages([]);
      return;
    }
    setLoadingFirestore(true);
    try {
      const [profile, savedPages] = await Promise.all([
        getUserProfileFromFirestore(activeUser.uid),
        listUserLandingPagesFromFirestore(),
      ]);
      if (profile) {
        setProfileForm({
          name: profile.name || activeUser.displayName || "Consultor G360",
          email: profile.email || activeUser.email || "",
          agencyName: profile.agencyName || "G360 Google Business Intelligence",
          phone: profile.phone || "(62) 99113-8004",
          plan: profile.plan || "g360_full",
        });
      } else {
        setProfileForm((prev) => ({
          ...prev,
          name: activeUser.displayName || prev.name || "Consultor G360",
          email: activeUser.email || prev.email || "",
        }));
      }
      setFirestorePages(savedPages || []);
    } catch (err) {
      console.error("Failed to load Firestore persistence data:", err);
    } finally {
      setLoadingFirestore(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setFbUser(u);
      if (u) {
        loadFirestoreData(u);
      } else {
        setFirestorePages([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeBusiness?.name) {
      setSelectedBiz(activeBusiness);
      setQuery(activeBusiness.name);
      if (activeBusiness.recommended_template) {
        setSelectedTplId(activeBusiness.recommended_template);
      }
    }
  }, [activeBusiness?.name]);

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/places/autocomplete", { params: { q: query } });
        setSuggestions(data.suggestions || []);
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const handleSelectSuggestion = async (sug) => {
    setDropdownOpen(false);
    setQuery(sug.name);
    try {
      const { data } = await api.get(`/places/details/${encodeURIComponent(sug.place_id)}`);
      setSelectedBiz(data);
      if (data.recommended_template) setSelectedTplId(data.recommended_template);
    } catch {
      setSelectedBiz(sug);
    }
  };

  const handleGenerateNow = async (e) => {
    e?.preventDefault();
    let bizToUse = selectedBiz;
    if (!bizToUse || bizToUse.name.toLowerCase() !== query.trim().toLowerCase()) {
      if (query.trim().length >= 2) {
        try {
          const { data } = await api.get(`/places/details/${encodeURIComponent(`custom::${query.trim()}`)}`);
          bizToUse = data;
        } catch {
          bizToUse = {
            name: query.trim(),
            category: "Empresa Local",
            segment: "servicos",
            city: "Anápolis",
            uf: "GO",
            phone: "(62) 99113-8004",
            whatsapp: "5562991138004",
          };
        }
      }
    }
    if (!bizToUse) {
      toast.error("Digite ou selecione a empresa para gerar o site.");
      return;
    }
    const tpl = SITE_TEMPLATES.find((t) => t.id === selectedTplId) || SITE_TEMPLATES[0];
    if (onQuickGenerate) {
      await onQuickGenerate(bizToUse, tpl.archetype, tpl.id);
    }
  };

  const handleDownloadHtml = (proj) => {
    const html = generateSiteHtml(proj.data, { editor: false });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${proj.slug || "site-oficial"}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Código HTML independente exportado com sucesso!");
  };

  const handleDeployFree = async (proj) => {
    setDeployingId(proj.id);
    try {
      const htmlContent = generateSiteHtml(proj.data, { editor: false });
      const { data } = await api.post("/g360/deploy", {
        provider: "vercel",
        projectSlug: proj.slug,
        htmlContent,
        customToken: vercelToken,
      });
      if (data?.url) {
        setDeployUrlMap((prev) => ({ ...prev, [proj.id]: data.url }));
        if (fbUser) {
          await saveLandingPageToFirestore({ ...proj, deployedUrl: data.url });
          await loadFirestoreData(fbUser);
        }
        toast.success(data.message || "Site publicado com sucesso!");
      }
    } catch (e) {
      toast.error(fmtErr(e, "Falha ao publicar site"));
    } finally {
      setDeployingId("");
    }
  };

  const handleDeleteProject = async (id) => {
    try {
      await api.delete(`/projects/${id}`);
      if (onProjectsChanged) onProjectsChanged();
      toast.success("Site removido.");
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao remover site"));
    }
  };

  const handleSaveSingleToFirestore = async (proj) => {
    if (!fbUser) {
      toast.error("Faça login com o Google para salvar a Landing Page no Firestore.");
      return;
    }
    setSavingPageId(proj.id);
    try {
      const saved = await saveLandingPageToFirestore({
        ...proj,
        deployedUrl: deployUrlMap[proj.id] || `/site/${proj.slug}`,
      });
      if (saved) {
        toast.success(`Landing Page "${saved.name}" salva no Firestore (/landing_pages/${saved.id})!`);
        await loadFirestoreData(fbUser);
      }
    } catch (err) {
      toast.error("Erro ao salvar Landing Page no Firestore.");
    } finally {
      setSavingPageId("");
    }
  };

  const handleSyncAllToFirestore = async () => {
    if (!fbUser) {
      toast.error("Faça login com o Google primeiro para sincronizar seus sites no Firestore.");
      return;
    }
    if (!projects.length) {
      toast.info("Nenhum site gerado para sincronizar.");
      return;
    }
    setSyncingAll(true);
    try {
      for (const proj of projects) {
        await saveLandingPageToFirestore({
          ...proj,
          deployedUrl: deployUrlMap[proj.id] || `/site/${proj.slug}`,
        });
      }
      await loadFirestoreData(fbUser);
      toast.success(`${projects.length} Landing Page(s) sincronizada(s) com sucesso no Firestore!`);
    } catch (err) {
      toast.error("Falha ao sincronizar Landing Pages no Firestore.");
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDeleteFromFirestore = async (pageId) => {
    if (!fbUser) return;
    try {
      const ok = await deleteLandingPageFromFirestore(pageId);
      if (ok) {
        setFirestorePages((prev) => prev.filter((p) => p.id !== pageId));
        toast.success("Landing Page removida do Firestore.");
      }
    } catch (err) {
      toast.error("Erro ao remover Landing Page do Firestore.");
    }
  };

  const handleRestoreFirestorePageToEditor = (lpDoc) => {
    const existingLocal = projects.find((p) => p.id === lpDoc.id || p.slug === lpDoc.slug);
    if (existingLocal && onOpenEditor) {
      onOpenEditor(existingLocal);
      return;
    }
    const biz = lpDoc.siteData?.business || {
      name: lpDoc.businessName,
      category: lpDoc.category,
      city: lpDoc.city,
      phone: lpDoc.phone,
      whatsapp: lpDoc.whatsapp,
    };
    const rebuiltData = createProjectData(biz, lpDoc.archetype, lpDoc.templateId);
    if (lpDoc.headline || lpDoc.subheadline || lpDoc.ctaText) {
      rebuiltData.texts = {
        ...rebuiltData.texts,
        "hero.headline": lpDoc.headline || rebuiltData.texts?.["hero.headline"],
        "hero.subheadline": lpDoc.subheadline || rebuiltData.texts?.["hero.subheadline"],
        "hero.cta": lpDoc.ctaText || rebuiltData.texts?.["hero.cta"],
      };
    }
    if (onOpenEditor) {
      onOpenEditor({
        id: lpDoc.id,
        slug: lpDoc.slug,
        name: lpDoc.name,
        archetype: lpDoc.archetype,
        status: lpDoc.status,
        data: rebuiltData,
      });
    }
  };

  const handleSaveUserProfile = async (e) => {
    e.preventDefault();
    if (!fbUser) {
      toast.error("Conecte sua conta Google para salvar o perfil no Firestore.");
      return;
    }
    setSavingProfile(true);
    try {
      const saved = await saveUserProfileToFirestore({
        name: profileForm.name,
        agencyName: profileForm.agencyName,
        phone: profileForm.phone,
        plan: profileForm.plan,
      });
      if (saved) {
        toast.success(`Perfil salvo com sucesso em /users/${saved.uid}!`);
      }
    } catch (err) {
      toast.error("Erro ao salvar perfil de usuário no Firestore.");
    } finally {
      setSavingProfile(false);
    }
  };

  const cardClass = dark
    ? "bg-[#303134]/85 backdrop-blur-xl border border-[#3C4043] text-[#E8EAED]"
    : "bg-white/90 backdrop-blur-xl border border-[#DADCE0] text-[#202124] shadow-[0_1px_2px_rgba(60,64,67,0.06),0_2px_6px_rgba(60,64,67,0.04)]";
  const mutedText = dark ? "text-[#9AA0A6]" : "text-[#5F6368]";
  const subtleBg = dark ? "bg-[#202124]" : "bg-[#F8F9FA]";
  const borderCol = dark ? "border-[#3C4043]" : "border-[#DADCE0]";

  return (
    <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* DIRECT SITE EXPRESS WORKSPACE HEADER (NO MARKETING HOME CLUTTER) */}
      <section className={`rounded-2xl p-5 sm:p-6 space-y-5 ${cardClass}`} data-testid="site-express-direct-panel">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-inherit">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[#1A73E8]">
              <span>Modulo @pacote-site</span>
              <span>·</span>
              <span>Site Express Integrado ao G360</span>
            </div>
            <h1 className="text-[22px] sm:text-[25px] font-bold tracking-tight mt-0.5">
              Criador Direto de Sites Otimizados (Ficha Google → Site Oficial)
            </h1>
            <p className={`text-[13px] mt-0.5 ${mutedText}`}>
              Sem pagina inicial promocional: selecione a empresa que voce ja auditou ou otimizou no GBP e gere o site pronto para editar e publicar gratis.
            </p>
          </div>

          <button
            type="button"
            onClick={onSwitchToStandaloneSiteExpress}
            className={`px-4 py-2.5 rounded-xl border text-[12.5px] font-semibold flex items-center gap-2 self-start cursor-pointer ${borderCol} ${subtleBg} hover:border-[#1A73E8]`}
            data-testid="open-standalone-site-express-btn"
          >
            <ExternalLink size={15} className="text-[#1A73E8]" />
            <span>Ver Produto Site Express Separado (Com Home Comercial)</span>
          </button>
        </div>

        {/* Direct 1-Field Company Picker + Template Selector + Generate */}
        <div ref={boxRef} className="space-y-4">
          <form onSubmit={handleGenerateNow} className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-6 relative">
              <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${mutedText}`}>
                01. Empresa do Cliente (Puxa Dados e Fotos Automaticamente)
              </label>
              <div
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border ${
                  dark ? "bg-[#202124] border-[#5F6368]" : "bg-white border-[#DADCE0]"
                }`}
              >
                <Search size={18} className="text-[#1A73E8] shrink-0" />
                <input
                  type="text"
                  value={query}
                  onFocus={() => setDropdownOpen(true)}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Digite o nome da empresa para gerar o site..."
                  className="w-full bg-transparent text-[14px] font-medium outline-none"
                  data-testid="site-express-direct-input"
                />
              </div>

              {dropdownOpen && suggestions.length > 0 && (
                <div
                  className={`absolute left-0 right-0 top-full mt-1.5 rounded-xl border overflow-hidden z-30 shadow-xl ${
                    dark ? "bg-[#303134] border-[#5F6368]" : "bg-white border-[#DADCE0]"
                  }`}
                >
                  {suggestions.map((sug) => (
                    <button
                      key={sug.place_id}
                      type="button"
                      onClick={() => handleSelectSuggestion(sug)}
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between text-[13px] ${
                        dark ? "hover:bg-[#3C4043]" : "hover:bg-[#F1F3F4]"
                      }`}
                    >
                      <div>
                        <span className="font-semibold">{sug.name}</span>
                        <span className={`ml-2 text-[11.5px] ${mutedText}`}>
                          {sug.category} · {sug.city}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-[#1A73E8]" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-3">
              <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${mutedText}`}>
                02. Modelo Estrategico do Nicho
              </label>
              <select
                value={selectedTplId}
                onChange={(e) => setSelectedTplId(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-[13.5px] font-semibold outline-none ${
                  dark ? "bg-[#202124] border-[#5F6368]" : "bg-white border-[#DADCE0]"
                }`}
              >
                {SITE_TEMPLATES.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.badge || tpl.archetype})
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3 flex items-end gap-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-[13.5px] flex items-center justify-center gap-2 cursor-pointer"
                data-testid="site-express-direct-generate-btn"
              >
                <Rocket size={16} />
                <span>Gerar e Abrir Editor</span>
              </button>
            </div>
          </form>

          {selectedBiz && (
            <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-[12.5px] ${borderCol} ${subtleBg}`}>
              <div className="flex items-center gap-2.5">
                <Building2 size={16} className="text-[#1A73E8]" />
                <span>
                  Ficha vinculada: <strong>{selectedBiz.name}</strong> ({selectedBiz.category} · {selectedBiz.city || "Anápolis"})
                </span>
                {Array.isArray(selectedBiz.photos) && selectedBiz.photos.length > 0 && (
                  <span className="text-[11px] font-semibold text-[#34A853]">
                    · {selectedBiz.photos.filter((p) => typeof p === "string" && !p.startsWith("data:image/svg+xml")).length || selectedBiz.photos.length} fotos vinculadas da ficha
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenTemplates && onOpenTemplates(selectedBiz, selectedTplId)}
                className="text-[#1A73E8] font-semibold hover:underline cursor-pointer"
              >
                Visualizar Galeria Completa de 7 Modelos →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* DIREÇÃO DA CRIAÇÃO DE IMAGENS — PROMPT MESTRE SITE EXPRESS */}
      {(() => {
        const targetBiz =
          selectedBiz ||
          projects[0]?.data?.business || {
            name: query || "Empresa Selecionada",
            category: "Serviços Profissionais",
            city: "Anápolis",
            uf: "GO",
          };
        const masterJson = buildCompanyImageDataJson(targetBiz);
        const masterRows = buildSiteImagePlanningTable(targetBiz);
        const masterMd = buildMasterImagePromptMarkdown(targetBiz);

        return (
          <section
            className={`rounded-2xl p-5 sm:p-6 space-y-4 ${cardClass}`}
            data-testid="site-express-master-image-direction"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-inherit">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#1A73E8]">
                  <Sparkles size={13} />
                  <span>Direção Oficial da Criação de Imagens · Site Express</span>
                </div>
                <h2 className="text-[19px] font-bold mt-0.5">
                  Prompt Mestre — Planejamento Fotográfico de Alta Conversão ({targetBiz.name})
                </h2>
                <p className={`text-[12.5px] mt-0.5 ${mutedText}`}>
                  Diretriz de arte e fotografia comercial integrada à ferramenta: preenche automaticamente os dados confirmados da empresa, preserva fotos reais do Google Maps e proíbe textos ou selos artificiais sobre as fotos.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-testid="site-express-copy-master-prompt-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(masterMd);
                    toast.success("PROMPT MESTRE completo copiado para a área de transferência!");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy size={14} />
                  <span>Copiar Prompt Mestre Completo</span>
                </button>
                <button
                  type="button"
                  data-testid="site-express-download-master-prompt-btn"
                  onClick={() => {
                    const blob = new Blob([masterMd], { type: "text/markdown;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `prompt-mestre-imagens-${String(targetBiz.name || "site")
                      .toLowerCase()
                      .replace(/\s+/g, "-")}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Prompt Mestre (.MD) baixado!");
                  }}
                  className={`px-3.5 py-2 rounded-xl border text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer ${borderCol} ${subtleBg}`}
                >
                  <Download size={14} />
                  <span>Baixar .MD</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left: Auto-filled 1. DADOS DA EMPRESA JSON */}
              <div className={`lg:col-span-4 rounded-xl border p-4 space-y-2.5 ${borderCol} ${subtleBg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A73E8] flex items-center gap-1.5">
                    <FileText size={13} /> 1. Dados da Empresa (Auto-Preenchido)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(masterJson, null, 2));
                      toast.success("JSON de Dados da Empresa copiado!");
                    }}
                    className="text-[11px] font-semibold text-[#1A73E8] hover:underline cursor-pointer"
                  >
                    Copiar JSON
                  </button>
                </div>
                <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[240px] p-3 rounded-lg bg-[#202124] text-[#E8EAED]">
                  {JSON.stringify(masterJson, null, 2)}
                </pre>
              </div>

              {/* Right: 4. TABELA DE PLANEJAMENTO DE IMAGENS DO SITE */}
              <div className={`lg:col-span-8 rounded-xl border p-4 space-y-2.5 ${borderCol} ${subtleBg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#34A853] flex items-center gap-1.5">
                    <ImageIcon size={13} /> 4. Tabela de Planejamento ({masterRows.length} arquivos padronizados)
                  </span>
                  <span className={`text-[11px] ${mutedText}`}>
                    Formato: .webp · sRGB · Sem textos nas fotos
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[240px]">
                  <table className="w-full text-left border-collapse text-[11.5px]">
                    <thead>
                      <tr className={`border-b ${borderCol} ${mutedText}`}>
                        <th className="py-2 pr-2 font-semibold">#</th>
                        <th className="py-2 pr-3 font-semibold">Arquivo Padronizado</th>
                        <th className="py-2 pr-3 font-semibold">Seção</th>
                        <th className="py-2 pr-3 font-semibold">Formato</th>
                        <th className="py-2 pr-3 font-semibold">Objetivo Visual</th>
                        <th className="py-2 text-right font-semibold">Prompt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-inherit">
                      {masterRows.map((r) => (
                        <tr key={r.filename} className="hover:bg-black/5">
                          <td className="py-2 pr-2 font-mono">{r.index}</td>
                          <td className="py-2 pr-3 font-mono font-semibold text-[#1A73E8] whitespace-nowrap">
                            {r.filename}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">{r.sectionName}</td>
                          <td className="py-2 pr-3 font-mono whitespace-nowrap">
                            {r.aspectRatio} ({r.dimensions})
                          </td>
                          <td className={`py-2 pr-3 max-w-[260px] truncate ${mutedText}`} title={r.visualObjective}>
                            {r.visualObjective}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(r.individualPrompt);
                                toast.success(`Prompt de ${r.filename} copiado!`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#1A73E8]/10 text-[#1A73E8] font-semibold text-[11px] hover:bg-[#1A73E8] hover:text-white transition-colors cursor-pointer"
                            >
                              Copiar Prompt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* GENERATED SITES & 1-CLICK FREE HOSTING (VERCEL / NETLIFY / HTML ZIP) */}
      <section className={`rounded-2xl p-5 sm:p-6 space-y-5 ${cardClass}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-inherit">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#34A853]">
              Hospedagem Gratuita Integrada · Vercel, Netlify e Exportacao HTML Independente
            </div>
            <h2 className="text-[19px] font-bold mt-0.5">
              Sites Criados ({projects.length}) — Edite, Exporte, Salve no Firestore ou Publique
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {fbUser && (
              <button
                type="button"
                disabled={syncingAll || projects.length === 0}
                onClick={handleSyncAllToFirestore}
                data-testid="sync-all-landing-pages-btn"
                className="px-3.5 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CloudUpload size={14} />
                <span>
                  {syncingAll
                    ? "Sincronizando no Firestore..."
                    : "Sincronizar Todos no Firestore"}
                </span>
              </button>
            )}
            <input
              type="password"
              value={vercelToken}
              onChange={(e) => setVercelToken(e.target.value)}
              placeholder="Token Gratuito Vercel (opcional p/ .vercel.app)"
              className={`px-3.5 py-2 rounded-xl border text-[12px] w-64 outline-none ${borderCol} ${subtleBg}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const pBiz = proj.data?.business || {};
            const liveUrl = deployUrlMap[proj.id] || `/site/${proj.slug}`;
            const isSavedInFirestore = firestorePages.some(
              (fp) => fp.id === proj.id || fp.slug === proj.slug
            );
            return (
              <div
                key={proj.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 ${borderCol} ${subtleBg}`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-[#1A73E8]">
                        {pBiz.category || proj.archetype}
                      </span>
                      <h3 className="text-[16px] font-bold mt-0.5">{proj.name}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(proj.id)}
                      className={`p-1.5 rounded-lg hover:bg-black/10 ${mutedText}`}
                      title="Remover site"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className={`text-[12px] flex items-center justify-between gap-2 ${mutedText}`}>
                    <span>
                      {pBiz.city || "Brasil"} · Slug: <span className="font-mono">/{proj.slug}</span>
                    </span>
                    {isSavedInFirestore && (
                      <span className="text-[10.5px] font-bold text-[#34A853]">
                        Salvo no Firestore
                      </span>
                    )}
                  </div>

                  <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-[12px] ${borderCol} ${dark ? "bg-[#303134]" : "bg-white"}`}>
                    <a
                      href={liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#1A73E8] font-mono truncate hover:underline flex items-center gap-1"
                    >
                      <Globe size={13} /> {liveUrl}
                    </a>
                    <a
                      href={liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold text-[#1A73E8] shrink-0"
                    >
                      Abrir
                    </a>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-inherit">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenEditor && onOpenEditor(proj)}
                      className="py-2 px-3 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 size={13} /> Editar Visual
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadHtml(proj)}
                      className={`py-2 px-3 rounded-xl border text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${borderCol} ${
                        dark ? "bg-[#303134]" : "bg-white"
                      }`}
                    >
                      <Download size={13} /> Baixar HTML
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={savingPageId === proj.id}
                      onClick={() => handleSaveSingleToFirestore(proj)}
                      data-testid={`save-firestore-lp-${proj.id}`}
                      className={`py-2 px-3 rounded-xl border text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${borderCol} ${
                        dark ? "bg-[#303134] hover:border-[#1A73E8]" : "bg-white hover:border-[#1A73E8]"
                      }`}
                    >
                      <Database size={13} className="text-[#1A73E8]" />
                      <span>
                        {savingPageId === proj.id
                          ? "Salvando..."
                          : "Salvar Firestore"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={deployingId === proj.id}
                      onClick={() => handleDeployFree(proj)}
                      className="py-2 px-3 rounded-xl bg-[#34A853] hover:opacity-95 text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Rocket size={13} />
                      <span>
                        {deployingId === proj.id ? "Publicando..." : "Publicar Gratis"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FIRESTORE CLOUD PERSISTENCE: LANDING PAGES (/landing_pages) & USER PROFILE (/users) */}
      <section
        className={`rounded-2xl p-5 sm:p-6 space-y-5 ${cardClass}`}
        data-testid="firestore-persistence-panel"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-inherit">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1A73E8]">
              Firebase Firestore Cloud · gen-lang-client-0860310554
            </div>
            <h2 className="text-[19px] font-bold mt-0.5">
              Persistência no Firestore: Landing Pages Geradas (<code className="font-mono text-[16px] text-[#1A73E8]">/landing_pages</code>) e Perfil de Usuário (<code className="font-mono text-[16px] text-[#1A73E8]">/users</code>)
            </h2>
            <p className={`text-[12.5px] mt-0.5 ${mutedText}`}>
              Dados validados pelo esquema estrito do arquivo <code className="font-mono">firebase-blueprint.json</code> e protegidos pelas regras de segurança <code className="font-mono">firestore.rules</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {fbUser ? (
              <button
                type="button"
                onClick={() => loadFirestoreData(fbUser)}
                disabled={loadingFirestore}
                className={`px-3.5 py-2 rounded-xl border text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer ${borderCol} ${subtleBg}`}
              >
                <RefreshCw size={14} className={loadingFirestore ? "animate-spin text-[#1A73E8]" : "text-[#1A73E8]"} />
                <span>Atualizar Dados do Firestore</span>
              </button>
            ) : (
              <GoogleSignInButton
                loading={fbAuthBusy}
                label="Conectar Google p/ Firestore"
                onClick={async () => {
                  setFbAuthBusy(true);
                  try {
                    const res = await googleSignIn();
                    if (res?.user) {
                      setFbUser(res.user);
                      await loadFirestoreData(res.user);
                      toast.success(`Conectado ao Firestore como ${res.user.email}`);
                    }
                  } catch (err) {
                    toast.error("Falha ao autenticar no Firebase Auth");
                  } finally {
                    setFbAuthBusy(false);
                  }
                }}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* User Profile Persistence Card (/users/{userId}) */}
          <form
            onSubmit={handleSaveUserProfile}
            className={`lg:col-span-5 rounded-2xl border p-5 space-y-4 ${borderCol} ${subtleBg}`}
            data-testid="firestore-user-profile-form"
          >
            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <div className="flex items-center gap-2">
                <UserCheck size={17} className="text-[#1A73E8]" />
                <h3 className="text-[15px] font-bold">
                  Perfil do Usuário (<code className="font-mono text-[13px] text-[#1A73E8]">/users/&#123;uid&#125;</code>)
                </h3>
              </div>
              <span className={`text-[11px] font-mono ${mutedText}`}>
                {fbUser ? `UID: ${fbUser.uid.slice(0, 10)}...` : "Desconectado"}
              </span>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className={`block text-[11px] font-semibold uppercase mb-1 ${mutedText}`}>
                  Nome Completo / Consultor
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Marcus Henrique Pires Dias"
                  maxLength={120}
                  required
                  className={`w-full px-3.5 py-2 rounded-xl border outline-none ${borderCol} ${dark ? "bg-[#303134]" : "bg-white"}`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-semibold uppercase mb-1 ${mutedText}`}>
                  Nome da Agencia / Operacao
                </label>
                <input
                  type="text"
                  value={profileForm.agencyName}
                  onChange={(e) => setProfileForm((p) => ({ ...p, agencyName: e.target.value }))}
                  placeholder="G360 Google Business Intelligence"
                  maxLength={160}
                  className={`w-full px-3.5 py-2 rounded-xl border outline-none ${borderCol} ${dark ? "bg-[#303134]" : "bg-white"}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[11px] font-semibold uppercase mb-1 ${mutedText}`}>
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="(62) 99113-8004"
                    maxLength={40}
                    className={`w-full px-3.5 py-2 rounded-xl border outline-none ${borderCol} ${dark ? "bg-[#303134]" : "bg-white"}`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-semibold uppercase mb-1 ${mutedText}`}>
                    Plano Ativo
                  </label>
                  <select
                    value={profileForm.plan}
                    onChange={(e) => setProfileForm((p) => ({ ...p, plan: e.target.value }))}
                    className={`w-full px-3.5 py-2 rounded-xl border font-semibold outline-none ${borderCol} ${dark ? "bg-[#303134]" : "bg-white"}`}
                  >
                    <option value="g360_full">G360 Completo</option>
                    <option value="site_express_only">Site Express</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={!fbUser || savingProfile}
                data-testid="save-firestore-profile-btn"
                className="w-full py-2.5 px-4 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-[13px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save size={15} />
                <span>
                  {savingProfile
                    ? "Salvando Perfil no Firestore..."
                    : "Salvar Perfil no Firestore (/users)"}
                </span>
              </button>
            </div>
          </form>

          {/* Saved Landing Pages in Firestore (/landing_pages/{pageId}) */}
          <div className={`lg:col-span-7 rounded-2xl border p-5 space-y-4 ${borderCol} ${subtleBg}`}>
            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <div className="flex items-center gap-2">
                <Database size={17} className="text-[#34A853]" />
                <h3 className="text-[15px] font-bold">
                  Landing Pages Persistidas no Firestore ({firestorePages.length})
                </h3>
              </div>
              <span className={`text-[11px] font-mono ${mutedText}`}>
                Colecao: /landing_pages
              </span>
            </div>

            {!fbUser ? (
              <div className={`p-6 rounded-xl border text-center text-[13px] ${borderCol} ${mutedText}`}>
                Autentique-se com sua conta Google acima para visualizar, salvar e sincronizar suas Landing Pages diretamente no banco Firestore.
              </div>
            ) : firestorePages.length === 0 ? (
              <div className={`p-6 rounded-xl border text-center text-[13px] ${borderCol} ${mutedText}`}>
                Nenhuma Landing Page salva no Firestore ainda. Clique em <strong>"Salvar Firestore"</strong> em qualquer site acima ou em <strong>"Sincronizar Todos no Firestore"</strong>.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {firestorePages.map((lp) => (
                  <div
                    key={lp.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12.5px] ${borderCol} ${
                      dark ? "bg-[#303134]" : "bg-white"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-[14px] flex items-center gap-2">
                        <span>{lp.name}</span>
                        <span className="text-[11px] font-mono text-[#1A73E8]">
                          /{lp.slug}
                        </span>
                      </div>
                      <div className={mutedText}>
                        {lp.category} · {lp.city} · Modelo: <strong>{lp.templateId}</strong> ({lp.archetype})
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestoreFirestorePageToEditor(lp)}
                        className="px-3 py-1.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[11.5px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={12} /> Abrir no Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFromFirestore(lp.id)}
                        className={`p-1.5 rounded-lg hover:bg-black/10 ${mutedText} cursor-pointer`}
                        title="Excluir do Firestore"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
