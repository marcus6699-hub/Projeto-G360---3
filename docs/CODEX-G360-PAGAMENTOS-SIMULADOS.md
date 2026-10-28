# G360 — ledger de pagamentos exclusivamente simulados

Data: 28/10/2026. Branch: `codex/auditoria-g360`.

## Implementado e testado

`src/server/paymentLedger.ts` complementa o simulador em memória existente sem substituí-lo. É um adaptador de teste offline para intenções e eventos persistentes. Não cria cobrança, assinatura, receita real ou integração de gateway. Nenhuma rota HTTP foi adicionada, nenhum serviço foi ativado e nenhum registro real foi lido ou modificado.

O construtor exige simultaneamente `NODE_ENV=test`, `enabled:true`, segredo fictício de ao menos 32 bytes e caminho `payment-ledger.fixture.json` dentro de um subdiretório temporário. Não pode ser usado no `db.json` do aplicativo nem habilitado em produção. O segredo fica apenas em memória; não é persistido no ledger ou nas respostas.

O arquivo usa `AtomicJsonStore`: leitura estrita, substituição atômica, backup anterior verificado, lock e comparação de revisão. Cada operação relê uma transação; falha de gravação não confirma evento ou deixa o estado fictício avançado em memória. Repetir após recuperação usa o registro persistido. Se o principal desaparecer mas existir backup anterior, o módulo recusa inicialização vazia e exige recuperação explícita. Os mesmos limites de instância única, estado incerto após interrupção/fsync e necessidade de recuperação verificada do armazenamento JSON continuam valendo; não há limpeza ou restauração automática.

## Contrato para integração de testes futura

```ts
new PaymentLedger(file, { enabled: true, secret: fictionalSecret, now? });
ledger.create(trustedTenantId, { clientId, reference, amountCents, currency: 'BRL', dueOn: 'YYYY-MM-DD' });
ledger.list(trustedTenantId);
ledger.get(trustedTenantId, invoiceId);
ledger.history(trustedTenantId, invoiceId);
ledger.receive(trustedTenantId, { timestamp, signature, rawBody: Buffer });
```

- O `trustedTenantId` deve vir da identidade/autorização verificada do backend de teste, nunca diretamente do body. Este módulo não é middleware de autenticação e não consulta o cadastro do Escritório. O chamador deve comprovar previamente que o cliente pertence à conta e que a operação é autorizada.
- Identificadores de conta/cliente/referência/evento são strings ASCII limitadas a 128 caracteres; não são caminhos de arquivos.
- Valores são centavos inteiros positivos, limitados a 100.000.000, em BRL. Não há preço calculado, checkout, cartão/CVV, juros ou parcelamento implícito.
- A referência de intenção é única por conta: repetir os mesmos termos devolve a intenção existente sem gravar; reutilizar referência com cliente/valor/vencimento diferentes falha. Outra conta pode usar referência igual sem acessar a primeira.
- As intenções são sempre `mode:'simulation'`, com IDs aleatórios, data de criação do relógio de teste e estados `pending`, `overdue`, `confirmed`, `canceled`, `refunded`. Confirmação é fictícia e não deve ser somada a receita real.
- O evento é JSON UTF-8 estrito, até 16 KiB, com exatamente `id`, `tenantId`, `invoiceId`, `amountCents`, `currency`, `state`. Valor, moeda, intenção e conta precisam coincidir com o registro anterior.
- Assinatura fictícia: HMAC-SHA256 sobre `timestamp + '.' + rawBody`. Timestamp em segundos, janela máxima de cinco minutos para passado/futuro. Comparação constante e autenticação dos bytes originais antes de interpretar o JSON.
- Esse HMAC é **protocolo do simulador**, não o webhook de um fornecedor. O adaptador de gateway futuro deve seguir a documentação específica; não presumir que Efí/Asaas/Mercado Pago/Stripe usem esse método.
- IDs de eventos são únicos por conta. Repetição byte a byte autenticada não grava nem reaplica estado. Repetir ID com conteúdo diferente falha. Uma repetição antiga depois de reembolso devolve o estado atual e separadamente `originallyAppliedState`, evitando regressão visual.
- Transições: pendente → vencido/confirmado/cancelado; vencido → confirmado/cancelado; confirmado → estornado. Cancelado/estornado não voltam a confirmado. Eventos atrasados que tentam regredir estado são recusados sem gravar. Eventos novos que repetem o mesmo estado são registrados sem criar outra intenção ou alterar valor.
- Evento e mudança de estado ficam no mesmo commit. Histórico aceito deve reconstruir o estado do arquivo; estrutura/versão/cadeia inválida falha sem semear ou substituir dados.

## Testes executados

Comando:

```sh
NODE_ENV=test node --import tsx --test src/server/paymentSimulation.test.ts src/server/paymentLedger.test.ts
```

Resultado: **16 aprovados, zero falhas e zero ignorados** — quatro originais preservados e doze testes novos. `npm run lint` passou após correção de estreitamento de tipo no módulo novo. `git diff --check` passou.

Cobertura nova: proibição de produção e nomes de arquivo reais; leitura sem seed; retomada de intenção/evento após nova instância; idempotência por conta; cópias retornadas sem mutação interna; validação de termos monetários/datas/IDs; isolamento em listagem/detalhe/histórico/evento; replay alterado; moeda/valor incompatíveis; HMAC de bytes originais; prazo e tamanho; JSON/UTF-8 inválido; campos desconhecidos; ENOSPC antes do commit com retry exato; estrutura/versão e estado adulterados; principal ausente com backup anterior sem reinicialização; duas instâncias relendo alterações; dois processos concorrentes sincronizados produzindo um commit e um conflito explícito, com retry preservando ambas as intenções.

Somente arquivos temporários e dados fictícios foram usados. Log local: `/tmp/g360-payment-ledger-tests.log`; diretórios temporários permanecem disponíveis para inspeção enquanto o ambiente existir.

## Limites e próxima integração

O módulo está **IMPLEMENTADO e TESTADO localmente**, não integrado à interface/Escritório nem a fornecedor. Não altera o financeiro existente ou cria um segundo Escritório. É recurso de testes para a futura integração e eventual extração de uma interface de provedor; o caminho de produção continua bloqueado.

Antes de operação real ainda faltam escolha/condições do provedor, autorização financeira, segredos server-side, evento autenticado conforme fornecedor, consulta de conciliação independente, vínculo ao cliente/plano/conta recebedora, moeda e valores conferidos, idempotência externa, tratamento de timeouts ambíguos, retenção/auditoria e backup independente. Receber webhook válido por si só não comprova pagamento se o método real exigir conciliação. Não reusar o segredo ou o arquivo de testes.
