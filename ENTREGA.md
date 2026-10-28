# G360 Business — entrega integrada para avaliação local

Esta branch contém a versão integrada das quatro IAs, testes e documentação. Não contém bancos privados, dependências instaladas, credenciais reais ou o histórico antigo do projeto.

## Abrir no Windows

1. No GitHub privado, selecione a branch **codex/g360-unificado-v1** e use **Code → Download ZIP**. Esta instrução só funciona depois que a branch for enviada e confirmada; nenhum link antecipado é uma entrega concluída.
2. Extraia para uma pasta nova. Abra no VS Code a pasta que contém `package.json`.
3. Instale Node.js 24 LTS e Bun. No terminal PowerShell dessa pasta:

```powershell
bun install --frozen-lockfile --ignore-scripts
node scripts/verify-transfer.mjs
npm run lint
npm run build
node scripts/start-windows-review.mjs
```

4. Consulte localmente as credenciais fictícias no arquivo indicado pelo terminal. Abra **http://127.0.0.1:3001** no navegador desse mesmo computador. O servidor estará no Windows, não na nuvem. Ctrl+C encerra sem excluir dados.
5. Em Prospecção, baixe e importe o JSON de empresas fictícias para testar sem APIs.

O guia detalhado está em [LEIA-ME-WINDOWS.md](LEIA-ME-WINDOWS.md). Não usar banco original, .env real ou conta de produção.

## Pacote e galeria

- [ZIP Windows exato, já validado](entrega/G360-BUSINESS-UNIFICADO-WINDOWS-v1.zip) e [SHA-256](entrega/G360-BUSINESS-UNIFICADO-WINDOWS-v1.zip.sha256). No GitHub privado, abra o arquivo e use Download raw file. Nada será publicado como site.
- [Galeria local](galeria/index.html): abra esse HTML após baixar/extrair o repositório; não é GitHub Pages nem uma prévia hospedada. Contém 28 capturas reais com dados fictícios.
- [Relatório de homologação](galeria/RELATORIO.md).
- [Inventário exato da entrega](MANIFESTO-ENTREGA.json): arquivo e SHA-256 de cada item preparado para o commit, exceto ele próprio.

O ZIP automático do GitHub terá hash diferente do ZIP exato acima. Confira o manifesto de arquivos extraídos; não compare hashes de arquivos ZIP distintos.

## Limites

O histórico de homologação inclui 332 testes aprovados e 22 verificações Chromium com 28 capturas. Resultados novos de instalação limpa ficam registrados na preparação desta entrega; não declarar execução Windows antes de testar no Windows real. Testes que exigem /tmp, Chromium e ferramentas Linux devem usar ambiente Linux/WSL separado.

API de produção, Firestore/OAuth reais, rankings medidos, assinaturas e pagamentos permanecem sem ativação. Recursos não configurados devem informar indisponível. A interface do Escritório é de consulta; funções completas de cadastro/revisão ainda estão nas APIs protegidas. Esta entrega não é uma declaração de prontidão para produção.
