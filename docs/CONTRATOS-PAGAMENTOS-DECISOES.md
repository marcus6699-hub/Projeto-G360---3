# Contratos, assinatura e pagamentos — decisões técnicas

Data: 27/10/2026. Branch: `codex/auditoria-g360`.

Este documento registra diagnóstico e decisões propostas. Não houve contratação, cadastro externo, envio de contrato, criação de cobrança, consulta a conta financeira ou consumo de saldo. Nenhum arquivo de interface foi alterado.

## Evidência encontrada no projeto

- O relatório de auditoria e a busca no código identificam menções a Efí/Pix em `src/components/g360/G360SaaSSettingsPanel.jsx`. Isso demonstra uma intenção de configuração, não um gateway implementado ou uma decisão comercial aprovada. Não foram encontrados cliente autenticado de pagamentos, criação de cobrança, conciliação ou receptor de webhook financeiro existente.
- `src/components/DigitalContract.tsx` marca o contrato como assinado antes de confirmar persistência; constrói um identificador com `Math.random()` e data; chama esse identificador de hash criptográfico; abre `mailto:` e WhatsApp; e alega validade jurídica plena/título executivo. Esses elementos não comprovam assinatura do cliente, integridade criptográfica do documento nem envio efetivamente concluído. Não reutilizar esse fluxo como assinatura real.
- Há outro componente em `src/components/g360/DigitalContract.tsx` e links com `contrato_digital`. A existência de componentes e links não comprova uma jornada ativa e verificável de assinatura. A interface e seu roteamento devem ser coordenados com Antigravity, preservando o trabalho existente.
- Nenhum dado de Pix ou identificação pessoal encontrado foi reproduzido neste documento.

## Limite da pesquisa externa

O ambiente informa rede restrita, com política aplicada e sem destinos Planalto ou provedores financeiros/de assinatura autorizados. Não houve tentativa de contornar essa política. As URLs oficiais abaixo são referências para validação posterior; **seu conteúdo e suas tarifas atuais não foram consultados nesta execução**. Recursos de sandbox, gratuidades, modalidades e disponibilidade descritos são candidatos conhecidos, sujeitos à confirmação documental e contratual. Não há prova de homologação externa nem de gratuidade de uma conta específica.

## Requisitos brasileiros a validar

| Referência oficial | Implicação para a implementação |
| --- | --- |
| [MP 2.200-2/2001, art. 10](https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm) | ICP-Brasil oferece regime próprio de presunção. O §2 admite outros meios de comprovação de autoria e integridade, nas condições legais. Isso não torna qualquer clique ou hash uma assinatura suficiente. |
| [Lei 14.063/2020](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm) | Distingue assinaturas simples, avançadas e qualificadas em seu âmbito legal. Não aplicar automaticamente seus requisitos de interações públicas a todos os contratos privados. Definir método adequado ao contrato e ao risco. |
| [Código Civil](https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm) | Revisar capacidade e poderes de representação, objeto, forma exigida e manifestação de vontade. Os artigos sobre prestação de serviços não conferem, isoladamente, validade universal ao mecanismo eletrônico. |
| [CPC, art. 784 e §4](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm) e [Lei 14.620/2023](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14620.htm) | Validade do contrato, força probatória e qualidade de título executivo são questões distintas. O §4 tem requisitos para títulos eletrônicos e dispensa de testemunhas; advogado deve avaliar o provedor, a integridade e o caso concreto. Não prometer executividade automática. |
| [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) | Definir finalidade, base legal adequada, minimização, acesso, retenção, operadores, compartilhamento e atendimento ao titular. Consentimento não é a única base legal. IP e registros de identidade podem ser dados pessoais; biometria exige cuidado adicional. |

Revisão jurídica deve aprovar modelo, obrigações, renovação/cancelamento, encargos, aceite, poderes de quem assina e método de assinatura. O mecanismo técnico não substitui essa revisão. Enviar um link por WhatsApp ou e-mail não equivale à assinatura; comprovante de entrega também não equivale ao aceite do conteúdo.

## Caminho recomendado para contratos

1. Preservar o backend existente e manter versões imutáveis de conteúdo revisado, dados do contratante e identificação do modelo. Calcular SHA-256 dos bytes exatos; identificador aleatório de contrato e hash do documento têm propósitos diferentes.
2. Separar `rascunho`, `revisado`, `aguardando assinatura`, `assinado`, `recusado`, `cancelado` e `expirado`. Vencimento contratual é uma dimensão separada; uma assinatura antiga não desaparece quando o contrato vence.
3. Nesta fase usar somente documentos fictícios e um simulador explicitamente identificado. Não chamar simulação de assinatura real nem gerar certificados com afirmações jurídicas.
4. Para operação real, preferir um provedor especializado com API, validação de identidade adequada, pacote exportável de evidências e documento final verificável. Manter envio real desativado até aprovação do método, fornecedor, conta, custos e destinatários.
5. Vincular envelope externo a versão/hash imutáveis, signatários e tenant. O cliente não pode declarar unilateralmente `assinado`. Callback deve ser autenticado conforme o provedor, processado de forma idempotente e conciliado pela API autenticada. Documento final e evidências devem ser obtidos de destinos controlados, sem permitir URLs arbitrárias contornarem SSRF.
6. Preservar bytes originais e finais, respectivos hashes, versão do modelo, manifesto de signatários, método/resultado de autenticação informado pelo provedor, identificadores de eventos e envelope, horários UTC e pacote de evidências. Hash sozinho não comprova identidade ou horário; relógio do servidor não é carimbo de tempo confiável. Nunca registrar tokens, códigos OTP ou dados completos desnecessários nos logs.
7. Exportar e restaurar documento e evidências juntos em backup externo criptografado; controlar acesso por tenant; testar verificação dos hashes após restauração. Não depender apenas da retenção do provedor ou do JSON local.

### Alternativas de assinatura

| Alternativa | Adequação | Limite / custo a confirmar |
| --- | --- | --- |
| [Clicksign](https://developers.clicksign.com/) | Candidata brasileira para API, envelope e evidências. | Sandbox/API, limites, autenticação e preço por plano/envelope devem ser confirmados. Nenhuma conta criada. |
| [D4Sign](https://docapi.d4sign.com.br/) | Outra candidata brasileira para comparar requisitos e exportação de evidências. | Homologação, API contratada, autenticação e tarifa não verificados. |
| [DocuSign](https://developers.docusign.com/) | Candidata com ambiente de desenvolvimento e ecossistema de API. | Desenvolvimento não implica produção gratuita; analisar transferência internacional, plano e adequação jurídica. |
| [Assinatura eletrônica gov.br](https://www.gov.br/governodigital/pt-br/identidade/assinatura-eletronica) | Alternativa para assinatura manual pelo titular, quando elegível e adequada ao documento. | Serviço ao cidadão não implica API de SaaS aberta ou integração comercial gratuita. Validar elegibilidade, método e fluxo de retorno; não coletar credenciais gov.br. |
| Fluxo próprio | Somente rascunho, revisão e simulação nesta fase. | Custo de identidade, antifraude, integridade, evidências e operação; não recomendado como primeira assinatura comercial do G360. |

## Gateways para avaliação

Não há fornecedor escolhido nesta etapa. A menção anterior a Efí deve ser considerada antes de contratar uma alternativa. Cada recurso depende de produto, conta, credenciamento e documentação vigentes; Pix comum, Pix Automático e assinatura recorrente no cartão não são o mesmo produto.

| Candidato / referência oficial | Adequação a investigar | Teste e condições |
| --- | --- | --- |
| [Efí](https://dev.efipay.com.br/) | Pix, APIs de cobrança/cartão e opções de recorrência; distinguir produtos, Pix Automático, certificados/mTLS e regras de webhook. Aproveita a intenção visual existente. | Confirmar ambientes de homologação por produto, credenciais de teste e tarifas. Não confundir transferência Pix com autorização de recorrência. |
| [Asaas](https://docs.asaas.com/) | Gestão de cobranças, clientes, assinaturas e notificações; candidata para reduzir trabalho operacional. | Confirmar sandbox, restrições Pix/cartão, webhooks autenticados, estornos e condições comerciais. |
| [Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs) | Checkout/Pix/cartão e produto de assinaturas; avaliar disponibilidade e meios de pagamento permitidos em cada produto. | Contas/credenciais de teste, eventos e limitações de testes dependem do produto; validar reembolsos e retentativas. |
| [Stripe](https://docs.stripe.com/) | Billing, cartão, eventos e ferramentas de teste; candidata quando recursos de assinatura forem prioritários. | Confirmar suporte na conta brasileira e quais meios permitem recorrência. Pix não deve ser presumido recorrente. Billing e outros produtos podem ter tarifas adicionais. |

Nenhuma tarifa numérica é afirmada: faltam consulta atual, volume, prazo de recebimento, parcelamento e contrato. Antes da escolha, comparar taxas de Pix/cartão, antecipação, parcelamento, mensalidade, Billing, estorno, chargeback, mínimo, saques, limites e suporte. Páginas comerciais iniciais: [Efí](https://sejaefi.com.br/), [Asaas](https://www.asaas.com/), [Mercado Pago](https://www.mercadopago.com.br/), [Stripe Brasil](https://stripe.com/br/pricing). Cobranças reais e contratação continuam bloqueadas.

### Requisitos de um adaptador futuro

- Dinheiro em centavos inteiros e moeda explícita. Calcular preço/plano no servidor; nunca confiar no valor, tenant, status ou papel enviados pelo navegador.
- Chaves de sandbox e produção separadas no servidor; modo real desativado por padrão. Não armazenar cartão/CVV; usar checkout/tokenização oficial. Nunca considerar a volta do navegador como confirmação de pagamento.
- Operação local registrada antes da chamada externa, chave de idempotência estável e identificador externo único. Timeout deixa resultado indeterminado: consultar/reconciliar antes de repetir, sem gerar cobrança duplicada.
- Webhook específico ao fornecedor: preservar corpo bruto quando necessário à assinatura, validar assinatura/token/certificado conforme documentação, comparar segredos com segurança, rejeitar payload excessivo, separar test/live e conferir conta recebedora. Não inventar um HMAC genérico que o fornecedor não emite.
- Deduplicar evento persistido, validar ID/valor/moeda/conta/tenant com recurso consultado na API confiável e tratar repetição, desordem e assinatura inválida. Não construir URL externa a partir de entrada arbitrária.
- Estados financeiros claros: pendente, confirmado, vencido, cancelado e estornado, com eventos de reembolso parcial/chargeback quando aplicáveis. Cancelar uma assinatura não estorna automaticamente pagamentos anteriores. Evento pendente atrasado não pode reverter confirmação.
- Testar pagamento e webhook só por simulação local enquanto a documentação e um sandbox comprovadamente gratuito não estiverem disponíveis. Neste estado, nenhuma homologação com provedor foi executada.

## Critérios para avançar

| Critério | Estado nesta revisão |
| --- | --- |
| Inspeção de decisões e integrações existentes | Concluída no código disponível; não há evidência de gateway operacional. |
| Comparação técnica inicial | Preparada; documentos externos/tarifas atuais não validados por restrição de rede. |
| Aprovação de contrato e método de assinatura por revisão jurídica | Pendente. |
| Coordenação com Antigravity para retirar afirmações indevidas e integrar estados reais | Pendente; nenhum arquivo de interface alterado. |
| Seleção comercial de assinatura e pagamentos | Pendente; nenhuma contratação autorizada. |
| Sandbox externo comprovadamente gratuito e credenciais fictícias/de teste | Bloqueado até documentação/acesso/conta de teste adequados; simulador local permanece permitido. |
| Autenticação de callback, idempotência, reconciliação e evidências do fornecedor | A implementar e homologar após escolha. |
| Backup externo restaurável, acesso administrativo recuperável e isolamento revisado | Pré-requisitos de produção; validação real exige autorização específica. |
| Envio real, cobrança real, produção | Não autorizados. |

Recomendação: concluir a estrutura local e os testes de isolamento/estados; validar documentos oficiais e condições; escolher assinatura especializada e gateway após comparar Efí e Asaas com os requisitos reais, mantendo Mercado Pago/Stripe como alternativas. Não ativar integrações reais por inferência de uma interface existente. O projeto não está declarado pronto para produção.
