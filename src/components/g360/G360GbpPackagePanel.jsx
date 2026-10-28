import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Layers,
  Tag,
  FileText,
  ShoppingBag,
  Calendar,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  Link2,
  Building2,
  Plus,
  Download,
  ExternalLink,
  ShieldCheck,
  PhoneCall,
  Palette,
  CheckSquare,
  Square,
  Trash2,
  Edit3,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Save,
  Undo,
} from "lucide-react";
import { api, fmtErr } from "@/lib/api";

// 3 Curated Palettes for Brand Identity Selection
const SUGGESTED_PALETTES = [
  {
    id: "violet-elegance",
    name: "Moderna & Tecnológica (Violeta & Lavanda)",
    description: "Sofisticada, inovadora e premium. Transmite autoridade e design moderno.",
    primary: "#7C3AED",
    secondary: "#A855F7",
    accent: "#EDE9FE",
    darkText: "#1A1033",
    lightText: "#FFFFFF",
  },
  {
    id: "navy-confidence",
    name: "Corporativa & Confiável (Azul Marinho & Ciano)",
    description: "Firmeza, estabilidade e credibilidade para negócios estabelecidos e B2B.",
    primary: "#0F172A",
    secondary: "#0284C7",
    accent: "#E0F2FE",
    darkText: "#0F172A",
    lightText: "#FFFFFF",
  },
  {
    id: "emerald-vitality",
    name: "Orgânica & Vital (Esmeralda & Âmbar)",
    description: "Acolhedora, próspera e humana. Ideal para serviços locais, saúde e bem-estar.",
    primary: "#065F46",
    secondary: "#059669",
    accent: "#ECFDF5",
    darkText: "#064E3B",
    lightText: "#FFFFFF",
  },
];

import { useAuth } from "@/context/AuthContext";
import { buildApprovedSiteBriefing, gbpBusinessKey } from "@/lib/ai/gbpApproval.js";

export default function G360GbpPackagePanel(props) {
  const { user } = useAuth();
  const ownerUid = user?.uid || user?.id || "";
  const identity = gbpBusinessKey(ownerUid, props.activeBusiness);
  if (!ownerUid || !props.activeBusiness?.name) return <p role="status">Entre na sua conta e selecione uma empresa para preparar o Pacote GBP.</p>;
  return <GbpPackageContent {...props} key={identity} ownerUid={ownerUid} businessKey={identity} />;
}

function GbpPackageContent({
  ownerUid, businessKey,
  dark = false,
  activeBusiness,
  onOpenSiteExpressWithBriefing,
}) {
  const [pkg, setPkg] = useState(null);
  const alive = useRef(true);
  const requestId = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [loading, setLoading] = useState(false);
  // 9-step workflow:
  // "info" | "logo" | "palettes" | "identity_approval" | "content" | "ai_generation" | "review" | "package_approval" | "export_site"
  const [activeStep, setActiveStep] = useState("info");
  const [copiedId, setCopiedId] = useState("");
  const [customDifferential, setCustomDifferential] = useState("");
  const [gbpConnected, setGbpConnected] = useState(false);
  const [syncingField, setSyncingField] = useState("");

  // Brand Identity State
  const [selectedPalette, setSelectedPalette] = useState(SUGGESTED_PALETTES[0]);
  const [logoPreview, setLogoPreview] = useState(null);
  const [identityApproved, setIdentityApproved] = useState(false);
  const [packageApproved, setPackageApproved] = useState(false);

  // Individual Approvals Map: { [itemId: string]: boolean }
  const [approvedItems, setApprovedItems] = useState({});

  // Last Saved Draft Timestamp
  const [lastSavedDraft, setLastSavedDraft] = useState(null);

  // Inline editing state for items
  const [editingItemId, setEditingItemId] = useState(null);
  const [editBuffer, setEditBuffer] = useState("");

  // Confirmation modal for deleting photos
  const [photoToDelete, setPhotoToDelete] = useState(null);

  // Custom Service Form
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");
  const [userPhotos, setUserPhotos] = useState([]);

  const cardClass = dark
    ? "bg-[#14121E] border border-white/[0.08] text-[#EDE9FE] shadow-[0_4px_20px_rgba(0,0,0,0.35)] rounded-2xl"
    : "bg-white border border-slate-200/80 text-[#1A1033] shadow-[0_2px_12px_rgba(0,0,0,0.04)] rounded-2xl";
  const mutedText = dark ? "text-[#9D98B3]" : "text-[#64748B]";
  const subtleBg = dark ? "bg-white/[0.04]" : "bg-slate-50";
  const borderCol = dark ? "border-white/[0.08]" : "border-slate-200/80";

  const draftKey = `g360_gbp_v1_${businessKey}`;
  const generatePackage = async (bizOverride) => {
    const current = ++requestId.current;
    setLoading(true);
    try {
      const target = bizOverride || activeBusiness;
      if (!target?.name) return;
      const { data } = await api.post("/g360/gbp-package/generate", { business:target, customDifferential });
      if (!alive.current || current !== requestId.current) return;
      if (data?.pkg) {
        setPkg(data.pkg);
        const palette = data.pkg.branding?.colorPalettes?.[0];
        if (palette) setSelectedPalette({...palette,darkText:"#1A1033",lightText:"#FFFFFF"});
      }
    } catch (e) {
      if (alive.current && current === requestId.current) toast.error(fmtErr(e,"Erro ao preparar o pacote GBP"));
    } finally { if (alive.current && current === requestId.current) setLoading(false); }
  };
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (parsed?.ownerUid === ownerUid && parsed?.businessKey === businessKey && parsed?.pkg) {
        setPkg(parsed.pkg); setUserPhotos(parsed.userPhotos || []);
        if (parsed.selectedPalette) setSelectedPalette(parsed.selectedPalette);
        if (parsed.logoPreview) setLogoPreview(parsed.logoPreview);
        // Saved drafts are editable content, not proof of an approval in this session.
        return;
      }
    } catch { /* An invalid draft must not leak into another business. */ }
    generatePackage(activeBusiness);
  }, []);
  useEffect(() => {
    setApprovedItems({}); setPackageApproved(false); setIdentityApproved(false);
  }, [pkg, selectedPalette, logoPreview]);
  const openApprovedSite = () => {
    try {
      const briefing = buildApprovedSiteBriefing({pkg,approvedItems,identityApproved,packageApproved,selectedPalette,logoPreview,userPhotos,businessKey,ownerUid});
      onOpenSiteExpressWithBriefing?.(activeBusiness,briefing);
    } catch (error) { toast.error(error.message); }
  };

  // Save Draft to LocalStorage
  const handleSaveDraft = () => {
    try {
      const payload = {
        pkg,
        ownerUid, businessKey,
        selectedPalette,
        logoPreview,
        identityApproved,
        packageApproved,
        approvedItems,
        userPhotos,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
      setLastSavedDraft(new Date());
      toast.success("Rascunho do Pacote GBP salvo com sucesso!");
    } catch (e) {
      toast.error("Não foi possível salvar o rascunho local.");
    }
  };

  const copyText = (text, id, label = "Conteúdo copiado") => {
    navigator.clipboard.writeText(String(text || ""));
    setCopiedId(id);
    toast.success(label);
    setTimeout(() => setCopiedId(""), 1800);
  };

  const handleSyncToGoogle = (sectionName, textToCopy) => {
    if (textToCopy) {
      navigator.clipboard.writeText(String(textToCopy));
      toast.success(`${sectionName} copiado! Abrindo painel do Google Meu Negócio...`);
    } else {
      toast.info("Abrindo painel oficial do Google Meu Negócio...");
    }
    window.open("https://business.google.com/", "_blank", "noopener,noreferrer");
  };

  const toggleItemApproval = (itemId) => {
    setApprovedItems((prev) => {
      const updated = { ...prev, [itemId]: !prev[itemId] };
      const statusText = updated[itemId] ? "Item aprovado individualmente" : "Item marcado como pendente";
      toast.info(statusText);
      return updated;
    });
  };

  const handleAddService = (e) => {
    e.preventDefault();
    if (!newServiceName.trim() || !pkg) return;
    const desc =
      newServiceDesc.trim() ||
      `${newServiceName.trim()}. Consulte disponibilidade nos canais oficiais de ${pkg.businessName}.`;
    const updated = {
      ...pkg,
      services: [
        {
          name: newServiceName.trim(),
          category: pkg.primaryCategory,
          localTerm: `${newServiceName.trim().toLowerCase()} ${pkg.city.toLowerCase()}`,
          description: desc.slice(0, 300),
        },
        ...(pkg.services || []),
      ],
    };
    setPkg(updated);
    setNewServiceName("");
    setNewServiceDesc("");
    toast.success("Serviço SEO adicionado ao pacote");
  };

  const handleDownloadPackageMarkdown = () => {
    if (!pkg) return;
    const md = `# PACOTE DE OTIMIZAÇÃO GBP & IDENTIDADE DA EMPRESA — ${pkg.businessName.toUpperCase()}
Cidade: ${pkg.city} - ${pkg.uf}
Telefone: ${pkg.phone}
WhatsApp Oficial: ${pkg.whatsappUrl}
Identidade Visual Aprovada: ${identityApproved ? "SIM" : "PENDENTE"}
Paleta Selecionada: ${selectedPalette.name} (Primária: ${selectedPalette.primary}, Secundária: ${selectedPalette.secondary})
Status Geral do Pacote: ${packageApproved ? "ITENS REVISADOS APROVADOS" : "EM ANDAMENTO"}

## 1. CATEGORIAS DO PERFIL
- Categoria Principal: ${pkg.primaryCategory}
- Categorias Adicionais:
${(pkg.additionalCategories || []).map((c) => `  * ${c}`).join("\n")}

## 2. DESCRIÇÃO COM SEO SEMÂNTICO (750 CARACTERES)
(${pkg.description750.length}/750 caracteres)
${pkg.description750}

## 3. SERVIÇOS OTIMIZADOS COM PALAVRAS-CHAVE LOCAIS (ATÉ 300 CARACTERES CADA)
${(pkg.services || [])
  .map(
    (s, i) =>
      `### ${i + 1}. ${s.name} (${s.category})\n- Termo local: ${s.localTerm}\n- Aprovado: ${approvedItems[`svc-${i}`] ? "SIM" : "NÃO"}\n- Descrição (${s.description.length}/300c): ${s.description}`
  )
  .join("\n\n")}

## 4. CATÁLOGO DE PRODUTOS GBP
${(pkg.products || [])
  .map((p, i) => `### Produto ${i + 1}: ${p.name} [${p.category}]\n- Preço/CTA: ${p.priceLabel}\n- Aprovado: ${approvedItems[`prod-${i}`] ? "SIM" : "NÃO"}\n- Descrição: ${p.description}`)
  .join("\n\n")}

## 5. CRONOGRAMA DE 10 PUBLICAÇÕES AGENDADAS (ATÉ 1.500 CARACTERES)
${(pkg.posts || [])
  .map(
    (pt) =>
      `### Post #${pt.number} — ${pt.title} (${pt.objective})\n- Data sugerida: ${pt.scheduledDate} às ${pt.scheduledTime}\n- Botão CTA: ${pt.ctaType} (${pt.ctaPhone})\n- Direção de Foto: ${pt.imageDirection}\n- Aprovado: ${approvedItems[`post-${pt.number}`] ? "SIM" : "NÃO"}\n- Texto (${pt.charCount}/1500c):\n${pt.text}`
  )
  .join("\n\n")}

## 6. NOMES SEO PARA ARQUIVOS DE FOTOGRAFIA
${(pkg.photoSeoNames || []).map((f) => `- ${f}`).join("\n")}
`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pacote-gbp-${pkg.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Documento completo do Pacote GBP baixado!");
  };

  // Steps definition for 9-step workflow
  const STEPS = [
    { id: "info", stepNum: "01", label: "Informações", fullTitle: "01. Informações da Empresa & Categorias", icon: Building2 },
    { id: "logo", stepNum: "02", label: "Logomarca", fullTitle: "02. Logomarca & Marca Visual", icon: ImageIcon },
    { id: "palettes", stepNum: "03", label: "3 Paletas", fullTitle: "03. 3 Paletas de Cores Sugeridas", icon: Palette },
    { id: "identity_approval", stepNum: "04", label: "Aprovação Identidade", fullTitle: "04. Aprovação da Identidade Visual", icon: ShieldCheck },
    { id: "content", stepNum: "05", label: "Bio, Serviços & Produtos", fullTitle: "05. Bio 750c, Serviços e Catálogo", icon: FileText },
    { id: "ai_generation", stepNum: "06", label: "Geração IA", fullTitle: "06. Geração IA (Textos, Posts & Imagens)", icon: Sparkles },
    { id: "review", stepNum: "07", label: "Revisão Individual", fullTitle: "07. Revisão Individual & Aprovação", icon: CheckSquare },
    { id: "package_approval", stepNum: "08", label: "Aprovação Pacote", fullTitle: "08. Aprovação do Pacote GBP", icon: CheckCircle2 },
    { id: "export_site", stepNum: "09", label: "Envio Site Express", fullTitle: "09. Envio Direto ao Site Express", icon: Layers },
  ];

  const currentStepIndex = STEPS.findIndex((s) => s.id === activeStep);
  const goToNextStep = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setActiveStep(STEPS[currentStepIndex + 1].id);
    }
  };
  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setActiveStep(STEPS[currentStepIndex - 1].id);
    }
  };

  // Stats calculation
  const totalItemsCount = 1 + (pkg?.services?.length || 0) + (pkg?.products?.length || 0) + (pkg?.posts?.length || 0);
  const approvedCount = Object.values(approvedItems).filter(Boolean).length;

  if (!pkg) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-12 text-center">
        <RefreshCw size={24} className="animate-spin mx-auto text-[#7C3AED]" />
        <p className={`mt-3 text-[14px] ${mutedText}`}>Preparando pacote de otimização GBP...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* TOP HEADER: Active Profile + Fast Actions + Draft Saving */}
      <section className={`rounded-2xl p-5 sm:p-6 ${cardClass}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-inherit">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#9333EA] text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                <span className="px-2 py-0.5 rounded-full bg-[#7C3AED]/10 dark:bg-[#7C3AED]/20 border border-[#7C3AED]/20">
                  Pacote GBP · 9 Etapas Completas
                </span>
                <span>·</span>
                <span>Padrão Google Meu Negócio</span>
              </div>
              <h1 className="text-[22px] sm:text-[25px] font-extrabold tracking-tight mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">
                {pkg.businessName} — {pkg.city}/{pkg.uf}
              </h1>
              <p className={`text-[13px] mt-0.5 ${mutedText}`}>
                Fluxo integrado: da taxonomia oficial do Google à logomarca, paleta, publicações e envio direto ao Site Express.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Draft Save Button with Status */}
            <button
              type="button"
              onClick={handleSaveDraft}
              className={`px-4 py-2.5 rounded-full border text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-all ${borderCol} ${subtleBg} hover:border-[#7C3AED] hover:text-[#7C3AED]`}
              title="Salva todo o progresso atual no navegador"
            >
              <Save size={15} className="text-[#7C3AED]" />
              <span>Salvar Rascunho</span>
              {lastSavedDraft && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                  {lastSavedDraft.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setGbpConnected((v) => !v);
                toast.success(
                  !gbpConnected
                    ? "Conta Google Business Profile conectada em modo Proprietário/Gerente!"
                    : "Modo de edição local ativado."
                );
              }}
              className={`px-4 py-2.5 rounded-full border text-[13px] font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                gbpConnected
                  ? "bg-[#16A34A] border-[#16A34A] text-white shadow-sm"
                  : `${borderCol} ${subtleBg} hover:border-[#7C3AED] hover:text-[#7C3AED]`
              }`}
              data-testid="connect-gbp-oauth-btn"
            >
              <ShieldCheck size={16} className={gbpConnected ? "text-white" : "text-[#7C3AED] dark:text-[#A78BFA]"} />
              <span>{gbpConnected ? "Google Conectado" : "Conectar Google (Gestor)"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPackageMarkdown}
              className={`px-4 py-2.5 rounded-full border text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-all ${borderCol} ${subtleBg} hover:border-[#7C3AED] hover:text-[#7C3AED]`}
            >
              <Download size={15} className="text-[#7C3AED] dark:text-[#A78BFA]" />
              <span>Baixar Pacote</span>
            </button>

            <button
              type="button"
              onClick={openApprovedSite}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A855F7] hover:opacity-95 text-white text-[13px] font-semibold flex items-center gap-2 shadow-md shadow-purple-500/25 transition-all cursor-pointer"
              data-testid="transfer-to-site-express-btn"
            >
              <Layers size={15} />
              <span>Abrir no Site Express</span>
            </button>
          </div>
        </div>

        {/* 9-STEP WORKFLOW STEPPER BAR */}
        <div className="pt-5 space-y-3">
          <div className="flex items-center justify-between text-[12px] font-semibold">
            <span className={mutedText}>
              Etapa {currentStepIndex + 1} de {STEPS.length}:{" "}
              <strong className={dark ? "text-[#EDE9FE]" : "text-[#1A1033]"}>
                {STEPS[currentStepIndex].fullTitle}
              </strong>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 font-bold">
                {approvedCount}/{totalItemsCount} Itens Aprovados
              </span>
              {identityApproved && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <Check size={11} /> Identidade OK
                </span>
              )}
            </div>
          </div>

          {/* Stepper pills scrollable container */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = activeStep === s.id;
              const isPast = idx < currentStepIndex;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStep(s.id)}
                  className={`px-3.5 py-2 rounded-full text-[12px] font-semibold border flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? "bg-gradient-to-r from-[#7C3AED] to-[#9333EA] border-transparent text-white shadow-md shadow-purple-500/20"
                      : isPast
                      ? "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                      : `${borderCol} ${subtleBg} ${mutedText} hover:text-[#7C3AED] hover:border-[#7C3AED]`
                  }`}
                  data-testid={`gbp-step-btn-${s.id}`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                      isActive
                        ? "bg-white text-purple-700"
                        : isPast
                        ? "bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-200"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {isPast ? "✓" : idx + 1}
                  </span>
                  <Icon size={14} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* STEP 1: INFORMAÇÕES DA EMPRESA & CATEGORIAS */}
      {activeStep === "info" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Categories & WhatsApp Link */}
          <div className={`lg:col-span-5 rounded-2xl p-5 sm:p-6 space-y-5 ${cardClass}`}>
            <div className="flex items-center justify-between border-b pb-3 border-inherit">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                  Taxonomia Oficial Google
                </div>
                <h2 className="text-[17px] font-bold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">Categorias Empresariais</h2>
              </div>
              <button
                type="button"
                onClick={() => handleSyncToGoogle("Categorias Empresariais")}
                className="px-3 py-1.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] text-[12px] font-semibold hover:bg-[#7C3AED] hover:text-white transition-colors cursor-pointer"
              >
                {syncingField === "Categorias Empresariais" ? "Aplicando..." : "Aplicar na Ficha"}
              </button>
            </div>

            <div className="space-y-3">
              <div className={`p-3.5 rounded-xl border ${borderCol} ${subtleBg} flex items-center justify-between gap-2`}>
                <div>
                  <div className="text-[11px] font-bold uppercase text-[#7C3AED] dark:text-[#A78BFA]">Categoria Principal</div>
                  <div className="font-bold text-[15px] mt-0.5">{pkg.primaryCategory}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(pkg.primaryCategory, "cat-main", "Categoria principal copiada")}
                  className={`p-2 rounded-lg border ${borderCol} hover:border-[#7C3AED] cursor-pointer`}
                >
                  {copiedId === "cat-main" ? <Check size={15} className="text-[#16A34A]" /> : <Copy size={15} />}
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[12px] font-semibold ${mutedText}`}>
                    Categorias Adicionais Recomendadas ({pkg.additionalCategories?.length || 0})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyText((pkg.additionalCategories || []).join(", "), "cat-all", "Todas as categorias copiadas")
                    }
                    className="text-[12px] font-semibold text-[#7C3AED] dark:text-[#A78BFA] hover:underline cursor-pointer"
                  >
                    Copiar todas
                  </button>
                </div>
                <div className="space-y-2">
                  {(pkg.additionalCategories || []).map((cat, idx) => (
                    <div
                      key={idx}
                      className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-[13px] ${borderCol} ${subtleBg}`}
                    >
                      <span className="font-medium">{cat}</span>
                      <button
                        type="button"
                        onClick={() => copyText(cat, `cat-${idx}`, `Categoria "${cat}" copiada`)}
                        className="text-[#7C3AED] dark:text-[#A78BFA] hover:opacity-80 cursor-pointer"
                      >
                        {copiedId === `cat-${idx}` ? <Check size={14} className="text-[#16A34A]" /> : <Copy size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Official WhatsApp Chat URL */}
            <div className="pt-4 border-t border-inherit space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                Campo Chat / WhatsApp do Google Meu Negócio
              </div>
              <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${borderCol} ${subtleBg}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 size={16} className="text-[#7C3AED] dark:text-[#A78BFA] shrink-0" />
                  <span className="font-mono text-[13px] truncate">{pkg.whatsappUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(pkg.whatsappUrl, "wa-url", "Link de WhatsApp copiado")}
                  className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-[12px] font-semibold shrink-0 shadow-sm cursor-pointer hover:opacity-95"
                >
                  {copiedId === "wa-url" ? "Copiado" : "Copiar Link"}
                </button>
              </div>
            </div>
          </div>

          {/* Quick info edit & summary */}
          <div className={`lg:col-span-7 rounded-2xl p-5 sm:p-6 space-y-4 ${cardClass}`}>
            <div className="border-b pb-3 border-inherit">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                Dados Cadastrais da Ficha
              </div>
              <h2 className="text-[17px] font-bold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">Identificação e Localização</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`text-[12px] font-semibold ${mutedText}`}>Nome Comercial</label>
                <input
                  type="text"
                  value={pkg.businessName}
                  onChange={(e) => setPkg((p) => ({ ...p, businessName: e.target.value }))}
                  className={`w-full mt-1 px-3.5 py-2.5 rounded-xl border text-[14px] font-bold ${borderCol} ${subtleBg} outline-none focus:border-[#7C3AED]`}
                />
              </div>

              <div>
                <label className={`text-[12px] font-semibold ${mutedText}`}>Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={pkg.phone}
                  onChange={(e) => setPkg((p) => ({ ...p, phone: e.target.value }))}
                  className={`w-full mt-1 px-3.5 py-2.5 rounded-xl border text-[14px] font-mono ${borderCol} ${subtleBg} outline-none focus:border-[#7C3AED]`}
                />
              </div>

              <div>
                <label className={`text-[12px] font-semibold ${mutedText}`}>Cidade de Atendimento</label>
                <input
                  type="text"
                  value={pkg.city}
                  onChange={(e) => setPkg((p) => ({ ...p, city: e.target.value }))}
                  className={`w-full mt-1 px-3.5 py-2.5 rounded-xl border text-[14px] ${borderCol} ${subtleBg} outline-none focus:border-[#7C3AED]`}
                />
              </div>

              <div>
                <label className={`text-[12px] font-semibold ${mutedText}`}>Estado (UF)</label>
                <input
                  type="text"
                  value={pkg.uf}
                  onChange={(e) => setPkg((p) => ({ ...p, uf: e.target.value }))}
                  className={`w-full mt-1 px-3.5 py-2.5 rounded-xl border text-[14px] font-mono ${borderCol} ${subtleBg} outline-none focus:border-[#7C3AED]`}
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <span className={`text-[12px] ${mutedText}`}>
                Dados informados para revisão — origem e aprovação devem ser confirmadas
              </span>
              <button
                type="button"
                onClick={goToNextStep}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-[13px] font-semibold flex items-center gap-2 shadow-sm hover:opacity-95 cursor-pointer"
              >
                <span>Avançar para Logomarca</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: LOGOMARCA & MARCA VISUAL */}
      {activeStep === "logo" && (
        <section className={`rounded-2xl p-5 sm:p-6 space-y-6 ${cardClass}`}>
          <div className="border-b pb-4 border-inherit flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                Identidade Visual · Logomarca Oficial (Proporção 1:1)
              </div>
              <h2 className="text-[19px] font-extrabold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">
                Logotipo para Ficha do Google e Header do Site
              </h2>
            </div>
            <span className="text-[12px] font-semibold text-purple-600 dark:text-purple-300 bg-purple-500/10 px-3 py-1 rounded-full">
              Formato Recomendado: PNG Transparente 512x512 ou WebP
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Preview Box */}
            <div className="md:col-span-4 flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-[#7C3AED]/30 bg-purple-50/50 dark:bg-purple-950/20 text-center space-y-3">
              <div className="w-32 h-32 rounded-2xl bg-white dark:bg-[#1A1630] border border-[rgba(124,58,237,0.2)] shadow-md flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logomarca" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon size={36} className="text-[#7C3AED]/50" />
                    <span className="text-[11px] mt-1 font-semibold">Sem Logotipo</span>
                  </div>
                )}
              </div>
              <div className="text-[13px] font-bold text-[#1A1033] dark:text-[#EDE9FE]">
                {logoPreview ? "Logotipo Carregado" : "Nenhum logotipo selecionado"}
              </div>
            </div>

            {/* Upload or Mock Generator Actions */}
            <div className="md:col-span-8 space-y-4">
              <div className="space-y-2">
                <h3 className="text-[15px] font-bold text-[#1A1033] dark:text-[#EDE9FE]">
                  Selecione o arquivo da logomarca
                </h3>
                <p className={`text-[13px] ${mutedText}`}>
                  O logotipo será utilizado automaticamente como avatar da ficha GBP, favicon e logotipo no cabeçalho do futuro site.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-[13px] font-semibold cursor-pointer shadow-sm hover:opacity-95 flex items-center gap-2">
                  <Upload size={15} />
                  <span>Fazer Upload do Logotipo</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setLogoPreview(reader.result);
                        toast.success("Logotipo carregado com sucesso!");
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>

                {logoPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreview(null);
                      toast.info("Logotipo removido.");
                    }}
                    className="px-4 py-2.5 rounded-full border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 text-[13px] font-semibold cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span>Remover Logotipo</span>
                  </button>
                )}
              </div>

              <div className={`p-4 rounded-xl border ${borderCol} ${subtleBg} flex items-center justify-between`}>
                <div className="flex items-center gap-2.5">
                  <Sparkles size={18} className="text-[#7C3AED]" />
                  <span className="text-[12.5px] font-medium">
                    Não possui logotipo profissional? A IA do G360 pode estruturar um monograma estilizado no Site Express.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-inherit flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevStep}
              className={`px-4 py-2 rounded-full border text-[13px] font-semibold flex items-center gap-1.5 ${borderCol}`}
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <button
              type="button"
              onClick={goToNextStep}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-[13px] font-semibold flex items-center gap-2 shadow-sm hover:opacity-95 cursor-pointer"
            >
              <span>Avançar para 3 Paletas</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: 3 PALETAS DE CORES SUGERIDAS */}
      {activeStep === "palettes" && (
        <section className={`rounded-2xl p-5 sm:p-6 space-y-6 ${cardClass}`}>
          <div className="border-b pb-4 border-inherit">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
              Harmonia Cromática · 3 Direções Visuais
            </div>
            <h2 className="text-[19px] font-extrabold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">
              Selecione a Paleta de Cores para a Marca
            </h2>
            <p className={`text-[13px] mt-0.5 ${mutedText}`}>
              A paleta escolhida definirá os botões, banners de posts e os estilos de temas do site gerado para este cliente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(pkg.branding?.colorPalettes || SUGGESTED_PALETTES).map((pal) => {
              const isSelected = selectedPalette.id === pal.id;
              return (
                <div
                  key={pal.id}
                  onClick={() => {
                    setSelectedPalette(pal);
                    toast.success(`Paleta "${pal.name.split(" ")[0]}" selecionada!`);
                  }}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                    isSelected
                      ? "border-[#7C3AED] bg-purple-50/40 dark:bg-purple-950/20 shadow-md ring-2 ring-[#7C3AED]/20"
                      : `${borderCol} ${subtleBg} hover:border-[#7C3AED]/50`
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold text-[#7C3AED] dark:text-[#A78BFA]">
                        {pal.name.split("(")[0]}
                      </span>
                      {isSelected ? (
                        <span className="w-5 h-5 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-[11px] font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700" />
                      )}
                    </div>

                    {/* Color Swatches */}
                    <div className="flex items-center gap-2">
                      <div
                        className="w-10 h-10 rounded-xl shadow-inner border border-black/10 flex items-center justify-center text-[10px] text-white font-mono font-bold"
                        style={{ backgroundColor: pal.primary }}
                        title="Cor Primária"
                      />
                      <div
                        className="w-10 h-10 rounded-xl shadow-inner border border-black/10 flex items-center justify-center text-[10px] text-white font-mono font-bold"
                        style={{ backgroundColor: pal.secondary }}
                        title="Cor Secundária"
                      />
                      <div
                        className="w-10 h-10 rounded-xl shadow-inner border border-black/10 flex items-center justify-center text-[10px] font-mono font-bold"
                        style={{ backgroundColor: pal.accent, color: pal.darkText }}
                        title="Cor de Fundo / Realce"
                      />
                    </div>

                    <p className={`text-[12.5px] leading-relaxed ${mutedText}`}>{pal.description}</p>
                  </div>

                  <div className="pt-3 border-t border-inherit flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>{pal.primary}</span>
                    <span>{pal.secondary}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-inherit flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevStep}
              className={`px-4 py-2 rounded-full border text-[13px] font-semibold flex items-center gap-1.5 ${borderCol}`}
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <button
              type="button"
              onClick={goToNextStep}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-[13px] font-semibold flex items-center gap-2 shadow-sm hover:opacity-95 cursor-pointer"
            >
              <span>Avançar para Aprovação da Identidade</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: APROVAÇÃO DA IDENTIDADE VISUAL */}
      {activeStep === "identity_approval" && (
        <section className={`rounded-2xl p-5 sm:p-6 space-y-6 ${cardClass}`}>
          <div className="border-b pb-4 border-inherit">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
              Consolidação de Marca · Checkpoint de Aprovação
            </div>
            <h2 className="text-[19px] font-extrabold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">
              Aprovação da Identidade Visual da Empresa
            </h2>
            <p className={`text-[13px] mt-0.5 ${mutedText}`}>
              Valide o conjunto de logotipo e paleta antes de avançar para a produção de conteúdo denso.
            </p>
          </div>

          {/* Identity Approval Summary Card */}
          <div className="p-6 rounded-2xl border border-[rgba(124,58,237,0.2)] bg-gradient-to-br from-white to-purple-50/30 dark:from-[#1E1A2E] dark:to-[#1A1630] space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="w-24 h-24 rounded-2xl bg-white dark:bg-[#1A1630] border border-[rgba(124,58,237,0.2)] shadow-md flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logotipo" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-center text-slate-400">
                    <Building2 size={28} className="mx-auto text-[#7C3AED]" />
                    <span className="text-[10px] font-semibold block mt-1">Logo Padrão</span>
                  </div>
                )}
              </div>

              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                  {pkg.primaryCategory}
                </span>
                <h3 className="text-[22px] font-extrabold text-[#1A1033] dark:text-[#EDE9FE]">{pkg.businessName}</h3>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                    Paleta: {selectedPalette.name.split("(")[0]}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                    {pkg.city} - {pkg.uf}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Palettes Swatch in Action */}
            <div className="p-4 rounded-xl border border-black/5 dark:border-white/5 bg-white/70 dark:bg-black/20 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold">Cores Oficiais da Marca:</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-6 h-6 rounded-lg inline-block border border-black/10"
                    style={{ backgroundColor: selectedPalette.primary }}
                  />
                  <span
                    className="w-6 h-6 rounded-lg inline-block border border-black/10"
                    style={{ backgroundColor: selectedPalette.secondary }}
                  />
                  <span
                    className="w-6 h-6 rounded-lg inline-block border border-black/10"
                    style={{ backgroundColor: selectedPalette.accent }}
                  />
                </div>
              </div>

              {/* Approval Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  setIdentityApproved((v) => !v);
                  if (!identityApproved) {
                    toast.success("Identidade Visual Aprovada!");
                  } else {
                    toast.info("Identidade Visual desmarcada.");
                  }
                }}
                className={`px-5 py-2.5 rounded-full font-bold text-[13px] flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                  identityApproved
                    ? "bg-[#16A34A] text-white hover:opacity-90"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-[#7C3AED] hover:text-white"
                }`}
              >
                {identityApproved ? <Check size={16} /> : <CheckCircle2 size={16} />}
                <span>{identityApproved ? "Identidade Aprovada ✓" : "Clique para Aprovar Identidade"}</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-inherit flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevStep}
              className={`px-4 py-2 rounded-full border text-[13px] font-semibold flex items-center gap-1.5 ${borderCol}`}
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <button
              type="button"
              onClick={goToNextStep}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-[13px] font-semibold flex items-center gap-2 shadow-sm hover:opacity-95 cursor-pointer"
            >
              <span>Avançar para Bio, Serviços e Produtos</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      )}

      {/* STEP 5: BIO, SERVIÇOS E PRODUTOS */}
      {activeStep === "content" && (
        <div className="space-y-6">
          {/* 750-Char Bio */}
          <div className={`rounded-2xl p-5 sm:p-6 space-y-4 ${cardClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-inherit">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                  SEO Semântico Local · Limite Oficial 750 Caracteres
                </div>
                <h2 className="text-[17px] font-bold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">
                  Descrição da Empresa no Google (Bio 750c)
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-[12px] font-bold tabular-nums px-2.5 py-1 rounded-full border ${borderCol} ${
                    pkg.description750.length > 750 ? "text-[#DC2626]" : "text-[#16A34A]"
                  }`}
                >
                  {pkg.description750.length} / 750 caracteres
                </span>
                <button
                  type="button"
                  onClick={() => copyText(pkg.description750, "desc-750", "Descrição de 750 caracteres copiada!")}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-95 cursor-pointer"
                >
                  {copiedId === "desc-750" ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedId === "desc-750" ? "Copiado!" : "Copiar Descrição"}</span>
                </button>
              </div>
            </div>

            <textarea
              rows={5}
              maxLength={750}
              value={pkg.description750}
              onChange={(e) =>
                setPkg((prev) => ({
                  ...prev,
                  description750: e.target.value,
                  descriptionCharCount: e.target.value.length,
                }))
              }
              className={`w-full p-4 rounded-xl border text-[14px] leading-relaxed outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all ${borderCol} ${subtleBg}`}
              data-testid="gbp-description-750-textarea"
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <input
                type="text"
                value={customDifferential}
                onChange={(e) => setCustomDifferential(e.target.value)}
                placeholder="Adicionar diferencial específico (ex: entrega em 20 min, projeto 3D grátis)..."
                className={`flex-1 px-3.5 py-2 rounded-xl border text-[13px] outline-none focus:border-[#7C3AED] ${borderCol} ${subtleBg}`}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => generatePackage(activeBusiness)}
                  className={`px-4 py-2 rounded-full border text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${borderCol} ${subtleBg} hover:border-[#7C3AED] hover:text-[#7C3AED]`}
                >
                  <RefreshCw size={14} className={loading ? "animate-spin text-[#7C3AED]" : ""} />
                  <span>Reescrever com IA</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSyncToGoogle("Descrição de 750 caracteres")}
                  className="px-4 py-2 rounded-full bg-[#16A34A] hover:opacity-90 text-white text-[12px] font-semibold shadow-sm cursor-pointer"
                >
                  Publicar no Perfil
                </button>
              </div>
            </div>
          </div>

          {/* Services Section */}
          <section className={`rounded-2xl p-5 sm:p-6 space-y-4 ${cardClass}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-inherit">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                  Estratégia de Palavras-Chave · Limite 300 Caracteres
                </div>
                <h3 className="text-[17px] font-bold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">
                  Serviços SEO ({pkg.services?.length || 0})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleSyncToGoogle("Serviços SEO")}
                className="px-4 py-2 rounded-full bg-[#7C3AED] text-white text-[12px] font-semibold hover:opacity-95"
              >
                Sincronizar Serviços no Google
              </button>
            </div>

            {/* Add Service Inline */}
            <form onSubmit={handleAddService} className={`p-4 rounded-xl border grid grid-cols-1 md:grid-cols-12 gap-3 ${borderCol} ${subtleBg}`}>
              <div className="md:col-span-4">
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Nome do Serviço / Palavra-Chave Local"
                  className={`w-full px-3.5 py-2 rounded-xl border text-[13px] outline-none focus:border-[#7C3AED] ${borderCol} ${dark ? "bg-[#1E1A2E]" : "bg-white"}`}
                />
              </div>
              <div className="md:col-span-6">
                <input
                  type="text"
                  maxLength={300}
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                  placeholder="Descrição de até 300 caracteres..."
                  className={`w-full px-3.5 py-2 rounded-xl border text-[13px] outline-none focus:border-[#7C3AED] ${borderCol} ${dark ? "bg-[#1E1A2E]" : "bg-white"}`}
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full h-full py-2 px-3 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(pkg.services || []).map((svc, idx) => (
                <div key={idx} className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${borderCol} ${subtleBg}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#7C3AED] dark:text-[#A78BFA]">
                        SERVIÇO #{String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className={`font-mono text-[11px] tabular-nums ${mutedText}`}>
                        {svc.description.length}/300c
                      </span>
                    </div>
                    <h4 className="font-bold text-[14px] text-[#1A1033] dark:text-[#EDE9FE]">{svc.name}</h4>
                    <p className={`text-[12.5px] leading-relaxed ${mutedText}`}>{svc.description}</p>
                  </div>
                  <div className={`pt-2.5 border-t ${borderCol} flex items-center justify-between`}>
                    <button
                      type="button"
                      onClick={() => copyText(svc.description, `svc-desc-${idx}`, "Descrição de 300c copiada")}
                      className="px-3 py-1 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] text-[11.5px] font-semibold hover:bg-[#7C3AED] hover:text-white transition-colors"
                    >
                      Copiar Texto
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Products Section */}
          <section className={`rounded-2xl p-5 sm:p-6 space-y-4 ${cardClass}`}>
            <div className="border-b pb-3 border-inherit">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                Vitrine de Produtos · Limite 1.000 Caracteres
              </div>
              <h3 className="text-[17px] font-bold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">
                Produtos Estruturados ({pkg.products?.length || 0})
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(pkg.products || []).map((prod, idx) => (
                <div key={idx} className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${borderCol} ${subtleBg}`}>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#7C3AED]">{prod.category}</span>
                    <h4 className="text-[15px] font-bold text-[#1A1033] dark:text-[#EDE9FE]">{prod.name}</h4>
                    <div className="text-[12px] font-semibold text-[#16A34A]">{prod.priceLabel}</div>
                    <p className={`text-[12.5px] leading-relaxed ${mutedText}`}>{prod.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(prod.description, `prod-d-${idx}`, "Descrição copiada")}
                    className="w-full py-1.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] text-[12px] font-semibold hover:bg-[#7C3AED] hover:text-white transition-colors"
                  >
                    Copiar Detalhes
                  </button>
                </div>
              ))}
            </div>
          </section>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevStep}
              className={`px-4 py-2 rounded-full border text-[13px] font-semibold flex items-center gap-1.5 ${borderCol}`}
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <button
              type="button"
              onClick={goToNextStep}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-[13px] font-semibold flex items-center gap-2 shadow-sm hover:opacity-95 cursor-pointer"
            >
              <span>Avançar para Geração IA</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: GERAÇÃO IA (TEXTOS, POSTS E IMAGENS) */}
      {activeStep === "ai_generation" && (
        <section className={`rounded-2xl p-5 sm:p-6 space-y-6 ${cardClass}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-inherit">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                Publicações Estratégicas · Limite Oficial 1.500 Caracteres
              </div>
              <h2 className="text-[19px] font-extrabold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">
                10 Publicações Agendadas com Direção de Fotografia
              </h2>
              <p className={`text-[13px] ${mutedText}`}>
                Textos densos, direcionamento de imagem para fotos reais ou IA, e chamada para ação configurada.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSyncToGoogle("10 Publicações")}
              className="px-5 py-2.5 rounded-full bg-[#16A34A] text-white text-[13px] font-semibold shadow-sm hover:opacity-90 cursor-pointer"
            >
              Agendar no Google Perfil
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(pkg.posts || []).map((post) => (
              <div
                key={post.number}
                className={`rounded-2xl border p-5 flex flex-col justify-between gap-3 ${borderCol} ${subtleBg}`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold uppercase text-[#7C3AED] dark:text-[#A78BFA]">
                      PUBLICAÇÃO #{String(post.number).padStart(2, "0")} · {post.objective}
                    </span>
                    <span className="text-[11px] font-mono font-semibold tabular-nums text-[#16A34A]">
                      Agendar: {post.scheduledDate}
                    </span>
                  </div>

                  <h3 className="text-[15px] font-bold text-[#1A1033] dark:text-[#EDE9FE]">{post.title}</h3>

                  <div
                    className={`p-3 rounded-xl border text-[12.5px] leading-relaxed max-h-[140px] overflow-y-auto whitespace-pre-line ${borderCol} ${
                      dark ? "bg-[#1E1A2E]" : "bg-white"
                    }`}
                  >
                    {post.text}
                  </div>

                  <div className={`text-[11.5px] space-y-1 ${mutedText}`}>
                    <div>
                      <strong className={dark ? "text-[#EDE9FE]" : "text-[#1A1033]"}>Direção da Foto: </strong>
                      {post.imageDirection}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#7C3AED] dark:text-[#A78BFA]">
                        <PhoneCall size={12} /> Botão CTA: {post.ctaType}
                      </span>
                      <span className="font-mono tabular-nums">{post.charCount} / 1500 caracteres</span>
                    </div>
                  </div>
                </div>

                <div className={`pt-3 border-t ${borderCol} flex items-center justify-between gap-2`}>
                  <button
                    type="button"
                    onClick={() => copyText(post.text, `post-${post.number}`, `Texto da Publicação #${post.number} copiado!`)}
                    className="px-4 py-1.5 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {copiedId === `post-${post.number}` ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedId === `post-${post.number}` ? "Texto Copiado" : "Copiar Post"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncToGoogle(`Publicação #${post.number}`)}
                    className={`px-3.5 py-1.5 rounded-full border text-[12px] font-semibold cursor-pointer transition-all ${borderCol} hover:border-[#7C3AED] hover:text-[#7C3AED]`}
                  >
                    Agendar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-inherit flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevStep}
              className={`px-4 py-2 rounded-full border text-[13px] font-semibold flex items-center gap-1.5 ${borderCol}`}
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <button
              type="button"
              onClick={goToNextStep}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-[13px] font-semibold flex items-center gap-2 shadow-sm hover:opacity-95 cursor-pointer"
            >
              <span>Avançar para Revisão Individual</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      )}

      {/* STEP 7: REVISÃO INDIVIDUAL COM EDIÇÃO INLINE, EXCLUSÃO COM CONFIRMAÇÃO & APROVAÇÃO POR ITEM */}
      {activeStep === "review" && (
        <section className={`rounded-2xl p-5 sm:p-6 space-y-6 ${cardClass}`}>
          <div className="border-b pb-4 border-inherit flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                Controle de Qualidade Unitário · Edição Inline & Aprovação
              </div>
              <h2 className="text-[19px] font-extrabold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">
                Revisão e Aprovação Item por Item
              </h2>
              <p className={`text-[13px] ${mutedText}`}>
                Edite qualquer texto diretamente, aprove individualmente cada componente e gerencie fotos com segurança.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[13px] font-bold px-3 py-1 rounded-full bg-purple-500/10 text-[#7C3AED] dark:text-[#A78BFA]">
                {approvedCount} de {totalItemsCount} Itens Aprovados
              </span>
            </div>
          </div>

          {/* Item 1: Bio Review */}
          <div className={`p-4 rounded-xl border ${borderCol} ${subtleBg} space-y-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[14px]">01. Descrição Semântica (Bio 750c)</span>
                {approvedItems["bio"] ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                    <Check size={12} /> Aprovado
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
                    Pendente
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggleItemApproval("bio")}
                className={`px-3 py-1 rounded-full text-[12px] font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                  approvedItems["bio"]
                    ? "bg-emerald-600 text-white"
                    : "border border-[#7C3AED] text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white"
                }`}
              >
                {approvedItems["bio"] ? <CheckSquare size={13} /> : <Square size={13} />}
                <span>{approvedItems["bio"] ? "Aprovado" : "Aprovar Item"}</span>
              </button>
            </div>

            <textarea
              rows={3}
              value={pkg.description750}
              onChange={(e) => setPkg((p) => ({ ...p, description750: e.target.value }))}
              className={`w-full p-3 rounded-lg border text-[13px] ${borderCol} ${dark ? "bg-[#1E1A2E]" : "bg-white"} outline-none focus:border-[#7C3AED]`}
            />
          </div>

          {/* Items 2: Services Review */}
          <div className="space-y-3">
            <h3 className="text-[15px] font-bold text-[#1A1033] dark:text-[#EDE9FE]">
              Serviços Cadastrados ({pkg.services?.length || 0})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(pkg.services || []).map((svc, idx) => {
                const sId = `svc-${idx}`;
                const isApproved = approvedItems[sId];
                return (
                  <div key={idx} className={`p-4 rounded-xl border ${borderCol} ${subtleBg} space-y-2`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold text-[#7C3AED]">Serviço #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => toggleItemApproval(sId)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                          isApproved
                            ? "bg-emerald-600 text-white"
                            : "border border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-300"
                        }`}
                      >
                        {isApproved ? <Check size={11} /> : null}
                        <span>{isApproved ? "Aprovado" : "Aprovar"}</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      value={svc.name}
                      onChange={(e) => {
                        const next = [...pkg.services];
                        next[idx].name = e.target.value;
                        setPkg({ ...pkg, services: next });
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-[13px] font-bold ${borderCol} ${
                        dark ? "bg-[#1E1A2E]" : "bg-white"
                      }`}
                    />

                    <textarea
                      rows={2}
                      value={svc.description}
                      onChange={(e) => {
                        const next = [...pkg.services];
                        next[idx].description = e.target.value;
                        setPkg({ ...pkg, services: next });
                      }}
                      className={`w-full p-2 rounded-lg border text-[12px] ${borderCol} ${
                        dark ? "bg-[#1E1A2E]" : "bg-white"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Photo Management with Confirmation Modal */}
          <div className={`p-5 rounded-xl border ${borderCol} ${subtleBg} space-y-4`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-[#1A1033] dark:text-[#EDE9FE]">
                  Galeria de Fotos da Empresa ({userPhotos.length})
                </h3>
                <p className={`text-[12px] ${mutedText}`}>
                  Substitua ou exclua fotos com confirmação antes da sincronização.
                </p>
              </div>

              <label className="px-4 py-2 rounded-full bg-[#7C3AED] text-white text-[12px] font-semibold cursor-pointer hover:bg-[#6D28D9] flex items-center gap-1.5 shadow-sm">
                <Upload size={13} />
                <span>Adicionar Foto</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const r = new FileReader();
                    r.onload = () => {
                      const cleanSlug = (pkg.businessName || "empresa").toLowerCase().replace(/[^a-z0-9]+/g, "-");
                      const seoName = `${cleanSlug}-foto-${(pkg.city || "cidade").toLowerCase()}-${userPhotos.length + 1}.jpg`;
                      setUserPhotos((prev) => [...prev, { url: r.result, tag: "Fachada & Serviços", seoName }]);
                      toast.success("Foto adicionada à galeria");
                    };
                    r.readAsDataURL(file);
                  }}
                />
              </label>
            </div>

            {userPhotos.length === 0 ? (
              <div className="py-6 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                Nenhuma foto anexada ainda. Adicione fotos locais para compor o pacote.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {userPhotos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl border border-[rgba(124,58,237,0.15)] bg-white dark:bg-[#1E1A2E] space-y-2 relative group"
                  >
                    <img src={photo.url} alt={photo.seoName} className="w-full h-24 object-cover rounded-lg" />
                    <div className="text-[11px] font-mono truncate text-[#7C3AED]">{photo.seoName}</div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">#{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => setPhotoToDelete({ photo, index: idx })}
                        className="p-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        title="Excluir foto com confirmação"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delete Photo Confirmation Modal */}
          {photoToDelete && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#1E1A2E] rounded-2xl p-6 max-w-sm w-full space-y-4 border border-red-200 dark:border-red-900 shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto">
                  <AlertTriangle size={24} />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="text-[16px] font-bold text-slate-900 dark:text-slate-100">Confirmar exclusão da foto?</h4>
                  <p className="text-[12px] text-slate-500">
                    Esta ação removerá "{photoToDelete.photo.seoName}" da galeria do pacote GBP.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPhotoToDelete(null)}
                    className="flex-1 py-2 rounded-full border border-slate-300 dark:border-slate-700 text-[13px] font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserPhotos((prev) => prev.filter((_, i) => i !== photoToDelete.index));
                      setPhotoToDelete(null);
                      toast.success("Foto removida com sucesso");
                    }}
                    className="flex-1 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold"
                  >
                    Confirmar Exclusão
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-inherit flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevStep}
              className={`px-4 py-2 rounded-full border text-[13px] font-semibold flex items-center gap-1.5 ${borderCol}`}
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <button
              type="button"
              onClick={goToNextStep}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-[13px] font-semibold flex items-center gap-2 shadow-sm hover:opacity-95 cursor-pointer"
            >
              <span>Avançar para Aprovação Final do Pacote</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      )}

      {/* STEP 8: APROVAÇÃO DO PACOTE GBP */}
      {activeStep === "package_approval" && (
        <section className={`rounded-2xl p-5 sm:p-6 space-y-6 ${cardClass}`}>
          <div className="border-b pb-4 border-inherit">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
              Validação Executiva · Selo de Qualidade G360
            </div>
            <h2 className="text-[19px] font-extrabold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">
              Aprovação Final do Pacote GBP
            </h2>
            <p className={`text-[13px] mt-0.5 ${mutedText}`}>
              Verifique o checklist de prontidão para entrega ao cliente ou sincronização imediata no Google Meu Negócio.
            </p>
          </div>

          {/* Readiness Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border ${borderCol} ${subtleBg} space-y-3`}>
              <h3 className="font-bold text-[14px]">Checklist de Otimização GBP</h3>
              <div className="space-y-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#16A34A]" />
                  <span>Taxonomia Google ({pkg.primaryCategory} + {pkg.additionalCategories?.length || 0} adicionais)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#16A34A]" />
                  <span>Descrição Semântica ({pkg.description750?.length || 750}/750c)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#16A34A]" />
                  <span>Catálogo de Serviços ({pkg.services?.length || 0} serviços com SEO local)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#16A34A]" />
                  <span>Produtos Estruturados ({pkg.products?.length || 0} itens na vitrine)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#16A34A]" />
                  <span>Cronograma Agendado ({pkg.posts?.length || 10} publicações densas)</span>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${borderCol} ${subtleBg} space-y-3`}>
              <h3 className="font-bold text-[14px]">Identidade & Aprovações</h3>
              <div className="space-y-2 text-[13px]">
                <div className="flex items-center gap-2">
                  {identityApproved ? (
                    <CheckCircle2 size={16} className="text-[#16A34A]" />
                  ) : (
                    <AlertTriangle size={16} className="text-[#F59E0B]" />
                  )}
                  <span>Identidade Visual: {identityApproved ? "Aprovada" : "Pendente de confirmação"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#16A34A]" />
                  <span>Paleta Escolhida: {selectedPalette.name.split("(")[0]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#16A34A]" />
                  <span>Itens com Revisão Unitária: {approvedCount} de {totalItemsCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Master Approval Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-200">
                Homologação de Pacote Comercial
              </div>
              <h3 className="text-[20px] font-extrabold">Revisão do Pacote de Otimização GBP</h3>
              <p className="text-[13px] text-purple-200">
                Aprove os dados e a identidade antes de transferir os itens revisados para o Site Express.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setPackageApproved(true);
                handleSaveDraft();
                toast.success("Pacote GBP homologado e aprovado com sucesso!");
              }}
              className="px-6 py-3 rounded-full bg-white text-purple-900 hover:bg-purple-50 font-bold text-[14px] shadow-md flex items-center gap-2 cursor-pointer transition-all shrink-0"
            >
              <CheckCircle2 size={18} className="text-emerald-600" />
              <span>{packageApproved ? "Itens revisados aprovados ✓" : "Aprovar Pacote Completo"}</span>
            </button>
          </div>

          <div className="pt-4 border-t border-inherit flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevStep}
              className={`px-4 py-2 rounded-full border text-[13px] font-semibold flex items-center gap-1.5 ${borderCol}`}
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <button
              type="button"
              onClick={goToNextStep}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-[13px] font-semibold flex items-center gap-2 shadow-sm hover:opacity-95 cursor-pointer"
            >
              <span>Avançar para Envio ao Site Express</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      )}

      {/* STEP 9: ENVIO DIRETO AO SITE EXPRESS COM BRIEFING PROGRESSIVO */}
      {activeStep === "export_site" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Interactive Media Manager & SEO Renaming */}
          <div className={`lg:col-span-6 rounded-2xl p-5 sm:p-6 space-y-4 ${cardClass}`}>
            <div className="flex items-center justify-between border-b pb-3 border-inherit">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                  Mídia & SEO de Imagens
                </div>
                <h2 className="text-[17px] font-bold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">Nomes Otimizados para Fotos</h2>
              </div>
              <button
                type="button"
                onClick={() => copyText((pkg.photoSeoNames || []).join("\n"), "seo-photos", "Lista de nomes SEO copiada")}
                className="px-4 py-1.5 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12px] font-semibold shadow-sm cursor-pointer"
              >
                Copiar Lista
              </button>
            </div>

            {/* SEO Filenames List */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {(pkg.photoSeoNames || []).map((fname, idx) => (
                <div
                  key={idx}
                  className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-[12px] font-mono ${borderCol} ${subtleBg}`}
                >
                  <span className="truncate">{fname}</span>
                  <button
                    type="button"
                    onClick={() => copyText(fname, `fn-${idx}`, `Nome "${fname}" copiado`)}
                    className="text-[#7C3AED] shrink-0 cursor-pointer hover:opacity-80"
                  >
                    {copiedId === `fn-${idx}` ? <Check size={14} className="text-[#16A34A]" /> : <Copy size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Progressive Site Briefing (BRIEFING_SITE_DO_GBP.md) */}
          <div className={`lg:col-span-6 rounded-2xl p-5 sm:p-6 space-y-4 ${cardClass}`}>
            <div className="border-b pb-3 border-inherit">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#16A34A]">
                Transferência Automática @pacote-gbp para @pacote-site
              </div>
              <h2 className="text-[17px] font-bold mt-0.5 text-[#1A1033] dark:text-[#EDE9FE]">Briefing Progressivo do Site Express</h2>
              <p className={`text-[12.5px] mt-0.5 ${mutedText}`}>
                Todos os dados homologados no Google Meu Negócio já estão prontos para alimentar o Site Express em 1 clique.
              </p>
            </div>

            {pkg.siteBriefing && (
              <div className={`p-4 rounded-xl border space-y-3 text-[13px] ${borderCol} ${subtleBg}`}>
                <div>
                  <span className={`font-semibold ${mutedText}`}>Modelo Recomendado: </span>
                  <div className="font-bold text-[#7C3AED] dark:text-[#A78BFA] mt-0.5">{pkg.siteBriefing.recommendedSiteModel}</div>
                </div>
                <div>
                  <span className={`font-semibold ${mutedText}`}>Headline Principal (Hero): </span>
                  <div className="font-semibold mt-0.5">{pkg.siteBriefing.heroHeadline}</div>
                </div>
                <div>
                  <span className={`font-semibold ${mutedText}`}>Subtítulo Persuasivo: </span>
                  <div className={`mt-0.5 ${mutedText}`}>{pkg.siteBriefing.heroSubheadline}</div>
                </div>
                <div>
                  <span className={`font-semibold ${mutedText}`}>Palavras-Chave Integradas: </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(pkg.siteBriefing.localKeywords || []).slice(0, 6).map((kw, i) => (
                      <span key={i} className={`text-[11.5px] px-2.5 py-1 rounded-md border ${borderCol}`}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={openApprovedSite}
              className="w-full py-3.5 px-5 rounded-full bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A855F7] hover:opacity-95 text-white font-semibold text-[14px] flex items-center justify-center gap-2 shadow-md shadow-purple-500/25 transition-all cursor-pointer"
            >
              <Layers size={17} />
              <span>Construir Site Express com estes Dados</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
