import { useMemo, useState } from "react";
import { buildVerifiedSiteHtml, downloadVerifiedSiteZip } from "@/lib/sitegen/verifiedSite";

export default function VerifiedSiteReview({ business, onBack }) {
  const [input, setInput] = useState({ name: business?.name || "", category: business?.category || "", city: business?.city || "", phone: "", description: "", color: "#243b4a", approved: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (field, value) => { setInput((previous) => ({ ...previous, [field]: value, approved: false })); setError(""); };
  const preview = useMemo(() => input.approved ? buildVerifiedSiteHtml(input) : "", [input]);
  async function exportZip() {
    setBusy(true); setError("");
    try { await downloadVerifiedSiteZip(input); } catch (e) { setError(e.message || "Falha na exportação."); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-slate-900 dark:text-slate-100">
    <button type="button" className="underline" onClick={onBack}>← Voltar à prospecção</button>
    <header><h1 className="text-2xl font-semibold">Site estático: revisar antes de gerar</h1><p className="mt-2 text-sm">Nome e categoria vieram do OSM, não do GBP. Nenhuma avaliação, experiência, foto, preço ou disponibilidade será presumida. O ZIP abre fora do G360 e não publica nada.</p></header>
    <div className="grid gap-4 sm:grid-cols-2">{[["name", "Nome aprovado"], ["category", "Categoria aprovada"], ["city", "Cidade aprovada"], ["phone", "Telefone autorizado (opcional)"], ["description", "Descrição aprovada (opcional)"]].map(([field, label]) => <label key={field} className="text-sm">{label}<input value={input[field]} maxLength={field === "description" ? 2000 : 160} onChange={(e) => update(field, e.target.value)} className="mt-1 w-full rounded border p-2 text-slate-900" /></label>)}<label className="text-sm">Cor aprovada<input type="color" value={input.color} onChange={(e) => update("color", e.target.value)} className="mt-1 block h-10 w-20" /></label></div>
    <label className="flex items-start gap-3"><input type="checkbox" checked={input.approved} onChange={(e) => setInput((previous) => ({ ...previous, approved: e.target.checked }))} /><span>Revisei e aprovo estes dados para esta prévia e exportação local. Confirmarei direitos e contato antes de qualquer publicação.</span></label>
    {error && <p role="alert">{error}</p>}
    {preview ? <><iframe title="Prévia local do site aprovado" sandbox="" srcDoc={preview} className="h-[500px] w-full rounded border bg-white" /><button disabled={busy} type="button" onClick={exportZip} className="rounded bg-slate-900 px-5 py-3 text-white disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900">{busy ? "Gerando ZIP…" : "Exportar ZIP estático"}</button></> : <p role="status" className="rounded border p-4">Revise e aprove os campos para visualizar a prévia.</p>}
  </section>;
}
