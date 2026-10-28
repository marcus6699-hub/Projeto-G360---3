# Escritório G360 — backend local e contrato de integração

Atualização: 28/10/2026. Branch `codex/auditoria-g360`. Nenhum dado real, envio externo, conta, cobrança ou credencial foi alterado nesta implementação.

## Integração

`registerOfficeRoutes(app, { db, saveDb })`, de `src/server/office.ts`, deve ser registrado depois da autenticação verificada e de `persistenceContext`, antes de `persistenceErrorHandler`. `db` é o documento por requisição já existente; `saveDb` é seu commit atômico atual. Não criar outro leitor ou gravador JSON.

Os dados são uma propriedade opcional `office` do documento existente. Leitura sem essa propriedade retorna listas vazias e **não grava**. A primeira ação administrativa explícita cria registros locais; não migra, atribui ou descobre proprietários de dados antigos. Documento office inválido causa 503 sem substituição automática.

Identidade vem exclusivamente de `req.user.uid/role`, estabelecida pelo middleware de autenticação. Nenhuma identidade enviada no corpo substitui a sessão. Administrador vê todos; usuário vê somente clientes cujo `ownerUid` corresponde à sua identidade. Criar cliente exige administrador e uma conta existente. A confirmação da relação comercial/propriedade continua sendo responsabilidade do administrador antes dessa ação; não existe atribuição automática.

## API para Antigravity

Todas as rotas começam por `/api/office`, retornam JSON e exigem autenticação.

| Método e rota | Permissão | Comportamento |
| --- | --- | --- |
| GET `/` | Proprietário/admin | Clientes, contratos, histórico, metadados de sites, avisos internos, catálogo de planos e financeiro simulado filtrados |
| GET `/clients?q=&plan=&archived=false&page=1&limit=25` | Proprietário/admin | Lista paginada com total somente dos registros autorizados; `archived` aceita false/true/all, limite máximo 100 |
| GET `/clients/:id` | Proprietário/admin | `{client}` com revisão calculada e estado de arquivamento; estrangeiro retorna 404 |
| PATCH `/clients/:id` | Admin | `expectedRevision` obrigatório; somente `name,businessName,email,archived`; 428 se ausente, 409 se desatualizado |
| POST `/clients` | Admin | `ownerUid,name,businessName,email,plan?,expiresOn?`; cria cliente local |
| PATCH `/clients/:id/subscription` | Admin | `plan,expiresOn,canceled,expectedRevision?`; registro manual sem ativação de pagamento |
| POST `/clients/:id/sites` | Admin | `projectId`; associação explícita com conferência de proprietário e exclusividade por cliente |
| POST `/contracts` | Proprietário/admin | `clientId,title,text,expiresOn?,projectId?,serviceType?`; rascunho com snapshot do cliente e vínculo explícito opcional ao projeto |
| POST `/contracts/:id/versions` | Proprietário/admin | `text,expectedVersion?`; acrescenta versão, preserva anteriores; apenas rascunho/revisão; 409 para versão esperada desatualizada |
| GET `/contracts/:id/document?version=n` | Proprietário/admin | Anexo de texto UTF-8 da versão explícita, com hashes e bloqueio de interpretação como HTML |
| POST `/contracts/:id/review` | Proprietário/admin | Solicita revisão do rascunho |
| POST `/contracts/:id/approve` | Admin | `sha256` da versão atual obrigatório |
| POST `/contracts/:id/signature-request` | Admin | `sha256`; fila interna sem envio, `delivered:false`, `blockedBy:signature_provider_not_configured` |
| POST `/contracts/:id/cancel` | Admin | Cancela localmente preservando versões e eventos; não representa rescisão jurídica |

Conteúdo contratual é texto. A interface deve exibi-lo como texto escapado, nunca como HTML não confiável. A rota document exige versão explícita e retorna seus bytes textuais como anexo `text/plain; charset=utf-8`, com `nosniff`, CSP sandbox e cache desabilitado. `X-Content-SHA256` corresponde aos bytes exatos baixados; `X-G360-Version-SHA256` corresponde ao hash do texto mais snapshot do cliente. Não há editor, PDF, modelo jurídico aprovado, link público ou envio externo implementado. `sha256` comprova integridade do texto e snapshot serializados, **não identifica um signatário, não comprova tempo independente e não substitui assinatura**. Versão aprovada não pode ser reescrita. Evidência produzida somente em teste tem `kind:simulation`, `legalSignature:false` e status `simulated_signed`.

Vencimentos são datas civis ISO `AAAA-MM-DD`, comparadas pelo dia UTC neste backend: `active`, `expiring` (hoje até sete dias), `expired`, `canceled`, `no_expiration`. A interface deve traduzir explicitamente; `no_expiration` não significa contrato vigente. Para uma política comercial em horário de Brasília diferente do dia UTC, alinhar regra antes de ativação. Avisos são registros retornados ao navegador, `delivered:false`; não há mensagens automáticas. Vencimento contratual é independente da assinatura.

Sites retornados são somente os projetos explicitamente associados pelo administrador em `siteIds` do cliente. Cada associação exige que o `ownerUid` existente do projeto coincida com o do cliente; projetos legados sem proprietário não são atribuídos. Outro cliente, mesmo da mesma conta, não pode receber projeto já associado (409); repetir a mesma associação é idempotente. A leitura verifica novamente a propriedade atual e não mostra associação que deixou de ser compatível. Retornam-se somente id, clientId, ownerUid, name, slug; não são copiados dados internos do site, chaves ou conteúdo. `publicationStatus:not_verified` evita afirmar publicação sem verificação. Nenhum vínculo é inferido ou migrado automaticamente.

Planos `unassigned`, `starter`, `business` são catálogo local informativo, sem preços, contratação, limites ou liberação automática de recursos. Não apresentar esse catálogo como cobrança ativa. As permissões dos módulos existentes não foram substituídas.

## Simulações restritas

O servidor normal não deve habilitar `allowSimulation`. As três rotas abaixo exigem simultaneamente `NODE_ENV=test`, `allowSimulation:true` e administrador:

- POST `/contracts/:id/simulate-signature`: apenas após fila interna; grava evidência explicitamente fictícia.
- POST `/financial/simulate`: `clientId,amountCents,dueOn,reference`. Inteiros positivos, referência idempotente e conflito 409 quando reutilizada com outros dados.
- POST `/financial/:id/simulate-status`: `status` em fluxo pending → confirmed/canceled; confirmed → refunded. Atraso é calculado na leitura; nenhuma cobrança acontece.

`src/server/paymentSimulation.ts` é outro harness de testes, **sem endpoint HTTP e sem ligação a gateway real**. Verifica HMAC-SHA256 sobre timestamp e bytes exatos, janela de cinco minutos, tamanho máximo de 16 KiB, evento único, valor esperado e transições pending/overdue/confirmed/canceled/refunded. Exige `NODE_ENV=test` e `enabled:true`, inclusive a cada operação. Seu estado é somente em memória: não deve ser usado em produção como registro de cobrança ou deduplicação durável. Webhook real dependerá de protocolo/documentação do provedor e transação persistente da mudança de estado mais evento.

## Validação e limites

`office.test.ts`: vinte testes com arquivos temporários e dados fictícios; acesso anônimo, isolamento entre contas, administração, associação explícita e exclusiva de sites, bloqueio de projeto legado/estrangeiro, metadados sem conteúdo, download de versão e proteção dos cabeçalhos/bytes, leitura sem seed, datas, integridade/versionamento, aprovação hash, fila sem envio, cancelamento, bloqueio de simulação em produção, idempotência, transições financeiras, falha de persistência e office inválido. `paymentSimulation.test.ts`: quatro testes de ambiente, HMAC, replay, tamanho/tempo/valor e transições.

Não existe assinatura jurídica real, provedor de pagamento, saldo, sandbox remoto, envio WhatsApp/e-mail, cobrança, política comercial aprovada, trilha imutável externa ou documento assinado armazenado. Histórico é local no JSON, protegido pelo armazenamento atômico existente, sem garantia contra administrador do sistema de arquivos. Provedor, contrato jurídico, consentimento, retenção/LGPD, backup externo e recuperação de acesso permanecem necessários para comercialização.

Erros 401/403/404/409/503 devem ser exibidos pela interface; 409 exige recarregar os dados antes de tentar novamente. Em falha de persistência não presumir sucesso. Não alterar arquivos de interface, de OpenCode ou de AI Studio para consumir essas rotas sem coordenação.

## Cadastro, revisões e arquivamento — ampliação de 28/10/2026

A listagem nova preserva o GET agregado antigo: `/api/office` continua retornando todos os clientes autorizados, inclusive arquivados, e acrescenta `revision` e `archived` em cada cliente sem gravar a leitura. A rota `/clients` inicia em página 1, limite 25, somente não arquivados; busca nome/empresa/e-mail sem revelar totais de outra conta. Limite máximo 100, filtros repetidos/arrays e paginação inválida retornam 400. O total é o número real de registros locais autorizados, não um indicador comercial estimado.

`revision` é SHA-256 calculada sobre o cliente persistido, não segredo ou autorização. `PATCH /clients/:id` exige revisão exata antes da alteração; campos desconhecidos, proprietário, IDs, plano e vínculos não podem ser alterados por esse endpoint. Alterações de plano continuam na rota administrativa própria, agora com condição opcional `expectedRevision`. Para consumidores novos, enviar a condição em toda mudança de plano; a ausência continua aceita somente para preservar o contrato anterior. A escrita atômica existente continua protegendo requisições concorrentes; a revisão cobre também intenções antigas enviadas em requisições posteriores.

Arquivar é uma alteração lógica administrativa, não exclusão. Dados, contratos, versões, histórico e downloads autorizados são preservados; novos rascunhos para cliente arquivado são recusados até restaurar o cadastro com uma revisão atual. A alteração de dados comerciais do cliente não reescreve o snapshot de contratos já criados. O código não transfere proprietário ou apropria dados antigos.

Na criação de contrato, `projectId` é opcional e só é aceito se o projeto já estiver explicitamente vinculado ao cliente e tiver seu proprietário atual compatível. `serviceType` é texto informado, não catálogo ou preço inventado. O contrato pode continuar sem projeto quando essa associação não existir. Em append de versões, `expectedVersion` opcional recusa intenção antiga; versões anteriores permanecem intactas, inclusive para consumidores antigos que ainda não enviem a condição. O hash de aprovação e o bloqueio de alteração após aprovação continuam obrigatórios.

A leitura também recusa IDs duplicados e vínculos órfãos na seção Escritório, sem substituir conteúdo inválido por demonstrações. Não há migração estrutural: novos campos são opcionais e só persistem por ação explícita.

Validação desta ampliação: `NODE_ENV=test node --import tsx --test src/server/office.test.ts` — **20 aprovados, zero falhas e zero ignorados**; nove cenários novos verificam paginação/isolamento, leitura sem escrita, revisão/concorrência otimista com duas requisições HTTP simultâneas, arquivamento preservando documentos, mudança de plano condicionada, projeto legítimo/estrangeiro, versões desatualizadas e corrupção de vínculos. Os arquivos são temporários com identidades de teste injetadas; isso não homologa por si só o frontend ou o Firebase. A validação consolidada do servidor deve ocorrer separadamente.
