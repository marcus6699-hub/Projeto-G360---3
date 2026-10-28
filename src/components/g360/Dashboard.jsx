import { useEffect, useState } from 'react';
import { api, fmtErr } from '@/lib/api';
export default function Dashboard({dark=false,onOpen}) {
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;Promise.all([api.get('/projects'),api.get('/office'),api.get('/g360/crm')]).then(([p,o,c])=>{if(live)setData({projects:p.data.projects||[],office:o.data,leads:c.data.leads||[]})}).catch(e=>{if(live)setError(fmtErr(e,'Dashboard indisponível'))});return()=>{live=false}},[]);
 const cards=data?[['Sites locais',data.projects.length],['Clientes do Escritório',data.office.clients.length],['Minutas e contratos',data.office.contracts.length],['Leads do CRM',data.leads.length]]:[];
 return <section data-testid="g360-dashboard" className={`max-w-6xl mx-auto p-4 sm:p-6 space-y-6 ${dark?'text-slate-100':'text-slate-900'}`}>
 <header><p className="text-xs font-bold text-purple-600 uppercase tracking-widest">G360 Business</p><h1 className="text-2xl font-extrabold mt-1">Dashboard</h1><p className="text-sm mt-2 text-slate-500">Visão dos registros autorizados da sua conta. As contagens representam dados armazenados, sem estimativas comerciais.</p></header>
 {error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Carregando registros…</p>}
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{cards.map(([label,value])=><article key={label} className={`p-5 rounded-2xl border ${dark?'bg-[#14121E] border-white/10':'bg-white border-slate-200/80 shadow-sm'}`}><p className="text-sm text-slate-500">{label}</p><strong className="text-3xl block mt-2 text-purple-600">{value}</strong></article>)}</div>
 <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 text-purple-950"><h2 className="font-bold">Do diagnóstico ao site</h2><p className="text-sm mt-2">Selecione a empresa, registre evidências, revise o Pacote GBP e envie apenas informações aprovadas ao Site Express.</p><div className="flex flex-wrap gap-3 mt-4">{[['audit','Prospecção e auditoria'],['office','Escritório'],['site-express-direct','Site Express']].map(([v,l])=><button key={v} className="g360-btn-primary" onClick={()=>onOpen(v)}>{l}</button>)}</div></div>
 <p className="text-sm text-slate-500">Conexões externas, faturamento real e assinatura eletrônica dependem de configuração e homologação. A ausência dessas conexões não gera resultados demonstrativos.</p>
 </section>
}
