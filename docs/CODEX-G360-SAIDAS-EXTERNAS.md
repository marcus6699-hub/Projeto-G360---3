# G360 — autorização de saídas externas

28/10/2026. Branch `codex/auditoria-g360`.

## Estado

`src/server/externalAccess.ts` e seus dez testes foram implementados. O agente principal incorporou o patch de integração em `server.ts`, `src/server/g360Engine.ts` e `src/server/googlePhoto.ts`; esses arquivos compartilhados não foram editados por este subagente. O artefato `docs/patches/external-provider-authorization.patch` serve para comparar outras versões, **não deve ser reaplicado à branch já incorporada**.

Sem autorização explícita válida no ambiente do servidor, a chamada aos provedores cobertos é bloqueada antes do SDK/transporte. Chave presente, `strictFreeMode`, nome do modelo contendo `free`, saldo inventado ou interface mostrando “ativo” não concedem essa autorização.

## Mecanismo implementado

- Grant obtido exclusivamente de `G360_EXTERNAL_ACCESS_GRANTS` no ambiente do processo. Não existe rota para gravá-lo a partir de body, query, headers, Firestore ou perfil do usuário. Nenhuma variável ou chave real foi alterada nesta tarefa.
- Grant exige ID, provedor conhecido, declaração `cost: "free_verified"`, referência documental de evidência, datas UTC canônicas, validade de no máximo uma hora e `maxCallsPerProcess` de 1 a 1.000. Formato inválido, campos desconhecidos, grants duplicados ou declaração de uso pago são recusados. Exige no máximo um grant por provedor.
- Reserva ocorre antes de cada método do SDK e antes do transporte HTTP; operações concorrentes não ultrapassam o contador local. Falha não devolve a reserva: o provedor pode consumir cota mesmo quando a resposta se perde.
- O guard do SDK verifica autorização na invocação, inclusive quando o método foi obtido antes da expiração do grant. Preserva o receiver original; não substitui o pipeline de IA nem modifica prompts.
- APIs HTTP têm HTTPS, hostname, caminho e método fixos; credenciais no hostname/URL, porta alternativa, fragmento, alvo desconhecido e redirecionamento são recusados. Deadline absoluto de até dez segundos cobre transporte/corpo; resposta limitada a 2 MiB. Erros não incluem URL, chave ou resposta bruta.
- Métodos SDK precisam de timeout e `retryOptions: { attempts: 1 }` na configuração do cliente: o SDK Google instalado usa cinco tentativas por padrão. Uma reserva de invocação não deve permitir cinco requisições automáticas. A configuração compartilhada é responsabilidade da incorporação pelo agente principal.
- Status mantém saldo/tipo de crédito desconhecidos e não autoriza uso pago.

## O que isso não comprova

`free_verified` é uma **declaração do operador baseada em evidência externa**, não uma consulta automática à fatura. O software não conhece saldo ou cobrança futura do provedor. Não habilitar um grant só porque o JSON de exemplo é aceito: a gratuidade, conta/produto/modelo, limites, prazo e ausência de cobrança automática precisam ser comprovados fora do simulador. Esta execução não criou grant real e não consumiu serviço externo.

O contador é por processo, não um orçamento financeiro durável ou cota por tenant. Reiniciar pode reiniciar contadores; múltiplas instâncias não compartilham a reserva. Para produção, conciliar com quota persistida por conta e limite imposto no próprio provedor. Não se deve depender desse contador para impedir ultrapassar uma franquia faturável.

O wrapper de SDK guarda métodos invocados pelo backend. Operações internas de um SDK e recursos habilitados pelo modelo podem gerar outras requisições; desabilitar retries e homologar cada operação/produto antes de autorizar. Não expor opções arbitrárias de SDK ou endpoint a usuários.

## Escopo de transporte e preservação

Hosts fixos cobertos: Google Places, Outscraper, NVIDIA, OpenRouter, Groq, Cerebras, Mistral, Hugging Face, Pollinations texto, Serper, Nominatim, BrasilAPI e CNPJ.ws. O SDK Gemini é coberto pelo guard de métodos. A obtenção de metadados de foto Google passa pela mesma autorização.

O novo wrapper **não substitui `publicUrlClient`**. Os fluxos de URLs fornecidas por usuários mantêm validação de DNS, IP fixado, proxy, redirecionamento e limites no transporte SSRF existente. O wrapper de provedores é para destinos fixos confiáveis do código; não é uma API de fetch arbitrário nem promete resolver SSRF para URLs de usuários.

Vercel/deploy, Firebase/Auth, PostgreSQL e APIs executadas diretamente no frontend não são interceptados por este módulo. Nenhum deploy ou operação real foi executado. URLs de imagem externas geradas para o navegador, integrações de outros agentes e novos caminhos de saída precisam de revisão própria. Não afirmar bloqueio universal de gastos do aplicativo inteiro apenas por incorporar este arquivo.

As regras de rede/proxy da implantação continuam aplicáveis. O wrapper utiliza o transporte `fetch` injetado/configurado, enquanto o cliente SSRF existente mantém sua própria garantia de proxy/IP fixado. Não há alteração de rota, TLS ou política da plataforma para alcançar provedor bloqueado.

## Fallback e proveniência

Os catches históricos podem continuar para engine local/demonstração quando a saída é negada ou o provedor falha. O guard impede a chamada sem grant, porém **não transforma fallback em informação real verificada**. OpenCode/AI Studio devem preservar `source`, ausência de dados e estado de disponibilidade; números/textos locais não podem ser apresentados como retorno real de provedor. O agente principal mantém essa pendência separada sem reescrever prompts/fluxos de outro agente.

## Configuração futura (somente formato, não autorização de uso)

Exemplo exclusivamente fictício e com datas fixas; não copiar como grant operacional:

```json
[
  {
    "id": "fixture-documentation-only",
    "provider": "gemini",
    "cost": "free_verified",
    "evidenceRef": "FICTICIO-nao-comprova-gratuidade",
    "issuedAt": "2026-10-28T12:00:00.000Z",
    "expiresAt": "2026-10-28T12:05:00.000Z",
    "maxCallsPerProcess": 1
  }
]
```

Antes de configurar, comprovar o recurso gratuito e impedir faturamento automático na conta; definir operação/modelo/cota e necessidade de dados; aprovar o uso e manter a evidência fora dos valores de segredo. Não incluir chaves ou dados de cliente no grant. Na ausência dessa comprovação, deixar a variável ausente: bloqueio é o comportamento esperado.

## Testes executados

`node --import tsx --test src/server/externalAccess.test.ts`: **10 aprovados, zero falhas e zero ignorados**. Testes usam relógio/transportes/SDK fictícios e o SDK instalado interceptado antes do despacho, sem consultar provedores:

1. Ausência, erro de formato, uso pago e falsa inferência de chave/modo gratuito.
2. Provedor/campos desconhecidos, duplicidade, datas inválidas/futuras/expiradas e quota inválida.
3. Reserva concorrente anterior à execução e saldo desconhecido.
4. Método obtido antes de expirar, receiver correto e bloqueio posterior à expiração.
5. Falha sem devolução de cota ou retry automático pelo guard.
6. Alvos, protocolos, portas e métodos proibidos sem transporte.
7. API fixa legítima e redirect forçado a `error`.
8. Redirect para metadados, limite de tamanho e erros sem segredo ou fallback.
9. Transporte e corpo parados interrompidos pelo deadline; cancelamento anterior evita despacho.
10. Cliente real `GoogleGenAI` instalado, chave/modelo fictícios: exceção síncrona da política antes de entrar no método SDK, confirmando compatibilidade do proxy sem enviar requisição.

`npm run lint`: exit 0 na validação do módulo. O patch inicial foi aplicado somente em cópia `/tmp/g360-external-policy-candidate-qywctv94` e passou análise de tipos; a incorporação e a suíte ampliada da branch são registradas pelo agente principal. Nenhum teste deste módulo usa arquivo de dados real, provedor ou credencial de produção.
