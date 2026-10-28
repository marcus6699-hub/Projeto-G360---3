import { useEffect, useState } from "react";
import { api, fmtErr } from "@/lib/api";

const contractStates = {
  draft: "Minuta", review: "Em revisão", approved: "Aprovado internamente — ainda não assinado",
  awaiting_provider: "Aguardando plataforma de assinatura — ainda não enviado",
  simulated_signed: "Assinatura simulada de teste — sem assinatura eletrônica real",
  canceled: "Cancelado",
};
const expirationStates = { active: "Vigente", expired: "Vencido", expiring: "Vence em até 7 dias", no_expiration: "Sem vencimento", canceled: "Cancelado" };
const financialStates = { pending: "Pendente", overdue: "Vencido", confirmed: "Confirmação simulada", canceled: "Cancelado", refunded: "Estorno simulado" };
const money = (cents) => Number.isSafeInteger(cents) ? new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"}).format(cents / 100) : "Valor indisponível";

export default function Office({ dark = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null);
    api.get("/office", {signal:controller.signal}).then(({data:next}) => {
      if (!cancelled) setData(next);
    }).catch((e) => { if (!cancelled) setError(fmtErr(e, "Escritório indisponível. Nenhum dado de demonstração foi inserido.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [revision]);
  const clients = Array.isArray(data?.clients) ? data.clients : [];
  const contracts = Array.isArray(data?.contracts) ? data.contracts : [];
  const sites = Array.isArray(data?.sites) ? data.sites : [];
  const financial = Array.isArray(data?.financial) ? data.financial : [];
  const history = Array.isArray(data?.history) ? data.history : [];
  const clientName = (id) => clients.find(c => c.id === id)?.businessName || clients.find(c => c.id === id)?.name || "Cliente vinculado";
  const card = `rounded-2xl border p-4 sm:p-6 min-w-0 ${dark ? "bg-[#14121E] border-white/10" : "bg-white border-slate-200/80"}`;
  return <main data-testid="office-panel" className={`p-4 sm:p-6 max-w-[1440px] mx-auto w-full space-y-6 ${dark ? "text-[#EDE9FE]" : "text-slate-900"}`}>
    <header className="flex flex-wrap justify-between items-start gap-4"><div><h1 className="text-2xl font-bold">Escritório G360</h1><p className="text-sm mt-2">Clientes, contratos, sites, vencimentos e histórico da sua conta.</p></div><button type="button" onClick={() => setRevision(r => r + 1)} disabled={loading} className="g360-btn-primary" data-testid="office-refresh">{loading ? "Carregando…" : "Atualizar"}</button></header>
    <p className="rounded-xl bg-amber-100 text-amber-950 p-4 text-sm">Consulta operacional local. Aprovação interna não é assinatura eletrônica. Cobranças reais e assinatura por provedor permanecem desativadas. A criação e revisão de registros estão disponíveis na API protegida; esta tela é somente de consulta.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {loading && <p role="status">Carregando registros autorizados…</p>}
    {data && <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className={card}><h2 className="text-lg font-bold mb-4">Clientes ({clients.length})</h2>{!clients.length && <p>Nenhum cliente cadastrado no Escritório.</p>}<ul className="space-y-3">{clients.map(c => <li key={c.id} className="border-b border-slate-200/30 pb-3 break-words"><strong>{c.businessName || c.name}</strong><p>{c.name} · Plano {c.plan}</p><p>{expirationStates[c.expiration] || "Situação indisponível"}{c.expiresOn ? ` · ${c.expiresOn}` : ""}{c.archived ? " · Arquivado" : ""}</p></li>)}</ul></section>
      <section className={card}><h2 className="text-lg font-bold mb-4">Contratos ({contracts.length})</h2>{!contracts.length && <p>Nenhuma minuta cadastrada.</p>}<ul className="space-y-3">{contracts.map(c => <li key={c.id} className="border-b border-slate-200/30 pb-3 break-words"><strong>{c.title}</strong><p>{clientName(c.clientId)}</p><p>{contractStates[c.status] || "Estado não reconhecido — assinatura não comprovada"}</p><p>{expirationStates[c.expiration] || "Vencimento indisponível"}{c.expiresOn ? ` · ${c.expiresOn}` : ""} · {c.versions?.length || 0} versão(ões)</p></li>)}</ul></section>
      <section className={card}><h2 className="text-lg font-bold mb-4">Sites vinculados ({sites.length})</h2>{!sites.length && <p>Nenhum site vinculado a cliente do Escritório.</p>}<ul className="space-y-3">{sites.map(s => <li key={`${s.clientId}:${s.id}`} className="break-words"><strong>{s.name}</strong><p>{clientName(s.clientId)} · Publicação externa não verificada</p></li>)}</ul></section>
      <section className={card}><h2 className="text-lg font-bold mb-4">Situação financeira ({financial.length})</h2><p className="text-sm mb-3">Registros de simulação; não comprovam pagamento real.</p>{!financial.length && <p>Nenhum lançamento.</p>}<ul className="space-y-3">{financial.map(f => <li key={f.id}><strong>{clientName(f.clientId)} · {money(f.amountCents)}</strong><p>{financialStates[f.state || f.status] || "Situação não confirmada"} · Vencimento {f.dueOn}</p></li>)}</ul></section>
      <section className={`${card} lg:col-span-2`}><h2 className="text-lg font-bold mb-4">Histórico ({history.length})</h2>{!history.length && <p>Nenhum evento registrado.</p>}<ul className="space-y-2">{history.slice(-50).reverse().map(e => <li key={e.id} className="text-sm break-words">{clientName(e.clientId)} · {e.type} · {e.at}</li>)}</ul>{history.length > 50 && <p className="text-sm mt-3">Exibindo os 50 eventos mais recentes; os anteriores permanecem preservados no backend.</p>}</section>
    </div>}
  </main>;
}
