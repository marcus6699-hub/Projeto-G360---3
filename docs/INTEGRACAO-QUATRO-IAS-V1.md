# G360 Business — primeira versão integrada de teste

28/10/2026. Cópia independente: `/workspace/g360-unificado-v1`. Não é deploy nem declaração de prontidão de produção. Nenhum projeto original ou backup foi usado como diretório de execução.

## Como abrir

As dependências já estão disponíveis localmente; não é necessário instalar para esta cópia.

```bash
cd /workspace/g360-unificado-v1
NODE_ENV=development G360_DATA_DIR=/workspace/g360-unificado-v1-test-data BIND_HOST=127.0.0.1 PORT=3001 npm run dev
```

Abra `http://127.0.0.1:3001` pelo navegador/encaminhamento de porta do ambiente. O localhost do Windows não aponta automaticamente para este container. O comando acima inicia somente servidor local, sem publicar.

O diretório de dados contém somente fixtures. As credenciais aleatórias das contas admin/user fictícias estão em `/workspace/g360-unificado-v1-test-data/TEST-CREDENTIALS-PRIVATE.json`, com acesso privado; leia localmente, não publique. Nenhuma conta real foi redefinida. Para criar outra base fictícia independente:

```bash
node scripts/prepare-integration-fixture.mjs /workspace/g360-outro-teste
```

O comando exige diretório novo e nunca sobrescreve dados existentes. Use esse diretório em G360_DATA_DIR. Não aponte a cópia para bancos originais. Firebase está configurado com projeto fictício; login Google/Firestore reais não estão habilitados. Use login local.

## Incorporação e conflitos resolvidos

| Agente | Incorporado | Limites |
|---|---|---|
| Codex | Backend, scrypt/sessões, papéis/propriedade, JSON atômico, SSRF, custos e testes preservados; logout agora coordena backend/Firebase; escopos Workspace reduzidos | Revogação Firebase tem testes simulados; Firebase/Firestore/OAuth reais dependem de homologação externa |
| OpenCode | Prospecção OSM, evidências com histórico por usuário, Geogrid geométrico sem posições, filtro OSM, site verificado autocontido, templates e melhorias HTML/ZIP; JSZip 3.10.2 | Consulta OSM real exige contato e autorização externa gratuita verificável; sem chamadas reais nesta fase |
| AI Studio | Prompt hardening, pipeline local, branding, adaptador GBP, aprovações, transferência de descrição/itens/mídia/paleta e filtro pending corrigido | Rascunho determinístico local, não inferência por LLM remoto; conteúdo deve ser revisto |
| Antigravity | Tokens/visual Vella/HIG e preferência Nunito, componentes, navegação desktop/mobile, editor e fluxo de nove etapas GBP | Fonte Nunito sem arquivo local depende da disponibilidade de fonte/fallback; painel legado com simulações não é a tela exportada |

Não foram substituídos server.ts/g360Engine.ts integralmente. Foram portados módulos novos e conciliados os comportamentos. auditContract reúne exports complementares, retira projeções automáticas e exige evidência para posições; interface mostra indisponível em vez de dados inventados. Studio liga OSM/evidências/site independente à interface Antigravity. CRM mantém namespace UID; GBP usa UID + identidade da empresa e proteção contra resposta antiga. Aprovações se invalidam quando conteúdo/branding muda. projectFactory não reintroduz itens pendentes quando todos são filtrados. Handoff leva dados aprovados para Site Express; renderer valida a paleta. Previews permanecem sandboxados; mensagens do editor exigem origem no iframe esperado.

Históricos evidenceAudits/evidenceClients não são truncados globalmente; campos novos passam pelo validador e armazenamento Codex. Rotas novas são autenticadas; OSM padrão passa pela política de transporte externa com corpo/tempo limitados e autorização explícita. OSM não comprova propriedade de perfil Google.

Escritório G360 recebeu tela protegida de consulta para clientes, contratos, sites, vencimentos, financeiro simulado e histórico. Criação/revisão continuam nas APIs protegidas existentes; a tela é somente leitura. CRM visual permanece separado do Escritório; não houve migração automática entre os dois.

## Evidências reais

- Suíte final isolada: **322 testes, 322 aprovados, 0 falhas, 0 ignorados**, incluindo SSRF, autenticação, permissões, JSON, backup, exportações, GBP e nova integração HTTP.
- Os testes Codex foram mantidos; fixture GBP do teste de falha de disco agora informa empresa válida exigida pela API. Teste OpenCode da fronteira anônima foi adaptado para exigir 401 conforme autenticação Codex, com novos testes autenticados de evidências e isolamento. Não foram retirados asserts de segurança.
- `npm run lint` (tsc --noEmit): sucesso. `npm run build`: sucesso, Vite 8.3.5.
- Chromium real em fixtures: **19 verificações aprovadas**, sem findings nem erros JavaScript. Login incorreto/correto, sessão/reload, logout/revogação, recuperação indisponível honesta, isolamento entre duas contas, Office desktop/tablet/celular, indisponibilidade OSM e jornada controlada OSM→evidências/Geogrid→GBP aprovado→Site Express→Editor→salvamento→HTML/ZIP.
- Navegador de segurança sitegen: **14 cenários controlados**; sem leitura do documento pai, tracking e ataques de contexto isolados conforme o relatório. É amostragem, não prova universal contra XSS.
- Inicialização do build real em modo production, somente loopback e dados fictícios: **4 grupos de verificações HTTP aprovados** (serviço, bloqueio anônimo/arquivos privados, senha/cookie, Office/logout). Processo encerrado ao fim.
- JSZip 3.10.2 confirmado no registro npm; tarball conferido por SHA-512; dependências diretas idênticas à versão anterior. Somente entrada JSZip do bun.lock atualizada; tsx permaneceu em runtime e start Codex preservado. Nenhum lifecycle script de instalação executado. Instalação limpa com lock Bun ainda requer homologação.

Logs completos e screenshots referenciados estão em `/workspace/g360-integracao-recebimento-20261028T120757Z/etapa3/relatorios/etapa4-*`. As tentativas intermediárias com falhas foram preservadas. Os resultados acima correspondem aos arquivos finais `etapa4-tests-final.log`, `etapa4-types-final2.log`, `etapa4-build-final.log`, `etapa4-browser-v6.log`, `etapa4-sitegen-browser.log` e `etapa4-production-smoke.json`. Nenhum teste consultou empresas reais ou enviou contrato/cobrança.

Para repetir:

```bash
node scripts/test-isolated.mjs
npm run lint
npm run build
python3 scripts/browser-local.py
python3 scripts/sitegen-browser-local.py
```

Os testes criam cópias fictícias temporárias. Playwright e Chromium estão disponíveis neste ambiente; outros ambientes devem prover essas ferramentas gratuitas. Não executar testes em bancos originais.

## Pendências e riscos

1. Bases Antigravity/AI Studio ainda não têm objeto Git verificável. Conciliação foi por conteúdo entregue e hashes da Etapa 3, sem assumir ancestralidade; patches incompatíveis não foram aplicados automaticamente.
2. Busca real OSM não foi executada. Fonte gratuita precisa de contato, política de uso/limites e autorização gratuita documentada. Google/Outscraper/IA remota permanecem sem ativação; superfícies legadas de descoberta sem fonte verificável retornam 503.
3. GBP com empresas reais, Firebase/Firestore/OAuth e regras efetivamente implantadas não foram homologados com serviços reais. Não usar permissões do frontend ou planos informativos como autorização de backend.
4. Assinatura eletrônica e pagamentos reais não estão ativos. Minuta/aprovação interna/WhatsApp não são assinatura; planos e financeiro não ativam cobrança. Recuperação administrativa real exige plano/autorização próprios.
5. Persistência ainda JSON para instância única e sessões em memória; escalabilidade, recuperação de locks/estado incerto e backup externo independente seguem pendentes. Nenhum dado legado foi reassociado ou migrado.
6. Avisos conhecidos de gRPC/esbuild e revisão completa de dependências continuam; esta etapa não declara esses alertas resolvidos. Instalação limpa reprodutível do lock final precisa ser testada. Build avisa sobre __dirname, chunks grandes e import Firebase estático/dinâmico.
7. Preview sandbox pode impedir restauração automática de scroll interno; não relaxar allow-same-origin para contornar. Teste visual verifica jornada e overflow em três tamanhos, não cada tela e combinação de navegador.
8. HTML/ZIP de templates pode depender de fontes/CDN/imagens/API e não é export universal offline. A opção de site verificado OpenCode é autocontida. Arquivo de vídeo excluído da entrega Antigravity não foi recuperado automaticamente.
9. Parte do código legado de geração fica preservada para conciliação posterior; rotas inseguras de descoberta estão bloqueadas e painel legado de métricas sintéticas não é acessível pela exportação atual. Revisão futura deve remover/conciliar caminhos legados com autorização, sem reativar resultados fabricados.

## Próxima etapa e reversão

Recomenda-se revisão funcional do usuário nesta cópia, fornecer bases ausentes e homologar instalação limpa, dados empresariais autorizados e serviços de teste antes de considerar incorporação. Não está pronto para produção.

Reversão não exige reset ou restauração do original: pare o servidor local e mantenha esta cópia para comparação; projeto e backup anteriores continuam intactos. MANIFESTO-INTEGRACAO.json documenta os hashes da cópia e ALTERACOES-INTEGRACAO.json lista mudanças em relação à referência Codex. Não houve commit, push, merge, deploy, publicação, alteração de contas reais ou gastos.
