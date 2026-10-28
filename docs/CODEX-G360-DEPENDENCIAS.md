# G360 — revisão de dependências e candidato isolado

28/10/2026. Branch `codex/auditoria-g360`. **Nenhuma alteração aplicada a `package.json` ou `bun.lock` do checkout.** Não houve migração, conexão Firebase real, cobrança, merge, push ou publicação.

## Estado efetivo do checkout

`bun pm why` e `bun audit --json` confirmaram:

| Dependência efetiva | Origem | Aviso |
| --- | --- | --- |
| `@grpc/grpc-js@1.9.16` | `firebase@13.1.0` → `@firebase/firestore@4.19.0`, que exige `~1.9.0` | Alto GHSA-m9gg-hp2v-232j e baixo GHSA-f596-whhp-79r4 |
| `@grpc/grpc-js@1.14.6` | Cópias da cadeia `firebase-admin` → Google Cloud/Google GAX | Corrigida para esses dois avisos |
| `esbuild@0.18.20` | `drizzle-kit@0.31.11` → `@esbuild-kit/esm-loader@2.6.5` → `core-utils@3.3.2` | Moderado GHSA-67mh-4wv8-2f99 |
| `esbuild@0.25.12` | Direta e Drizzle Kit | Além da correção 0.25.0 |
| `esbuild@0.28.2` | `tsx@4.23.15`, que exige `~0.28.0` | Sem esse aviso no registro consultado |

O registro reportou três avisos no checkout. Isso não equivale a três explorações demonstradas.

## Impacto e fontes oficiais

O aviso [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j), consultado nesta execução, envolve credenciais de **servidor** gRPC com `requireClientCertificate:false` e autenticação baseada em `getAuthContext`. Também descreve certas configurações xDS. O G360 inspecionado não cria servidor gRPC, não usa esse método para autenticar e não apresenta configuração xDS. O pacote vulnerável vem da cadeia cliente Firestore; não se identificou o pré-requisito de exploração no servidor do aplicativo.

Isso não elimina o aviso nem prova ausência universal de exposição futura. A instalação/artefato integrado pode mudar, e o SDK Node realmente utiliza gRPC — evidenciado pelo experimento controlado abaixo. Não alegar que o pacote está inerte em qualquer implantação.

O advisory informa versões corrigidas **1.13.6 e 1.14.5**; também afeta `>=1.14.0,<1.14.5`. A cópia Admin `1.14.6` está além dessas correções. O [aviso baixo](https://github.com/advisories/GHSA-f596-whhp-79r4) refere-se a mensagens de erro dos handlers de servidor.

O [advisory esbuild](https://github.com/advisories/GHSA-67mh-4wv8-2f99), também consultado, envolve requisições de qualquer origem ao servidor de desenvolvimento, corrigidas em `0.25.0`. Não foi encontrado uso de `esbuild.serve` pelo G360. Loader/transformação não é o mesmo serviço afetado. Mesmo assim, não expor servidores de desenvolvimento e eliminar a cadeia antiga por solução compatível.

## Candidato preparado sem alterar o checkout

Diretório: `/tmp/g360-dependency-candidate-9x0xfwd6`.

Foram copiadas somente fontes/configurações necessárias, excluindo `.env`, DB original, métricas, `.git`, `node_modules`, `dist` e anexos. A configuração Firebase foi substituída por projeto demo fictício. O candidato recebeu:

```json
"overrides": {
  "@grpc/grpc-js": "1.14.6",
  "esbuild": "0.25.12"
}
```

O lock foi gerado com Bun 1.4.4 e a instalação foi limpa/frozen, sem scripts. Dependências físicas foram instaladas no próprio candidato, sem symlink para o `node_modules` original.

| Verificação realizada no candidato | Resultado real |
| --- | --- |
| `bun install --lockfile-only --ignore-scripts` | Exit 0 |
| `bun install --frozen-lockfile --ignore-scripts` | Exit 0; 543 pacotes, um postinstall bloqueado |
| `npm run lint` | Exit 0 |
| `npm run build` | Exit 0, 1,37 s; avisos conhecidos de Vite/importação/chunks |
| `node scripts/test-isolated.mjs` | **255 aprovados, zero falhas e zero ignorados**, aproximadamente 30,7 s |
| Auth Emulator oficial local | **7 aprovados**, incluindo o backend real em cópia fictícia, zero falhas/ignorados |
| `bun audit --json` | `{}` no registro consultado |
| SDK Node Firestore contra servidor gRPC controlado | Leitura de documento fictício aprovada, um RPC local |
| Firestore Emulator e suas regras | **Não executado**: JAR oficial fora da política de rede e sem cache |
| Navegador com o candidato | Não executado; o build não comprova runtime visual |

Os 255 testes refletem o snapshot do código no início do experimento. Outros agentes continuam trabalhando; não substituir o total final do checkout por esse número nem somar testes opcionais como se fossem parte da suíte padrão.

Logs: `/tmp/g360-dependency-lock.log`, `g360-dependency-install.log`, `g360-dependency-lint.log`, `g360-dependency-build.log`, `g360-dependency-tests.log`, `g360-dependency-auth-emulator.log`, `g360-dependency-audit.json`, `g360-dependency-grpc-smoke-retained.log`. Diretórios temporários podem desaparecer; artefatos persistentes abaixo permitem reconstruir o experimento.

## Experimento gRPC controlado

O SDK Firebase Node abriu stream `Listen` em um servidor gRPC próprio ligado somente a `127.0.0.1`, com projeto `demo-g360-dependency` e identidade fictícia, leu um documento com conteúdo conhecido e encerrou cliente/servidor. Não houve contato com Firestore de produção, certificados reais ou acesso a dados existentes.

A primeira tentativa implementava apenas `BatchGetDocuments`; falhou porque esse caminho do SDK usa `Listen`. Foi corrigido o **servidor de teste**, sem mudar o SDK ou mascarar permissões. A segunda execução e a execução do artefato retido passaram.

Esse ensaio exercita o transporte/serialização usados pelo SDK, mas **não** homologa regras Firestore, escrita/transações, TLS, autenticação real, reconexão ou todos os recursos do fornecedor. Não confundir servidor gRPC simulado com Firestore Emulator.

## Patch e reprodução

- `docs/patches/dependency-candidate.patch`: proposta de manifesto+lock, não aplicada. `git apply --check` passou sobre o estado atual do checkout.
- `docs/patches/dependency-grpc-smoke.mjs`: experimento de transporte. Copiar para o diretório do candidato antes de executar; recusa versão gRPC diferente de `1.14.6`.

Hashes da base usada para o patch:

| Arquivo | SHA-256 anterior | SHA-256 candidato |
| --- | --- | --- |
| `package.json` | `bc107290518254d539a6039fee93d172c4f5ea9c867e6a71027013f2a63ae2dc` | `f28f148967c163bbb765e5cc20dfb9b0af6bdf5203435fc59767d39a13a7ee69` |
| `bun.lock` | `c19350584b907fdad2269310f3a667c24ae5eeaf75b16360c67762f649dbab2a` | `94f566210951398ef563b79d5ba59de7fe09dcb8973eabdc3d919f017efd1fbe` |

Se o manifesto de outro agente mudar, não forçar o patch. Conciliar a intenção dos overrides, gerar novo lock e repetir instalação/testes. Não mesclar entradas transitivas manualmente. Nunca executar os testes contra o DB original.

## Limites e decisão de incorporação

**Não aplicar automaticamente o candidato no checkout.** O resultado é promissor, mas parcialmente homologado:

1. gRPC `1.14.6` ultrapassa `~1.9.0` requerido pelo SDK Firestore atual.
2. Override global de esbuild ultrapassa `~0.18.20` do loader e **reduz** `0.28.2` do tsx para `0.25.12`, fora de `~0.28.0`. Os testes passaram, mas não cobrem toda a API e futuras transformações.
3. Auditoria vazia não prova compatibilidade ou ausência de vulnerabilidades desconhecidas.
4. Falta testar o SDK Firestore completo/emulador e o loader Drizzle com schema fictício. Nenhuma migração real é necessária ou autorizada para isso.

Preferir atualização suportada do Firebase e retirada da cadeia legada do loader, preservando a versão exigida por tsx. Se um override for adotado temporariamente, exigir responsável/prazo, testes negativos/controlados de Firestore/SDK e validação após conciliar `package.json`/`bun.lock` com OpenCode. A exceção de exposição atual deve distinguir ausência de caminho identificado de risco zero.

## Licenças, depreciações e dependências a revisar

Metadados dos 46 pacotes diretos instalados: 37 MIT, seis Apache-2.0, um BSD-2-Clause, um ISC e JSZip sob `(MIT OR GPL-3.0-or-later)`. gRPC é Apache-2.0; esbuild e Drizzle Kit são MIT. A opção MIT do JSZip deve ser acompanhada dos avisos/licença exigidos, não tratada como ausência de obrigações.

Uma varredura dos metadados `name/version/license` do candidato encontrou 545 identidades: MIT 381; Apache-2.0 97; ISC 27; BSD-3-Clause 16; BSD-2-Clause sete; MPL-2.0 seis; BlueOak-1.0.0 seis; uma cada sob MIT+Zlib, 0BSD, CC-BY-4.0, MIT-ou-GPL e campo legado de licença MIT. Nenhum desses metadados ficou sem declaração. Isso é inventário técnico, não parecer jurídico nem revisão completa de todos os arquivos/fontes/artefatos. Retenção de notices, distribuição e componentes não npm ainda exigem conferência.

O registro npm confirmou `@esbuild-kit/esm-loader` e `core-utils` depreciados e incorporados ao tsx. `@types/uuid@11.0.0` é stub depreciado: uuid já fornece tipos. Sua remoção e mover ferramentas/tipos de desenvolvimento para dependências adequadas são candidatos de conciliação, não alterações já feitas. `framer-motion` é usado por componentes; não removê-lo apenas por existir também `motion` sem revisar consumidores dos outros agentes.

Não foram feitas atualizações massivas, remoções de bibliotecas nem alterações em módulos compartilhados. O candidato é uma proposta testada parcialmente, não liberação de produção.
