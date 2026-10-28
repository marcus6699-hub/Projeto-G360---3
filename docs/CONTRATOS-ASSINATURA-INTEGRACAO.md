# Contratos, assinatura e pagamentos — revisão para integração

Data: 27/10/2026. Branch conferida: `codex/auditoria-g360`.

Inspeção estática do código disponível, sem alterar interfaces, executar envio, criar cobrança ou consultar contas reais. Este documento complementa e precisa a leitura dos relatórios anteriores: **os dois componentes antigos que simulam assinatura não estão montados no fluxo atual identificado**. Isso não comprova inexistência de problemas em outras versões dos agentes ou em uma implantação externa.

## Conclusão sobre a interface

O fluxo ativo de contrato encontrado é `/` → `App.tsx` → `Studio.jsx` → visão `crm` → `G360CrmFinancePanel.jsx` → subvisão `contract`. Nesse fluxo, o contrato é apresentado como **minuta aguardando assinatura externa**, e o botão informa que a assinatura eletrônica não está configurada. Não foi encontrada conversão de aprovação interna do novo backend em assinatura eletrônica nessa interface; ela ainda não consome `/api/office`.

Portanto, a afirmação verificável é: **no fluxo ativo identificado por inspeção, a minuta não é apresentada como assinatura concluída; existem componentes legados não montados com afirmações indevidas que não podem ser reativados sem correção**. Esta revisão não é um ensaio visual completo em navegador, não examina a versão de outras branches e não certifica validade jurídica.

| Evidência no código | Resultado |
| --- | --- |
| `src/App.tsx:30` | Rotas `/login`, `/site/:slug` e `/`; não existe rota pública de assinatura nem tratamento de `?contrato_digital=` no código encontrado. |
| `src/pages/Studio.jsx:438` | Visão CRM monta `G360CrmFinancePanel`. Os dois `DigitalContract.tsx` não têm importação/montagem encontrada nas fontes atuais. |
| `src/components/g360/G360CrmFinancePanel.jsx:374` | Link de assinatura só vem de `externalSignatureUrl`; não gera comprovante ou identidade de signatário. |
| Mesmo arquivo, linha 418 | Botão chama aviso de assinatura eletrônica ainda não configurada. |
| Mesmo arquivo, linha 558 | Texto preparado para WhatsApp diz “Minuta” para conferência; abertura do WhatsApp não comprova entrega ou aceite. Nenhum envio foi executado nesta revisão. |
| Mesmo arquivo, linha 624 | Documento HTML baixado informa minuta aguardando assinatura das partes. O botão menciona PDF, mas o arquivo produzido é `.html`, que pode ser impresso posteriormente. |
| Mesmo arquivo, linha 902 | Card de etapa “fechado” explicita “Assinatura externa não verificada”; etapa CRM não confirma assinatura. |
| Mesmo arquivo, linhas 1453 e 1466 | Status “Minuta de Contrato (Aguardando Assinatura)” e “Minuta Pronta — Aguardando Assinatura Externa”. |
| Mesmo arquivo, linha 1565 | Prévia exibe “Minuta de Contrato” e “Assinatura Externa Pendente”. |
| `src/server/office.ts:127` | Aprovação administrativa produz `approved`, sem gerar status de assinatura real. |
| Mesmo arquivo, linha 132 | Solicitação gera `awaiting_provider`, `delivered:false` e bloqueio por provedor não configurado. |
| Mesmo arquivo, linha 145 | Assinatura fictícia só no ambiente de teste com opção explícita; usa `simulated_signed` e `legalSignature:false`. |

### Componentes legados: risco latente

- `src/components/DigitalContract.tsx:60`: gera identificador com `Math.random`, chama `setSigned(true)` antes de persistir e prepara mensagens como se o documento estivesse assinado. Linha 71 tenta gravar `signed_contracts` no Firestore; as regras locais atuais não abrem essa coleção. Uma falha de gravação não desfaz o estado visual. Linhas 267 e 320 apresentam assinatura/disparo concluídos e afirmação ampla de validade/título executivo.
- `src/components/g360/DigitalContract.tsx:93`: outro identificador aleatório é apresentado como hash/carimbo válido. Linha 75 fabrica link `?contrato_digital=...&token=...`, sem jornada pública correspondente encontrada. Linhas 115 e 203 usam o booleano local para afirmar assinatura em mensagens. A função Gmail na linha 167 pode enviar comunicação real caso esse componente seja montado e o usuário possua token; não foi executada. Linha 531 contém alegação jurídica ampla.

Nenhum desses arquivos foi alterado ou apagado. Antigravity deve preservá-los como código inativo até corrigir/remover suas afirmações e adaptar o fluxo; não basta conectá-los à API nova. Não publicar alegação de “hash criptográfico”, “carimbo de tempo”, “assinado” ou “título executivo” baseada no identificador local.

### Pendências do fluxo ativo para Antigravity

1. Integrar o estado do backend por contrato e versão: `draft`, `review`, `approved`, `awaiting_provider`, `canceled`. `simulated_signed` deve ser explicitamente fictício e jamais interpretado como assinatura real.
2. Manter o conteúdo e o snapshot aprovados congelados, associar a versão aos bytes enviados ao provedor e apresentar `delivered:false` como não enviado. O documento baixado pelo backend é texto UTF-8, não PDF jurídico aprovado.
3. Receber status real somente de evento autenticado e conciliado no backend; não de booleano local, parâmetro de URL, etapa CRM, upload arbitrário ou retorno do navegador.
4. Validar o link externo como HTTPS e de provedor aprovado. O campo atual é texto livre; escape HTML impede injeção de marcação, mas não comprova protocolo/destino/identidade do serviço. Não coletar senha gov.br nem apresentar um link arbitrário como assinatura verificada.
5. Rever textos de conformidade automática e distinguir minuta, documento assinado, evidência, validade do contrato e eventual executividade. Referenciar lei não substitui análise do método ou do caso.
6. Testar em navegador todos os estados, falhas de gravação, conteúdo hostil, logout/mudança de conta e confirmação de destinatários. Nenhum envio real automático deve ocorrer para demonstrar esses estados.

## O que falta para assinatura eletrônica real

O backend atual tem rascunhos, versões, hash, revisão e fila local; não tem autenticação do signatário, instrumento final assinado, carimbo independente, integração de assinatura, recepção verificada de eventos, pacote de evidências ou retenção externa homologada.

Requisitos mínimos do método escolhido:

- Modelo revisado, partes e poderes de representação, obrigações, preço, vigência, cancelamento e manifestação de vontade sobre o conteúdo exato.
- Método de identificação/autenticação adequado ao risco e ao contrato; escopo jurídico analisado para MP 2.200-2/2001, Lei 14.063/2020, Código Civil, CPC e LGPD, sem promessa de validade universal.
- Envelope ligado ao tenant, contrato, signatários e versão/hash; original e final preservados sem reescrita; status não declarado pelo cliente.
- Eventos conforme protocolo do fornecedor, autenticados, idempotentes e conciliados; downloads de documentos com destino controlado e proteção SSRF.
- Evidências exportáveis e verificáveis, auditoria com minimização de dados, retenção e acesso definidos, backup protegido e restauração conjunta de documentos/evidências.

### Alternativas e custos

Não houve consulta externa nova a tarifas ou termos nesta revisão. A política de rede previamente verificada não autorizava os domínios oficiais desses serviços. Os links são referências para validação posterior, não confirmação de preço atual ou concessão de gratuidade.

| Alternativa | Possibilidade gratuita | Limite/custo e autorização |
| --- | --- | --- |
| Simulação local atual | Sem consumo de API externa | Apenas teste fictício; não gera assinatura real. |
| [Assinador gov.br](https://www.gov.br/governodigital/pt-br/identidade/assinatura-eletronica) manual | Candidato de serviço gratuito ao cidadão elegível, conforme regras oficiais a confirmar | Elegibilidade e método precisam ser conferidos. Não implica API SaaS gratuita. Documento real e envio dependem de autorização. Não coletar credenciais do titular. |
| Plataforma especializada: [Autentique](https://www.autentique.com.br/), [ZapSign](https://zapsign.com.br/), [Clicksign](https://developers.clicksign.com/), [D4Sign](https://docapi.d4sign.com.br/) | Investigar franquia/plano gratuito ou sandbox, quando oferecido e adequado | API, autenticação adicional, número de documentos, evidências e operação comercial podem ser pagos; tarifas atuais não verificadas. Não contratar ou ativar. |
| [DocuSign](https://developers.docusign.com/) | Ambiente de desenvolvimento é candidato para homologação | Desenvolvimento não significa produção gratuita; confirmar condições, transferência de dados e plano. |
| Assinatura física e arquivo conferido | Pode dispensar API de assinatura | Exige conferência externa do instrumento, segurança de armazenamento e procedimento próprio; upload de arquivo não prova assinatura nem autoria. Não foi implementada validação documental. |

Recomendação: começar por minuta/revisão locais e escolher serviço especializado após validar método, evidências e condições comerciais. O caminho manual gov.br pode ser comparado como operação assistida, caso elegível e juridicamente adequado; não simular integração automática inexistente.

## Pagamentos reais: diagnóstico objetivo

Não foi encontrado gateway de cobrança operacional nos módulos examinados. Configurar chave Pix localmente não cria cobrança, assinatura recorrente, confirmação de recebimento nem estorno. O backend financeiro e o verificador HMAC atuais são simulações de teste, sem webhook financeiro real.

No fluxo ativo `G360SaaSSettingsPanel.jsx:164`, o total exibido como **“Faturamento Realizado”** na linha 209 soma `dealValue` dos leads em `fechado` **ou `otimizacao`**. Não está lastreado em pagamento conciliado. Antigravity deve identificar essa soma como indicador comercial estimado ou integrar recebimentos confirmados; não pode utilizá-la para comprovar liquidação, emitir recibo ou liberar plano pago.

| Candidato | Avaliação necessária | Gratuidade/custo |
| --- | --- | --- |
| [Efí](https://dev.efipay.com.br/) | Verificar intenção anterior, Pix/cobranças/cartão, certificados e produtos de recorrência | Sandbox e tarifas por produto a confirmar; não há credencial de teste homologada nesta tarefa. |
| [Asaas](https://docs.asaas.com/) | Clientes, cobranças, assinaturas, autenticação e ordem dos eventos | Sandbox pode ser candidato; não presumir taxas zero de processamento nem gratuidade da produção. |
| [Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs) | Checkout, Pix/cartão, produto de assinatura e reembolso | Credenciais de teste e limitações por produto a validar. |
| [Stripe](https://stripe.com/br/pricing) | Billing, eventos, teste e disponibilidade na conta brasileira | Confirmar processamento e cobranças adicionais do Billing; Pix não deve ser presumido recorrente. |

Para escolher, obter tabela vigente de Pix/cartão, parcelamento, antecipação, mensalidade, assinatura/Billing, chargeback, estorno, saque e volume. Não há base para informar um preço numérico atual sem essa consulta. Um sandbox comprovadamente gratuito não autoriza cobrança real nem consumo de saldo pago.

Antes de operar: conta comercial aprovada; autorização de custo; segredos separados test/live no servidor; preços e planos calculados pelo servidor; checkout/tokenização oficial sem guardar cartão/CVV; idempotência persistente; evento autenticado segundo o fornecedor; validação de conta/valor/moeda/tenant; conciliação; estados e estornos/chargebacks; backup e recuperação; interface que não confunde etapa comercial com liquidação. O HMAC genérico de testes não é substituto do protocolo real do gateway escolhido.

## Responsabilidades e autorizações

| Ação | Responsabilidade / condição |
| --- | --- |
| Corrigir ou manter inativos os componentes legados; integrar estados e rótulos corretos | Antigravity, com contrato de API do Codex; sem sobrescrever seu trabalho. |
| Backend de evidências, adapter de assinatura/gateway e testes fictícios | Codex, depois de fornecedor/protocolo e condições definidos; sem disparo real. |
| Conteúdo/modelo contratual e uso de dados em IA | AI Studio e revisão jurídica adequada, sem enviar dados pessoais reais para demonstrar. |
| Comparar planos/tarifas atuais e recursos gratuitos | Consulta oficial permitida e decisão comercial; sem contratação implícita. |
| Criar conta externa, conceder escopos, contratar serviço, inserir credencial, enviar contrato ou iniciar cobrança real | Depende de autorização específica do usuário e dos critérios de segurança. |
| Publicar ou migrar dados | Continua não autorizado. |

Critério de integração: os testes existentes de isolamento/versionamento devem continuar aprovados; a interface ativa deve demonstrar em teste que aprovação interna, etapa CRM e envio de link nunca produzem assinatura real ou pagamento confirmado. Não houve alteração de UI ou execução de envio/cobrança nesta revisão.
