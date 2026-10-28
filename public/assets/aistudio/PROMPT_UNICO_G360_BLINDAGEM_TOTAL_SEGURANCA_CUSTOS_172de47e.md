# G360 BUSINESS — PROMPT MESTRE DE CORREÇÃO INTEGRAL
## Blindagem de segurança, CostGuard, APIs, dados, contratos e regressões — execução contínua no projeto existente

Atue como uma equipe sênior de engenharia de software, arquitetura cloud, segurança de aplicações, privacidade/LGPD, controle financeiro de APIs, testes automatizados e UX. Trabalhe **diretamente no projeto G360 Business já existente no Google AI Studio**. A missão é **corrigir de uma só vez, de ponta a ponta**, os problemas comprovados ou apontados pelas duas auditorias anteriores, investigar problemas associados, implementar proteção consistente, executar testes e entregar um relatório com evidências. **Não entregue apenas mais um diagnóstico ou plano**: execute as correções locais, seguras e reversíveis já autorizadas neste prompt. Não solicite confirmação entre correções normais. Trabalhe continuamente até cobrir todo o escopo ou encontrar um bloqueio real.

## 0. LIMITES DE AUTORIZAÇÃO E PRESERVAÇÃO

- Preserve o projeto G360, estrutura, CRM, dados, registros, banco, branches, histórico, identidade visual, telas, rotinas de GBP Check, Pacote GBP, imagens, sites, CNPJ, propostas, autenticação e contratos. Não recrie o aplicativo, não substitua o stack e não reescreva módulos inteiros sem necessidade.
- Antes de editar: confira diretório, Git/branch/HEAD, diff, dependências, configuração e testes disponíveis. Preserve mudanças não commitadas. Crie branch de trabalho ou checkpoint local reversível se o ambiente permitir, sem descartar nada. Faça mudanças mínimas e rastreáveis; não faça merge nem push forçado.
- **Autorizado:** examinar código e configuração, corrigir vulnerabilidades e bugs localmente, adicionar testes gratuitos com mocks, melhorar validações, middleware, tratamento de erros, contadores, logs seguros e interface pertinente. Corrija até validar, sem pedir autorização por cada mudança.
- **Não autorizado sem confirmação expressa:** publicar/deploy em produção, merge, apagar dados/coleções/tabelas/documentos, executar migrações destrutivas, editar faturamento, criar recursos cloud, ativar APIs ou planos pagos, inserir cartões, comprar créditos, enviar comunicações ou contratos reais, alterar segredos em produção, girar credenciais sem plano de continuidade, criar assinatura eletrônica própria, integrar provedor de assinatura, ou fazer chamadas reais que possam ser cobradas.
- Faça testes com **mocks/stubs locais**, ambiente isolado e sem faturamento. Se alguma melhoria exigir mudança de infraestrutura, custo, recurso inexistente ou migração irreversível, implemente apenas a parte independente que for segura e registre o restante como **BLOQUEADO — REQUER AUTORIZAÇÃO**. Isso não deve interromper o restante do trabalho.
- Não declare “R$ 0 garantido”, “juridicamente válido”, “100% protegido” ou “100% testado” sem comprovação. Não revele dados pessoais, tokens, chaves ou URLs privadas nos relatórios.

## 1. VERIFIQUE OS ACHADOS E FAÇA UM INVENTÁRIO REAL

Confira no código atual, sem confiar cegamente em nomes de arquivos/linhas ou afirmações anteriores:
- `src/server/costGuard.ts` e as rotas `GET/PUT /api/g360/cost-guard`;
- `src/server/g360Engine.ts`, `server.ts`, `src/firebase.ts`, `src/App.tsx`, `src/components/g360/G360CrmFinancePanel.jsx` e os demais arquivos realmente usados;
- caminhos que usam Gemini, geração de texto/imagem/vídeo, chat, Search/Maps Grounding, Google Places, fotos, autocomplete, details, CNPJ, Firestore, Cloud SQL, Cloud Run e fornecedores secundários;
- todas as formas de chegar às APIs, incluindo rotas antigas, duplicadas, chamadas diretas no frontend, proxy, SDK, webhooks e serviços de fallback;
- parâmetros de autenticação, sessão e autorização, variáveis de ambiente, chaves, cache, armazenamento, persistência, erros e telemetria.

Faça busca por endpoints, `fetch`, `axios`, SDKs e imports para montar internamente uma **matriz completa de rotas e dependências**: rota → método → requer autenticação? → perfil permitido → API externa → custo potencial → CostGuard aplicado? → limite → cache permitido? → teste de segurança. Não presuma que as cinco rotas citadas abaixo sejam as únicas expostas.

## 2. CORRIJA IMEDIATAMENTE A FALHA CRÍTICA DE AUTORIZAÇÃO DO COSTGUARD

A auditoria verificou `PUT /api/g360/cost-guard` retornando **HTTP 200 sem Authorization**, permitindo que um usuário anônimo alterasse `enabled`, `strictFreeMode` ou limites.

- Exija autenticação **validada no servidor**, usando o sistema de identidade existente. Não confie em `localStorage`, `role` enviado pelo cliente, cabeçalhos improvisados ou ocultação de botões.
- Autorize alterações **somente para administrador legítimo**, com papel/verificação persistente pelo backend. Se o projeto usa Firebase Auth, valide tokens assinados e sua origem/validade com o mecanismo apropriado; nunca aceite JWT não verificado. Não eleve usuários automaticamente a admin. Se não houver papel de admin seguro, bloqueie PUT por padrão e explique o requisito, em vez de liberar por conveniência.
- Proteja `GET /api/g360/cost-guard` e qualquer endpoint de métricas/configuração para impedir exposição de uso interno a terceiros; forneça somente informação necessária ao usuário autorizado.
- Valide corpo da requisição com esquema estrito e whitelist, tipos, faixas plausíveis, mínimos/máximos e rejeição de campos desconhecidos; impeça `enabled:false`, limites infinitos, valores negativos, `NaN`, strings disfarçadas, overrides por query e payloads massivos sem permissão específica. Diferencie atualização de preferências e desativação de proteção: desativação sensível deve ser explicitamente autorizada, rastreável e jamais possível para usuários comuns.
- Proteja contra CSRF quando a autenticação depender de cookie/sessão, CORS permissivo, repetição, brute force e concorrência; não utilize `Access-Control-Allow-Origin: *` com credenciais. Adote princípio de menor privilégio e logs administrativos sem PII.
- Respostas corretas: 401 sem autenticação, 403 sem privilégio, 400 para payload inválido e 200 somente para admin válido. Teste GET e PUT nas quatro condições com mocks reais da camada de autenticação.
- Em caso de erro na validação de papel, **falhe fechado** (negação segura).

## 3. TORNE O COSTGUARD CENTRAL E IMPOSSÍVEL DE CONTORNAR POR ROTAS ESQUECIDAS

- Integre CostGuard **antes da chamada externa**, numa camada compartilhada de acesso aos provedores; não dependa de cada desenvolvedor lembrar de inserir `checkLimit` manualmente em cada botão. Toda chamada faturável ou de custo incerto deverá passar pelo mesmo adaptador protegido; evite código que chame SDK diretamente por caminhos secundários.
- Corrija especificamente as rotas informadas como desprotegidas: `/api/ai/maps-grounding`, `/api/ai/search-grounding`, `/api/ai/video`, `/api/ai/chat`, `/api/places/autocomplete`, `/api/places/details/:placeId`, incluindo a rota de fotografia, busca de locais, `/api/ai/image` e qualquer outra encontrada.
- Resolva a **duplicidade de `/api/g360/cnpj-lookup`** e a rota legada que intercepta chamadas antes da versão com cache/limites. Mantenha uma única entrada efetiva ou delegação comum, preservando o contrato da API. Cubra tanto a rota antiga quanto a nova nos testes e impeça bypass por ordem de registro de rotas.
- Procure caminhos diretos no navegador que usam chaves com capacidade de cobrança e elimine a possibilidade de contornar controles do servidor. Respeite as exceções exigidas pelos SDKs de cliente, usando restrições de chave/quotas por API e origem quando necessário; não mova segredos para o browser.
- Implemente política **deny-by-default** para provedores desconhecidos ou não classificados. Operações comprovadamente locais podem executar normalmente. Uma integração “freemium” não é automaticamente gratuita: se o plano, chave, billing ou custo não puderem ser confirmados, bloqueie a chamada potencialmente cobrada no modo estrito e apresente explicação clara.
- Em falha do CostGuard ou do armazenamento de contadores, não libere requisições com possível cobrança. Evite travar indevidamente operações locais e rotinas gratuitas comprovadas.
- Nunca exponha um endpoint para o cliente escolher `cost=free` ou `provider=local` e assim burlar a classificação do servidor.

## 4. LIMITES EFETIVOS, CONTADORES DURÁVEIS E CONCORRÊNCIA

A auditoria identificou `cost-guard-metrics.json` no disco local. Isso **não é persistência confiável em Cloud Run** e pode divergir entre réplicas.

- Use o mecanismo persistente **já existente e autorizado** (por exemplo Firestore ou banco já conectado), se apropriado e sem contratação de novo recurso. Reutilize esquema e credenciais existentes com menor privilégio; não crie Cloud SQL, Storage ou qualquer novo serviço sem autorização. Se o backend disponível não suportar contador atômico e persistente, bloqueie chamadas com custo incerto em ambiente de múltiplas instâncias e documente a limitação: não declare proteção completa com JSON no disco.
- Contadores devem funcionar entre reinício, múltiplas instâncias, usuários e requisições paralelas, com operações **atômicas/transacionais** para reservar cota antes de chamar o provedor. Implemente política clara para reserva, sucesso, erro, timeout e cancelamento; nunca libere cota de uma chamada já cobrada apenas porque ocorreu falha de resposta.
- Limites separados por usuário/organização, rota, provedor, modelo/SKU e global. Tenha limites por minuto, dia, mês, concorrência e operações caras (imagem/vídeo/grounding); regras conservadoras e configuráveis só pelo administrador, sem inventar valores monetários como se fossem preços reais.
- Normalize fusos e janelas de tempo, use relógio do servidor/UTC, trate virada de dia/mês, race condition, vários cliques, requisições em lote e bursts. Não dependa do relógio do navegador.
- Implemente idempotência para operações com efeito colateral e deduplicação de chamadas iguais simultâneas; nunca misture resultados entre clientes, usuários ou permissões. Desabilitar botão no frontend é complemento, não defesa principal.
- Limite tamanho de entrada/saída, duração, tokens, contexto, arquivos, timeout, retries com backoff **finito** e custo máximo por solicitação. Não execute retry infinito nem tentativa automática de outro modelo potencialmente pago.
- Respostas padronizadas sem expor segredos: 429 para limitação, 503 quando proteção não está disponível ou 402/403 se a política de produto justificar, com mensagem compreensível e próximo passo. Preserve rastreabilidade dos erros no servidor.
- Logs de contagem e consumo sem registrar prompts sensíveis, documentos, CPF, chaves, tokens nem imagens particulares. Métricas agregadas para administrador, sem simular valor de fatura.

## 5. PREÇOS REAIS, GRATUIDADE, CHAVES E FATURAMENTO

- **Corrija informação desatualizada:** desde março de 2025 o Google Maps Platform substituiu o antigo crédito recorrente de US$ 200 por **franquias gratuitas por SKU**; verifique a documentação oficial atual e o projeto real. Não implemente um cálculo baseado em US$ 200/mês.
- Gemini tem limites por modelo/projeto e modalidades de cobrança distintas; não confunda limites RPM/TPM/RPD com limite de gasto. Consulte o status real quando houver acesso de leitura autorizado. Não presuma que chave criada no AI Studio sempre seja gratuita.
- Identifique o que é faturado fora da aplicação: Cloud SQL (instância/armazenamento), Cloud Run (execução/rede), Firestore (conforme plano/cotas), Cloud Storage, logs, egress, serviços parceiros e qualquer outro recurso realmente provisionado. **CostGuard não controla esses custos fixos/indiretos.**
- Verifique se chaves Google Maps possuem restrições por **API e aplicação**, segregando chaves públicas de SDK e chaves privadas do servidor; verifique abuso, chaves órfãs e permissões excessivas. Não altere chaves/console/iam/billing sem autorização: deixe instruções exatas para configuração manual quando indispensável.
- Remova credenciais e dados sensíveis do bundle, Git e logs **apenas por procedimentos seguros e autorizados**, sem apagar histórico ou quebrar serviços. Caso haja exposição atual, bloqueie uso da credencial comprometida apenas se a ação puder ser feita com segurança e autorização; caso contrário, destaque urgência e rota de correção.
- Quotas do provedor, orçamentos e alertas de Billing são **camadas complementares**; alertas não constituem corte automático garantido. Caso não seja possível conferir o console, marque `FATURAMENTO NÃO VERIFICADO`. Forneça checklist do Google Cloud Billing, Cloud SQL/Run, APIs e Google AI Studio, sem dizer que o custo é zero.
- Mantenha modo gratuito como preferência conservadora: não faça chamada remota com custo incerto sem liberação expressa. Uma chamada gratuita segundo o provedor pode contar para a cota ou mudar de preço no futuro.

## 6. FALLBACKS: NÃO TROQUE ECONOMIA POR RESULTADOS FICTÍCIOS OU BAIXA QUALIDADE

- Audite o fallback relatado de `/api/ai/image` (Flux/Pollinations ou SVG), `/api/g360/audit` e geração determinística do GBP. Verifique se cada alternativa existe, está acessível, tem uso permitido/licença compatível, limites e qualidade real. Não prometa “gratuito para sempre”, “fotografia em alta resolução” ou “100% realista” sem testes/termos do provedor.
- **Nunca apresente SVG ilustrativo ou imagem gerada como fotografia real de produto, loja, equipe ou serviço.** Indique “Imagem ilustrativa” quando apropriado e peça foto original quando necessário. Não invente produtos, clientes, resultados ou evidências comerciais.
- Se não houver provedor autorizado de imagens disponível, mostre “Geração indisponível no modo gratuito” e ofereça copiar o prompt de imagem para ferramenta externa. **Não gere substituto falso ou arquivo vazio fingindo sucesso.**
- Preserve o padrão do `@pacote-gbp` já definido: descrição com **750 caracteres exatos**, **20 serviços** com **300 caracteres exatos** por descrição, **6 a 8 produtos reais confirmados** com **1.000 caracteres exatos** por descrição, **10 publicações informativas + 1 publicação de oferta** com **1.500 caracteres exatos** cada, 20 termos locais fundamentados e validação automática de contagem. Respeite a ausência de produtos reais: **não invente** para completar quantidade; sinalize pendência.
- Caso o fallback determinístico não consiga atender qualidade, contagem ou verdade factual, **não marque o pacote como concluído**. Informe pendências e preserve o conteúdo já válido. Não confunda pontuação interna do GBP Check com métricas oficiais do Google.
- Preserve `@pacote-site`: planejamento baseado no tipo de negócio, imagens reais preparadas antes do desenvolvimento, SEO técnico, performance mobile, testes, links, exportação e publicação somente autorizada.

## 7. CONFIDENCIALIDADE E DADOS PESSOAIS

- A auditoria anterior retirou CPF/RG/endereço fixos do frontend, mas os dados reais do prestador continuam em `localStorage` (`g360_contract_provider`). Isso é armazenamento legível por scripts do mesmo domínio e não equivale a cofre privado.
- Inspecione XSS (dados de cliente/CNPJ, descrições, HTML carregado de arquivos, templates de contrato, `dangerouslySetInnerHTML`, URLs compartilhadas, impressão HTML), controle de acesso e vazamento de dados. Escape/sanitize HTML de maneira apropriada, com testes de payloads maliciosos; evite aceitar HTML ativo arbitrário nos uploads de contrato. Corrija injeções com abordagem compatível com o projeto.
- Evite guardar CPF, RG, tokens e documentos em `localStorage`, query strings, logs e mensagens públicas. Se já houver persistência autenticada e adequada no servidor, implemente migração **não destrutiva e com consentimento claro**, respeitando titularidade e backup. Não crie serviço de armazenamento novo nem migre/remova dados automaticamente se houver risco de perda, privacidade, cobrança ou alteração irreversível.
- Enquanto não houver armazenamento seguro aprovado, remova gravação automática de novos dados sensíveis no browser quando possível sem perda dos existentes, explique a limitação na UI e forneça alternativa temporária segura. Não declare LGPD “100% atendida”.
- Verifique autenticação de todas as rotas de CRM, CNPJ, propostas, contas, armazenamento, geração de site e auditorias com dados de clientes; revise IDOR (um usuário acessando dados de outro por ID), permissões e exposição de erros. Use validação server-side, escaping e políticas de segurança de conteúdo viáveis.
- Mantenha coleta mínima e finalidade justificada; cuidado com logs contendo IP ou documentos. Não adicione ferramentas invasivas, rastreamento extra ou serviços de terceiros sem autorização.

## 8. CONTRATOS: INTEGRIDADE SEM SIMULAR ASSINATURA

- Mantenha a correção da Etapa 1: “Minuta de contrato — aguardando assinatura”, sem selo GOV.BR falso, código aleatório, ou função que permite ao consultor certificar a assinatura unilateralmente.
- **Não implemente agora sistema próprio de assinatura ou API comercial**, nem mude contratos históricos/estado do CRM sem autorização específica. Se for preciso aceitar arquivo assinado externamente, primeiro analise como validar o documento; anexar um PDF não prova automaticamente sua validade.
- Diferencie corretamente: criado, baixado, compartilhado, aguardando assinatura, assinado externamente verificado. Não trate envio por WhatsApp, clique, print, hash isolado ou geração de PDF como assinatura concluída.
- Revise templates jurídicos para não incluir afirmações falsas ou garantias universais de validade. Não reescreva termos contratuais de negócio além das correções de apresentação e segurança já autorizadas; sinalize necessidade de revisão jurídica para cláusulas materiais.
- Corrija XSS/injeção nos contratos e vazamentos em parâmetros de URL. Preserve minutas existentes, preenchimento, impressão, propostas e histórico.

## 9. INTERFACE E VISIBILIDADE HONESTA

- Adicione ou ajuste o painel atual de configuração do CostGuard, **apenas para admin autenticado**, sem redesenhar o G360: modo estrito, estado de serviços, limites, bloqueios, contadores persistentes, último erro e explicação simples. Se não houver painel existente, faça a menor interface necessária e reversível.
- Para usuários comuns, mensagens simples: “Limite de uso atingido”, “Recurso indisponível no modo gratuito”, “Serviço temporariamente indisponível”; sem mostrar segredos, endpoint interno, stack trace ou promessas de custo zero.
- A interface não pode mostrar sucesso se o backend negou, se a imagem veio vazia, se os caracteres não batem ou se o contrato não foi assinado. Estados: carregando, concluído, falhou, bloqueado, aguarda informação/aprovação.
- Não altere visual/layout de GBP, CRM, contratos e sites além do essencial para segurança/clareza.

## 10. TESTES EXAUSTIVOS SEM CONSUMIR CRÉDITOS

Crie/execute testes automatizados e inspeções de comportamento reais, com mocks de APIs externas. Inclua casos positivos, negativos, de concorrência e de recuperação:

**Acesso:** GET/PUT CostGuard sem token=401; usuário normal=403; admin=sucesso; token expirado/falso, role forjada, CORS/CSRF, payload inválido, campo não permitido, tentativa de desativar sem autorização, vazamento de métricas.

**Cobertura de rotas:** Gemini (chat, imagem, vídeo, grounding e quaisquer modelos usados), Places (busca, autocomplete, details, fotos), CNPJ (inclusive rota legada), serviços opcionais; testes que falhem se nova rota com custo for criada sem guardião.

**Limites e persistência:** paralelo de 50/100 requisições, limites na mesma janela, reinício de processo, duas instâncias simuladas, virada do dia/mês, erros/timeout/retry, falha do banco, cache contaminado entre clientes, dupla cobrança/contagem e reserva atômica. Se multi-instância não puder ser comprovada, reporte como pendente e bloqueie caminho pago por segurança.

**Modo estrito:** API potencialmente cobrada bloqueada se custo ou billing for desconhecido; operação local continua; fallback gratuito somente se comprovadamente disponível e permitido; resposta correta sem sucesso inventado.

**Segurança:** entradas HTML maliciosas, upload de template, consulta CNPJ, dados de cliente, IDs de outro usuário, tokens em URL, segredos no bundle e log, session/token inválido, armazenamento local sensível.

**Regressão do produto:** autenticação, CRM, criação/edição de leads, CNPJ, propostas, minutas, download/impressão, compartilhamento WhatsApp, GBP Check, `@pacote-gbp` com contagem **exata**, geração/cópia de prompts de imagens, `@pacote-site`, prévia, exportação e demais telas; simule respostas externas quando necessário para não gastar.

Execute comandos existentes de lint, typecheck, build e testes e verifique se a interface sobe no ambiente local. Não diga que “foi testado” se apenas leu o código. Não use serviços pagos como testes; registre testes que exigem ambiente externo como não executados.

## 11. REGRAS DE QUALIDADE DE IMPLEMENTAÇÃO

- Mudanças pequenas por módulo, sem reescrita ampla, sem dependências pagas. Novas dependências gratuitas só se necessárias, compatíveis e verificadas; preserve lockfile e versões.
- Middleware único e reutilizável de autenticação/roles; adaptador único para chamadas com custo; fonte única para configuração; prevenção de rotas duplicadas; APIs tipadas/validadas; tratamento consistente de erro.
- Garanta ausência de race conditions e tratamento de falha de infraestrutura; evite bloqueio global ao carregar o app. Nunca libere chamadas externas no erro para “não quebrar a experiência”.
- Respeite políticas de cache/armazenamento dos provedores, especialmente Google Maps Places; dados de terceiros não podem ser armazenados indefinidamente sem base ou autorização contratual.
- Não invente planos/cotas/preços/modelos. Se não puder confirmar, rotule como não verificado e aplique política conservadora.
- Mantenha separação entre desenvolvimento e produção. Nada de deploy automático, push/merge ou mutação de GCP/Billing.

## 12. CRITÉRIOS DE CONCLUSÃO E RELATÓRIO — EXECUTE TUDO, NÃO PARE NA PRIMEIRA TAREFA

Considere concluído apenas se:
1. Rotas administrativas não possam ser usadas anonimamente ou por usuários sem privilégio.
2. Todas as saídas potencialmente cobradas estejam cobertas pelo mesmo guardião ou bloqueadas de modo seguro, sem bypass.
3. Limites persistam e resistam à concorrência no ambiente de execução efetivo **ou** o risco esteja bloqueado e declarado pendente de infraestrutura aprovada.
4. Falsas assinaturas permaneçam desativadas, nenhum contrato seja marcado como assinado por compartilhamento e nenhum dado antigo seja apagado.
5. Dados pessoais e segredos não estejam expostos por novos fluxos; limitações legadas sejam documentadas claramente.
6. Fallbacks não mintam sobre custo, qualidade, origem ou conclusão de pacotes/imagens.
7. Ferramentas essenciais permaneçam funcionais, com bloqueios somente onde a segurança ou modo de custo realmente exigir.
8. Testes unitários, integração, segurança, build e regressão executáveis passem; falhas sejam corrigidas e retestadas.

Entregue **um único relatório final**, objetivo mas comprovável, contendo:
- Arquivos/funções modificados, por problema; quais achados não se confirmaram.
- Quadro “ANTES → DEPOIS” para segurança do CostGuard, rotas de Gemini/Places/CNPJ, persistência, dados pessoais, contratos e funcionamento geral.
- Tabela de **todas** as rotas com custo (coberta/bloqueada/pendente), resultado de autenticação e testes.
- Controles de custo realmente implementados, o que é cota estimada, o que NÃO pode ser garantido, e custos cloud ainda fora do CostGuard.
- Testes: nome, comando, resultado e evidência, inclusive falhas e não executados.
- Mudanças pendentes por dependerem de credenciais, console, custo, autorização ou infraestrutura.
- Resultado final: `SEGURO PARA TESTES LOCAIS`, `BLOQUEADO PARA PRODUÇÃO` ou `PRONTO PARA REVISÃO DE PUBLICAÇÃO`, com justificativa. Jamais declare produção aprovada por conta própria.

**EXECUTE AGORA TODAS AS CORREÇÕES LOCAIS SEGURAS E REVERSÍVEIS, UMA APÓS A OUTRA, SEM ME SOLICITAR AUTORIZAÇÃO ENTRE ELAS. CORRIJA FALHAS DOS TESTES E REPITA A VALIDAÇÃO. NÃO PUBLIQUE, NÃO CONTRATE E NÃO ALTERE RECURSOS CLOUD SEM MINHA APROVAÇÃO. SÓ RETORNE AO FINAL COM RESULTADOS REAIS E PENDÊNCIAS CONCRETAS.**
