# G360 — validação real em navegador e patches de conciliação

28/10/2026. Trabalho no checkout `codex/auditoria-g360`.

## Ambiente e preservação

Foi usado Chromium real em modo headless (`/usr/bin/chromium`) controlado por Playwright Python já instalado no runtime. Não foi necessário instalar serviço, contratar fornecedor ou usar crédito de API.

O executor `scripts/browser-local.py` copia as fontes para `/tmp/g360-browser-*`, exclui `.env`, banco, métricas e configuração Firebase originais e cria uma configuração/projeto e contas inteiramente fictícios. Dependências são reutilizadas por link somente de leitura do mesmo checkout, em uma cópia temporária de fontes, sem nova worktree Git nem modificação de outro agente. O build roda nessa cópia.

A aplicação inicia em produção somente em loopback. Há HTTPS local com certificado/chave fictícios gerados no diretório temporário e proxy local; o navegador aceita esse certificado exclusivamente no contexto do teste. `G360_ALLOWED_ORIGINS` aponta para a própria origem local. Não foi afrouxado o atributo `Secure` do cookie, alterado domínio real ou realizado deploy. O primeiro ensaio HTTP expôs uma limitação do próprio teste com cookie Secure; o ambiente foi corrigido para HTTPS, sem alterar a proteção do aplicativo.

Requisições do navegador para fora da origem local são abortadas. `fetch` do servidor está bloqueado no preload da cópia. Não houve login Google, envio de mensagem, assinatura, consulta paga ou chamada real Firebase. Fontes, imagens e scripts remotos foram bloqueados, incluindo `apis.google.com`, Google Fonts, Tailwind CDN e Unsplash.

## Comandos e resultados

```sh
python3 scripts/browser-local.py
python3 scripts/browser-local.py --verify-patches
```

O primeiro comando testa as fontes efetivas e **retorna exit 2 quando reproduz as duas falhas descritas abaixo**. Não é uma aprovação total do navegador. O segundo aplica os dois patches de revisão **somente dentro da cópia temporária** e comprova seu comportamento, sem alterar os arquivos visuais do checkout.

Último ensaio com patches: **14 verificações aprovadas, zero findings e zero erros de página, exit 0**, em `/tmp/g360-browser-bnlpdx61`. Resultado JSON no próprio diretório e em `/tmp/g360-browser-patches-result.log`.

A execução final sem patches, em `/tmp/g360-browser-nvm0fbwu`, teve **11 verificações aprovadas e duas falhas comprovadas, exit 2**; o resumo consta em `/tmp/g360-browser-result.log` e no `browser-result.json` da cópia. Esses artefatos temporários não são dados de produção e podem desaparecer em outra sessão.

## Fluxos realmente utilizados

| Fluxo | Evidência e limite |
| --- | --- |
| Anônimo | Navegação redireciona para `/login`; API privada responde 401. |
| Senha incorreta | Formulário real recusa e mantém página de login. |
| Login local | Formulário entra no Studio; `/auth/me` confirma a conta fictícia; cookie opaco é Secure, HttpOnly e SameSite Strict. |
| Recarregamento | Studio e sessão local continuam acessíveis após reload. Não comprova sessão OAuth. |
| Projeto | Criado pela API no contexto do navegador e posteriormente encontrado na listagem visual real de projetos/clientes. A criação não foi pelo editor de sites. |
| Escritório novo | `/api/office` foi consultado com cookies do navegador; não existe ainda prova de frontend consumindo as novas APIs do Escritório. |
| Dados privados | `db.json` e seu backup não são acessíveis pela web: 404. |
| Contrato ativo | Navegação real CRM → contrato apresenta minuta/assinatura externa pendente. O botão interno não muda para assinatura concluída. |
| Download | Clique real baixa `.html` contendo os dados fictícios inseridos e indicação de assinatura pendente. Não é PDF nem documento eletronicamente assinado. |
| Dados próprios | Prestador fictício da conta A permanece após reload, incluindo no cenário com namespace por UID. |
| Logout | Botão real encerra o acesso local; `/auth/me` e `/projects` respondem 401; reload e navegação continuam negados. Não testa signOut do SDK Firebase. |
| Recuperação | A interface atual apresenta sucesso apesar de 503 do backend; patch isolado apresenta indisponibilidade. |
| Outra conta | Cadastro de conta B real na base fictícia reproduz leitura dos dados do prestador A pela chave global; patch isolado impede a reutilização. |
| Legado sem dono | Com o patch, dados antigos não associados a UID não são automaticamente atribuídos à conta conectada. |

## Falhas comprovadas que permanecem na interface de trabalho

1. `src/pages/AuthPage.jsx`, botão de recuperação: captura e ignora o erro 503 e mostra que instruções serão enviadas. A recuperação automática não existe. Isso é sucesso visual falso, não falha da resposta do backend.
2. `src/components/g360/G360CrmFinancePanel.jsx`: `g360_contract_provider` e outras chaves locais não têm namespace de usuário. Após salvar o nome **fictício** do prestador A, sair e cadastrar B no mesmo navegador, B vê aquele dado. A API privada continua protegida; a falha é reutilização de estado local entre contas.

Os dois problemas foram registrados como **failed**, não escondidos como testes verdes ou resultados de mocks. Dados e pessoas envolvidos são fictícios. A segunda falha afeta isolamento e impede declarar o fluxo comercial seguro em computador compartilhado.

## Patches preparados, não aplicados ao checkout

- `docs/patches/auth-recovery-no-false-success.patch`: exibe erro retornado pelo backend; uma resposta futura de solicitação recebida não é confundida com mensagem efetivamente entregue.
- `docs/patches/antigravity-crm-storage-uid.patch`: usa identidade do AuthContext para namespace dos dados locais, reinicia o estado do painel quando a identidade muda e não lê/atribui automaticamente valores antigos sem proprietário. Abrange prestador, modelos, pacotes, workflow e badges do painel existente.

Ambos passaram `git apply --check` e foram aplicados à cópia temporária para build e teste real dos 14 cenários acima. **Não aplicar automaticamente ao arquivo de Antigravity sem conciliar seu diff atual.** Namespaces evitam reutilização acidental entre contas, mas não criptografam localStorage nem o tornam protegido contra JavaScript malicioso ou pessoa com acesso local ao perfil do navegador. Dados pessoais não devem ser armazenados desnecessariamente em computadores compartilhados.

## Evidências locais

Na cópia com patches `/tmp/g360-browser-bnlpdx61`:

- `browser-result.json`: resumo estruturado dos cenários.
- `logged-in.png`: Studio realmente renderizado.
- `contract-draft.png`: minuta com campos fictícios e indicação de assinatura pendente.
- `fictional-draft.html`: download efetivo.
- `build.log` / `server.log`: execução da cópia.

Na cópia sem patches, o executor também salva `cross-account-provider-finding.png` se reproduzir o vazamento local entre as contas fictícias. Não foram incluídos certificados/chaves, dados gerados, screenshots ou banco em arquivos destinados ao Git.

## Pendências

Antigravity deve conciliar os patches, repetir o ensaio e integrar o novo Escritório. Logout Firebase/OAuth unificado, popup/retorno Google, emulador, expiração real de token, restauração de rascunhos por backend, planos e pagamentos são ensaios separados; não foram homologados por esta rodada visual local. Nunca tratar a aprovação interna da minuta, link WhatsApp ou download HTML como assinatura legítima.
