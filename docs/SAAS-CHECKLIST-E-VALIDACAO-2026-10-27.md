# G360 Business — preparação SaaS e validação de segurança

Data: 27/10/2026. Branch de trabalho: `codex/auditoria-g360`.

Este relatório distingue preparação local de integração comercial. Nenhuma conta real foi recuperada, nenhum contrato foi enviado, nenhum pagamento foi criado e nenhuma publicação foi feita. As alterações anteriores não commitadas foram preservadas. A confirmação inicial do usuário autorizou código reversível e testes fictícios, não migrações ou operações reais.

## Checklist das etapas

| Etapa | Implementado | Testado | Parcialmente validado | Bloqueado | Pendente |
| --- | --- | --- | --- | --- | --- |
| 1. Segurança existente | Autenticação, XSS e SSRF preservadas | Suíte anterior e proxies controlados | Compatibilidade com o proxy operacional | Nenhum teste de serviço interno real permitido | Homologação do proxy de produção |
| 2. Persistência | Escrita atômica, conflitos, falhas explícitas; exportação e restauração em arquivo novo | Corrupção, permissões, disco, interrupção, concorrência, recuperação fictícia | Backup em diretório separado na mesma máquina | Aplicação de recuperação em base real | Cópia externa independente protegida e exercício operacional |
| 3. Autenticação | Origem/CORS, limite de tentativas, entradas limitadas, contas inativas e verificação Firebase com revogação | Login, permissões e recuperação administrativa exclusivamente fictícia | Autenticação Firebase sem serviço real; limite local ao processo | Redefinir senha administrativa real | Identificação comprovada, janela de manutenção e autorização; entrega segura para recuperação remota |
| 4. Arquitetura SaaS | Isolamento existente e correção de conflito SQL entre proprietários; cadastro validado | Contas distintas e geração de SQL sem acesso ao banco real | JSON para instância única e catálogo de planos | Migração estrutural real | Preços, benefícios, cotas por conta, assinaturas efetivas e sessões compartilhadas |
| 5. Escritório | Clientes, vínculo explícito de sites, contratos, vencimentos, histórico e avisos sem envio | Autorização, persistência, estados e isolamento | Metadados locais de publicação; financeiro simulado | Mensagens, alterações e cobranças reais | Interface Antigravity; autorização para cadastrar informações reais |
| 6. Contratos | Versões, snapshot, hash SHA-256, revisão/aprovação, documento em texto e fila interna sem envio | Isolamento, integridade, download versionado e assinatura fictícia | Hash demonstra integridade local; não comprova identidade nem tempo confiável | Enviar/assinar contrato real ou contratar provedor | Modelo jurídico revisado, escolha e homologação do provedor, consentimento e pacote de evidências |
| 7. Pagamentos | Simulador independente com HMAC, corpo original, prazo, idempotência, valores e transições | Eventos fictícios; nenhum endpoint financeiro público ativado | Comparação documental de provedores | Conta de comerciante, cobrança e utilização de créditos pagos | Decisão comercial, sandbox oficial acessível, adapter específico e reconciliação persistente |
| 8. APIs e dados | Inventário; status administrativo sem chaves/saldos inventados; retirada de tokens das respostas e da chave no redirecionamento de fotos | Origem, autorização e transportes simulados | Política histórica de custos não cobre todos os provedores/caminhos | Atestar gratuidade ou consumir serviços pagos | Gestão central de segredos; cotas por conta; revisão OAuth/Firestore; comprovação de custos |
| 9. Inicialização | Loader TypeScript de produção, import JSON explícito, validação Firebase, porta/build e erros seguros; JSZip declarado | Instalação limpa, análise de tipos, build e HTTP local de produção com base fictícia | Node 24.19 validado; outras versões não homologadas | Publicação não autorizada | Infraestrutura, HTTPS, origem confiável, monitoramento e segredos operacionais |
| 10. Integração | Executor isolado reproduzível e testes adicionais | Resultados consolidados abaixo | Serviços reais e validade jurídica não homologados | Produção até resolver os bloqueios | Revisão final independente e aceite comercial/jurídico |

## Implementações desta etapa

- `server.ts`: integração do Escritório e inventário administrativo; política de origem e tentativas; login/cadastro; recuperação remota responde indisponível em vez de sucesso fictício; publicação pública omite metadados privados e conteúdo suspenso; erro SQL de proprietário retorna 409; erros de API sanitizados; inicialização validada.
- `src/middleware/auth.ts`: conta inativa deixa de usar sessão; Firebase exige e-mail verificado, consulta revogação e respeita bloqueio local quando a identidade existe. Nenhuma função ou claim real foi alterada.
- `src/db/users.ts`: atualização por conflito exige o mesmo proprietário na própria instrução SQL. Logs de erro não incluem objetos potencialmente sensíveis.
- `src/lib/firebase-admin.ts`: import JSON com atributo e projeto explícito validado; ausência/configuração inválida falha sem selecionar projeto implícito.
- `src/server/g360Engine.ts`: tokens de deploy não são retornados ao navegador; novas credenciais não são aceitas em configuração JSON comum; cadastro administrativo valida tamanho, senha e e-mail duplicado. Tokens já existentes continuam preservados no arquivo e exigem tratamento separado autorizado.
- `src/server/authPolicy.ts`: validação, origem explícita e limite local de tentativas sem confiar em `X-Forwarded-For` enviado pelo cliente.
- `src/server/office.ts`: seção opcional `office` criada somente por mutação explícita; nenhum preenchimento de demonstração em GET, nenhuma atribuição automática de projetos antigos. Associação de site exige proprietário compatível e vínculo explícito. Simulações exigem ambiente de teste e opção não habilitada no aplicativo normal.
- `src/server/paymentSimulation.ts`: ferramenta exclusivamente de teste, sem transporte de gateway ou registro financeiro de produção.
- `src/server/integrationRegistry.ts`: metadados administrativos sem valores de credenciais; crédito desconhecido permanece desconhecido. Substituição de segredo é por ambiente seguro e reinício, sem migração automática.
- `src/server/googlePhoto.ts`: recurso e tamanho restritos, API fixa, chave em cabeçalho, redirecionamento remoto desativado, limite de tempo e resposta; navegador recebe somente URL HTTPS do CDN permitido sem credenciais.
- `scripts/backup-json.mjs`: exportação verificável e restauração somente em novo arquivo privado fora do checkout. Não exclui nem sobrescreve destino existente.
- `scripts/test-isolated.mjs`: copia fontes para `/tmp`, exclui bases e ambientes reais, cria dados fictícios e executa os testes com ambiente restrito.
- `package.json` e `bun.lock`: `npm start` utiliza `tsx` como dependência de produção; `jszip@3.10.1` declarado para eliminar a instalação manual externa. Não foi alterado o código de exportação do OpenCode.

Testes novos: `src/db/users.test.ts`; `src/server/adminRecovery.test.ts`, `authPolicy.test.ts`, `office.test.ts`, `paymentSimulation.test.ts`, `integrations.test.ts`, `saasSecurity.test.ts`, `startup.test.ts`; `scripts/backup-json.test.mjs`.

Documentos de apoio: `AUDITORIA-APIS-E-AUTENTICACAO.md`, `BACKUP-EXTERNO-E-RECUPERACAO.md`, `CONTRATOS-PAGAMENTOS-DECISOES.md`, `ESCRITORIO-G360-BACKEND.md`.

## Validação

A execução inicial repetiu os **136 testes anteriores: 136 aprovados, zero falhas e zero ignorados**, em `/tmp/g360-baseline-clngutc5`. Essa cópia também serve de referência para comprovar a preservação dos arquivos críticos de SSRF e persistência.

A execução ampliada inicial aprovou 199 testes. A suíte final inclui os testes adicionais de vínculo explícito de sites, download contratual, erros de API e limitação real do login: **203 aprovados, zero falhas e zero ignorados**, exit 0, em aproximadamente 30 segundos.

| Grupo | Testes aprovados |
| --- | ---: |
| Suíte anterior: SSRF, persistência e segurança existente | 136 |
| Políticas de autenticação | 7 |
| Isolamento SQL | 2 |
| Recuperação administrativa fictícia | 6 |
| Backup e restauração offline | 15 |
| Escritório e contratos | 11 |
| Simulador de pagamentos | 4 |
| Status de integrações e fotos sem segredo | 4 |
| Segurança HTTP adicional | 8 |
| Inicialização | 10 |
| **Total** | **203** |

Logs locais da execução: `/tmp/g360-final-tests.log`, `/tmp/g360-final-lint.log`, `/tmp/g360-final-build.log`. Os diretórios temporários são descartáveis e podem não existir em outra sessão; o executor permite reproduzir os testes.

Comando reproduzível: `node scripts/test-isolated.mjs`. Não executar testes históricos que importam o servidor diretamente contra o checkout com dados originais.

Instalação limpa com `bun install --frozen-lockfile --ignore-scripts`: 548 pacotes, sem o antigo symlink de JSZip e sem `.env` ou banco original, em `/tmp/g360-full-clean-8_l2kp6r`. `npm run lint` e `npm run build` passaram. `npm start` foi iniciado com build real e dados/configuração fictícios: página inicial 200; API privada sem autenticação 401; banco e backup por HTTP 404; hash da base fictícia preservado. Não equivale a deploy.

`npm run lint` executa `tsc --noEmit`; não existe etapa ESLint configurada nesse script. O build conserva avisos preexistentes de bundle grande, `__dirname` no Vite e importação Firebase estática/dinâmica. Não foram alteradas as interfaces para resolver esses avisos.

Verificação final: `npm run lint` exit 0, `npm run build` exit 0 e `git diff --check` sem problemas. `HEAD` e `origin/main` continuam em `5190b4b8f6ac80eda6fe565e228eb740251ea165`; não existe branch local `main` neste checkout. O trabalho está não commitado no checkout de `codex/auditoria-g360`, sem mudança de referências ou publicação. Não houve alteração do `db.json` original ou das métricas originais. A comparação de bytes com a cópia inicial confirmou que `publicUrl.ts`, seus testes e contrato SSRF, `jsonPersistence.mjs`, a correção XSS e `AuthPage.jsx` foram preservados nesta etapa. Nenhum arquivo visual do Antigravity foi alterado.

## Bloqueios e riscos restantes

1. **Acesso administrativo real:** a conta legada pode continuar sem login por usar senha antiga incompatível. A simulação comprova o procedimento, mas não autoriza sua aplicação real. Reiniciar perde sessões em memória; nenhuma manutenção real deve começar sem recuperação aprovada e backup independente validado.
2. **JSON:** instância única recomendada. Lock abandonado e estado incerto exigem inspeção; não há limpeza ou restauração automática. Backup local ou em outro diretório da mesma máquina não protege contra perda física. O arquivo e o backup contêm informações sensíveis; Base64 não é criptografia.
3. **Assinatura:** não há assinatura eletrônica real, envio de links nem documento assinado por provedor. SHA-256 não é assinatura do cliente. A interface atual `DigitalContract.tsx` ainda contém alegações indevidas de assinatura/validade com identificador aleatório e precisa de correção pelo Antigravity antes do uso comercial. WhatsApp ou e-mail entregam links, não comprovam assinatura.
4. **Jurídico/LGPD:** modelo contratual, modalidade de assinatura, evidências, retenção, privacidade, fornecedores e resposta a incidentes precisam de revisão adequada ao negócio. Fontes oficiais estão referenciadas, mas o ambiente não permite consultar os destinos jurídicos e de gateways; não foi alegada verificação atual de leis, tarifas ou planos gratuitos.
5. **Pagamentos:** não existe integração operacional confirmada com Efí ou outro gateway. O simulador não substitui sandbox oficial. Faltam decisões comerciais, credenciais de teste autorizadas, adaptação ao método de webhook do provedor, persistência de eventos e reconciliação. Nenhum plano ou cobrança foi ativado.
6. **Custos/APIs:** `strictFreeMode` histórico não comprova gratuidade nem impede todos os caminhos de cobrança. Alguns SDKs/fallbacks não usam reserva anterior à chamada. Não se deve liberar chamadas externas comerciais até uniformizar essa política, contabilizar por conta e comprovar os limites do provedor. Nenhum teste usou crédito ou serviço externo de IA.
7. **Segredos:** valores preexistentes em JSON e chaves geridas no frontend/Firestore não foram migrados ou apagados. O backend deixa de devolver tokens de deploy e bloqueia novas gravações por essa rota, mas armazenamento de segredos externo e rotação exigem plano autorizado. Revisar escopos OAuth amplos com AI Studio/Antigravity.
8. **Planos/Firestore:** catálogo do Escritório é preparatório; não ativa benefício pago nem limita contas antigas automaticamente. `users.plan` do Firestore é editável pelo próprio usuário e não pode ser autoridade de cobrança/permissão. Regras remotas não foram publicadas. Faltam política de planos e limites server-side aprovados e homologados.
9. **SQL:** isolamento testado por SQL gerado e transporte simulado; falta PostgreSQL descartável antes de ligar a integração real. Não houve alteração estrutural ou conexão com banco real.
10. **Dependências:** `bun audit --json` consultou o registro gratuito e identificou dois avisos para `@grpc/grpc-js@1.9.16` transitivo de `@firebase/firestore` (alto GHSA-m9gg-hp2v-232j; baixo GHSA-f596-whhp-79r4; versões corrigidas a partir de 1.13.6) e um moderado de `esbuild@0.18.20` via ferramentas de desenvolvimento (GHSA-67mh-4wv8-2f99). Não há prova de exploração neste aplicativo. Atualizar o SDK ou impor versão fora do intervalo do fornecedor exige testes de compatibilidade Firebase; não foi feita atualização ampla às cegas. Não expor servidores de desenvolvimento.

## Coordenação

Antigravity recebe contrato da API em `ESCRITORIO-G360-BACKEND.md`: consumir estados reais, 409/503, assinatura não entregue e ausência de saldo conhecido; corrigir a simulação visual de assinatura antes de comercializar. Nenhuma interface foi alterada nesta etapa.

OpenCode: exportação preservada; JSZip agora declarado de forma reproduzível. Manter os acessos a URL pelo cliente seguro compartilhado e escritas JSON pelo armazenamento atômico. AI Studio: prompts e geração preservados; alinhar privacidade e política de custo antes de ativar provedores.

As instruções foram documentadas no repositório; não foram enviadas mensagens externas a outros serviços ou pessoas.

## Aprovação necessária antes de operações reais

- [ ] Comprovar titularidade administrativa e autorizar separadamente a recuperação.
- [ ] Criar e verificar backup em armazenamento independente protegido, restaurando uma cópia antes de tocar no original.
- [ ] Aprovar preços, limites e isolamento comercial; homologar interfaces com estados reais.
- [ ] Revisar contrato, consentimento, evidências e retenção com apoio jurídico adequado.
- [ ] Escolher e homologar provedores e sandbox; verificar tarifas e gratuidade sem consumir saldo pago.
- [ ] Resolver política de saída/custos, segredos e dependências; validar proxy e integrações em ambiente controlado.
- [ ] Completar revisão independente de segurança, recuperação e implantação. Publicação exige autorização própria.

**O projeto não está declarado pronto para produção ou comercialização.**
