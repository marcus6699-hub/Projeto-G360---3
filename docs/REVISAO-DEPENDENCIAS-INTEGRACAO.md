# Dependências — impacto e correção para integração

27/10/2026, branch `codex/auditoria-g360`. Nenhum upgrade/override foi aplicado ao manifesto ou lock nesta etapa. Nenhuma conta ou serviço Firebase real foi acessado.

`bun audit --json` identificou três avisos:

| Pacote / aviso | Caminho e impacto observado | Encaminhamento |
| --- | --- | --- |
| `@grpc/grpc-js@1.9.16`, alto, [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) | `firebase` → `@firebase/firestore`, que exige `~1.9.0`. O aviso oficial consultado exige servidor gRPC, `requireClientCertificate:false` e autenticação por `getAuthContext`. Nenhum servidor gRPC, uso de `getAuthContext` ou xDS foi encontrado no aplicativo. A cadeia de `firebase-admin` usa outra cópia, `1.14.6`. | Nenhum caminho de exploração identificado no código examinado; o aviso continua no inventário. Não afirmar risco zero. |
| Mesmo pacote, baixo, [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4) | Aviso relacionado a mensagens de handlers do servidor gRPC. Não foi encontrado esse servidor no G360. | Atualização compatível ainda necessária para remover o pacote afetado. |
| `esbuild@0.18.20`, moderado, [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | `drizzle-kit` → `@esbuild-kit/esm-loader` → `core-utils`. O aviso envolve o servidor de desenvolvimento de esbuild. Não foi encontrado `esbuild.serve` no G360; o loader usa transformação. Outras cópias: `0.25.12` e `0.28.2`. | Não expor ferramentas de desenvolvimento; atualizar/substituir a cadeia antiga com teste do loader. |

O aviso alto oficial informa correções em **1.13.6 e 1.14.5**; `>=1.14.0,<1.14.5` também é afetado. O resumo do registro mostrou apenas `<1.13.6`; não usar esse resumo como faixa completa. A cópia `1.14.6` da cadeia Admin está corrigida para esses avisos.

O SDK web usa resolução de navegador. Isso não comprova ausência de gRPC em qualquer artefato/SSR futuro. Pacote instalado não prova exploração, e ausência de chamada encontrada não prova inacessibilidade universal. Conferir novamente o artefato integrado.

## Opções de correção

1. **Preferida:** atualizar o SDK Firebase para versão que resolva gRPC corrigido em intervalo suportado pelo fornecedor. Testar Auth/Firestore, web/Node, emulador e build antes de incorporar.
2. Override transitivo pode retirar o aviso, mas gRPC `1.13.6`/`1.14.6` ultrapassa `~1.9.0`. Lint/build não homologam o canal cliente, autenticação ou reconexão do Firestore. Exige testes controlados e análise de compatibilidade.
3. Para esbuild, preferir atualizar a ferramenta que mantém a cadeia antiga. Override `0.18` → `0.25` atravessa intervalo pré-1.0; testar loader e Drizzle com schema fictício, sem migrações reais.
4. Enquanto não corrigido, registrar exceção com responsável/prazo e impedir exposição de servidores gRPC/dev. Isso reduz exposição, mas não elimina o aviso.

Um experimento isolado foi iniciado por um agente, porém seus arquivos/logs temporários não estavam disponíveis no ambiente retomado. Não é contabilizado como validação reproduzida neste fechamento. O manifesto/lock efetivo permanece sem overrides.

## Incorporação

Conciliar manifesto com OpenCode, especialmente JSZip e `tsx`; gerar um único lock; fazer instalação limpa frozen, tipos/build, suíte completa e teste de SDK/emulador. Repetir auditoria por versão efetiva. Não mesclar manualmente entradas do lock nem aplicar upgrades amplos para apenas zerar o relatório. Nenhuma operação real é necessária para esses ensaios locais.
