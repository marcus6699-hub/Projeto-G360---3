# Identidade, Firebase, OAuth e chaves — revisão de integração

Data: 27/10/2026. Checkout: `codex/auditoria-g360`.

Fechamento: a pendência de autoridade das sessões descrita abaixo foi corrigida no backend. Sessões Firebase preservam origem e horário de autenticação; cada uso consulta estado, revogação e claims atuais em `getUser`, inclusive após refresh. Falha do provedor não usa identidade local como fallback. Sessões locais legítimas continuam locais. A tabela de sessões remove expiradas ao emitir e limita capacidade em 10.000 entradas. Cinco novos testes com SDK simulado passaram; a suíte consolidada passou de 203 para 208, sem falhas ou testes ignorados. Nenhuma conta/claim real foi modificada. A homologação Firebase real e as pendências de Firestore/OAuth/frontend permanecem separadas.

Revisão de código local, sem consulta a contas, valores de segredos, dados reais ou regras publicadas. Nenhum arquivo de interface, regra Firebase, claim, credencial ou conta foi modificado por esta revisão. As referências abaixo descrevem o estado encontrado no início desta etapa; correções posteriores do backend devem ser conciliadas com os testes consolidados.

## Proteções existentes preservadas

- Login local exige hash scrypt, senha correta e conta ativa; sessão aleatória de oito horas em cookie HttpOnly, SameSite Strict e Secure em produção. Logout revoga a sessão local. Não há senha padrão aceita nem apropriação automática de conta legada.
- Bearer Firebase usa `verifyIdToken(token, true)` para verificar revogação, exige e-mail verificado, aceita administração somente de claim e respeita bloqueio local quando há identidade correspondente (`src/middleware/auth.ts`, `authenticate`, linhas 64–76 no início da revisão).
- Erros de persistência não são convertidos em acesso administrativo ou demonstração. Novos registros JSON carregam proprietário; legado não atribuído permanece restrito ao administrador.
- Origem e limite de tentativas são verificados no backend. O limite por socket é local ao processo e não presume que `X-Forwarded-For` seja confiável.
- `/api/admin/integrations` exige administrador, informa presença/configuração sem devolver valores, não inventa saldo e distingue configuração de verificação (`src/server/integrationRegistry.ts`).
- Respostas de CRM/configurações omitem tokens de implantação; novas credenciais não são aceitas por essa rota. Credenciais antigas não foram removidas ou migradas.
- A rota de fotos foi substituída por chamada fixa ao Google com chave em cabeçalho; navegador recebe URL restrita do CDN sem chave (`src/server/googlePhoto.ts`).

## Pendência prioritária: autoridade de sessões Firebase

No estado inicial, `/api/auth/firebase` verifica o token uma vez e chama o mesmo `setSession` usado por senha local (`server.ts`, rotas de autenticação, linhas 1128–1141). A sessão em `auth.ts` conserva somente UID e expiração e busca o papel no JSON (`getSessionUser`, linhas 29–43). Se a conta Firebase for desativada/revogada ou sua claim administrativa removida depois da troca, o cookie local não consulta essa mudança. Um papel administrativo originalmente copiado da claim para o JSON pode continuar sendo usado pelo cookie.

Consequência: a verificação correta do Bearer não se estende automaticamente à sessão criada a partir dele. Não é necessário conhecer uma senha incorreta para demonstrar o problema; a credencial originalmente legítima pode sobreviver a uma revogação esperada.

Correção recomendada, sem migrar ou reatribuir dados: distinguir a origem da sessão; preservar a autoridade de cada provedor; verificar estado/revogação Firebase enquanto essa sessão for usada; obter a função administrativa atual da autoridade Firebase, sem promover a partir de um papel local histórico. Refresh não pode converter sessão Firebase em sessão local. UID/e-mail de contas locais não devem ser vinculados automaticamente. Se o provedor não puder ser verificado, falhar com acesso negado ou indisponível, nunca recorrer à identidade local silenciosamente.

Testes exigidos em transporte/SDK simulado: troca válida, cookie após desativação, revogação posterior, remoção e adição de claim, refresh conservando origem, indisponibilidade do SDK, usuário local legítimo preservado, e isolamento entre duas identidades. Nenhuma chamada a contas Firebase reais é necessária para esses testes. A integração operacional real depende da configuração autorizada do SDK.

Outra melhoria independente: a tabela de sessões não fazia coleta global das expiradas nem tinha capacidade máxima. Limitar memória e remover entradas expiradas ao emitir sessões evita crescimento indefinido; não usar esse limite como substituto de armazenamento compartilhado para múltiplas instâncias.

## Firestore: arquivo local não comprova regras remotas

O arquivo `firestore.rules` começa com negação geral e concede acesso a documentos próprios por UID. Propriedade de projetos/auditorias/leads é verificada e não pode ser alterada pelo cliente. Isso é positivo, mas não comprova qual regra está publicada no projeto real.

| Ponto encontrado | Impacto e decisão para integração |
| --- | --- |
| `users.plan` pode ser criado/alterado pelo titular; regras 28–41 e 125–134 | É dado de perfil não confiável para cobrança ou direito pago. Catálogo/benefícios no backend precisam de autoridade administrativa própria. Não usar esse campo para autorizar planos SaaS. |
| `users.email` é validado como texto, sem comparar ao e-mail verificado do token | Perfil não é comprovação de identidade/e-mail. Backend deve usar identidade do provedor e procedimentos explícitos de vinculação. |
| `api_keys/{uid}` pode ser lido pelo titular e gravado diretamente do navegador; regras 182–189 | Isolamento entre usuários não equivale a segredo exclusivamente no servidor. Uma chave no estado React/Firestore acessível ao navegador continua exposta a código executado nessa sessão. |
| Regras de leitura usam autenticação; gravações usam e-mail verificado | Não presumir que regras próprias de autenticação do backend sejam aplicadas automaticamente às chamadas diretas do SDK Firestore. |
| Sem regra específica para `signed_contracts` | O fluxo visual que tenta gravar nessa coleção pode ser negado pelas regras locais. Isso reforça que mostrar “assinado” antes de persistir/provar não é confirmação de assinatura. Não liberar a coleção indiscriminadamente para fazer a interface funcionar. |
| Testes atuais de regras | São testes de texto e avaliadores JavaScript; não equivalem à execução das regras pelo Emulator Suite. Homologação com emulador e isolamento real de projetos são pendências. |

Mudança de regras exige coordenação com Antigravity/AI Studio e implantação autorizada. Nenhuma regra foi publicada. Antes de restringir chaves antigas, planejar compatibilidade, armazenamento seguro no backend, referência por provedor, máscara/status, substituição sem retorno do segredo e migração separadamente autorizada. Não apagar documentos existentes nesta etapa.

## OAuth e encerramento de sessão

`src/firebase.ts` solicita todos os `SCOPES` no login (linhas 42–80): inclui acesso amplo ao Gmail, envio, alteração de configurações e escopos Google Chat, além de Drive. O requisito de cada recurso deve ser inventariado; login básico deveria solicitar identidade, e acesso adicional somente por ação específica com consentimento incremental. A lista extensa amplia risco e pode exigir verificação do aplicativo pelo Google; não prova que todos os serviços funcionem ou sejam gratuitos.

O access token está em memória e não foi encontrado persistido em localStorage/sessionStorage nesse módulo. Isso evita persistência desnecessária, mas não protege contra código malicioso executado no navegador. `handleFirestoreError` registra UID/e-mail/caminho e erro completo (linhas 125–148): revisar minimização de dados pessoais e sanitização antes de enviar logs a terceiros.

Há duas saídas independentes: `src/context/AuthContext.jsx`, `logout`, chama `/auth/logout`; `src/firebase.ts`, `logout`, chama `signOut(auth)` e limpa cache OAuth. Sair de uma não necessariamente encerra a outra. Coordenar o botão de saída para encerrar cookie local e SDK Firebase, limpar estado e testar retorno/navegação/reabertura. Não revogar globalmente credenciais ou consentimentos reais como atalho para corrigir a interface.

## Gestão de chaves e status

`src/components/g360/ApiKeysSettings.jsx` lê valores inteiros de `api_keys` para o estado React (linhas 35–48), salva diretamente com `setDoc` (78–93) e mostra “Conectado / Ativo” a partir de comprimento maior que cinco (104–115). Campo preenchido não demonstra autenticação, saldo ou autorização de cobrança. Antigravity deve consumir status verificado do backend e preservar “configurado/não verificado” até um teste específico autorizado.

O backend ainda reconhece o alias `VITE_GOOGLE_MAPS_API_KEY` (`server.ts`, `getPlacesApiKey`). Prefixo VITE é destinado a variáveis que podem ir para o navegador; usar chaves distintas por finalidade com restrição adequada. Não renomear nem rotacionar uma chave real sem plano de compatibilidade/autorização. Configuração web Firebase é identificação pública de projeto, diferente de uma conta de serviço administrativa; não confundir as duas para ocultar ou liberar credenciais.

O indicador `paidUseAuthorized: false` do inventário é informativo, não interceptor universal. Há caminhos de IA/coleta que usam fornecedores diretamente ou contabilizam após chamar o provedor. Política de crédito/custo precisa ser aplicada antes de cada saída, com fonte de autorização, cotas por conta, reserva e tratamento de falhas. Não afirmar que `strictFreeMode` elimina todo risco de cobrança.

## Responsáveis e critérios de fechamento

| Responsável | Trabalho de integração |
| --- | --- |
| Codex/backend | Autoridade das sessões, limite de memória, autenticação, controle de propriedade, API de status e gestão server-side de chaves. Testar com SDK simulado e dados fictícios. |
| Antigravity | Logout coerente, estados reais de contratos e integrações, não exibir aprovação como assinatura, substituir leitura de segredos por status e plano administrativo. |
| Google AI Studio | Consentimento incremental, escopos OAuth mínimos, prompts/fallbacks e limites de exposição de dados. Não sobrescrever `src/firebase.ts` sem conciliação. |
| OpenCode | Garantir que coleta/exports usem identidade/permissões e política de custos do backend; não reintroduzir bypass de URL, gravação JSON direta ou exposição de chave. |
| Usuário/operador | Autorizar separadamente recuperação real, migração/rotação de chaves, alteração/publicação de regras e recursos externos. Provar titularidade e recuperar backup independente antes de operações reais. |

Critérios para aprovação integrada: nenhuma sessão com origem Firebase conserva função revogada; logout dos dois contextos verificado; titular A não lê dados/chaves de B; cliente não altera benefício pago; ausência de chave não produz “ativo”; fornecedor indisponível não gera sucesso fictício; segredos não aparecem em respostas/logs; cenários de negação rodam no emulador de regras antes de implantação autorizada. Permanecem obrigatórias revisão jurídica, controle de custo e recuperação operacional. Este documento não declara produção pronta.
