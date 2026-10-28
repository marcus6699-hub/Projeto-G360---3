# G360 — URLs externas, persistência e inicialização

Data: 27/10/2026. Branch confirmada: `codex/auditoria-g360`. Esta etapa contém diagnóstico, plano e testes de contrato candidatos. **Nenhuma correção foi aplicada à aplicação nesta etapa. Nenhuma migração, redefinição, alteração de permissão, push, merge ou publicação foi executada.**

## 1. Superfícies identificadas

| Entrada | Arquivo / função | Comportamento e risco |
| --- | --- | --- |
| POST `/api/g360/website-audit`, body.url | `src/server/g360Engine.ts:1858`, handler website-audit | Acrescenta HTTPS se faltar esquema, usa fetch com redirect follow e lê o corpo inteiro. Não bloqueia rede interna, metadata, DNS privado nem redirecionamentos perigosos. Timeout de 8 s não substitui essas verificações. Falhas viram relatório com ok:true. |
| POST `/api/ai/clone-site`, body.url/rawHtml | `server.ts:2537`, handler clone-site | Busca URL arbitrária, aceita redirecionamento padrão e usa corpo inteiro. Se rawHtml existir, pula a busca, mas ainda usa a URL em metadados/prompts. Falhas podem cair em alternativa de IA/extrator. new URL posterior pode lançar erro fora do tratamento atual. |
| POST `/api/g360/audit`, query ou business.place_id custom/business.source custom | `g360Engine.ts:1296`, resolveRealBusinessMultiEngine, chamado pelo handler audit | Expande qualquer URL HTTP(S), embora o objetivo seja ler links Maps. Segue redirecionamentos e pode prosseguir para provedores quando falha. Não limita essa etapa a Maps nem bloqueia destinos privados. |
| GET `/api/places/photo`, query.name/max_width_px | `server.ts:1877`, handler photo | Não busca o alvo no servidor: redireciona o navegador a origem Google fixa. Não é o mesmo vetor SSRF arbitrário. Ainda exige validação estrita do nome de recurso e revisão porque coloca uma chave na URL enviada ao cliente. Não foi usada chave real. |
| Places, Outscraper, Serper, Nominatim, CNPJ e IA | Chamadas fetch em `server.ts` e `g360Engine.ts` | Origens são fixas no código; entradas entram em JSON, caminhos ou query codificada. CNPJ é reduzido a dígitos e validado. Ainda é necessário revisar política de redirecionamento e confidencialidade de cabeçalhos para esses provedores, sem aplicar a eles cegamente a política de navegação genérica. |
| POST `/api/g360/deploy` | `g360Engine.ts`, handler deploy | Origem Vercel fixa; envia HTML e token. Não é URL arbitrária, mas requer política própria e nunca deve encaminhar token a origem de redirecionamento. Nenhum deploy executado. |

URLs de imagens extraídas do HTML são armazenadas/devolvidas e renderizadas no cliente, sem fetch adicional do servidor nesse fluxo. URLs enviadas em prompts também exigem cuidado: um destino bloqueado não pode ser enviado depois a um provedor como alternativa de busca. A presença da palavra urlContext em comentário/prompt não comprova que a ferramenta esteja configurada na chamada.

## 2. Evidência desta etapa

Arquivo novo: `ssrf.contract.mjs`, ao lado deste relatório. Foi copiado para `/tmp/g360-url-plan-qgzog1zq` com base fictícia marcada `securityPlanFixture: true`. O teste recusa execução no checkout original. Credenciais de provedores são removidas do processo de teste e todo fetch de saída é substituído por uma resposta fictícia. Apenas o cliente do teste conversa com o servidor HTTP local isolado; não houve consulta externa, DNS real de destino nem acesso a serviço de metadata.

Comando na cópia: `G360_URL_PLAN_FIXTURE=1 NODE_ENV=test node --import tsx --test docs/planejamento-urls/ssrf.contract.mjs`.

**Resultado: 12 testes executados, 1 passou e 11 falharam; 0 pulados.** São testes de proteção candidatos: as falhas demonstram os bloqueios ausentes, não aprovação de segurança. O controle positivo de auditoria pública simulada passou. Os casos negativos incluem loopback IPv4/IPv6, rede privada, metadata e redirecionamento público → metadata nos dois handlers, além da expansão de query interna pelo resolvedor de empresas. Os testes de redirect simulam o comportamento follow sem abrir conexão.

Esses testes estão fora da suíte regular e não alteram os 28 resultados registrados na rodada anterior. Essa suíte anterior não foi repetida aqui. Quando houver resolvedor DNS e transporte seguros, o contrato terá de injetar respostas DNS públicas fictícias e incluir os cenários adicionais abaixo; a simulação atual não comprova proteção de DNS ou do proxy.

## 3. Menor correção recomendada para URLs

Criar um único helper de busca de HTML público e usá-lo nos três pontos com URL arbitrária. Evitar reescrita dos motores de negócio.

1. Normalizar com a API URL antes de qualquer acesso. Aceitar apenas HTTP/HTTPS, sem credenciais embutidas, caracteres de controle ou porta inesperada. Proposta inicial: portas padrão 80/443; registrar como incompatibilidade sites públicos que dependem de outras portas. Validar comprimento e retornar 400 para entrada malformada, sem lançar erro não tratado.
2. Canonicalizar endereços antes de classificá-los. Bloquear destinos não públicos: localhost e aliases, loopback, privados, link-local, unspecified, multicast, faixas reservadas/documentais, CGNAT e metadata, em IPv4 e IPv6. Tratar IPv4 embutido em IPv6, formas decimais/hexadecimais e hostnames internos. Validar todos os resultados A/AAAA; qualquer endereço não público invalida o alvo. Erro ou ausência de resolução deve interromper a busca.
3. Evitar troca de endereço entre validação e conexão (DNS rebinding). A classificação DNS isolada seguida de fetch comum é insuficiente. O transporte deve usar o destino efetivamente validado, preservando hostname TLS, verificação do certificado e proxy/CA exigidos pelo ambiente. Se o proxy resolve o destino novamente, é necessário garantir a mesma política no ponto de conexão do proxy. **Não contornar o proxy nem abrir rota direta como solução.** Esta compatibilidade é critério obrigatório antes de escolher a implementação.
4. Usar redirecionamento manual, máximo proposto de 3 saltos, com validação completa de cada Location, inclusive relativa. Não encaminhar cookies, Authorization ou chaves entre origens. Bloquear HTTPS → HTTP no redirecionamento; HTTP público inicial continua permitido para diagnosticar sites sem HTTPS.
5. Ler resposta em fluxo com limite inicial proposto de 2 MiB de conteúdo descomprimido e orçamento total de 10 s incluindo resolução, conexão, saltos e leitura; não confiar apenas no Content-Length. Abortar ao exceder. Aceitar HTML/XHTML para os fluxos de página; erro de tipo/tamanho deve ser explícito.
6. Responder 403 para destino bloqueado, 400 para URL inválida, 413 para tamanho excedido e 504 para timeout. Erro de política não vira relatório comercial fictício nem chama IA/provedores alternativos. Uma entrada rawHtml não dispensa validar uma URL que também foi enviada.
7. Para expansão de Maps, permitir somente uma lista explícita de hosts Maps realmente usados, comparada como hostname completo. Conferir os hosts de cada salto; não aceitar qualquer `*.google.com` por conveniência. Confirmar os formatos legítimos necessários antes de fixar a lista. Sites genéricos continuam nos fluxos de scanner/clone com a política de rede pública.

Riscos da alteração: bloquear URLs antes toleradas, sites grandes/lentos ou com portas diferentes; afetar links curtos Maps; rejeitar respostas mal configuradas. Preservar consulta por nome, HTML enviado sem URL, auditoria de HTTP público e clonagem de HTTPS público. Testar esses controles positivos junto aos negativos.

## 4. Matriz adicional de testes a implementar

Além dos 12 contratos preparados:

- DNS fictício: público; privado; múltiplos endereços público+privado; timeout; resposta que muda entre consultas. Provar qual IP foi usado na conexão, inclusive sob proxy.
- Endereços: 127.1, 2130706433, 0x7f000001, 0.0.0.0, 172.16.0.1, 192.168.0.1, 100.64.0.1, ::, fc00::, fe80:: e ::ffff:127.0.0.1. Nenhum deve receber tráfego real nos testes.
- Hostnames localhost, metadata e nomes internos; URL com userinfo, esquema file/data/ftp/gopher, porta proibida e formato inválido.
- Redirects 301/302/303/307/308, relativos, em ciclo, em excesso, HTTPS → HTTP, para metadata e DNS privado; provar que cabeçalhos não vazam entre origens.
- Resposta grande com/sem Content-Length, corpo comprimido expansivo, streaming sem fim, tipo inválido, timeout/cancelamento e certificado TLS inválido.
- URL bloqueada junto de rawHtml: não chamar fetch nem provedor; preservar fluxo de rawHtml sem URL.
- Autenticação anônima 401; usuário autorizado em scanner público; bloqueio independente do papel administrativo. Testar isolamento dos dados gravados na cópia.

## 5. Persistência JSON

`server.ts:1039` carrega JSON em memória; arquivo inválido cai em criação/gravação de demonstração. `saveDb` (`server.ts:1108`) sobrescreve arquivo diretamente, captura o erro e permite que rotas continuem respondendo sucesso. CostGuard grava outro JSON diretamente. O resolvedor G360 também pode alterar imagens de auditorias durante uma leitura. Esses são riscos de perda, sucesso falso e mutações inesperadas.

Plano mínimo, em tarefa separada: falhar sem tocar no arquivo quando a leitura/estrutura estiver inválida; distinguir explicitamente instalação vazia de base corrompida; centralizar gravação temporária + sincronização + rename e propagação de falhas; só confirmar a operação após persistência; remover gravações de rotinas de leitura. Serializar operações e manter uma única instância enquanto houver JSON em memória. Escrita atômica sozinha não resolve perda de atualizações entre múltiplos processos.

Testes exclusivamente fictícios: JSON truncado preservado byte a byte, pasta sem permissão simulada, erro de gravação/rename, interrupção antes/depois da troca, reinício, duas mutações concorrentes e restauração íntegra. Validar backup externo antes de mudar a base real; não migrar agora para PostgreSQL por conveniência.

## 6. Inicialização de produção

Repetido `NODE_ENV=test npm start` somente na cópia fictícia, para testar o carregamento sem iniciar serviços: saída **1**, `ERR_IMPORT_ATTRIBUTE_MISSING` na importação de `firebase-applet-config.json` em `src/lib/firebase-admin.ts`. Essa é a primeira falha observada agora. Corrigi-la pode revelar outros problemas de imports; não assumir que basta uma única alteração. `server.js` apenas importa o mesmo server.ts.

Menor caminho candidato: padronizar execução com o loader TS já usado no desenvolvimento, garantir que esse loader esteja nas dependências de execução e configurar NODE_ENV=production no destino. Hoje tsx está em devDependencies; `npm ci/install --omit=dev` pode removê-lo. Alternativa mais estruturada: gerar backend JS com imports/JSON compatíveis e executar o artefato compilado. Decisão coordenada com responsável por package.json/lockfile; nenhum desses arquivos foi alterado.

Aprovação futura exige instalação congelada limpa e inicialização real no modo production em cópia isolada, com build disponível, verificação de HTML estático, rota pública, login fictício e bloqueios privados; NODE_ENV=test sozinho não valida o servidor de produção. Definir encerramento limpo e verificar que não usa middleware Vite em produção.

## 7. Integração futura do OpenCode / jszip

Não foi localizado AGENTS.md, manifesto de reservas nem revisão/commit identificável do OpenCode/Antigravity neste workspace. Não é possível certificar a correção deles a partir deste checkout. Nesta etapa, nenhum arquivo existente foi editado; só foram criados estes dois arquivos de planejamento.

O estado observado ainda tem import de jszip no gerador, sem declaração em package.json/bun.lock; node_modules/jszip aponta para `/workspace/.onboarding-tools/node_modules/jszip`. Isso é complemento local, não correção reproduzível confirmada do OpenCode.

Quando o responsável fornecer o commit/diff e as reservas: revisar somente leitura; conferir dependência/versão e lockfile; separar hunk de segurança do gerador de eventual mudança de ZIP; preparar comparação sem sobrescrever arquivos dele. Validar a integração numa cópia isolada sem esse symlink, com instalação congelada, build e teste que realmente abre o ZIP exportado e confere conteúdo. Revisar o resultado antes de qualquer integração na branch de trabalho. Nenhum merge/cherry-pick/push está autorizado nesta etapa.

## 8. Ordem e critérios de aprovação

1. Confirmar divisão de arquivos e compatibilidade do transporte/proxy; consolidar os testes negativos e positivos.
2. Implementar helper de URL e integrar scanner, clone e resolvedor Maps; garantir que política negada nunca dispara alternativa externa.
3. Fazer os 12 contratos passarem e acrescentar matriz DNS/redirect/corpo/TLS. Falhas de segurança ou zero testes bloqueiam aprovação.
4. Corrigir persistência em mudança separada, com teste de recuperação e sem tocar nos dados reais.
5. Coordenar jszip/lockfile e comando de produção com OpenCode; validar instalação limpa, ZIP e servidor de produção fictício.
6. Reexecutar suíte de autenticação/permissões, tipos, build e contratos de URL. Exigir backup externo recuperável e acesso administrativo confirmado antes da futura migração autorizada.

**Não pronto para produção:** os bloqueios de URL ainda falham, a inicialização de produção falha, persistência e acesso administrativo/recuperação continuam pendentes. O plano não autoriza alterar dados, permissões, contas ou publicar.
