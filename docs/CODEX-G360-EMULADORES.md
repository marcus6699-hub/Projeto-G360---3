# G360 — Firebase Emulator Suite local

28/10/2026. Branch `codex/auditoria-g360`.

## Resultado real

**Firebase Authentication Emulator executado localmente: 7 testes aprovados, zero falhas, zero ignorados.** Não são mocks do SDK: Firebase Admin e o backend G360 falaram HTTP com o processo oficial local do emulador, usando projeto fictício `demo-g360-codex`.

Testados:

1. Senha correta/incorreta e verificação Admin do token emitido pelo emulador.
2. Token com projeto diferente e token expirado rejeitados. O emulador emite tokens sem assinatura criptográfica, comportamento próprio de testes; isso não homologa validação de assinatura/certificados em produção.
3. Conta desativada e conta removida bloqueadas.
4. Revogação real de token anterior no emulador.
5. Claims administrativas atuais e diferença em relação a token antigo.
6. Troca de senha somente fictícia, preservando login de outro usuário.
7. Backend real em cópia temporária: troca de token por cookie, sessão, permissões adicionadas/removidas, refresh, logout, sessões paralelas e revogação. Hash/conteúdo da base fictícia preservado. Nenhum SDK foi substituído por mock nesse cenário.

Comando executado:

```sh
G360_FIREBASE_CLI_PATH=/tmp/g360-emulator-tools/node_modules/firebase-tools/lib/bin/firebase.js node scripts/run-firebase-emulators.mjs auth
```

Log: `/tmp/g360-auth-emulator-tests.log`. Fixture da última execução: `/tmp/g360-emulators-Pz1nNv`. Resultado exit 0; sete testes em aproximadamente 3,5 segundos, além do tempo de inicialização/desligamento. Arquivos temporários podem desaparecer entre sessões.

## Instalação isolada e retomada

Java encontrado: OpenJDK 21. Firebase CLI não estava instalado. Foi instalado `firebase-tools@14.24.2` em `/tmp/g360-emulator-tools`, sem scripts de instalação, sem alterar `package.json`, `bun.lock` ou `node_modules` do aplicativo.

```sh
npm_config_cache=/tmp/g360-npm-cache npm install --prefix /tmp/g360-emulator-tools --ignore-scripts --no-audit --no-fund firebase-tools@14.24.2
G360_FIREBASE_CLI_PATH=/tmp/g360-emulator-tools/node_modules/firebase-tools/lib/bin/firebase.js node scripts/run-firebase-emulators.mjs auth
```

A primeira tentativa de instalação falhou porque o cache padrão npm apontava para diretório de usuário indisponível. A correção foi selecionar cache em `/tmp`; não foi alterado HOME. Instalação posterior passou (728 pacotes). O CLI isolado apresentou avisos de dependências antigas/depreciadas; ele não integra o runtime do G360. Manter a ferramenta isolada e reavaliar sua versão antes de uso duradouro.

O CLI tentou obter MOTD/configuração remota e informou impossibilidade de acesso; o aviso foi não fatal. Não houve login Firebase, criação de projeto real ou acesso a conta remota. As operações Auth foram somente loopback e projeto demo.

## Proteções do executor

- Projeto fixo `demo-g360-codex`; não aceita projeto de produção por argumento.
- Portas livres em `127.0.0.1`, sem exposição em `0.0.0.0`; UI desativada.
- Ambiente do filho selecionado por allowlist, sem credenciais, tokens, `.env` ou configuração de projeto real.
- Configuração, regras copiadas e logs no diretório temporário; regras originais não alteradas.
- No ensaio do backend, fontes copiadas sem banco/métricas/ambientes originais e configuração Firebase substituída por demo. Dependências são reutilizadas por link de leitura na fixture temporária; nenhum worktree ou dado real é vinculado.
- Artefatos não apagados para permitir inspeção; processos do emulador e do backend fictício desligados ao terminar.
- `firebase-emulator.contract.mjs` exige marcador explícito, host loopback e projeto demo. O arquivo não é descoberto pela suíte padrão; execução requer o executor dedicado. Não inflar o total padrão com testes opcionais não executados.

## Firestore: bloqueio e preparação

**Firestore Emulator não executado. Nenhum teste das regras reais foi declarado aprovado.**

O CLI exige o JAR oficial `cloud-firestore-emulator-v1.19.8.jar`, distribuído por `storage.googleapis.com/firebase-preview-drop/emulator/`. Esse domínio não consta na política de saída atualmente aplicada e não existe JAR em cache. Não houve tentativa de contornar a restrição, baixar espelho ou usar banco de produção.

O executor prepara modo `all` e contém teste REST das regras reais copiadas: escrita válida verificada, leitura própria, leitura/escrita estrangeira e anônima negadas, campo administrativo inesperado negado, coleção `signed_contracts` fechada e usuário não verificado negado. **Esse cenário está preparado, não validado.**

O modo `all` recusa iniciar sem o JAR oficial previamente disponível em cache autorizado, evitando download automático:

```sh
G360_FIREBASE_CLI_PATH=/tmp/g360-emulator-tools/node_modules/firebase-tools/lib/bin/firebase.js G360_FIREBASE_EMULATOR_CACHE=/tmp/cache-autorizado node scripts/run-firebase-emulators.mjs all
```

Para avançar, disponibilizar o artefato oficial por acesso de rede autorizado/fornecido pelo ambiente, verificar o artefato e executar novamente. Não modificar regras para fazer o teste passar. O emulador Auth validado não substitui a homologação Firestore, a integração visual ou a autenticação real com certificados em produção.

## Arquivos criados

- `scripts/run-firebase-emulators.mjs`: isolamento, configuração e ciclo de vida.
- `scripts/firebase-emulator.contract.mjs`: testes de serviços locais e backend.
- Este documento.

`node --check` passou para os dois scripts; diff sem erros de espaços. Nenhuma conta, senha, claim, regra ou dado real alterado; sem merge, push, publicação, gasto ou migração.
