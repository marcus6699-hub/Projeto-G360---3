# G360 Business — fechamento e preparação para integração

27/10/2026. Checkout: `codex/auditoria-g360`. Este relatório prepara revisão e incorporação futura; não executa integração, merge, push ou publicação.

## Resultado

**208 testes aprovados, zero falhas e zero ignorados**: os 203 anteriores foram preservados e cinco foram adicionados para sessões Firebase. `node scripts/test-isolated.mjs` executou somente fontes copiadas para `/tmp` com base fictícia e SDK simulado. `npm run lint` (análise TypeScript), `npm run build` e `git diff --check` passaram. O build mantém os avisos conhecidos de tamanho/importação do Firebase/configuração Vite; não são comprovação de falha dos testes.

Logs desta execução: `/tmp/g360-integration-final-tests.log`, `/tmp/g360-integration-lint.log`, `/tmp/g360-integration-build.log`; cópia fictícia `/tmp/g360-validation-T7vNLW`. Arquivos temporários podem desaparecer ao trocar o ambiente; o comando permite reproduzir a validação.

## Correção independente concluída

Foi encontrada uma lacuna entre validar o token Firebase e usar o cookie criado a partir dele. Antes, esse cookie passava a se comportar como sessão local por até oito horas: desativação/revogação Firebase ou retirada de claim administrativa não era necessariamente respeitada.

- `src/middleware/auth.ts` agora mantém a origem e o horário original de autenticação da sessão. Para Firebase, consulta usuário atual, verifica desativação, e-mail verificado, `tokensValidAfterTime` e claims administrativas atuais. Não transforma papel local histórico ou claim antiga em autoridade Firebase.
- Renovação conserva essa origem e o horário original; não contorna revogação. O cookie continua opaco, HttpOnly e sem token Firebase/credenciais retornados ao navegador. Nenhuma senha, papel persistido, claim ou conta real foi alterada.
- Indisponibilidade da verificação nega a operação; não existe fallback para autenticação local. O endpoint de sessão retorna erro sanitizado e pode recuperar quando o serviço volta.
- Entradas expiradas são removidas ao criar sessões e há capacidade máxima de 10.000. Continua sendo armazenamento em memória, não apropriado a múltiplas instâncias sem trabalho adicional.
- `server.ts` aguarda a resolução assíncrona da sessão e usa renovação que conserva a autoridade. Qualquer consumidor adicional de `localSessionUser` precisa de `await`.
- `src/server/firebaseSession.test.ts` testa claims retiradas, token/local role antigos, revogação após refresh, conta desativada/não verificada/excluída e indisponibilidade do SDK. Todas as respostas e contas são simuladas.

Limitação operacional: cookies Firebase agora dependem da disponibilidade e configuração do SDK Admin para verificar `getUser`. Bearer/rotas administrativas podem repetir verificações. Não usar cache de claims que reintroduza privilégio revogado para reduzir chamadas; homologar latência, cotas e indisponibilidade antes de publicar. Nenhuma chamada Firebase real foi feita nesta validação.

## Interface de contratos — conclusão precisa

A inspeção do fluxo ativo `/` → Studio → CRM → contrato encontrou **minuta/assinatura externa pendente**, não uma assinatura concluída a partir de aprovação interna. O novo backend mantém `approved` separado de `awaiting_provider`, com `delivered:false`; sua simulação é explicitamente fictícia e desabilitada no aplicativo normal.

Correção de precisão em relação ao relatório anterior: os dois componentes `DigitalContract.tsx` com alegações indevidas existem, porém **não estão montados no fluxo atual identificado**. São risco latente de reutilização, não prova de que a interface ativa mostre uma assinatura falsa. Não foram alterados. A interface ativa ainda não consome `/api/office`; a confirmação é por inspeção de código, não por ensaio visual completo ou verificação de versão publicada.

Antigravity deve testar os estados integrados, preservar a distinção de minuta/aprovação/assinatura, impedir reativação dos componentes legados sem correção e validar links de fornecedor. Evidências e alternativas estão em `CONTRATOS-ASSINATURA-INTEGRACAO.md`.

## Pendências por responsável

| Tema | Funcional no checkout | Depende de outros agentes / validação | Exige autorização específica |
| --- | --- | --- | --- |
| Login | Local e recuperação fictícia testados; autoridade de sessão Firebase corrigida com SDK simulado | Logout coordenado cookie+SDK; homologação Firebase e emulador | Recuperar conta real ou mudar credenciais/claims |
| Firestore | Regras locais de proprietário inspecionadas; backend não deve confiar em plano do perfil | Antigravity/AI Studio: parar leitura de segredos no navegador, autoridade de plano no servidor; testar regras reais no emulador | Alterar/publicar regras remotas ou migrar documentos reais |
| OAuth | Inventário de escopos e sessões concluído | AI Studio/Antigravity: consentimento incremental, escopos mínimos, logout unificado e logs sem dados desnecessários | Alterar consentimentos/credenciais reais; habilitar envios |
| Chaves/custos | Status sem segredo e sem saldo inventado; tokens de deploy não retornados | Política uniforme anterior a cada chamada, cotas por conta e configuração segura; `strictFreeMode` não prova gratuidade | Migrar/rotacionar chaves reais, usar saldo pago ou contratar |
| Contratos | Versões, hashes, revisão, download e fila interna local | Antigravity: integrar API; revisão jurídica; provedor e evidências reais | Envio/assinatura de documento real, contratação ou serviço pago |
| Pagamentos | Simulador HMAC/idempotência/estados, sem cobrança | Decisão comercial, adapter específico, sandbox oficial gratuito confirmado e conciliação persistente | Ativar conta comercial, cobrança, dados financeiros reais ou gastos |
| Persistência | Escrita segura, conflito e recuperação fictícia | Ensaio de backup independente, recuperação operacional e estratégia de instância única | Migração/restauração real ou mudanças irreversíveis |
| Dependências | Alcance dos avisos avaliado; nenhuma exploração identificada no código do servidor | Atualização compatível Firebase/loader com emulador e instalação limpa | Nenhum gasto necessário para teste local; homologação externa precisa acesso autorizado |

Sobre custos: simulações locais não usam APIs pagas. Gov.br manual é candidato gratuito ao cidadão elegível, não uma API SaaS gratuita comprovada. Plataformas de assinatura podem oferecer sandbox/franquia; API, autenticação adicional e documentos podem ser cobrados. Gateways podem ter sandbox gratuito, mas operação Pix/cartão/recorrência envolve condições e tarifas. Nenhum preço atual é afirmado sem consulta e contrato verificados. Não houve ativação de serviços. Comparação e fontes: `CONTRATOS-PAGAMENTOS-DECISOES.md` e `CONTRATOS-ASSINATURA-INTEGRACAO.md`.

## Dependências: impacto real

`bun audit` continua mostrando avisos alto/baixo de gRPC e moderado de esbuild. A cópia gRPC `1.9.16` vem do SDK cliente Firestore; a cadeia Admin usa `1.14.6` corrigida. O aviso alto exige configuração de servidor gRPC e `getAuthContext` não encontrados no aplicativo. Não há caminho de exploração identificado nesta análise; isso não elimina a necessidade de atualizar ou prova risco zero.

Preferir SDK que resolva versão corrigida em intervalo suportado. Override ultrapassa o intervalo `~1.9.0` do fornecedor e não é homologado por apenas 208 testes locais. Para esbuild antigo, revisar o loader transitivo do Drizzle e impedir exposição de servidores dev. Detalhes, faixas completas e fonte oficial consultada: `REVISAO-DEPENDENCIAS-INTEGRACAO.md`.

## Arquivos candidatos a incorporação direta

São arquivos novos do backend/documentação, sem colisão textual conhecida neste checkout. **Se o destino já contiver arquivo homônimo ou mudanças de outro agente, comparar antes; não substituir automaticamente.** Copiar arquivo não equivale a ter concluído sua integração.

| Grupo | Arquivos |
| --- | --- |
| URL/persistência | `src/server/publicUrl.ts`, `publicUrl.test.ts`, `jsonPersistence.mjs`, `jsonPersistence.test.ts` |
| Políticas e sessão | `src/server/authPolicy.ts`, `authPolicy.test.ts`, `firebaseSession.test.ts`, `security.test.ts`, `saasSecurity.test.ts`, `adminRecovery.test.ts`, `startup.test.ts` |
| Escritório/integrações | `src/server/office.ts`, `office.test.ts`, `paymentSimulation.ts`, `paymentSimulation.test.ts`, `integrationRegistry.ts`, `googlePhoto.ts`, `integrations.test.ts` |
| SQL | `src/db/users.test.ts` (o módulo de produção exige conciliação abaixo) |
| Ferramentas offline | `scripts/backup-json.mjs`, `backup-json.test.mjs`, `setup-admin.mjs`, `test-isolated.mjs`; adicionar não autoriza executar setup/backup contra dados reais |
| Diagnóstico e testes de contrato | Documentação `docs/*.md`, relatórios sanitizados da auditoria e `docs/planejamento-urls/`; revisar conteúdo e manter histórico das evidências |

## Conciliação manual obrigatória

Não há diff das versões atuais de OpenCode, Antigravity e AI Studio neste checkout. A tabela identifica os pontos possíveis de conflito por responsabilidade e alteração local; não afirma que já houve conflito de merge nem autoriza buscar/modificar outras branches.

| Arquivo/área | Possível colisão | O que conservar ao conciliar |
| --- | --- | --- |
| `server.ts` | Rotas de coleta/IA, bootstrap e APIs de outros agentes | Ordem: proteção de arquivos privados, parser/cookies, contexto de persistência, origem/auth, rotas, 404 de API, handlers de erro e SPA. Rotas novas devem vir antes do 404. Aguardar sessão assíncrona. Preservar isolamento e erros 409/503. |
| `src/server/g360Engine.ts` | OpenCode coleta/Geogrid; AI Studio prompts; CRM/deploy | Alterar por trecho/função, nunca substituir o arquivo inteiro. Manter `publicUrlClient` nos três fluxos, ausência de fallback após bloqueio, proprietários, persistência por request e remoção de tokens das respostas. Preservar otimizações e prompts dos outros agentes. |
| `package.json` | OpenCode JSZip e dependências compartilhadas; runtime | Conservar `jszip@3.10.1`, `tsx` em dependências de produção e `start: node --import tsx server.ts`; conciliar versões e scripts adicionais antes de instalar. Não introduzir overrides experimentais sem homologação. |
| `bun.lock` | Qualquer adição/versão de todos os agentes | Gerar um único lock a partir do manifesto conciliado com a versão da ferramenta acordada; verificar diff e instalar frozen. Não escolher um lado inteiro nem editar entradas transitivas manualmente. |
| `src/middleware/auth.ts` | Consumidores de autenticação e contexto de usuário | Claims atuais, revogação, status local, origem da sessão, refresh sem conversão e limite de memória. Identidade não vem do body, UID de cookie ou e-mail de perfil. |
| `src/server/costGuard.ts` | Otimizações OpenCode de cache/cotas/coleta | Armazenamento seguro e falhas explícitas; preservação de totais/configurações. Uniformizar reserva/cotas sem alegar gratuidade não comprovada. |
| `src/db/users.ts` | Mudanças SQL | `ON CONFLICT` deve filtrar proprietário na instrução SQL e não confirmar escrita sem linha retornada. Não alterar schema/dados reais. |
| `src/lib/firebase-admin.ts` | Configuração Firebase/AI Studio | Projeto explícito validado, importação JSON compatível, ausência de segredo embutido. Não copiar credenciais entre ambientes. |
| `src/lib/sitegen/generateSiteHtml.js` | OpenCode exportação/templates | Escape JSON em contexto de script e validação de tracking; conservar layout/exportação e testar payloads XSS. |
| `src/pages/AuthPage.jsx` | Antigravity interface/login | Preservar troca real de token, ausência de senha padrão e autenticação sem atalhos. Coordenar logout e mensagens de indisponibilidade. Nenhuma nova edição visual nesta etapa. |
| `.gitignore` | Regras de todos os agentes | Não versionar DB, métricas, segredos, backups, locks e arquivos temporários privados. |

## Arquivos que não devem ser sobrescritos

`Studio.jsx`, `Editor.jsx`, `SearchHome.jsx`, os dois `DigitalContract.tsx`, `G360CrmFinancePanel.jsx`, `ApiKeysSettings.jsx`, `src/firebase.ts` e demais módulos visuais/prompts dos outros agentes não foram alterados neste fechamento. `firestore.rules` também não foi alterado/publicado. As pendências dessas áreas são instruções de conciliação, não correções já aplicadas.

Não incorporar `db.json`, métricas, `.env`, contas, credenciais, documentos/backup reais ou dados de teste gerados em `/tmp`. Dados antigos sem proprietário não serão atribuídos automaticamente.

## Sequência de validação integrada (sem executá-la em dados reais)

1. Capturar diffs de cada agente em contexto autorizado e reservar os arquivos compartilhados; preservar versões antes de conciliar.
2. Incorporar módulos novos após comparação, conciliar os trechos compartilhados e resolver manifesto antes do lock.
3. Instalação limpa frozen; executar `node scripts/test-isolated.mjs`, tipos e build; corrigir regressões antes de avançar.
4. Antigravity testar em navegador login/logout, contas distintas, estados de contrato e falhas sem mensagem de sucesso falsa; nada deve enviar documento ou criar cobrança real.
5. Emulador Auth/Firestore e teste do SDK/loader após atualização de dependências; testes de proxy controlado e segredos ausentes. Não usar projetos ou credenciais de produção.
6. Homologar sandbox oficialmente gratuito após escolha e acesso; validar contrato/método, webhooks específicos, evidências e conciliação. Simulador genérico não homologa provedor.
7. Solicitar autorizações separadas para recuperação administrativa, migrações de segredos/dados/regras, contratos/cobranças reais e publicação. Backup independente restaurável é pré-requisito.

## Preservação e decisão

As alterações continuam não commitadas no checkout de `codex/auditoria-g360`. Nenhuma mudança foi feita em referências Git, outras branches, dados reais, credenciais ou contas. Não houve merge, push, deploy, cobrança ou migração.

**Pronto para revisão do código e conciliação controlada. Não declarado pronto para comercialização ou produção.**
