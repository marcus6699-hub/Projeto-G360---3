import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function BrandPanel({ data, onChange }) {
  const logo = data.logo || {};
  const setLogo = (k, v) => onChange((d) => ({ ...d, logo: { ...(d.logo || {}), [k]: v } }));

  const upload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1024 * 1024) {
      toast.error("Logo muito grande (máx. 1 MB). Use PNG ou SVG otimizado.");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      setLogo("url", r.result);
      toast.success("Logo aplicado ao cabeçalho e rodapé");
    };
    r.readAsDataURL(f);
  };

  return (
    <div className="space-y-4" data-testid="brand-panel">
      <p className="text-[11.5px] text-slate-500 leading-relaxed">
        O logo aparece no cabeçalho (no lugar do ponto colorido) e no rodapé. PNG com fundo transparente ou SVG funcionam melhor.
      </p>

      <div className="panel !rounded-xl p-4 flex flex-col items-center gap-3" data-testid="brand-logo-preview">
        <div className="w-full h-24 rounded-lg bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,#fff_25%,#fff_75%,#f1f5f9_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px] border border-[#E4E4E7] grid place-items-center overflow-hidden">
          {logo.url ? (
            <img src={logo.url} alt="Logo" className={`max-h-16 max-w-[80%] object-contain ${logo.round ? "rounded-full" : ""}`} />
          ) : (
            <span className="text-[11px] text-slate-400">Sem logo — exibindo nome da empresa</span>
          )}
        </div>
        <label className="btn-primary-dark !py-2 !px-4 !text-[12px] cursor-pointer w-full justify-center">
          <Upload size={14} /> {logo.url ? "Trocar logo" : "Enviar logo"}
          <input data-testid="brand-logo-upload" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={upload} />
        </label>
      </div>

      <div>
        <label className="field-label">Ou cole a URL do logo</label>
        <input
          data-testid="brand-logo-url"
          className="field !py-2 !text-[12.5px]"
          placeholder="https://..."
          value={logo.url && !logo.url.startsWith("data:") ? logo.url : ""}
          onChange={(e) => setLogo("url", e.target.value)}
        />
      </div>

      {logo.url && (
        <>
          <label className="flex items-center justify-between text-[12.5px] font-semibold text-slate-700">
            Logo redondo
            <Switch data-testid="brand-logo-round" checked={!!logo.round} onCheckedChange={(v) => setLogo("round", v)} />
          </label>
          <label className="flex items-center justify-between text-[12.5px] font-semibold text-slate-700">
            Ocultar nome ao lado do logo
            <Switch data-testid="brand-logo-hidename" checked={!!logo.hideName} onCheckedChange={(v) => setLogo("hideName", v)} />
          </label>
          <button
            data-testid="brand-logo-remove"
            onClick={() => onChange((d) => ({ ...d, logo: null }))}
            className="flex items-center gap-1.5 text-[11.5px] font-bold text-red-600 hover:text-red-700"
          >
            <Trash2 size={12} /> Remover logo
          </button>
        </>
      )}
    </div>
  );
}
