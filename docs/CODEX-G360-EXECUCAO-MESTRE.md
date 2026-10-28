# G360 — execução mestre Codex

Data: 28/10/2026. Branch `codex/auditoria-g360`; HEAD `5190b4b8f6ac80eda6fe565e228eb740251ea165`. Um único worktree acessível; alterações anteriores não commitadas preservadas. Não foram encontradas instruções AGENTS.md ou arquivo independente do Protocolo Mestre Universal; o protocolo descrito no pedido orienta esta execução.

## Regras de evidência

IMPLEMENTADA é código, TESTADA exige execução, TESTADA NO NAVEGADOR exige uso do navegador, INTEGRADA exige comunicação efetiva, VALIDADA exige critérios completos. PARCIAL/BLOQUEADA/PENDENTE não são conclusão. Nenhuma operação real/paga, migração, push, merge ou publicação autorizada.

## Fila em execução

- P0: compatibilidade `/auth/me` vs Bearer/cookie, falhas de autoridade e respostas de sucesso, isolamento e chaves.
- P1: Auth emulator, navegação local fictícia/logout, gestão de clientes/concorrência, eventos financeiros simulados persistidos.
- P2: contratos entre módulos, revisão de dependências/custos, backup e auditoria; patches isolados de UI reservada.

## Fases (atualização progressiva)

| Fase | Tema | Estado | Evidência / próximo passo |
| --- | --- | --- | --- |
| 1 | RECONHECIMENTO DO PROJETO | VALIDADA | Diretório, branch, worktree único e HEAD conferidos; nenhuma referência alterada. |
| 2 | PROTOCOLO MESTRE UNIVERSAL | VALIDADA | Diagnóstico, correção e validação aplicados; protocolo do pedido observado. |
| 3 | DIVISÃO ENTRE AGENTES | PARCIAL | Responsabilidades preservadas; mudanças transversais de segurança exigem conciliação por trecho. |
| 4 | DEFINIÇÃO RIGOROSA DE CONCLUSÃO | VALIDADA | Estados distinguem código, teste, navegador, integração, bloqueio e produção. |
| 5 | INSPEÇÃO INICIAL COMPLETA | VALIDADA | Status, fontes, docs, serviços e variáveis por presença inspecionados sem valores secretos. |
| 6 | RELATÓRIO DE INTEGRAÇÃO EXISTENTE | VALIDADA | Relatório anterior lido e conferido; novas correções não substituem os 208 testes. |
| 7 | DOCUMENTO PERSISTENTE DE CONTINUIDADE | IMPLEMENTADA | Este documento contém as 87 fases, resultados, bloqueios e retomada. |
| 8 | REVALIDAÇÃO DOS 208 TESTES | TESTADA | 208 anteriores passaram novamente; suíte atual 263, com inventário por arquivo. |
| 9 | AUDITORIA COMPLETA DA ARQUITETURA | PARCIAL | Arquitetura mantida; acoplamentos de server/engine e transportes frontend ainda exigem conciliação. |
| 10 | PADRONIZAÇÃO DAS APIS | PARCIAL | Me alinhado ao requireAuth; clientes paginados, revisões e projetos ETag; APIs legadas ainda heterogêneas. |
| 11 | ERROS E RESILIÊNCIA | TESTADA | Erros, persistência, concorrência, ausência de autoridade e serviço indisponível testados. |
| 12 | CONTRATOS DE DADOS | PARCIAL | Fluxo HTTP audit/projeto/cliente/documento testado; branding/GBP/IA de outros agentes não integrados. |
| 13 | AUTENTICAÇÃO | TESTADA | Matriz local/Bearer/cookie/expiração/logout; novas correções de header e e-mail. |
| 14 | FIREBASE AUTH | PARCIAL | Auth Emulator real 7 testes anteriores nesta execução; assinatura de certificados de produção não homologada. |
| 15 | LOGOUT E OAUTH | PARCIAL | Backend revoga cookie; helper coordenado testado e patch preparado. SDK/logout frontend ainda não incorporado. |
| 16 | ERRO HTTP 401 | TESTADA | Me aceita Bearer ou cookie com mesma autoridade; header inválido não recorre a cookie. |
| 17 | AUTORIZAÇÃO E PERMISSÕES | PARCIAL | Owner/admin e último admin protegidos; perfil operador e regras comerciais dependem definição. |
| 18 | ISOLAMENTO ENTRE CLIENTES | PARCIAL | Backend e CRM local por UID testados; conciliação de todos os módulos ainda necessária. |
| 19 | SEGURANÇA DE ENTRADAS | TESTADA | Entradas de projetos, métricas e seis sinks XSS corrigidos; 14 casos Chromium, amostragem limitada. |
| 20 | SSRF | TESTADA | 67 testes SSRF preservados, incluindo transportes/proxies controlados. |
| 21 | CORS, CSRF E COOKIES | TESTADA | Origem/CORS/cookies testados; HTTPS local no Chromium; configuração de produção não alterada. |
| 22 | RATE LIMITING | PARCIAL | Limite login e política de saídas; cotas por conta/instância e borda ainda pendentes. |
| 23 | GESTÃO DE SEGREDOS | PARCIAL | Status sem segredo, default deny externo; chaves antigas/Firestore/browser não migrados. |
| 24 | LOGS E AUDITORIA | PARCIAL | Histórico real do Escritório e logs SDK sanitizados; auditoria durável completa/retencão pendentes. |
| 25 | MODELO DE DADOS | PARCIAL | Modelos existentes preservados; organizações/empresas/branding ainda não unificados. |
| 26 | FIRESTORE | BLOQUEADA | Regras locais inspecionadas; testes reais Firestore dependem JAR oficial permitido pela rede. |
| 27 | EMULADOR FIREBASE | PARCIAL | Auth Emulator executado 7/7. Firestore preparado, sem execução. Ferramenta temporária sumiu após retomada. |
| 28 | PERSISTÊNCIA DE RASCUNHOS | PARCIAL | Contratos preservam versões; fluxo de aprovação GBP/IA depende contrato com AI Studio. |
| 29 | CONCORRÊNCIA E INTEGRIDADE | TESTADA | CAS JSON, revisão cliente, If-Match projeto e ledger entre processos testados; consumidores legados precisam adotar revisão. |
| 30 | BACKUP | TESTADA | Backup fictício verificado; não existe comprovação de backup externo real. |
| 31 | RECUPERAÇÃO | TESTADA | Restauração em arquivo novo fictício e corrupção/interrupção testadas; nenhuma restauração real. |
| 32 | MIGRAÇÕES | PARCIAL | Sem migração real; local opcional G360_DATA_DIR não move nem inicializa dados. |
| 33 | AUDITORIA ADMINISTRATIVA COMPLETA | TESTADA | Backend Escritório existente ampliado, sem segundo módulo ou seed. |
| 34 | DASHBOARD ADMINISTRATIVO | PARCIAL | Dados vazios e metadados reais no backend; painel ainda não consome /api/office. |
| 35 | GESTÃO DE CLIENTES | TESTADA | Cadastro, detalhe, busca, paginação, atualização com revisão e arquivo lógico. |
| 36 | GESTÃO DE EMPRESAS | PARCIAL | BusinessName e vínculos explícitos; entidade empresa completa depende contrato dos módulos. |
| 37 | GESTÃO DE PROJETOS | TESTADA | CRUD validado, propriedade, detalhe e ETag; remoção de projeto vinculado bloqueada. |
| 38 | ATIVIDADES E HISTÓRICO | PARCIAL | Histórico do Escritório preservado; auditorias não apagam gerações/clientes; trilha geral pendente. |
| 39 | SISTEMA DE MINUTAS | TESTADA | Minuta por cliente/projeto, texto versionado e download; interface existente continua minuta. |
| 40 | VERSIONAMENTO DE CONTRATOS | TESTADA | Hash, autor, versões preservadas, aprovação da versão atual e conflito testados. |
| 41 | ESTADOS DE ASSINATURA | TESTADA | Aprovação interna e aguardando provedor separados; simulado não é assinatura legítima. |
| 42 | PREPARAÇÃO DE ASSINATURA ELETRÔNICA | BLOQUEADA | Revisão jurídica, método, provedor e homologação necessários; nenhum documento enviado. |
| 43 | CORREÇÃO DE COMPONENTES LEGADOS | PARCIAL | Componentes antigos continuam inativos; não reativar sem retirar alegações e operações falsas. |
| 44 | ARQUITETURA COMERCIAL | PARCIAL | Catálogo preparatório, sem preço inventado ou benefício pago ativado; decisão comercial pendente. |
| 45 | CONTROLE DE ACESSO POR PLANO | PARCIAL | Plano não é autoridade do perfil Firestore; entitlement/limites comerciais ainda não homologados. |
| 46 | MOTOR DE PAGAMENTOS | TESTADA | Simulador mais ledger persistente, BRL/idempotência/histórico e recuperação fictícios. |
| 47 | INTEGRAÇÃO FUTURA COM GATEWAY | BLOQUEADA | Nenhum gateway escolhido/ativado; adapter real depende provedor e sandbox confirmado. |
| 48 | WEBHOOKS | TESTADA | HMAC e replay persistido em simulador; protocolo real de fornecedor não homologado. |
| 49 | RELATÓRIOS FINANCEIROS | PARCIAL | Registros simulados identificados; custo desconhecido não é zero; sem faturamento real. |
| 50 | GOOGLE BUSINESS PROFILE | PARCIAL | Contrato de autoridade revisado; nenhuma ação real no GBP; depende OpenCode/AI Studio. |
| 51 | GOOGLE MAPS E OUTSCRAPER | PARCIAL | Transporte de provedores com default deny e limites; fallback/proveniência depende OpenCode. |
| 52 | SERVIÇOS DE IA | PARCIAL | Guard antes de SDK/HTTP e retries limitados; prompts/pipeline mantidos; outros transportes frontend pendentes. |
| 53 | DEPLOY FUTURO | PARCIAL | Start/build/local de dados opcional testados; infraestrutura/HTTPS/secrets/backup real pendentes. |
| 54 | REAVALIAÇÃO DO GRPC | PARCIAL | Impacto gRPC avaliado e candidato testado isolado; override não aplicado sem compatibilidade completa. |
| 55 | AUDITORIA DE DEPENDÊNCIAS | PARCIAL | Auditoria/cadeias/licenças/deprecações revisadas; avisos continuam no lock efetivo. |
| 56 | SEGURANÇA DO AMBIENTE | TESTADA | Presença de variáveis sem valores; emulador proibido em produção; dados reais não alterados. |
| 57 | MATRIZ DE AUTENTICAÇÃO | TESTADA | Matrizes local, mock SDK e Auth Emulator local executadas; OAuth real não testado. |
| 58 | MATRIZ MULTICLIENTE | TESTADA | Propriedade, detalhes, atualização e download com outra conta testados. |
| 59 | MATRIZ DE PERSISTÊNCIA | TESTADA | JSON/backup/ledger/concorrência/recuperação em /tmp; nenhum banco real. |
| 60 | MATRIZ DE CONTRATOS | TESTADA | Minutas, revisões, download, estados, integridade e isolamento. |
| 61 | MATRIZ DE PAGAMENTOS | TESTADA | Somente simulações persistidas: transições, repetição, disco e concorrência. |
| 62 | MATRIZ DE SEGURANÇA | TESTADA | SSRF, autorização, HTML, tamanho/tempo e XSS; não é prova universal nem inclui uploads inexistentes. |
| 63 | FRONTEND E BACKEND | PARCIAL | Chromium real para login/reload/projeto/minuta/logout; Office apenas HTTP, UI não integrada. |
| 64 | FLUXO MULTIMÓDULO | PARCIAL | Handoff HTTP audit → projeto → cliente → contrato testado; restante dos agentes não conciliado. |
| 65 | TESTES DE RECARREGAMENTO | TESTADA | Reload/sessão e isolamento de armazenamento CRM por UID; logout OAuth completo pendente. |
| 66 | TESTES DE AMBIENTE | TESTADA | 263 testes, tipos/build/diff; ensaios browser/Auth separados e evidências em documentos. |
| 67 | INVENTÁRIO DAS BRANCHES | PARCIAL | Só worktree Codex e referências locais existentes; branches dos demais agentes indisponíveis. |
| 68 | MAPA DE ARQUIVOS COMPARTILHADOS | IMPLEMENTADA | Mapa de compartilhados no relatório de integração; não substituir arquivos inteiros. |
| 69 | CONTRATOS ENTRE OS AGENTES | PARCIAL | Contrato auth, Escritório, policy e simulações preparados; tipos dos outros agentes precisam confronto. |
| 70 | TESTES DE CONTRATO | TESTADA | Matriz HTTP multimódulo e contratos negativos; fixtures claramente fictícias. |
| 71 | CONCILIAÇÃO NÃO DESTRUTIVA | PARCIAL | Patches isolados e candidatos temporários; nenhuma conciliação entre branches executada. |
| 72 | CHECKLIST DE PRONTIDÃO | IMPLEMENTADA | Checklist abaixo; aprovação integrada e produção seguem bloqueadas. |
| 73 | VARREDURA APÓS CADA MÓDULO | VALIDADA | Varreduras detectaram/repararam XSS, retenção de auditorias, admin e falso feedback. |
| 74 | FILA AUTOMÁTICA DE TRABALHO | VALIDADA | P0/P1 corrigidos quando seguros; bloqueios por outros agentes/serviços registrados. |
| 75 | SEGUNDA VARREDURA GERAL | PARCIAL | Segunda varredura concluída no material acessível; UI de outros branches/Firestore real não inspecionados. |
| 76 | ERROS DE AMBIENTE | VALIDADA | Erros de cache/CLI, tipagem e contexto retomado registrados; sem legacy-peer-deps ou upgrades amplos. |
| 77 | BLOQUEIO EXTERNO | VALIDADA | Bloqueios externos não produziram conta, cobrança ou acesso a produção. |
| 78 | CONFLITOS ENTRE AGENTES | PARCIAL | Patches para conciliação preservados; aprovação real dos outros agentes pendente. |
| 79 | LIMITE DE CONTEXTO OU SESSÃO | IMPLEMENTADA | Retomada e resultados persistentes; temporários desaparecem entre ambientes. |
| 80 | SEGURANÇA DAS OPERAÇÕES AUTÔNOMAS | VALIDADA | Sem merge/push/deploy, gastos, rotação, exclusão ou migração real. |
| 81 | BACKEND VALIDADO | PARCIAL | Backend validado nos cenários locais especificados; integração completa e cotas ainda pendentes. |
| 82 | FIREBASE VALIDADO | PARCIAL | Auth Emulator passou; Firestore e OAuth real não homologados. |
| 83 | ESCRITÓRIO VALIDADO | PARCIAL | Backend funcional/testado; frontend Office não integrado. |
| 84 | CONTRATOS VALIDADOS | PARCIAL | Minutas/documentos funcionais; assinatura legítima depende provedor/método aprovado. |
| 85 | PAGAMENTOS VALIDADOS | PARCIAL | Simulações testadas; pagamento real bloqueado. |
| 86 | PRONTIDÃO PARA PRODUÇÃO | BLOQUEADA | Integração entre branches, Firestore, segredos, recuperação e aprovações pendentes. |
| 87 | RELATÓRIO DE RESULTADOS | IMPLEMENTADA | Fechamento e retomada persistidos; não equivale a produção pronta. |

## Retomada

1. Confirmar `git branch --show-current`, `git status --short`, `git worktree list`.
2. Ler este documento e relatórios vinculados; não repetir tarefas já comprovadas.
3. Executar `node scripts/test-isolated.mjs` (usa cópia fictícia, jamais servidor contra DB original).
4. Revisar módulos novos antes de integrar; `npm run lint`, `npm run build`, `git diff --check`.
5. Não executar setup-admin, restore ou app contra contas/dados reais.

## Fechamento da rodada — 28/10/2026

- Suíte padrão final: **263 aprovados, zero falhas e zero ignorados**, aproximadamente 33s. Tipos/build/diff passaram.
- Inventário por foco de arquivo: **56 unitários/modelos/mocks e 207 integrações locais ou arquivos mistos**. Não são 207 serviços reais. Firebase SDK, SQL, DNS/transportes e falhas de IO usam simulações quando declarado. Não há contagem automática de cada mock individual; o inventário por arquivo torna o escopo auditável.
- Auth Emulator oficial: **7/7 passaram anteriormente nesta rodada**, sem mock SDK; a tentativa de reexecução no ambiente retomado falhou porque `/tmp/g360-emulator-tools` desapareceu. Não é regressão da aplicação; reinstalar ferramenta isolada conforme CODEX-G360-EMULADORES.md. Firestore Emulator continua não executado.
- Chromium: aplicação efetiva após correções chegou a **13 checks, zero findings/pageerrors** antes da última retomada; ensaio final ampliado com iframe precisa ser repetido, pois logs temporários desapareceram. Antes das correções duas falhas foram reproduzidas; patches em cópia tiveram14checks verdes.
- Site gerado: **14 cenários Chromium offline passaram**, inclusive GTM controlado incapaz de ler pai. Correções incorporadas: seis sinks, protocolos, fit/efeitos e sandbox público; tracking de editor desativado, exportação preservada.
- Candidato dependências separado:255testes+7Auth+1RPCgRPC local passaram, audit vazio; não aplicado ao manifesto/lock atual por incompatibilidades de intervalos.

Arquivos desta rodada: server.ts; middleware/auth.ts; server/office.ts e testes; externalAccess.ts e testes; paymentLedger.ts e testes; projectPolicy.ts; dataPaths.mjs e testes; costGuard.ts; g360Engine.ts; integrationRegistry.ts; googlePhoto.ts; testes Firebase/startup/segurança/multimódulo; lib/auth/logoutCoordinator.ts e testes; sitegen/generateSiteHtml.js, sections.js e siteSecurity.test.ts; PublicSite.jsx (sandbox), AuthPage.jsx (erro real de recuperação), G360CrmFinancePanel.jsx (armazenamento UID); scripts de emulador/browser/inventário; .gitignore e documentação. Layouts, otimizações e prompts preservados; alterações transversais precisam conciliação por trecho.

`G360_DATA_DIR` é opção retrocompatível; não copia, move ou cria DB. Sem a variável, caminho anterior permanece. Setup administrativo usa a mesma localização, mas não foi executado em base real. A variável nunca foi configurada em produção. Arquivos já rastreados no Git não deixam de sê-lo por .gitignore: sua retirada/migração precisa de plano aprovado.

## Próxima tarefa exata e autorizações

1. Reexecutar navegador com `python3 scripts/browser-local.py --verify-patches`; recuperar ferramenta temporária e repetir Auth Emulator se necessário.
2. Conciliar auth-context-logout.patch (helper testado, frontend ainda não conectado); revisar consentimento OAuth mínimo, estado por usuário e mensagens do Editor com Antigravity/AI Studio.
3. Liberar/prover artefato oficial Firestore em ambiente autorizado e executar `all`; nunca usar projeto real.
4. Integrar `/api/office` às telas e definir regras de planos/limites; validar todos os fluxos em navegador e reconciliar branches sem descartar trabalho.
5. Autorizações separadas: backup externo e recuperação administrativa real, titularidade de dados legados, migrações/rotação, fornecedor, contrato jurídico, cobranças e publicação. Nada disso foi executado.

**Não declarar o G360 pronto para comercialização/produção.**
