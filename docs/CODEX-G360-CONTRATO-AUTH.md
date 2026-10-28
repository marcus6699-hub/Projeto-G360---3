# Contrato de autenticação e logout — 28/10/2026

`GET /api/auth/me` agora usa a mesma autoridade de `requireAuth`: cookie opaco válido OU token Firebase Bearer validado/revogado/claims atuais. Resposta preserva `{id,name,email,role}`; ausência de identidade, expiração, header malformado ou credencial recusada resulta em 401. Nome/e-mail desconhecidos são `null`, nunca identidade demonstrativa. Header inválido não recorre a cookie silenciosamente. Falha de leitura/persistência continua 503.

`POST /api/auth/firebase` troca um ID token verificado por cookie e mantém origem/horário de autenticação. `POST /api/auth/refresh` renova cookie existente: não renova token OAuth, não cria sessão anônima e não troca sessão Firebase por local. Consumidor apenas Bearer usa `/me` diretamente e renova token pelo SDK; não precisa de cookie para `/me`.

`POST /api/auth/logout` revoga somente a sessão opaca atual e expira o cookie com mesmos atributos de segurança. Resposta adicional `{scope:'backend_cookie',firebaseSignOutRequired:true}` explicita que o SDK do navegador precisa sair também. Não revoga tokens globais ou sessões de outras pessoas/dispositivos. Tokens OAuth/ID extraídos antes do logout não são magicamente anulados pelo logout de cookie; não prometer isso.

## Conciliação frontend

`src/lib/auth/logoutCoordinator.ts` é helper testado e ainda não integrado ao `AuthContext.jsx` reservado. Chama backend e Firebase mesmo se um falhar, limpa estado local, e retorna erro sanitizado se a saída ficou incompleta. O frontend não deve engolir esse erro e mostrar sucesso. Enquanto sessão não é encerrada, ocultar dados privados e oferecer nova tentativa.

Patch isolado em `docs/patches/auth-context-logout.patch`. Antes de aplicar, conferir versão atual do Antigravity. Usar `logout` já existente em `src/firebase.ts` para limpar SDK e cache OAuth, e limpar caches/seleções por UID. Não apagar conteúdo legado sem comprovar proprietário. Não salvar tokens em localStorage para corrigir propagação.

Testes: matriz HTTP em `firebaseSession.test.ts` cobre Bearer/cookie, ausência, header inválido, erro, logout, sessões paralelas e expiração. Testes do helper usam funções injetadas; não são prova de logout integrado no navegador Firebase. O ensaio real de navegador atual comprova apenas login/logout local; o emulador comprova backend/Auth separado, conforme seus relatórios.
