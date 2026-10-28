# Proteção SSRF implementada — 27/10/2026

Branch: `codex/auditoria-g360`. Escopo desta etapa: busca segura de URLs nos três fluxos autorizados. Sem mudança de dados originais, conta, senha, permissão, persistência, dependência, merge, push ou publicação.

## Arquivos desta etapa

- Novo `src/server/publicUrl.ts`: política de URLs, classificação IPv4/IPv6, DNS, transporte direto/proxy, TLS, redirecionamentos e limites.
- Novo `src/server/publicUrl.test.ts`: 47 testes do mecanismo e do transporte.
- `server.ts`: integração no handler `/api/ai/clone-site` e tratamento de erros sem alternativa para uma URL bloqueada.
- `src/server/g360Engine.ts`: integração no scanner `/website-audit` e no resolvedor `resolveRealBusinessMultiEngine`; erros também são tratados em `/audit` e `/test-engines`.
- `docs/planejamento-urls/ssrf.contract.mjs`: preservados os 12 contratos originais; adaptação da simulação para DNS/transporte seguros e inclusão de 8 testes adicionais de API.
- Este relatório. As demais mudanças de segurança já existentes na branch foram preservadas.

## Política e transporte

Só HTTP e HTTPS, em suas portas padrão. Host sem protocolo assume HTTPS; host:443 sem protocolo é aceito. URL malformada retorna 400; credenciais na URL, porta não padrão, protocolo proibido e destino não público são rejeitados. Hostnames internos e localhost são bloqueados antes de DNS. IPs alternativos são canonicalizados pela API URL. IPv4 inclui exclusão de privados, loopback, link-local/metadata, CGNAT, documentação, benchmark, multicast e reservados. IPv6 permite unicast global com exclusão de faixas especiais, túneis e documentação; endereços mapeados/NAT64 são rejeitados conservadoramente.

Todos os resultados DNS precisam ser públicos. A conexão usa um IP dessa resolução; não faz outra resolução do hostname para conectar. O primeiro endereço IPv4 é preferido, ou IPv6 quando não houver IPv4. Não há tentativa automática de outro IP após falha.

Com proxy configurado, a conexão usa CONNECT para o **IP numérico validado e a porta**, com colchetes para IPv6. O hostname original é mantido no cabeçalho Host e na verificação TLS. O proxy não recebe o hostname de origem para resolver novamente. Credenciais do proxy ficam exclusivamente no CONNECT; não são encaminhadas ao site. HTTP_PROXY/HTTPS_PROXY/ALL_PROXY e variantes minúsculas são considerados; NO_PROXY não permite contornar a proteção. Proxy não suportado, recusa do túnel ou erro de TLS resultam em bloqueio. Não há fallback para conexão direta. Isso pressupõe proxy confiável que respeita o destino numérico do CONNECT, como qualquer infraestrutura de transporte confiável.

O TLS mantém verificação de certificado e hostname, usando a confiança configurada no Node; nenhuma verificação foi desabilitada. Cada redirecionamento abre uma nova conexão validada, com limite de 3 saltos. HTTPS → HTTP é bloqueado; HTTP público inicial permanece permitido para diagnóstico de sites sem HTTPS. Não são encaminhados cookies ou credenciais da requisição do usuário.

Limites: 10 s totais, incluindo DNS, conexão, saltos e corpo; 2 MiB tanto no corpo recebido quanto após descompressão; cabeçalhos HTTP limitados a 16 KiB. HTML e XHTML são aceitos, inclusive gzip, deflate e Brotli, com limites durante leitura. O mecanismo cancela a conexão ao exceder limites. Respostas bloqueadas não viram análises comerciais fictícias.

## Integração e preservação de funcionamento

- Scanner: usa somente o mecanismo compartilhado. Erros de política/limites/conexão são explícitos.
- Clone: valida a URL mesmo se rawHtml também estiver presente. HTML enviado sem URL continua aceito. Falha na busca termina a requisição, sem fallback de IA; URL bloqueada não chega à geração. O prompt da clonagem não inclui mais a URL como instrução de acesso remoto, usando o HTML recebido.
- Links de empresas: limita a expansão aos hosts explícitos `maps.app.goo.gl`, `goo.gl`, `maps.google.com`, `www.google.com` e `google.com`, incluindo cada salto. Consulta textual por nome permanece disponível. Link sem nome de empresa reconhecível ou com outra URL como nome é rejeitado, sem acionar provedores alternativos.

## Resultados reais

Execução em `/tmp/g360-ssrf-rrg7ecer`, cópia do código com base fictícia e sem arquivos .env. Nenhum serviço interno real ou provedor externo foi consultado. Resolver e transporte são simulados nos contratos de API; os testes de transporte usam servidores e proxies locais controlados. Os IPs públicos nesses testes são apenas destinos lógicos: conexões diretas são interceptadas para um servidor de teste local ou respondidas pelo proxy fictício. A conta administrativa original e o banco original não participaram.

| Grupo | Executados | Passaram | Falharam / pulados |
| --- | ---: | ---: | ---: |
| Contratos SSRF originais | 12 | 12 | 0 / 0 |
| Novos contratos de API | 8 | 8 | 0 / 0 |
| Testes do mecanismo/transporte | 47 | 47 | 0 / 0 |
| Testes existentes de segurança e aplicação | 28 | 28 | 0 / 0 |
| **Total** | **95** | **95** | **0 / 0** |

Comando completo, exclusivamente na cópia fictícia:

```sh
G360_URL_PLAN_FIXTURE=1 G360_TEST_FIXTURE=1 NODE_ENV=test node --import tsx --test docs/planejamento-urls/ssrf.contract.mjs src/server/publicUrl.test.ts src/server/security.test.ts firestore.rules.test.ts src/lib/firestoreSchemas.test.ts src/lib/sitegen/masterImagePrompt.test.ts src/lib/sitegen/sitegen.test.ts src/server/blindagem.test.ts src/server/costGuard.test.ts
```

O contrato de API exige cópia em /tmp, cwd igual à raiz da cópia, marcador `securityPlanFixture: true` no JSON e administrador fictício `url-fixture-admin` na primeira posição. A suíte existente requer também a conta fictícia audit-admin e os registros fictícios esperados. Não executar os testes que gravam métricas/banco no checkout original.

Os novos casos incluem DNS misto/privado/vazio/erro; IPv4 abreviado, decimal, hexadecimal e octal; IPv6 privado, loopback e mapeado; metadados; todos os status de redirect suportados; loops, downgrade e mudança de DNS em redirect; conteúdo grande/comprimido e stream que não termina; proxy numérico IPv4/IPv6, recusa sem escape direto e isolamento da autenticação de proxy. A configuração de TLS e a checagem do certificado contra o hostname original são verificadas com handshake simulado; não se afirma validação de TLS de um site público real.

Os controles positivos comprovam scanner e clone públicos simulados, HTML sem URL, HTTPS lógico, redirecionamento relativo, descompressão válida e um link curto Maps reconhecido. As negativas comprovam ausência de fallback, inclusive na clonagem com uma chave de IA **fictícia** configurada.

- `npm run lint` (TypeScript): passou, código de saída 0.
- `npm run build`: passou, código de saída 0. Permanecem os avisos anteriores de bundle grande, import dinâmico Firebase e __dirname do Vite.
- `git diff --check`: sem erros.
- `git diff` de db.json, cost-guard-metrics.json, package.json, bun.lock, Studio.jsx, Editor.jsx e SearchHome.jsx: vazio em relação ao HEAD. Arquivos visuais e autenticação já alterados em etapas anteriores também foram comparados ao checkpoint do diagnóstico e preservados nesta implementação.

## Limitações e bloqueios restantes

1. A compatibilidade com o proxy gerenciado real não foi testada contra um destino externo, conforme a exigência de testes simulados/controlados. Um proxy que só aceita CONNECT por hostname, ou cuja política proíbe IPs numéricos, bloqueará a consulta com 502. É necessário validar esse suporte no ambiente de destino por procedimento controlado antes de liberar o recurso; não relaxar a proteção nem contornar o proxy. A política de rede pode restringir sites públicos independentemente da aplicação.
2. Portas não padrão, conteúdo acima dos limites, faixas especiais conservadoramente bloqueadas e formatos/hosts Maps fora da lista não são suportados. Não há garantia de resposta de sites que bloqueiam robôs ou de disponibilidade de provedores reais.
3. Classificação de faixas especiais deve acompanhar as atualizações dos registros de endereçamento. O mecanismo não substitui a política de saída da infraestrutura nem limites de uso por usuário.
4. Persistência JSON, inicialização de produção, jszip reproduzível, continuidade administrativa e recuperação externa permanecem nas tarefas já diagnosticadas. Nenhuma dessas migrações/correções foi executada aqui.

**Conclusão:** correção SSRF implementada e validada nos cenários controlados autorizados. Isso não declara o projeto pronto para produção, nem autoriza publicação ou migração administrativa.
