# Validação da preparação de segurança — 27/10/2026

**Estado:** preparação concluída para avaliação; migração real e revisão final de segurança ainda pendentes. Branch verificada: `codex/auditoria-g360`, no commit de origem `5190b4b8f6ac80eda6fe565e228eb740251ea165`. A `main` remota continua nesse commit. Nenhum merge, push ou publicação foi feito.

## Verificações desta rodada

- Testes de segurança e testes existentes: **28 passaram, 0 falharam, 0 pulados**. Executados em cópia temporária com usuários, projetos, auditoria e lead fictícios. Incluíram bloqueios a senha antiga, acesso anônimo e acesso de outro usuário, além de operações autorizadas.
- Análise de tipos (`npm run lint`, que executa TypeScript): **passou**.
- Build (`npm run build`): **passou**. Permanecem avisos de bundle grande, import dinâmico Firebase sem separação de arquivo e configuração Vite com `__dirname`.
- Procedimento de backup/restauração: na cópia fictícia, o modo de prévia não alterou um byte; a aplicação criou um backup idêntico ao arquivo anterior; a restauração por cópia do backup recuperou o mesmo hash SHA-256. A conta fictícia foi redefinida novamente apenas para executar a suíte de testes.
- `git diff` dos arquivos `db.json` e `cost-guard-metrics.json` originais: vazio. As alterações de código e este relatório permanecem somente no checkout da branch de auditoria.

## Como preservar o acesso administrativo futuramente

O código atual rejeita a senha antiga em texto simples; portanto, **não se deve ativar essa versão esperando que a conta antiga continue acessível sem preparação**. Há dois caminhos sem senha padrão:

1. Preferido se o projeto usar Firebase: identificar uma conta Firebase controlada pelo responsável, conceder a ela o papel administrativo por configuração confiável do Firebase e testar o login administrativo no ambiente de destino antes de redefinir a senha local antiga. O e-mail isolado não concede privilégios. Essa configuração externa requer autorização e validação próprias.
2. Em manutenção programada: confirmar o titular e o UID da conta local antiga, criar backup durável fora do checkout, executar a prévia de `scripts/setup-admin.mjs`, aplicar a nova senha fornecida em variável segura e confirmar um login administrativo antes de liberar a aplicação. Se falhar, parar a aplicação e restaurar o backup validado. Isso depende de autorização específica antes da execução em dados reais.

O backup criado pelo script é **local ao ambiente**. Antes de uma alteração real, é necessário guardar e testar uma cópia recuperável fora desta máquina. A restauração foi demonstrada apenas com dados fictícios. O script de restauração manual, o acesso ao armazenamento externo e o fluxo Firebase real ainda não foram validados em produção.

## Depende de decisão ou autorização

- A senha da conta administrativa legada continua no `db.json` original e seu login fica bloqueado pelo novo código. Nenhuma senha real foi redefinida.
- A propriedade de projetos, auditorias e leads antigos continua sem atribuição automática. Acesso a registros sem titular verificado fica reservado a administradores até comprovação e plano de migração aprovado.
- Login Google/Firebase e o caminho de continuidade administrativa exigem ensaio com conta de teste real e configuração externa autorizada.
- A auditoria anterior identificou outros problemas, especialmente URLs externas fornecidas pelo usuário, persistência JSON e integrações não verificadas. Esta rodada não comprova segurança completa para produção.
