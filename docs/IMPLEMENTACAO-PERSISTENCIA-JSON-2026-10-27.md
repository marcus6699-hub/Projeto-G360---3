# Proteção da persistência JSON — 27/10/2026

Branch verificada: `codex/auditoria-g360`. A estrutura dos JSON principais e os contratos funcionais foram mantidos; não houve conversão de banco nem migração de dados reais. Código aplicado somente no checkout desta branch. Nenhuma conta, senha, credencial ou permissão real foi alterada. Não houve merge, push, deploy ou publicação.

## Inventário e correções

| Rotina | Antes | Agora |
| --- | --- | --- |
| `server.ts`, carregamento de db.json | Erro de leitura podia gerar e salvar demonstrações. | Leitura estrita de arquivo regular, UTF-8 e estrutura esperada. Arquivo ausente, vazio, ilegível ou inválido impede inicialização sem recriar/substituir dados. |
| `server.ts`, saveDb | Sobrescrita direta; erro era registrado e ignorado. | Estado isolado por requisição, gravação atômica com sincronização e checagem de versão; erros são propagados. Estado não salvo não aparece em consultas posteriores. |
| `g360Engine.ts`, ensureG360Db | Consultas podiam inserir demonstrações e corrigir fotos automaticamente. | Consultas preparam apenas valores vazios no rascunho da requisição, sem gravação e sem reescrever registros existentes. Uma operação explícita de gravação persiste seu próprio resultado. |
| `costGuard.ts`, leitura/gravação de métricas | Erro podia reinicializar métricas; mudança de dia podia descartar configurações. | Arquivo existente inválido não é substituído. Arquivo auxiliar ausente pode iniciar métricas vazias em memória. Configurações e contadores totais são preservados entre dias. Escrita falha restaura o último estado confirmado em memória. |
| `auth.ts`, getLocalUser | Leitura direta podia transformar erro de arquivo em falha de autenticação sem diagnóstico. | Leitura estrita pelo mesmo mecanismo; falha de armazenamento é encaminhada como indisponibilidade, sem alterar os critérios de autenticação ou papéis. |
| `scripts/setup-admin.mjs` | Leitura direta e gravação com mecanismo próprio, sem o protocolo comum de concorrência. | Usa o mesmo leitor, versão, bloqueio e gravação segura. A lógica de seleção e redefinição de conta foi preservada. O script não foi executado nesta etapa. |

Também foram examinadas as importações estáticas de configuração Firebase e a geração de `site-manifest.json` para ZIP. São configurações somente de leitura ou artefatos de exportação, não gravações nos bancos JSON; permaneceram intactas. Persistência local do navegador e PostgreSQL não foram modificados.

## Mecanismo compartilhado

Novo módulo: `src/server/jsonPersistence.mjs`, compatível com Node e com o script administrativo sem novas dependências.

1. **Leitura sem recuperação silenciosa:** valida UTF-8, JSON e campos essenciais. Não segue links simbólicos de dados; em Linux usa também abertura com O_NOFOLLOW. Campos extras e registros existentes são preservados. Não tenta inferir a propriedade de dados nem preencher dados comerciais reais.
2. **Gravação completa antes de substituir:** cria arquivo temporário exclusivo no mesmo diretório, completa escritas parciais, sincroniza o arquivo e preserva proprietário/grupo/modo do arquivo principal. Somente depois troca o nome de forma atômica e sincroniza o diretório. Se não puder manter essas condições, a operação falha.
3. **Cópia anterior:** antes da troca principal, guarda e sincroniza uma cópia verificável do conteúdo anterior em `<arquivo>.g360-previous.json`. O envelope contém formato, SHA-256 e bytes em Base64. Base64 não é criptografia. O arquivo tem acesso restrito e foi incluído no gitignore. Uma cópia desconhecida ou danificada nesse caminho não é sobrescrita automaticamente.
4. **Concorrência:** diretório `<arquivo>.g360-lock` impede dois escritores cooperantes de salvar ao mesmo tempo. A versão SHA-256 é comparada dentro do bloqueio e novamente perto da troca. Escritor desatualizado recebe conflito 409, sem sobrescrever a alteração já confirmada.
5. **Isolamento de requisições:** cada requisição trabalha em seu próprio rascunho. Uma operação não pode salvar alterações parciais de outra. Qualquer falha de persistência aborta novas gravações nessa mesma requisição, mesmo se uma rotina antiga capturar o erro. Uma nova requisição pode tentar novamente quando o problema for resolvido.
6. **Respostas corretas:** falhas de persistência resultam em 503; conflitos de versão, em 409. Um guard impede que catches antigos retornem sucesso depois de erro de IO. Em resposta já transmitida, a conexão é interrompida, pois o status enviado não pode ser alterado. Erros não expõem conteúdo dos dados ou credenciais.
7. **Estado incerto:** se a falha ocorrer depois da troca principal ou na liberação do bloqueio, a resposta informa `persistenceUncertain: true`. A gravação pode ter sido concluída. O store bloqueia novas operações até verificação/reinício; não desfaz automaticamente uma gravação que talvez já esteja confirmada.

8. **Proteção HTTP:** middleware anterior aos servidores estáticos/de desenvolvimento bloqueia os caminhos de db.json, métricas, backups, locks e temporários, incluindo /@fs e variações codificadas. Evita servir essas cópias privadas pela web sem alterar a interface ou o arquivo de configuração do Vite.

Limpeza automática só remove temporários e bloqueios criados pela própria operação. Nenhum arquivo de dados, cópia de recuperação ou bloqueio de outro escritor é excluído como tratamento de erro. Após interrupção abrupta, o bloqueio e os temporários podem ficar retidos para inspeção.

## Arquivos alterados nesta etapa

- Novo `src/server/jsonPersistence.mjs`: mecanismo compartilhado, transações por requisição e tratamento de respostas.
- Novo `src/server/jsonPersistence.test.ts`: 35 testes de armazenamento, métricas, concorrência, interrupção e HTTP.
- Novo `docs/planejamento-urls/persistence.contract.mjs`: 6 contratos de integração com as rotas reais, exclusivamente em cópia fictícia.
- `server.ts`: carregamento/gravação, contexto de persistência, bloqueio de arquivos privados via HTTP e captura de erros assíncronos de rotas que usam o armazenamento/métricas.
- `src/server/g360Engine.ts`: remoção das gravações/demonstrações durante leitura e encaminhamento de erros assíncronos.
- `src/server/costGuard.ts`: leitura, validação, rollover diário e gravação segura, com rollback de memória e sem fallback após erro de persistência.
- `src/middleware/auth.ts`: leitura estrita e encaminhamento de erro de IO, sem mudar as regras de acesso.
- `scripts/setup-admin.mjs`: adesão ao protocolo de persistência; nenhuma execução de redefinição.
- `.gitignore`: proteção de snapshots privados, bloqueios e temporários.
- Este relatório.

## Validação executada

Todos os testes de gravação e recuperação usaram arquivos temporários e dados fictícios. A suíte completa rodou em `/tmp/g360-json-158w7v1i`; os testes de interrupção e inicialização criaram outras cópias temporárias, com configuração Firebase fictícia e sem uso de serviços reais. Nenhum arquivo .env ou banco original foi usado como massa de teste.

| Grupo | Passaram | Falhas | Pulados |
| --- | ---: | ---: | ---: |
| Persistência: unitários, processos e HTTP | 35 | 0 | 0 |
| Persistência: rotas reais com IO simulado | 6 | 0 | 0 |
| SSRF: contratos e transporte existentes | 67 | 0 | 0 |
| Segurança/aplicação existentes | 28 | 0 | 0 |
| **Total** | **136** | **0** | **0** |

Foram simulados JSON/UTF-8 inválidos, arquivo vazio/ausente, permissão negada, disco cheio, erro de escrita, escrita parcial/zero bytes, falha de sincronização e rename, cópia anterior corrompida, escritor concorrente, versão desatualizada, morte do processo durante escrita e antes da troca, falha após troca, lock não liberado, recuperação em arquivo separado e erro capturado indevidamente por rota. A integração verificou que consultas não recriam demonstrações nem reescrevem fotos, que alterações não confirmadas não vazam e que as APIs não retornam sucesso após falha de disco. Também foram testados bloqueios de acesso HTTP aos bancos e artefatos privados, incluindo caminhos codificados e /@fs. A inicialização real do servidor em cópia fictícia recusou banco ausente, vazio e corrompido sem recriá-lo.

Comando da suíte completa, exclusivamente na cópia fictícia:

```sh
G360_URL_PLAN_FIXTURE=1 G360_TEST_FIXTURE=1 NODE_ENV=test node --import tsx --test --test-concurrency=1 docs/planejamento-urls/persistence.contract.mjs docs/planejamento-urls/ssrf.contract.mjs src/server/jsonPersistence.test.ts src/server/publicUrl.test.ts src/server/security.test.ts firestore.rules.test.ts src/lib/firestoreSchemas.test.ts src/lib/sitegen/masterImagePrompt.test.ts src/lib/sitegen/sitegen.test.ts src/server/blindagem.test.ts src/server/costGuard.test.ts
```

Os arquivos de teste que compartilham a base fictícia são executados sequencialmente para evitar interferência entre processos do runner. A concorrência real é testada intencionalmente em casos próprios, com dois rascunhos/requisições e processos isolados.

- `npm run lint` (TypeScript): passou, saída 0.
- `npm run build`: passou, saída 0; avisos anteriores do bundle/Vite/Firebase permanecem.
- `node --check` do módulo MJS e do script administrativo: passou, sem executar o script.
- Git diff conferido. Bancos originais, package.json, bun.lock, Studio.jsx, Editor.jsx, SearchHome.jsx e módulos Firebase: sem alterações desta etapa. O helper SSRF, seus testes/contratos e os arquivos visuais já alterados em etapas anteriores foram comparados com o checkpoint e preservados.

## Recuperação e limitações

- `previous()` apenas lê e confere a cópia anterior; não substitui automaticamente o banco. A recuperação foi comprovada gravando esses bytes em outro arquivo temporário e lendo-o novamente. Qualquer restauração no banco real exige autorização, cópia de preservação do arquivo com problema e aplicação parada.
- Há uma geração anterior local, não histórico completo nem backup externo. Ela pode não conter a última operação se a cópia atual for corrompida depois de um salvamento. Falha do disco/volume inteiro exige backup externo validado, ainda pendente.
- Após interrupção, não remover lock por tempo ou PID presumido. Parar e conferir os escritores, verificar original/cópia e inspecionar os artefatos antes de qualquer limpeza manual autorizada. Nunca remover automaticamente um bloqueio que pode estar em uso.
- Um resultado incerto não deve provocar repetição automática de operações não idempotentes: pode já ter sido salvo. Conferir os dados antes de reenviar.
- Todos os escritores precisam adotar o protocolo. Ferramentas externas que editam o JSON ignorando o lock não têm proteção integral contra corrida; não devem atuar junto com a aplicação. Arquivos devem ficar em filesystem local com rename atômico e sincronização suportada. Sincronização/disco foram simulados em testes, não se afirma tolerância comprovada a falha física de hardware.
- JSON continua carregado em memória. Rascunhos, cópias e sincronização têm custo de memória/IO. Instância única é recomendada. Expansão horizontal ou alto volume exige plano separado de armazenamento transacional e aprovação; nenhuma mudança assim foi feita.
- Conflitos durante uma requisição são detectados. Edição antiga enviada depois pelo cliente exige versão/ETag no contrato da API para distinguir intenção de sobrescrita; essa integração com interface permanece uma tarefa futura, não foi introduzida mudança incompatível de payload.
- Banco ausente agora requer preparação inicial explícita; o servidor não tenta adivinhar se deve criar ou recuperar uma base. A estrutura JSON principal foi mantida, inclusive campos extras e G360 legado parcial válido.

## Integração com outros agentes e publicação

Antigravity: nenhuma interface foi alterada. Consumidores devem tratar 409/503 como falha e não considerar streams interrompidos como salvamento concluído. Uma futura integração de ETag deve ser coordenada antes de mudar o contrato.

OpenCode: dependências, lockfile, exportação ZIP e otimizações não foram alterados. Novos escritores de JSON, inclusive scripts de manutenção, devem usar o módulo comum ou operar com a aplicação parada sob plano aprovado. As regras novas do gitignore precisam ser mantidas para evitar versionar snapshots privados.

SSRF: implementação e testes foram preservados integralmente; seus 67 testes passaram novamente. A compatibilidade do proxy real continua com a limitação registrada no relatório SSRF.

**O projeto não está declarado pronto para produção.** Permanecem a validação de inicialização de produção, jszip reproduzível, backup externo/recuperação administrativa e demais bloqueios já registrados. Não houve migração administrativa, redefinição de credencial ou publicação.
