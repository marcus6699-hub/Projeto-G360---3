# G360 Business unificado — abrir no Windows com VS Code

Pacote de código-fonte das quatro IAs, atualizado até a homologação visual da Etapa 5. Não contém banco privado, credenciais reais, node_modules, dist ou histórico Git.

## 1. Preparar o computador

Instale gratuitamente:

- Node.js **24 LTS**, pelo site oficial https://nodejs.org/ (inclui npm).
- VS Code, em https://code.visualstudio.com/ .
- Bun, seguindo a instalação oficial para Windows em https://bun.sh/docs/installation . O lockfile do projeto é bun.lock; prefira esse gerenciador para uma instalação reproduzível.

Abra um novo PowerShell e confira:

```powershell
node --version
bun --version
```

Este pacote foi preparado e validado em Linux. **A instalação nativa e a execução no Windows ainda precisam ser verificadas no seu computador.** Não há promessa de que os 332 testes executem diretamente no Windows.

## 2. Conferir e extrair o ZIP

Para o ZIP EXATO preparado pelo Codex:

```powershell
Get-FileHash .\G360-BUSINESS-UNIFICADO-WINDOWS-v1.zip -Algorithm SHA256
```

Compare com o arquivo .sha256 fornecido junto ao pacote. Se baixar “Download ZIP” gerado pelo GitHub, esse arquivo terá outro hash de ZIP; nesse caso confira os arquivos extraídos com `node scripts/verify-transfer.mjs` e o manifesto incluído.

Extraia para uma pasta NOVA, por exemplo `C:\Projetos\G360-Unificado`. Não extraia sobre os projetos OpenCode/Antigravity existentes. Abra no VS Code a pasta que contém package.json.

## 3. Instalar as dependências declaradas

No VS Code, abra Terminal → Novo Terminal, selecione PowerShell e execute na pasta do package.json:

```powershell
bun install --frozen-lockfile --ignore-scripts
npm run lint
npm run build
```

Se a instalação falhar por versão do Bun, pacote ou dependência nativa, guarde a mensagem completa. Não apague/substitua bun.lock nem execute instaladores desconhecidos para contornar o problema. O pacote preserva o lock e as versões do projeto; ainda falta homologar a instalação limpa no Windows.

`npm install --ignore-scripts` é uma alternativa quando Bun não está disponível, mas não reproduz o bun.lock e pode resolver versões diferentes. Por isso não é o caminho preferencial desta entrega. Não é necessário instalar serviços pagos.

## 4. Iniciar com dados fictícios, sem APIs

```powershell
node scripts/start-windows-review.mjs
```

Esse inicializador:

- exige configuração Firebase fictícia e recusa arquivo .env;
- cria uma pasta NOVA de dados fictícios dentro de LocalAppData, fora do código;
- gera senhas aleatórias novas para as contas de teste;
- bloqueia fetch externo no backend e limita o servidor a 127.0.0.1:3001;
- imprime somente o caminho do arquivo privado com as credenciais fictícias.

Abra **http://127.0.0.1:3001** no navegador do próprio Windows. Agora o servidor estará no seu computador, diferentemente do ambiente na nuvem. Não é deploy.

Abra localmente o arquivo `TEST-CREDENTIALS-PRIVATE.json` indicado pelo terminal para consultar o login admin/user de teste. Não publique esse arquivo. Para encerrar o servidor, use Ctrl+C. Cada inicialização usa dados novos; os anteriores permanecem preservados e não são excluídos.

Não configure credenciais reais nesta avaliação. Não use bancos originais e não copie .env de outro projeto.

## 5. Jornada de avaliação

1. Entre com a conta admin fictícia e abra Dashboard.
2. Em Prospecção, baixe “empresas fictícias para teste”.
3. Use Importar JSON, selecione Aurora e registre declarações/evidências.
4. Abra Geogrid: há coordenadas geométricas, sem rankings simulados.
5. Prepare o Pacote GBP; revise e aprove identidade e itens antes de transferir ao Site Express.
6. Gere o projeto local, edite, salve e baixe HTML/ZIP.
7. Selecione Horizonte e confirme que dados e aprovações de Aurora não reaparecem.
8. Consulte CRM, Escritório e Administração. A tela do Escritório é de consulta; cadastro/revisão completos continuam nas APIs protegidas.

A Central de IA e buscas externas devem informar indisponibilidade sem integração homologada. Copiar/enviar contrato não equivale a assinatura eletrônica. Exportações de templates podem depender de imagens/fontes/CDNs externas; a alternativa de site verificado é distinta.

## 6. Testes e limites de plataforma

Foram preservados todos os testes fonte, inclusive fixtures fictícias e documentação. O histórico validado em Linux é 332 testes aprovados, além de Chromium e build; não representa execução nova nem validação Windows.

- `npm run lint` e `npm run build` devem ser executados no Windows após instalar.
- `node scripts/test-isolated.mjs` e diversos testes exigem caminhos /tmp e outras condições Linux.
- Os scripts de navegador exigem Python, Playwright, Chromium e caminhos Linux; para repeti-los, use ambiente Linux/WSL compatível, com nova instalação de dependências nesse ambiente, sem misturar node_modules de Windows e Linux.
- Não execute todos os testes diretamente no banco em uso. Eles devem operar em cópias temporárias/fictícias conforme as instruções.
- Não use `npm run clean` no PowerShell: o comando preservado é `rm -rf dist`, voltado a Unix. Não é necessário para instalar ou abrir.
- Textos de documentação mais antigos podem citar /workspace e fases anteriores; este guia descreve a transferência Windows.

Pendências para produção: homologação de Firebase/Firestore/OAuth, APIs externas/custos, assinador/gateway, recuperação administrativa/legado, dependências, instalação limpa, backup externo e operação além de uma instância JSON. Não publique esta versão sem nova revisão.
