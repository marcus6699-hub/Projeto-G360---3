import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Trash2,
  Server,
  DollarSign,
  QrCode,
  Target,
  TrendingUp,
  Check,
  Copy,
} from "lucide-react";
import { api, fmtErr } from "@/lib/api";
import ApiKeysSettings from "./ApiKeysSettings";
import GoogleWorkspacePanel from "./GoogleWorkspacePanel";

export default function G360SaaSSettingsPanel({ dark = false }) {
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [financeGoals, setFinanceGoals] = useState({
    monthlyRevenueGoal: 15000,
    monthlyLeadsGoal: 30,
    averageTicketTarget: 997,
  });
  const [pixConfig, setPixConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("g360_pix_config");
      return saved
        ? JSON.parse(saved)
        : {
            pixKeyType: "CPF / CNPJ",
            pixKey: "018.070.701-90",
            beneficiaryName: "Marcus Henrique Pires Dias",
            bankName: "Nubank / Inter / Asaas",
          };
    } catch {
      return {
        pixKeyType: "CPF / CNPJ",
        pixKey: "018.070.701-90",
        beneficiaryName: "Marcus Henrique Pires Dias",
        bankName: "Nubank / Inter / Asaas",
      };
    }
  });

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    plan: "g360_full", // "g360_full" | "site_express_only"
    role: "user",
  });
  const [deploySettings, setDeploySettings] = useState({
    vercelToken: "",
    netlifyToken: "",
    agencyName: "G360 Google Business Intelligence",
    agencyPhone: "(62) 99999-0000",
    agencyDocument: "018.070.701-90",
  });
  const [aiStatus, setAiStatus] = useState({
    provider: "gemini",
    model: "gemini-3.8-flash",
    has_own_key: false,
    google_places_active: false,
  });

  const [engines, setEngines] = useState({});
  const [testingEngines, setTestingEngines] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const loadAll = async () => {
    try {
      const [uRes, crmRes, aiRes, engRes] = await Promise.all([
        api.get("/g360/users"),
        api.get("/g360/crm"),
        api.get("/settings/ai"),
        api.get("/g360/engine-status"),
      ]);
      setUsers(uRes.data?.users || []);
      setLeads(crmRes.data?.leads || []);
      if (crmRes.data?.financeGoals) {
        setFinanceGoals((prev) => ({ ...prev, ...crmRes.data.financeGoals }));
      }
      if (crmRes.data?.deploySettings) {
        setDeploySettings((prev) => ({ ...prev, ...crmRes.data.deploySettings }));
      }
      if (aiRes.data) setAiStatus(aiRes.data);
      if (engRes.data?.engines) setEngines(engRes.data.engines);
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao carregar configurações"));
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSavePixConfig = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem("g360_pix_config", JSON.stringify(pixConfig));
      toast.success("Configurações de Chave Pix e Recebimento salvas com sucesso!");
    } catch {
      toast.error("Não foi possível salvar a chave Pix.");
    }
  };

  const handleRunEngineTest = async () => {
    setTestingEngines(true);
    try {
      const { data } = await api.post("/g360/test-engines", {
        sampleQuery: "Encanto Móveis Planejados",
      });
      setTestResult(data);
      toast.success("Diagnóstico em tempo real concluído com sucesso!");
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao testar motores"));
    } finally {
      setTestingEngines(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      toast.error("Preencha nome, e-mail e senha para liberar o login.");
      return;
    }
    try {
      const { data } = await api.post("/g360/users", newUser);
      if (data?.user) {
        setUsers((prev) => [...prev, data.user]);
        setNewUser({ name: "", email: "", password: "", plan: "g360_full", role: "user" });
        toast.success(`Login criado para ${data.user.email}`);
      }
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao criar usuário"));
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await api.delete(`/g360/users/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("Acesso revogado.");
    } catch (e) {
      toast.error(fmtErr(e, "Não foi possível remover este usuário"));
    }
  };

  const handleSaveDeploySettings = async (e) => {
    e.preventDefault();
    try {
      await api.put("/g360/settings", { deploySettings, financeGoals });
      toast.success("Dados da agência e metas financeiras salvos no servidor!");
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao salvar configurações"));
    }
  };

  // Financial Metrics (Relocated from CRM to Administração / Acessos)
  const closedLeads = leads.filter((l) => l.stage === "fechado" || l.stage === "otimizacao");
  const totalRevenue = closedLeads.reduce((acc, l) => acc + Number(l.dealValue || 0), 0);
  const pipelineValue = leads
    .filter((l) => l.stage === "prospeccao" || l.stage === "proposta")
    .reduce((acc, l) => acc + Number(l.dealValue || 0), 0);
  const avgTicket = closedLeads.length > 0 ? Math.round(totalRevenue / closedLeads.length) : 997;
  const conversionRate = leads.length > 0 ? Math.round((closedLeads.length / leads.length) * 100) : 0;
  const remainingGoal = Math.max(0, financeGoals.monthlyRevenueGoal - totalRevenue);
  const clientsNeededToHitGoal = Math.ceil(remainingGoal / Math.max(1, avgTicket));

  const cardClass = dark
    ? "bg-[#303134]/90 border border-[#3C4043] text-[#E8EAED]"
    : "bg-white border border-[#E2E8F0] text-[#1E293B] shadow-[0_1px_3px_rgba(15,23,42,0.04)]";
  const mutedText = dark ? "text-[#9AA0A6]" : "text-[#64748B]";
  const subtleBg = dark ? "bg-[#202124]" : "bg-[#F8FAFC]";
  const borderCol = dark ? "border-[#3C4043]" : "border-[#E2E8F0]";

  return (
    <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* HEADER */}
      <section className={`rounded-2xl p-5 sm:p-6 ${cardClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[#2563EB]">
              Painel Administrativo SaaS, Financeiro & Motores Conectados
            </div>
            <h1 className="text-[22px] sm:text-[25px] font-bold tracking-tight mt-0.5">
              Administração, Financeiro e Metas, Chave Pix e Gestão de Acessos
            </h1>
            <p className={`text-[13px] mt-0.5 ${mutedText}`}>
              Controle o faturamento da sua operação, configure sua chave Pix para contratos/propostas e gerencie logins de clientes SaaS.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[#16A34A]">
            <Server size={16} />
            <span>Backend Node.js + Firebase Cloud Ativo</span>
          </div>
        </div>
      </section>

      {/* SECTION 1: FINANCEIRO E METAS + CHAVE PIX (RELOCATED FROM CRM) */}
      <section className="space-y-4" data-testid="admin-finance-section">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`rounded-2xl p-5 ${cardClass}`}>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${mutedText}`}>
              Faturamento Realizado
            </div>
            <div className="text-[28px] font-mono font-extrabold text-[#16A34A] tabular-nums mt-1">
              R$ {totalRevenue.toLocaleString("pt-BR")}
            </div>
            <div className={`text-[12px] mt-1 ${mutedText}`}>
              Meta mensal: R$ {financeGoals.monthlyRevenueGoal.toLocaleString("pt-BR")}
            </div>
          </div>

          <div className={`rounded-2xl p-5 ${cardClass}`}>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${mutedText}`}>
              Em Negociação no Funil
            </div>
            <div className="text-[28px] font-mono font-extrabold text-[#2563EB] tabular-nums mt-1">
              R$ {pipelineValue.toLocaleString("pt-BR")}
            </div>
            <div className={`text-[12px] mt-1 ${mutedText}`}>
              Propostas e contratos ativos
            </div>
          </div>

          <div className={`rounded-2xl p-5 ${cardClass}`}>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${mutedText}`}>
              Ticket Médio por Cliente
            </div>
            <div className="text-[28px] font-mono font-extrabold tabular-nums mt-1">
              R$ {avgTicket.toLocaleString("pt-BR")}
            </div>
            <div className={`text-[12px] mt-1 ${mutedText}`}>
              Pacote GBP + Site Express + Placa
            </div>
          </div>

          <div className={`rounded-2xl p-5 ${cardClass}`}>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${mutedText}`}>
              Taxa de Conversão do Funil
            </div>
            <div className="text-[28px] font-mono font-extrabold text-[#F59E0B] tabular-nums mt-1">
              {conversionRate}%
            </div>
            <div className={`text-[12px] mt-1 ${mutedText}`}>
              {closedLeads.length} de {leads.length} empresas abordadas
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Metas Mensais */}
          <div className={`lg:col-span-7 rounded-2xl p-6 space-y-4 flex flex-col justify-between ${cardClass}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-inherit">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#2563EB] flex items-center gap-1.5">
                  <Target size={14} /> Planejamento Comercial e Metas da Agência
                </div>
                <h2 className="text-[17px] font-bold mt-0.5">
                  Calculadora de Fechamentos Mensais
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[12px] font-semibold ${mutedText}`}>Meta Mensal (R$):</span>
                <input
                  type="number"
                  value={financeGoals.monthlyRevenueGoal}
                  onChange={(e) =>
                    setFinanceGoals((g) => ({
                      ...g,
                      monthlyRevenueGoal: Number(e.target.value || 0),
                    }))
                  }
                  className={`w-32 px-3 py-1.5 rounded-xl border font-mono font-bold text-[13px] tabular-nums outline-none ${borderCol} ${subtleBg}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px]">
              <div className={`p-4 rounded-xl border ${borderCol} ${subtleBg}`}>
                <div className={mutedText}>Falta para atingir a meta:</div>
                <div className="text-[20px] font-mono font-bold text-[#2563EB] tabular-nums mt-1">
                  R$ {remainingGoal.toLocaleString("pt-BR")}
                </div>
              </div>
              <div className={`p-4 rounded-xl border ${borderCol} ${subtleBg}`}>
                <div className={mutedText}>Fechamentos necessários:</div>
                <div className="text-[20px] font-mono font-bold text-[#16A34A] tabular-nums mt-1">
                  {clientsNeededToHitGoal} clientes
                </div>
              </div>
              <div className={`p-4 rounded-xl border ${borderCol} ${subtleBg}`}>
                <div className={mutedText}>Pré-Análises por semana:</div>
                <div className="text-[20px] font-mono font-bold tabular-nums mt-1">
                  {Math.max(4, clientsNeededToHitGoal * 2)} fichas
                </div>
              </div>
            </div>
          </div>

          {/* Configuração de Chave Pix e Recebimento */}
          <form
            onSubmit={handleSavePixConfig}
            className={`lg:col-span-5 rounded-2xl p-6 space-y-4 flex flex-col justify-between ${cardClass}`}
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-inherit">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#16A34A] flex items-center gap-1.5">
                    <QrCode size={14} /> Recebimento Pix da Agência
                  </div>
                  <h3 className="text-[17px] font-bold mt-0.5">Chave Pix para Propostas e Contratos</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pixConfig.pixKey);
                    toast.success("Chave Pix copiada!");
                  }}
                  className="text-[11px] font-bold text-[#2563EB] flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={12} /> Copiar Pix
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 text-[12.5px]">
                <div>
                  <label className={`block text-[10.5px] font-semibold uppercase mb-1 ${mutedText}`}>
                    Tipo de Chave
                  </label>
                  <select
                    value={pixConfig.pixKeyType}
                    onChange={(e) => setPixConfig((p) => ({ ...p, pixKeyType: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${borderCol} ${subtleBg}`}
                  >
                    <option value="CPF / CNPJ">CPF / CNPJ</option>
                    <option value="Celular">Celular / WhatsApp</option>
                    <option value="E-mail">E-mail</option>
                    <option value="Chave Aleatória">Chave Aleatória</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-[10.5px] font-semibold uppercase mb-1 ${mutedText}`}>
                    Chave Pix
                  </label>
                  <input
                    type="text"
                    value={pixConfig.pixKey}
                    onChange={(e) => setPixConfig((p) => ({ ...p, pixKey: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl border font-mono outline-none ${borderCol} ${subtleBg}`}
                  />
                </div>
                <div>
                  <label className={`block text-[10.5px] font-semibold uppercase mb-1 ${mutedText}`}>
                    Titular / Favorecido
                  </label>
                  <input
                    type="text"
                    value={pixConfig.beneficiaryName}
                    onChange={(e) => setPixConfig((p) => ({ ...p, beneficiaryName: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl border outline-none ${borderCol} ${subtleBg}`}
                  />
                </div>
                <div>
                  <label className={`block text-[10.5px] font-semibold uppercase mb-1 ${mutedText}`}>
                    Instituição / Banco
                  </label>
                  <input
                    type="text"
                    value={pixConfig.bankName}
                    onChange={(e) => setPixConfig((p) => ({ ...p, bankName: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl border outline-none ${borderCol} ${subtleBg}`}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-[#16A34A] hover:opacity-95 text-white font-semibold text-[13px] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check size={15} /> Salvar Dados Financeiros e Chave Pix
            </button>
          </form>
        </div>
      </section>

      {/* SECTION 2: USERS & ENGINES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Multi-User SaaS Login Manager */}
        <div className={`lg:col-span-6 rounded-2xl p-5 sm:p-6 space-y-5 ${cardClass}`}>
          <div className="pb-3 border-b border-inherit">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#2563EB]">
              Controle de Assinantes e Acessos
            </div>
            <h2 className="text-[18px] font-bold mt-0.5">
              Liberar Login para Cliente (G360 Completo ou Só Site Express)
            </h2>
          </div>

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
            <div>
              <label className={`block text-[11px] font-semibold uppercase mb-1 ${mutedText}`}>
                Nome do Usuário / Agência
              </label>
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                placeholder="Ex: João Consultor GBP"
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none ${borderCol} ${subtleBg}`}
              />
            </div>
            <div>
              <label className={`block text-[11px] font-semibold uppercase mb-1 ${mutedText}`}>
                E-mail de Login
              </label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                placeholder="cliente@email.com"
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none ${borderCol} ${subtleBg}`}
              />
            </div>
            <div>
              <label className={`block text-[11px] font-semibold uppercase mb-1 ${mutedText}`}>
                Senha de Acesso
              </label>
              <input
                type="text"
                value={newUser.password}
                onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                placeholder="Senha inicial"
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none ${borderCol} ${subtleBg}`}
              />
            </div>
            <div>
              <label className={`block text-[11px] font-semibold uppercase mb-1 ${mutedText}`}>
                Produto Liberado no Login
              </label>
              <select
                value={newUser.plan}
                onChange={(e) => setNewUser((u) => ({ ...u, plan: e.target.value }))}
                className={`w-full px-3.5 py-2.5 rounded-xl border font-semibold outline-none ${borderCol} ${subtleBg}`}
              >
                <option value="g360_full">G360 Completo (Auditoria + Pacote GBP + CRM + Site Express)</option>
                <option value="site_express_only">Apenas Site Express (Produto Separado)</option>
              </select>
            </div>
            <div className="sm:col-span-2 pt-1">
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[13px] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus size={15} /> Criar Login de Cliente
              </button>
            </div>
          </form>

          <div className="space-y-2.5 pt-3 border-t border-inherit">
            <div className={`text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
              Usuários Cadastrados ({users.length})
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-[13px] ${borderCol} ${subtleBg}`}
                >
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span>{u.name}</span>
                      <span className="text-[11px] font-semibold text-[#2563EB]">
                        · {u.plan === "site_express_only" ? "Apenas Site Express" : "G360 Completo"}
                      </span>
                    </div>
                    <div className={`text-[12px] ${mutedText}`}>{u.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u.id)}
                    className={`p-2 rounded-lg hover:bg-black/10 ${mutedText}`}
                    title="Revogar acesso"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Real-Time Multi-Engine Diagnostic & Agency Brand */}
        <div className={`lg:col-span-6 rounded-2xl p-5 sm:p-6 space-y-5 ${cardClass}`}>
          <div className="pb-3 border-b border-inherit flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#16A34A]">
                Status das Integrações no Servidor
              </div>
              <h2 className="text-[18px] font-bold mt-0.5">
                Motores Google Maps, Outscraper, Gemini, NVIDIA e OpenRouter
              </h2>
            </div>
            <button
              type="button"
              onClick={handleRunEngineTest}
              disabled={testingEngines}
              data-testid="test-engines-btn"
              className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold cursor-pointer shrink-0"
            >
              {testingEngines ? "Testando..." : "Testar Motores Ao Vivo"}
            </button>
          </div>

          <div className="space-y-2.5">
            {Object.entries(engines).map(([key, item]) => (
              <div
                key={key}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${borderCol} ${subtleBg}`}
              >
                <div>
                  <div className="text-xs font-bold">{item.label}</div>
                  <div className={`text-[11px] mt-0.5 ${mutedText}`}>{item.mode}</div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    item.active
                      ? "bg-[#DCFCE7] text-[#15803D]"
                      : "bg-[#FEF3C7] text-[#B45309]"
                  }`}
                >
                  {item.active ? "ATIVO" : "VIA .ENV"}
                </span>
              </div>
            ))}
          </div>

          {testResult && (
            <div className="p-4 rounded-xl border border-[#16A34A]/40 bg-[#16A34A]/10 space-y-1.5 text-xs">
              <div className="font-bold text-[#16A34A]">
                Teste Real Executado — Fonte: {testResult.resolvedSource} | IA: {testResult.aiProviderUsed}
              </div>
              <div>
                <strong>Empresa Localizada:</strong> {testResult.sampleBusiness?.name} ({testResult.sampleBusiness?.city} - {testResult.sampleBusiness?.uf}) · Nota {testResult.sampleBusiness?.rating} ({testResult.sampleBusiness?.rating_count} avaliações)
              </div>
              <div className={mutedText}>{testResult.aiSampleOutput}</div>
            </div>
          )}

          <form onSubmit={handleSaveDeploySettings} className="space-y-3 pt-3 border-t border-inherit text-[13px]">
            <div>
              <label className={`block text-[11px] font-semibold uppercase mb-1 ${mutedText}`}>
                Nome da Sua Agência (Exibido nos Relatórios PDF, Propostas e Contratos)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={deploySettings.agencyName}
                  onChange={(e) => setDeploySettings((s) => ({ ...s, agencyName: e.target.value }))}
                  className={`flex-1 px-3.5 py-2.5 rounded-xl border outline-none ${borderCol} ${subtleBg}`}
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs cursor-pointer"
                >
                  Salvar Marca
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="pt-2">
        <GoogleWorkspacePanel dark={dark} />
      </div>

      <div className="pt-6 border-t border-inherit">
        <ApiKeysSettings dark={dark} />
      </div>
    </div>
  );
}
