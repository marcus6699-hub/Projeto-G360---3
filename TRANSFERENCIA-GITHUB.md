# Estratégia de transferência — sem push nesta etapa

## O que foi comprovado

- ZIP de fonte preparado separadamente, sem .git/histórico, bancos, credenciais reais, node_modules ou dist.
- Arquivos e hashes locais verificados; fonte integrada original não foi editada.
- Leitura Git remota de refs/heads/main funciona.
- A branch proposta `codex/transferencia-g360-windows-v1` não foi encontrada no remoto durante esta consulta. Não foi criada.
- `gh api repos/marcus6699-hub/Projeto-G360---3` retornou Forbidden. A política de rede não lista api.github.com. A consulta não comprovou a visibilidade nem permissões de escrita. Não foi tentado contornar o bloqueio ou testar escrita.
- Não há mecanismo de anexo/upload de arquivos disponível nesta conversa. /mnt/data não é gravável pelo usuário do ambiente. Não existe link de download público ou privado criado para este ZIP.

## Privacidade e recomendação

GitHub não oferece privacidade individual de branch: todas herdam a visibilidade e os acessos do repositório. package.json private:true apenas evita publicação npm acidental; não torna GitHub privado.

Se o repositório atual estiver CONFIRMADO como privado e houver permissão para escrever, uma branch nova pode transportar somente o pacote revisado, sem alterar main. Ainda não há comprovação suficiente para afirmar que o envio está autorizado/seguro neste ambiente.

Recomendação mais segura diante dessa incerteza: repositório GitHub SEPARADO, privado e vazio, como destino exclusivo de transferência; usar a branch codex/transferencia-g360-windows-v1, sem importar histórico antigo. Desativar GitHub Actions/automações antes do primeiro push para evitar execuções/consumo não autorizados. Nenhum novo serviço pago é necessário, mas criação/configuração do repositório e qualquer push dependem de autorização do usuário e de acesso disponível.

## Sequência futura, somente após autorização

1. Confirmar proprietário/destino, private=true, colaboradores autorizados, proteção de main e permissão de escrita. Se a API continuar bloqueada, a confirmação de visibilidade deve vir da configuração do GitHub acessível ao usuário; a leitura Git sozinha não a prova.
2. Usar somente a pasta preparada G360-Business-Windows e seu inventário. Não copiar .git do projeto antigo; seu histórico pode conter bancos/dados antigos. Manter os originais intactos.
3. Revisar fontes, exemplos e fixtures novamente para segredos. Fixtures explícitas (.invalid, senhas de teste e chave demo) não são credenciais reais. Não transportar dados produzidos pela avaliação.
4. Criar checkout/repositório de transferência isolado e commit somente depois da autorização específica; usar snapshot sem histórico anterior. Nenhum commit foi feito nesta etapa.
5. Enviar exclusivamente para a branch de entrega do destino privado confirmado. Sem merge, sem tocar main e sem workflows/deploy automático. Registrar os hashes completos e resultado real; não declarar sucesso antes de o GitHub confirmar o envio.
6. No Windows: GitHub → repositório privado → selecionar branch correta → Code → Download ZIP. Alternativamente usar git clone com branch específica e autenticação normal do GitHub. Não colocar tokens em URLs/comandos/arquivos.
7. O ZIP gerado pelo GitHub terá hash de arquivo diferente do ZIP local; conferir o MANIFESTO-ARQUIVOS.json após extrair com node scripts/verify-transfer.mjs. Para transferir o ZIP EXATO com o SHA-256 desta entrega, poderá ser incluído como artefato na branch privada ou em armazenamento privado autorizado, também somente após autorização.

## Condição atual

Pacote revisável pronto localmente. Transferência real ao computador ainda depende de um canal autorizado. Não houve commit, branch criada, push, merge, publicação, alteração de visibilidade nem ativação de serviço. A opção de branch privada é tecnicamente possível apenas dentro de repositório privado, com acesso confirmado; não foi validada a capacidade de escrita.
