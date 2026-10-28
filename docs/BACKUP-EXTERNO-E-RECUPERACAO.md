# Backup externo e recuperação — preparação sem dados reais

Data: 27/10/2026. Branch: `codex/auditoria-g360`.

## Implementado

`scripts/backup-json.mjs` oferece três operações offline, sem serviço contratado ou transmissão pela rede:

- `export ORIGEM DESTINO`: lê uma base existente válida, confere a revisão SHA-256 e cria uma cópia verificável em caminho novo fora do checkout.
- `verify BACKUP`: valida formato, tamanho, integridade dos bytes e estrutura da base.
- `restore-new BACKUP NOVO_ARQUIVO`: restaura exclusivamente em arquivo inexistente fora do checkout e relê o resultado com `AtomicJsonStore`.

Nenhuma operação altera o arquivo original. Destinos existentes, inclusive links simbólicos, são recusados. A verificação de caminho resolve o diretório real para impedir que um link aponte novamente ao checkout. A ferramenta não oferece comando para substituir `db.json` nem redefinir credenciais.

Novos arquivos têm permissão `0600`; arquivo e diretório são sincronizados com o disco antes da confirmação. A gravação exclusiva impede que dois processos sobrescrevam o mesmo destino. Uma interrupção pode deixar um arquivo incompleto: a ferramenta retorna falha e nunca reutiliza esse destino. Preserve-o para inspeção e escolha outro nome. Uma falha de sincronização pode ocorrer depois da escrita dos bytes: não considere essa execução confirmada.

A cópia usa um envelope versionado separado; o formato do banco do aplicativo continua inalterado. O limite atual é 64 MiB para o envelope completo, portanto o JSON original terá limite menor por causa da codificação Base64. Bases maiores exigem revisão da ferramenta, não truncamento.

## Ensaio seguro

Os testes criam bases exclusivamente fictícias em diretórios temporários. Para repeti-los:

```sh
node --test scripts/backup-json.test.mjs
```

Resultado desta etapa: **15 testes aprovados, zero falhas e zero testes ignorados**. Cobertura: cópia exata, restauração verificável, permissões privadas, destino existente, gravações concorrentes, caminhos internos e links, origem inválida, corrupção de checksum/conteúdo, interrupção de gravação, `EACCES`, `ENOSPC`, falha de sincronização, recuperação em novo destino e logs sem conteúdo das contas.

Não foi criado backup do banco real, nem realizada restauração ou alteração de acesso administrativo.

## Procedimento para futura aprovação

1. Identificar responsáveis pelo backup e pela recuperação e um destino privado em armazenamento separado. Um diretório fora do checkout, mas no mesmo disco, é somente uma cópia local e não protege contra perda física desse disco.
2. Aprovar janela operacional, retenção e tratamento dos dados pessoais. Para um conjunto consistente com arquivos gerados, métricas e outras fontes, suspender os escritores e inventariar cada componente. Esta ferramenta cobre somente a base principal compatível com `isApplicationDb`; não inclui PostgreSQL, Firestore, métricas ou arquivos de sites.
3. Depois de autorização específica para os dados reais, executar a exportação para um nome novo no destino aprovado; guardar o checksum apresentado em registro protegido separado.
4. Proteger a cópia com criptografia e controles de acesso do armazenamento aprovado antes de qualquer transferência externa. Nenhum upload é feito pela ferramenta.
5. Ler novamente a cópia a partir do destino externo com `verify`, comparando seu SHA-256 com o registro independente.
6. Executar `restore-new` para outro caminho novo de ensaio; verificar checksum, quantidades esperadas, login e permissões em instância isolada sem credenciais externas e sem chamadas pagas.
7. Registrar data, responsável, resultado do ensaio e critérios de aceitação. Apenas então propor separadamente qualquer troca da base original e plano de retorno. Essa troca e qualquer redefinição de senha dependem de autorização e não são executadas por esta ferramenta.

## Limitações e bloqueios

- Base64 **não é criptografia**. O envelope contém todos os dados da base, inclusive hashes de senhas e eventuais chaves legadas. Não enviar por chat, e-mail ou repositório e não guardar em diretório servido por HTTP.
- SHA-256 detecta corrupção comparado com um valor confiável. Não autentica a autoria: quem puder alterar o conteúdo e o checksum pode forjar um envelope válido. O registro independente, a proteção de acesso e, quando necessário, assinatura/autenticidade do armazenamento são requisitos operacionais.
- Somente a base principal é copiada. Um plano completo precisa cobrir PostgreSQL, Firestore, configurações necessárias e arquivos gerados sem expor segredos. Serviços remotos, identidade administrativa e plano de backup ainda exigem decisão e acesso autorizados.
- O snapshot representa um instante validado; gravações posteriores continuam acontecendo. Recomenda-se suspender os escritores para testes de restauração e conjuntos com várias fontes.
- O backup externo físico, a política de retenção, a criptografia e o ensaio de recuperação do ambiente real permanecem pendentes. Não se deve declarar recuperação de produção validada com base apenas nestes testes fictícios.
