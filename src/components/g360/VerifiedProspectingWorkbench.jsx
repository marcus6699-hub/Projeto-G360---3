import { buildAuditReportFromEvidenceAudit } from "@/lib/g360/auditContract";
import { useEffect, useMemo, useState } from "react";
import { api, fmtErr } from "@/lib/api";
import EvidenceAuditSummary from "./EvidenceAuditSummary";
import { filterOsmPlaces } from "@/lib/g360/filterOsmPlaces";

const categories = { padaria: "Padaria", farmacia: "Farmácia", restaurante: "Restaurante", cafe: "Café", salao: "Salão", oficina: "Oficina" };
const initialForm = { city: "", category: "padaria", lat: "", lng: "", filter: "all", phoneFilter: "all", socialFilter: "all" };
const initialEvidence = { ownership: "", website: "", category: "", description: "", phone: "", hours: "", photoCount: "" };

export default function VerifiedProspectingWorkbench({ userId, onBusinessChange, onOpenSite, onAuditReport }) {
  const storageKey = `g360_verified_workbench_${userId || "anonymous"}`;
  const [saved] = useState(() => { try { return userId ? JSON.parse(sessionStorage.getItem(storageKey) || "{}") : {}; } catch { return {}; } });
  const [form, setForm] = useState({ ...initialForm, ...saved.form });
  const [places, setPlaces] = useState(saved.places || []);
  const [selected, setSelected] = useState(saved.selected || null);
  const [evidence, setEvidence] = useState(initialEvidence);
  const [history, setHistory] = useState([]);
  const [clients, setClients] = useState([]);
  const [grid, setGrid] = useState(null);
  const [selectedAuditId, setSelectedAuditId] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeKey, setActiveKey] = useState(storageKey);

  useEffect(() => { if (userId && !accessDenied && activeKey === storageKey) { try { sessionStorage.setItem(storageKey, JSON.stringify({ form, places, selected })); } catch { /* storage unavailable */ } } }, [storageKey, activeKey, userId, accessDenied, form, places, selected]);

  useEffect(() => {
    // The mounted Studio can change identity without remounting this component.
    // Never keep the previous user's search, selection or history visible.
    let next = {};
    try { if (userId) next = JSON.parse(sessionStorage.getItem(storageKey) || "{}"); } catch { /* storage unavailable */ }
    setForm({ ...initialForm, ...next.form });
    setPlaces(next.places || []);
    setSelected(next.selected || null);
    setEvidence(initialEvidence);
    setHistory([]); setClients([]); setGrid(null); setSelectedAuditId(null); setMetadata(null);
    setMessage(""); setAccessDenied(false);
    setActiveKey(storageKey);
    onBusinessChange?.(next.selected || null);
  }, [storageKey, userId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get("/g360/evidence/audits"), api.get("/g360/evidence/clients")])
      .then(([audits, saved]) => { if (!cancelled) { setHistory(audits.data.audits || []); setClients(saved.data.clients || []); } })
      .catch((error) => { if (!cancelled) {
        const denied = error?.response?.status === 401;
        setAccessDenied(denied);
        if (denied) { setPlaces([]); setSelected(null); setHistory([]); setClients([]); onBusinessChange?.(null); }
        setMessage(denied ? "Sessão não autenticada para consultas protegidas. Entre novamente; não serão exibidos resultados de outra conta." : fmtErr(error, "Não foi possível carregar histórico"));
      } });
    return () => { cancelled = true; };
  }, [userId]);

  const visible = useMemo(() => filterOsmPlaces(places, form), [places, form]);
  const currentHistory = history.filter((entry) => entry.report?.placeId === selected?.place_id);
  const displayedAudit = currentHistory.find((entry) => entry.id === selectedAuditId) || currentHistory[0];
  useEffect(() => {
    if (!displayedAudit?.report) { onAuditReport?.(null); return; }
    const canonical = buildAuditReportFromEvidenceAudit(displayedAudit.report, {city:selected?.city,uf:selected?.uf});
    onAuditReport?.({...canonical, rawEvidenceAudit:displayedAudit.report, business:{...selected,...canonical.business}, keywords:[], pillars:[], criticalCount:0, warningCount:canonical.criteria.filter(c=>c.status === "warning").length, goodCount:canonical.criteria.filter(c=>c.status === "good").length});
  }, [displayedAudit, selected, onAuditReport]);
  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  async function search(event) {
    event.preventDefault();
    setBusy(true); setMessage(""); setGrid(null);
    try {
      const { data } = await api.post("/g360/osm/discover", { city: form.city.trim(), category: form.category, lat: Number(form.lat), lng: Number(form.lng) });
      setPlaces(data.places || []); setMetadata(data); setSelected(null); setEvidence(initialEvidence);
      setMessage(data.places.length ? `${data.places.length} registros OSM no raio de 1,5 km informado.` : "Nenhum registro OSM encontrado nesse raio. Não foram criados leads fictícios.");
    } catch (error) { setMessage(fmtErr(error, "Busca indisponível")); }
    finally { setBusy(false); }
  }

  async function importLocal(event) {
    const file=event.target.files?.[0]; if(!file)return;
    try {
      if(file.size>262144)throw Error('Arquivo excede 256 KiB.');
      const rows=JSON.parse(await file.text());
      if(!Array.isArray(rows)||rows.length<1||rows.length>100)throw Error('Informe entre 1 e 100 empresas em uma lista JSON.');
      const imported=rows.map(b=>{
        if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>160)throw Error('Empresa com nome inválido.');
        const text=k=>typeof b[k]==='string'?b[k].slice(0,500):null;
        return {place_id:`manual:${crypto.randomUUID()}`,name:b.name.trim(),category:text('category'),city:text('city'),uf:text('uf'),address:text('address'),phone:text('phone'),bio:text('bio'),lat:typeof b.lat==='number'&&Math.abs(b.lat)<=85?b.lat:null,lng:typeof b.lng==='number'&&Math.abs(b.lng)<=180?b.lng:null,source:'user-import-unverified',sourceUrl:null,rating:null,rating_count:null,verified:null};
      });
      setPlaces(imported);setSelected(null);setGrid(null);setEvidence(initialEvidence);onBusinessChange?.(null);
      setMetadata({attribution:'Importação local pelo usuário — sem verificação independente',collectedAt:new Date().toISOString(),limitations:'Importar não comprova propriedade, avaliações ou posições no Google.'});
      setMessage(`${imported.length} empresas importadas localmente para revisão. Nenhuma fonte externa foi consultada.`);
    } catch(error){setMessage(error.message||'Arquivo de importação inválido.');}
    finally{event.target.value='';}
  }

  function choose(place) {
    setSelected(place); setGrid(null); setMessage("");
    setEvidence(initialEvidence);
    onBusinessChange?.(place);
  }

  async function audit() {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const fields = {};
      const now = new Date().toISOString();
      for (const [key, raw] of Object.entries(evidence)) {
        if (raw === "") continue;
        const value = key === "ownership" ? raw === "yes" : key === "photoCount" ? Number(raw) : key === "hours" ? [raw] : raw;
        fields[key] = { value, source: "owner", observedAt: now };
      }
      const { data } = await api.post("/g360/evidence/audits", { placeId: selected.place_id, name: selected.name, fields });
      setHistory((previous) => [data.audit, ...previous]);
      setSelectedAuditId(data.audit.id);
      setMessage("Pré/pós-análise registrada. Campos aqui declarados pelo responsável não são comprovação GBP; nota oficial indisponível.");
    } catch (error) { setMessage(fmtErr(error, "Não foi possível registrar análise")); }
    finally { setBusy(false); }
  }

  async function register() {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const { data } = await api.post("/g360/evidence/clients", { placeId: selected.place_id, name: selected.name });
      setClients((previous) => data.alreadyRegistered ? previous : [data.client, ...previous]);
      setMessage(data.alreadyRegistered ? "Empresa já registrada em sua lista." : "Empresa registrada em sua lista, sem contato ou score inventados.");
    } catch (error) { setMessage(fmtErr(error, "Não foi possível registrar cliente")); }
    finally { setBusy(false); }
  }

  async function previewGrid() {
    if (!selected) return;
    setBusy(true); setMessage("");
    try { const { data } = await api.post("/g360/geogrid/preview", { lat: selected.lat, lng: selected.lng }); setGrid(data); }
    catch (error) { setMessage(fmtErr(error, "Prévia indisponível")); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 text-slate-900 dark:text-slate-100">
    <header><h1 className="text-2xl font-semibold">Prospecção com fonte verificável</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">OpenStreetMap (Overpass) não é Google Business Profile. Consulta manual e limitada; não garante cobertura de toda a cidade. Google Places e Outscraper aguardam proteção de cobrança comprovada.</p></header>
    <section className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-purple-950 text-sm space-y-3"><h2 className="font-semibold">Importar empresas para revisão</h2><p>Use um JSON local para trabalhar sem APIs. Dados importados são declarações do usuário, sem verificação externa.</p><div className="flex gap-3 flex-wrap"><label className="g360-btn-primary cursor-pointer">Importar JSON<input data-testid="business-json-import" className="sr-only" type="file" accept="application/json,.json" onChange={importLocal}/></label><a className="underline self-center" href="/homologacao/empresas-ficticias.json" download>Baixar empresas fictícias para teste</a></div></section>
    <form onSubmit={search} className="grid gap-3 rounded-xl border border-slate-300 p-4 sm:grid-cols-2 dark:border-slate-600">
      <label className="text-sm">Cidade (referência informada)<input required minLength={2} maxLength={80} value={form.city} onChange={(e) => update("city", e.target.value)} className="mt-1 w-full rounded border p-2 text-slate-900" /></label>
      <label className="text-sm">Categoria OSM<select value={form.category} onChange={(e) => update("category", e.target.value)} className="mt-1 w-full rounded border p-2 text-slate-900">{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm">Latitude do centro<input type="number" required min={-90} max={90} step="any" value={form.lat} onChange={(e) => update("lat", e.target.value)} className="mt-1 w-full rounded border p-2 text-slate-900" /></label>
      <label className="text-sm">Longitude do centro<input type="number" required min={-180} max={180} step="any" value={form.lng} onChange={(e) => update("lng", e.target.value)} className="mt-1 w-full rounded border p-2 text-slate-900" /></label>
      <button disabled={busy || accessDenied} className="rounded bg-slate-900 p-2 font-medium text-white disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900">{busy ? "Consultando…" : "Pesquisar registros OSM"}</button>
      <p className="self-center text-xs text-slate-600 dark:text-slate-300">Para consultas externas, o administrador deve configurar G360_OSM_CONTACT com contato válido.</p>
    </form>
    {message && <p role="status" className="rounded bg-slate-100 p-3 text-sm text-slate-900 dark:bg-slate-800 dark:text-white">{message}</p>}
    {metadata && <p className="text-xs text-slate-600 dark:text-slate-300">Fonte: {metadata.attribution} · Coletado em {new Date(metadata.collectedAt).toLocaleString("pt-BR")} {metadata.cached ? "· cache" : ""} · {metadata.limitations}</p>}
    {!accessDenied && places.length > 0 && <section aria-label="Resultados">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">Site no OSM<select value={form.filter} onChange={(e) => update("filter", e.target.value)} className="ml-2 rounded border p-2 text-slate-900"><option value="all">Todos</option><option value="with">Site registrado</option><option value="without">Site não informado</option></select></label>
        <label className="text-sm">Telefone no OSM<select value={form.phoneFilter} onChange={(e) => update("phoneFilter", e.target.value)} className="ml-2 rounded border p-2 text-slate-900"><option value="all">Todos</option><option value="with">Telefone registrado</option></select></label>
        <label className="text-sm">Redes sociais no OSM<select value={form.socialFilter} onChange={(e) => update("socialFilter", e.target.value)} className="ml-2 rounded border p-2 text-slate-900"><option value="all">Todos</option><option value="with">Instagram ou Facebook registrado</option></select></label>
      </div>
      <p className="mt-2 text-xs">Dados não informados no OSM não comprovam ausência de site, telefone, rede social ou WhatsApp. Filtros aplicam-se somente aos {places.length} registros retornados neste raio.</p>
      {visible.length === 0 && <p role="status" className="mt-4 text-sm">Nenhum registro corresponde aos filtros atuais.</p>}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">{visible.map((place) => <li key={place.place_id} className="rounded-xl border border-slate-300 p-4 dark:border-slate-600"><h2 className="font-medium">{place.name}</h2><p className="text-sm">{place.category || "Categoria não informada"} · {place.address || "Endereço não informado"}</p><p className="text-sm">{place.website ? "Site registrado no OSM" : "Site desconhecido"} · {place.phone || "Telefone não informado"}</p><p className="text-xs">{place.social?.instagram || place.social?.facebook ? "Rede social registrada no OSM" : "Redes sociais não informadas"}</p>{place.sourceUrl ? <a className="text-sm underline" href={place.sourceUrl} target="_blank" rel="noopener noreferrer">Ver objeto na fonte</a> : <span className="text-xs">Importado pelo usuário — não verificado</span>}<button type="button" onClick={() => choose(place)} className="ml-4 text-sm font-semibold underline">Selecionar</button></li>)}</ul>
    </section>}
    {!accessDenied && selected && <section className="space-y-5 rounded-xl border border-slate-300 p-4 dark:border-slate-600"><h2 className="text-xl font-semibold">{selected.name}: evidências declaradas</h2><p className="text-sm">Dados OSM são uma pista de prospecção, não evidência de GBP. Confirme com o responsável antes de registrar; deixar vazio significa desconhecido.</p><div className="grid gap-3 sm:grid-cols-2"><label>Propriedade declarada<select value={evidence.ownership} onChange={(e) => setEvidence((p) => ({ ...p, ownership: e.target.value }))} className="mt-1 w-full rounded border p-2 text-slate-900"><option value="">Não informado</option><option value="yes">Declara ser responsável</option><option value="no">Declara não ser responsável</option></select></label>{["website", "category", "description", "phone", "hours", "photoCount"].map((field) => <label key={field} className="text-sm">{{ website: "Site informado", category: "Categoria informada", description: "Descrição informada", phone: "Telefone informado", hours: "Horário informado", photoCount: "Fotos declaradas (quantidade)" }[field]}<input type={field === "photoCount" ? "number" : "text"} min={field === "photoCount" ? 0 : undefined} max={field === "photoCount" ? 10000 : undefined} value={evidence[field]} onChange={(e) => setEvidence((p) => ({ ...p, [field]: e.target.value }))} className="mt-1 w-full rounded border p-2 text-slate-900" /></label>)}</div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={audit} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900">Registrar análise com data</button><button type="button" disabled={busy} onClick={register} className="rounded border px-4 py-2">Registrar cliente</button><button type="button" disabled={busy} onClick={previewGrid} className="rounded border px-4 py-2">Prévia geométrica opcional</button><button type="button" onClick={() => onOpenSite?.(selected)} className="rounded border px-4 py-2">Preparar site (revisar dados)</button></div>
      {currentHistory.length > 0 && <><EvidenceAuditSummary report={displayedAudit.report} /><h3 className="font-semibold">Histórico registrado</h3><ol className="space-y-1 text-sm">{currentHistory.map((entry) => <li key={entry.id}><button type="button" className="underline" onClick={() => setSelectedAuditId(entry.id)}>Ver coleta de {new Date(entry.createdAt).toLocaleString("pt-BR")}</button> · Cobertura {entry.report.coverage}/100 · Nota GBP indisponível</li>)}</ol></>}
      {grid && <section><h3 className="font-semibold">Geogrid: somente coordenadas</h3><p className="text-sm">Nenhuma posição foi consultada ou estimada. Centro: {selected.lat}, {selected.lng}.</p><div className="mt-3 grid max-w-sm grid-cols-5 gap-1">{grid.points.map((point) => <span key={`${point.row}-${point.col}`} title={`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`} className="rounded border p-2 text-center text-xs" aria-label={`Ponto ${point.row + 1}, ${point.col + 1}: posição indisponível`}>–</span>)}</div></section>}
    </section>}
    {!accessDenied && clients.length > 0 && <section><h2 className="font-semibold">Clientes registrados nesta conta</h2><ul className="text-sm">{clients.map((client) => <li key={client.id}>{client.name} · {new Date(client.createdAt).toLocaleDateString("pt-BR")}</li>)}</ul></section>}
  </div>;
}
