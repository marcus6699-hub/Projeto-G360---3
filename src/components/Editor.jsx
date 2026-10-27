import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  Save,
  Download,
  ExternalLink,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Undo2,
  Redo2,
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
} from "lucide-react";
import { generateSiteHtml, downloadHtml, downloadSiteZip, defaultSections } from "@/lib/sitegen/generateSiteHtml";
import { PALETTES, ALL_PALETTES, FONT_PAIRS, SITE_TEMPLATES } from "@/lib/sitegen/theme";
import SectionsPanel from "@/components/SectionsPanel";
import ItemsPanel from "@/components/ItemsPanel";
import BrandPanel from "@/components/BrandPanel";
import MarketingPanel from "@/components/MarketingPanel";
import AiStudioPanel from "@/components/AiStudioPanel";
import Inspector from "@/components/Inspector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VIEWPORTS = [
  { id: "desktop", icon: Monitor, label: "Computador", width: 1200 },
  { id: "tablet", icon: Tablet, label: "Tablet", width: 768 },
  { id: "mobile", icon: Smartphone, label: "Celular", width: 390 },
];

export default function Editor({ project, onProject, onSave, onExit }) {
  const [viewport, setViewport] = useState("desktop");
  const [tab, setTab] = useState("sections");
  const [inspector, setInspector] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoom, setZoom] = useState(90);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [history, setHistory] = useState([project.data]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const isUndoRedoRef = useRef(false);

  const handleUndo = useCallback(() => {
    if (historyIdx > 0) {
      isUndoRedoRef.current = true;
      const prevData = history[historyIdx - 1];
      setHistoryIdx(historyIdx - 1);
      onProject((p) => ({ ...p, data: prevData }));
      setDirty(true);
      toast.info("Ação desfeita (Undo)");
    }
  }, [history, historyIdx, onProject]);

  const handleRedo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      isUndoRedoRef.current = true;
      const nextData = history[historyIdx + 1];
      setHistoryIdx(historyIdx + 1);
      onProject((p) => ({ ...p, data: nextData }));
      setDirty(true);
      toast.info("Ação refeita (Redo)");
    }
  }, [history, historyIdx, onProject]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);
  const saveTimer = useRef(null);
  const projectRef = useRef(project);
  const iframeRef = useRef(null);
  const scrollYRef = useRef(0);
  projectRef.current = project;

  const html = useMemo(() => generateSiteHtml(project.data, { editor: true }), [project.data]);

  const recordIframeScroll = () => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (win && typeof win.scrollY === "number") {
        scrollYRef.current = win.scrollY;
      }
    } catch {
      // ignore cross-origin if any
    }
  };

  const handleIframeLoad = () => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      if (scrollYRef.current > 0) {
        win.scrollTo(0, scrollYRef.current);
      }
      win.addEventListener(
        "scroll",
        () => {
          scrollYRef.current = win.scrollY;
        },
        { passive: true }
      );
    } catch {
      // ignore
    }
  };

  const patchData = useCallback(
    (fn) => {
      recordIframeScroll();
      onProject((p) => {
        const nextData = fn(p.data);
        if (!isUndoRedoRef.current) {
          setHistory((prev) => {
            const sliced = prev.slice(0, historyIdx + 1);
            return [...sliced, nextData];
          });
          setHistoryIdx((prev) => prev + 1);
        }
        isUndoRedoRef.current = false;
        return { ...p, archetype: nextData.archetype || p.archetype, data: nextData };
      });
      setDirty(true);
    },
    [onProject, historyIdx]
  );

  const switchTemplate = (tplId) => {
    const tpl = SITE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    scrollYRef.current = 0;
    patchData((d) => ({
      ...d,
      templateId: tpl.id,
      archetype: tpl.archetype,
      paletteId: tpl.paletteId,
      fontId: tpl.fontId,
      sections: d.archetype === tpl.archetype ? d.sections : defaultSections(tpl.archetype),
    }));
    toast.success(`Modelo alterado para ${tpl.name}`);
  };

  const doSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(projectRef.current);
      setDirty(false);
      toast.success("Projeto salvo");
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  useEffect(() => {
    if (!dirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onSave(projectRef.current)
        .then(() => setDirty(false))
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(saveTimer.current);
  }, [dirty, project, onSave]);

  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data;
      if (!d || d.__sxp !== 1) return;
      if (d.type === "edit") {
        const item = d.key.match(/^item\.(\d+)\.(name|description|price|badge)$/);
        const faq = d.key.match(/^faq\.(\d+)\.(q|a)$/);
        if (item) {
          const [, idx, field] = item;
          patchData((data) => ({
            ...data,
            business: {
              ...data.business,
              items: data.business.items.map((it, i) => (i === +idx ? { ...it, [field]: d.value } : it)),
            },
          }));
        } else if (faq) {
          const [, idx, field] = faq;
          patchData((data) => ({
            ...data,
            business: {
              ...data.business,
              faqs: data.business.faqs.map((f, i) => (i === +idx ? { ...f, [field]: d.value } : f)),
            },
          }));
        } else {
          patchData((data) => ({ ...data, texts: { ...data.texts, [d.key]: d.value } }));
        }
      } else if (d.type === "inspect-button") {
        setInspector({ type: "button", id: d.id });
      } else if (d.type === "inspect-image") {
        setInspector({ type: "image", id: d.id });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [patchData]);

  const vp = VIEWPORTS.find((v) => v.id === viewport) || VIEWPORTS[0];
  const arch = project.data.archetype || project.archetype || "produtos";
  const currentTemplateId =
    project.data.templateId || (arch === "gastronomia" ? "simprao" : arch === "servicos" ? "atelie-val" : "vitrine-express");
  const palList = PALETTES[arch] || ALL_PALETTES;
  const scale = zoom / 100;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" data-testid="editor-root" style={{ height: "calc(100vh - 64px)" }}>
      {/* Top Toolbar */}
      <div className="bg-white border-b border-[#E4E4E7] px-3.5 py-2 flex items-center gap-2 flex-nowrap overflow-x-auto studio-scroll z-20">
        <button
          data-testid="editor-back-button"
          onClick={onExit}
          className="flex-none flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={14} /> <span className="hidden xl:inline">Clientes</span>
        </button>

        <button
          data-testid="sidebar-toggle-top"
          onClick={() => setSidebarOpen((s) => !s)}
          title={sidebarOpen ? "Recolher menu lateral" : "Abrir menu lateral"}
          className="flex-none flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-[#E4E4E7] hover:bg-slate-50 transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          <span className="hidden lg:inline">{sidebarOpen ? "Recolher Menu" : "Abrir Menu"}</span>
        </button>

        <input
          data-testid="editor-project-name"
          aria-label="Nome do projeto"
          value={project.name}
          onChange={(e) => {
            onProject((p) => ({ ...p, name: e.target.value }));
            setDirty(true);
          }}
          className="text-[13.5px] font-bold text-slate-900 bg-transparent border border-transparent hover:border-[#E4E4E7] focus:border-slate-900 rounded-lg px-2 py-1 outline-none w-[160px] truncate transition-colors"
        />
        <span
          className={`flex-none text-[10.5px] font-bold px-2.5 py-1 rounded-full ${
            project.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
          data-testid="editor-status-pill"
        >
          {project.status === "active" ? "Ativo no ar" : "Suspenso"}
        </span>

        <div className="flex-none flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5 ml-auto">
          {VIEWPORTS.map((v) => (
            <button
              key={v.id}
              data-testid={`viewport-switch-${v.id}`}
              onClick={() => setViewport(v.id)}
              title={v.label}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
                viewport === v.id ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <v.icon size={13} /> <span className="hidden 2xl:inline">{v.label}</span>
            </button>
          ))}
        </div>

        {/* Template Switcher */}
        <Select value={currentTemplateId} onValueChange={switchTemplate}>
          <SelectTrigger
            data-testid="template-select"
            aria-label="Modelo de Layout"
            className="flex-none w-[162px] h-8 text-[12px] font-bold bg-amber-50/70 border-amber-300 text-slate-900"
          >
            <Layers size={13} className="text-amber-600 mr-1 flex-none" />
            <SelectValue placeholder="Modelo" />
          </SelectTrigger>
          <SelectContent>
            {SITE_TEMPLATES.map((tpl) => (
              <SelectItem key={tpl.id} value={tpl.id}>
                <span className="flex items-center gap-2">
                  <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: tpl.colors[1] }} />
                  {tpl.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={project.data.paletteId} onValueChange={(v) => patchData((d) => ({ ...d, paletteId: v }))}>
          <SelectTrigger data-testid="palette-select" aria-label="Paleta de cores" className="flex-none w-[136px] h-8 text-[12px] font-semibold">
            <SelectValue placeholder="Paleta" />
          </SelectTrigger>
          <SelectContent>
            {palList.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">
                  <i className="w-3 h-3 rounded-full inline-block" style={{ background: p.vars.sec }} />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={project.data.fontId} onValueChange={(v) => patchData((d) => ({ ...d, fontId: v }))}>
          <SelectTrigger data-testid="font-select" aria-label="Tipografia" className="flex-none w-[140px] h-8 text-[12px] font-semibold">
            <SelectValue placeholder="Tipografia" />
          </SelectTrigger>
          <SelectContent>
            {FONT_PAIRS.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                <span style={{ fontFamily: f.heading }}>{f.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          data-testid="editor-save-button"
          onClick={doSave}
          disabled={saving}
          className="flex-none flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border border-[#E4E4E7] hover:bg-slate-50 transition-colors text-slate-700"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {dirty ? "Salvar" : "Salvo"}
        </button>
        <a
          data-testid="editor-open-site"
          href={`/site/${project.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-none flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border border-[#E4E4E7] hover:bg-slate-50 transition-colors text-slate-700"
        >
          <ExternalLink size={13} /> <span className="hidden sm:inline">Abrir</span>
        </a>
        {/* Undo / Redo controls */}
        <div className="flex items-center border border-[#E4E4E7] rounded-lg overflow-hidden bg-white">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIdx <= 0}
            className="p-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700"
            title="Desfazer (Ctrl+Z)"
            aria-label="Desfazer"
          >
            <Undo2 size={13} />
          </button>
          <div className="w-[1px] h-4 bg-[#E4E4E7]" />
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIdx >= history.length - 1}
            className="p-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700"
            title="Refazer (Ctrl+Y)"
            aria-label="Refazer"
          >
            <Redo2 size={13} />
          </button>
        </div>

        <button
          type="button"
          data-testid="toggle-fullscreen-button"
          onClick={() => setIsFullscreen((f) => !f)}
          className="flex-none flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border border-[#E4E4E7] hover:bg-slate-50 transition-colors text-slate-700"
          title="Alternar Tela Cheia do Canvas"
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          <span className="hidden sm:inline">{isFullscreen ? "Sair Tela Cheia" : "Tela Cheia"}</span>
        </button>

        <button
          data-testid="export-html-button"
          onClick={() => {
            downloadHtml(project.data, `${project.slug}.html`, project.slug);
            toast.success("HTML exportado — pronto para hospedar em qualquer lugar");
          }}
          className="flex-none btn-primary-dark !py-1.5 !px-3 !text-[12px]"
        >
          <Download size={13} /> HTML
        </button>

        <button
          data-testid="export-zip-button"
          onClick={async () => {
            await downloadSiteZip(project.data, `${project.slug}.zip`, project.slug);
            toast.success("Pacote ZIP completo baixado (HTML + manifesto + instruções)");
          }}
          className="flex-none flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          title="Baixar pacote ZIP completo autossuficiente"
        >
          <Archive size={13} /> Baixar ZIP
        </button>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Retractable Left Sidebar (Canva Style) */}
        <aside
          data-testid="editor-sidebar"
          className={`relative flex-none bg-white border-r border-[#E4E4E7] flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
            sidebarOpen ? "w-[310px]" : "w-0 border-r-0 overflow-hidden"
          }`}
        >
          <div className="w-[310px] flex flex-col h-full min-h-0">
            <div className="flex border-b border-[#E4E4E7]">
              {[
                ["sections", "Seções"],
                ["items", "Itens"],
                ["brand", "Marca"],
                ["marketing", "Mkt"],
                ["ai", "IA Grátis"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  data-testid={`editor-tab-${id}`}
                  onClick={() => setTab(id)}
                  className={`flex-1 text-[11.5px] font-bold py-3 transition-colors ${
                    tab === id
                      ? id === "ai"
                        ? "text-amber-600 border-b-2 border-amber-500 bg-amber-50/40"
                        : "text-slate-900 border-b-2 border-slate-900"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto studio-scroll p-4" data-lenis-prevent="true">
              {tab === "sections" && <SectionsPanel data={project.data} onChange={patchData} />}
              {tab === "items" && <ItemsPanel data={project.data} onChange={patchData} />}
              {tab === "brand" && <BrandPanel data={project.data} onChange={patchData} />}
              {tab === "marketing" && <MarketingPanel data={project.data} onChange={patchData} />}
              {tab === "ai" && <AiStudioPanel data={project.data} onChange={patchData} />}
            </div>
          </div>
        </aside>

        {/* Canva-Style Edge Pull Tab on Sidebar Border */}
        <button
          data-testid="sidebar-collapse-handle"
          aria-label={sidebarOpen ? "Recolher barra lateral" : "Expandir barra lateral"}
          onClick={() => setSidebarOpen((s) => !s)}
          style={{ left: sidebarOpen ? "310px" : "0px" }}
          className="absolute top-1/2 -translate-y-1/2 z-30 w-5 h-16 bg-white border border-l-0 border-[#D4D4D8] rounded-r-xl shadow-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:w-6 transition-all duration-300 cursor-pointer"
          title={sidebarOpen ? "Esconder menu lateral (Estilo Canva)" : "Mostrar menu lateral"}
        >
          {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Canvas Area + Bottom Zoom Bar (Single clean scrollbar inside site) */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0" style={{ background: "#E5E7EB" }}>
          <div
            className="flex-1 min-w-0 min-h-0 overflow-x-auto overflow-y-hidden studio-scroll p-3 sm:p-5 flex justify-center items-stretch"
            data-lenis-prevent="true"
          >
            <div
              style={{
                width: `${Math.round(vp.width * scale)}px`,
                transition: "width .2s ease",
              }}
              className="flex-none h-full relative"
            >
              <div
                className="canvas-shell bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#D4D4D8] origin-top-left"
                style={{
                  width: `${vp.width}px`,
                  height: `${Math.round(100 / scale)}%`,
                  transform: `scale(${scale})`,
                }}
              >
                <iframe
                  ref={iframeRef}
                  key={viewport}
                  onLoad={handleIframeLoad}
                  title="Canvas do site"
                  data-testid="editor-canvas"
                  srcDoc={html}
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          </div>

          {/* Canva-Style Bottom Zoom Bar */}
          <div
            data-testid="editor-zoom-bar"
            className="h-11 bg-white border-t border-[#E4E4E7] px-5 flex items-center justify-between gap-4 text-[12px] text-slate-600 select-none z-20"
          >
            <div className="flex items-center gap-2 text-slate-400 font-medium">
              <span className="hidden sm:inline">
                Modo Canva · Clique em textos para editar, em fotos (inclusive dos itens) para trocar imagem, ou em botões para personalizar
              </span>
              <span className="sm:hidden">Editor Visual</span>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <button
                data-testid="zoom-out-button"
                aria-label="Diminuir zoom"
                onClick={() => setZoom((z) => Math.max(50, z - 5))}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                title="Diminuir zoom"
              >
                <ZoomOut size={15} />
              </button>
              <input
                data-testid="zoom-slider"
                aria-label="Ajustar zoom do canvas"
                type="range"
                min={50}
                max={100}
                step={5}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-28 sm:w-36 accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <button
                data-testid="zoom-in-button"
                aria-label="Aumentar zoom"
                onClick={() => setZoom((z) => Math.min(100, z + 5))}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                title="Aumentar zoom"
              >
                <ZoomIn size={15} />
              </button>
              <span data-testid="zoom-value" className="font-bold text-slate-900 tabular-nums w-11 text-right">
                {zoom}%
              </span>
              <button
                data-testid="zoom-reset-button"
                onClick={() => setZoom(zoom === 100 ? 80 : 100)}
                className="flex items-center gap-1 px-2 py-1 rounded-md border border-[#E4E4E7] hover:bg-slate-50 text-[11px] font-bold text-slate-700 transition-colors"
                title="Alternar ajuste de tela (80% / 100%)"
              >
                <Maximize2 size={12} /> {zoom === 100 ? "Ajustar" : "100%"}
              </button>
            </div>
          </div>
        </div>

        {inspector && (
          <Inspector inspector={inspector} data={project.data} onChange={patchData} onClose={() => setInspector(null)} />
        )}
      </div>
    </div>
  );
}
