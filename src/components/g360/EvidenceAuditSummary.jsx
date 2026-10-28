import { Fragment } from "react";

const LABELS = {
  ownership: "Propriedade do perfil",
  website: "Site vinculado",
  category: "Categoria principal",
  description: "Descrição do negócio",
  phone: "Telefone",
  hours: "Horário de funcionamento",
  reviewCount: "Volume de avaliações",
  photoCount: "Fotos confirmadas pelo responsável",
};

const STATUS = {
  attention: { text: "Atenção", className: "text-amber-700 dark:text-amber-300" },
  unknown: { text: "Sem evidência", className: "text-slate-600 dark:text-slate-300" },
  good: { text: "Atendido", className: "text-emerald-700 dark:text-emerald-300" },
};
const ADVICE = {
  ownership: "Solicite ao responsável comprovação de acesso e função no perfil; avaliações não provam propriedade.",
  website: "Confirme o endereço oficial e, se não houver site, prepare uma página aprovada pelo responsável.",
  category: "Revise a categoria principal com o responsável e compare com o serviço efetivamente prestado.",
  description: "Produza descrição factual e peça aprovação antes de publicar.",
  phone: "Confirme um telefone ativo e autorizado antes de divulgar.",
  hours: "Confirme horários regulares e especiais diretamente com o negócio.",
  reviewCount: "Consulte fonte autorizada para quantidade real; não fabrique avaliações.",
  photoCount: "Solicite mídia própria autorizada e registre a quantidade informada.",
};

/** Read-only React presentation; integration into the Antigravity-owned panel is pending. */
export default function EvidenceAuditSummary({ report }) {
  if (!report) return <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Nenhuma análise com evidências disponível.</p>;
  return (
    <section aria-labelledby="evidence-audit-title" className="space-y-5 text-slate-900 dark:text-slate-100">
      <header className="space-y-1">
        <h2 id="evidence-audit-title" className="text-xl font-semibold">Análise com evidências</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Checklist G360 independente — não é uma nota oficial do Google.</p>
      </header>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1" aria-live="polite">
        <strong className="text-3xl tabular-nums">{report.score === null ? "Pontuação indisponível" : `${report.score}/100`}</strong>
        <span className="text-sm text-slate-600 dark:text-slate-300">Cobertura: {report.coverage}/100 pontos documentados</span>
      </div>
      <dl className="divide-y divide-slate-200 dark:divide-slate-700">
        {report.criteria.map((criterion) => {
          const state = STATUS[criterion.status] || STATUS.unknown;
          return (
            <div key={criterion.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
              <dt className="font-medium">{LABELS[criterion.id] || criterion.id} <span className="font-normal text-slate-600 dark:text-slate-300">({criterion.weight} pontos)</span></dt>
              <dd className={`text-sm font-medium ${state.className}`}>{state.text}</dd>
              <dd className="text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">
                {criterion.evidence ? <Fragment>Fonte: {criterion.evidence.source === "owner" ? "declarada pelo responsável" : "Google Places"} · Coletado em {new Date(criterion.evidence.observedAt).toLocaleDateString("pt-BR")}</Fragment> : "Este campo não foi verificado; não foi tratado como falha."}
              </dd>
              {criterion.status !== "good" && <dd className="text-sm text-slate-700 dark:text-slate-200 sm:col-span-2">{criterion.status === "attention" ? "Atenção: " : "Próximo passo: "}{ADVICE[criterion.id] || "Confirme o dado na fonte original."}</dd>}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
