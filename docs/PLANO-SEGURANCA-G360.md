# Continuação da segurança — G360 Business

## O que o código faz agora

- O cadastro inicial não cria administrador com senha fixa. A tela não oferece mais acesso de demonstração. Login Google troca um token Firebase verificado por sessão local; não usa a conta administrativa antiga.
- O login local aceita somente senhas com hash scrypt. Contas antigas com senha em texto simples ficam preservadas, porém bloqueadas até redefinição controlada.
- `scripts/setup-admin.mjs` apenas mostra uma prévia sem `--apply`. Em base vazia, pode criar o primeiro administrador. Em base com usuários, exige UID e e-mail correspondentes a um administrador existente. `--apply` faz backup fora do checkout e grava o JSON por troca atômica. O script nunca foi aplicado aos dados reais desta branch.
- Novas auditorias e leads CRM recebem `ownerUid`. Usuários comuns veem e alteram seus próprios registros. Registros antigos sem proprietário não são atribuídos automaticamente; administradores continuam podendo acessá-los. Configurações globais, gerenciamento de usuários e deploy continuam restritos a administradores.
- A propriedade `isInstagram` foi declarada opcional no tipo do critério, sem mudar o cálculo existente.

## Plano para contas e dados antigos

1. Confirmar com o responsável, fora deste relatório, o UID e e-mail da conta administrativa legítima e verificar backup íntegro do `db.json`. Não enviar senha por chat.
2. Após autorização específica, fornecer uma nova senha apenas por variável segura de ambiente para a execução do comando de redefinição. Primeiro executar sem `--apply`, conferir a prévia e o UID/e-mail. Depois executar `--apply` uma vez, conferir backup e login. Não atribuir projetos, auditorias ou leads antigos nesse passo.
3. Inventariar cada registro antigo sem `ownerUid` e obter comprovação de titularidade antes de propor migração. Preparar mapeamento por IDs, prévia das mudanças, backup e testes de acesso cruzado. Solicitar autorização separada para aplicar esse mapeamento aos dados reais.
4. Enquanto a titularidade não for comprovada, o administrador pode consultar os registros antigos; usuários comuns podem trabalhar com registros novos próprios. Projetos antigos também seguem visíveis apenas para administrador.

## Restrições para revisão final

- A redefinição da conta antiga e eventual atribuição dos dados antigos **não foram feitas**. A conta local antiga permanecerá sem login até a redefinição autorizada.
- A sessão local é guardada na memória do processo: reinício exige novo login. Servidores múltiplos exigiriam armazenamento compartilhado de sessão.
- O fluxo Google foi implementado com `verifyIdToken`, mas não foi testado contra Firebase real. O papel de administrador via Firebase exige custom claim; e-mail sozinho não dá privilégio.
- Não há separação por proprietário para configurações financeiras globais e tokens de deploy; esses recursos permanecem exclusivos do administrador.
- A auditoria anterior apontou riscos adicionais (SSRF, persistência JSON e provedores externos) que não fazem parte destas quatro correções. É necessário revisar esses pontos antes de declarar o aplicativo seguro para produção.

## Validação sem dados reais

Os testes de API rodam exclusivamente numa cópia temporária com a variável `G360_TEST_FIXTURE=1` e uma conta fictícia identificada pelo teste. A aplicação da redefinição foi exercitada apenas nessa cópia. A análise de tipos e o build usam o checkout desta branch. Nenhum comando de migração foi executado no `db.json` original.
