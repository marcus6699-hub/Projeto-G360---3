# Auditoria de APIs e autenticação — 27/10/2026

Escopo: inspeção de código na branch `codex/auditoria-g360`, testes locais sem conexão SQL, sem consultar valores de credenciais e sem alterar contas, dados ou permissões reais. Este inventário não comprova configuração ou disponibilidade de serviços externos. Os itens identificados abaixo devem ser confrontados com as correções integradas e os testes HTTP finais.

## Autenticação e recuperação

- Login local usa scrypt com salt, comparação constante e sessão opaca de oito horas. Senhas antigas em texto simples continuam recusadas; não há conversão automática autorizada.
- Sessões locais estão em memória, são revogadas no logout e desaparecem ao reiniciar. Essa restrição deve ser informada ao usuário antes da manutenção; múltiplas instâncias exigem armazenamento de sessão compartilhado em etapa específica.
- A rota de recuperação anteriormente retornava sucesso sem entregar recuperação. Ela precisa indicar indisponibilidade claramente; não deve emitir token ou adotar identidade apenas porque alguém conhece um e-mail.
- `scripts/setup-admin.mjs` permite prévia e aplicação explícita com identidade administrativa já comprovada, backup e escrita atômica. Apenas cópias do script foram executadas em diretórios temporários com bases fictícias. Redefinição real segue bloqueada até autorização, backup externo restaurado com sucesso em cópia e verificação da identidade do titular por canal confiável.
- Firebase e autenticação local são identidades distintas. Não vincular automaticamente contas pelo e-mail. Claims administrativas devem vir de token verificado; revogação e contas desativadas precisam ser verificadas. Não modificar claims ou funções reais nesta etapa.
- Cadastro e criação administrativa precisam validar tamanho, formato e unicidade de e-mail. A adoção de uma nova política de senha não deve invalidar senhas legítimas já existentes.
- Ausência inicial de proteção de origem e limites de tentativas foi identificada. `authPolicy.ts` oferece verificação explícita de origem, limite por endereço do socket, memória limitada e validação de entradas. O limite é local ao processo, ignora `X-Forwarded-For` não confiável e não substitui proteção compartilhada na borda em produção.
- Projetos, CRM e auditorias JSON filtram `ownerUid`; dados antigos sem proprietário continuam restritos ao administrador, sem apropriação automática.

## Falha SQL corrigida

`src/db/users.ts` usava `auditId` globalmente único para atualizar auditoria sem filtrar seu proprietário no conflito. Um usuário poderia substituir campos de auditoria de outra conta ao conhecer seu identificador.

O `ON CONFLICT DO UPDATE` agora inclui `WHERE audits.user_id = <id interno obtido da identidade autenticada>`. Não muda proprietário nem estrutura do banco. Conflito entre contas não produz linha atualizada e gera `SqlOwnershipConflict` (409), sem confirmar gravação. A integração HTTP deve conservar esse estado.

Testes em `src/db/users.test.ts`: SQL gerado pelo Drizzle contém o filtro de proprietário e parâmetro controlado pelo servidor; conflito sem linha não retorna sucesso. Nenhuma conexão PostgreSQL foi realizada. Validação em PostgreSQL descartável ainda é necessária antes de ativar essa integração real.

## Inventário de integrações

| Integração | Fonte de credencial encontrada | Observação de segurança e custo |
| --- | --- | --- |
| Firebase Auth/Admin | configuração de projeto e credenciais de execução do SDK | Configuração web Firebase identifica projeto; não equivale a chave administrativa. Verificar token e revogação; não assumir status operacional pela existência da configuração. |
| Gemini: texto, imagem, áudio, vídeo, grounding | `GEMINI_API_KEY` no servidor | Não consultar saldo inventado. Cotas/modelos gratuitos dependem do projeto e condições do provedor; algumas chamadas não passam pelo mesmo guardião. |
| Google Places/Maps | `GOOGLE_PLACES_API_KEY`, `GOOGLE_MAPS_API_KEY`, alias `VITE_GOOGLE_MAPS_API_KEY` | Prefixo VITE pode expor valor ao bundle quando utilizado no frontend. Separar chave web restrita e chave de servidor. Redirecionamento de fotos com `key=` foi identificado como exposição e deve ser substituído por entrega segura no backend. |
| Outscraper | `OUTSCRAPER_API_KEY` | Bloqueado por padrão no modo estrito, porém outros caminhos de coleta precisam usar a mesma política. Não presumir saldo gratuito. |
| NVIDIA, OpenRouter, Groq | `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY` | Fallback de IA pode enviar conteúdo a outro operador; requer política, consentimento quando aplicável e autorização de custo. |
| Cerebras, Mistral, Hugging Face | `CEREBRAS_API_KEY`, `MISTRAL_API_KEY`, `HUGGINGFACE_API_KEY` | Mesmas restrições; presença de chave não comprova plano gratuito nem saldo. |
| Serper | `SERPER_API_KEY` | Não comprovar gratuidade a partir do nome da API ou existência de chave. |
| BrasilAPI / CNPJ.ws / Nominatim | sem segredo no código consultado | Respeitar limites e termos; indisponibilidade não deve ser convertida em dados fictícios apresentados como verificados. |
| Pollinations texto/imagem | rotas externas no código | Disponibilidade, privacidade e condições atuais não comprovadas; prompts enviados por URL podem aparecer em logs do provedor. |
| Vercel / Netlify | variáveis de servidor ou tokens em `g360.deploySettings` | Tokens não devem retornar ao navegador nem ser gravados em JSON como configuração comum. Nenhuma publicação autorizada. |
| PostgreSQL | `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME` | Não conectar ambiente real nesta tarefa. Sanitizar erros para evitar detalhes internos nos retornos HTTP. |
| Google Workspace / Drive / Gmail | token OAuth em memória no frontend | Não persistir token em armazenamento web. Escopos mínimos e envio real exigem autorização específica; interface não prova operação concluída. |

## Pontos de proteção de dados

1. Respostas públicas de sites anteriormente retornavam o objeto completo e não filtravam estado suspenso. Entregar apenas campos necessários, sem metadados privados, e garantir suspensão no servidor.
2. As configurações de implantação retornavam tokens ao administrador no navegador e aceitavam persistência em JSON. Preferir segredo em ambiente/gerenciador externo, status booleano e remoção de valores das respostas. Não migrar nem apagar valores existentes sem autorização.
3. As regras Firestore permitem ao titular ler o documento de suas chaves e alterar `users.plan`. Esse campo não pode conceder direitos pagos. Regras remotas não foram publicadas nem alteradas; integração futura deve tratar plano e segredos no backend e coordenar compatibilidade com a interface.
4. Não registrar objetos de erro de SDK/SQL sem sanitização: eles podem conter URLs, parâmetros, conteúdo ou dados de conexão. A rota HTTP deve retornar mensagens genéricas.
5. Dados pessoais, documentos de contratos e evidências exigem retenção definida, acesso restrito, backup externo protegido e procedimento LGPD. Não estabelecer validade jurídica ou conformidade universal apenas por adicionar logs e hashes.
6. Um único backup local anterior não protege contra perda física da máquina. Recuperação e backup externo continuam requisito de operação real.

## Gratuidade e medição

`strictFreeMode` controla configurações locais e não consulta fatura, créditos ou plano do provedor. Defaults históricos permitiam Gemini e Places mesmo nesse modo. Há caminhos que contabilizam após a chamada, o que não impede excesso concorrente nem cobrança de requisição que falhou após chegar ao provedor.

Preparação para comercialização exige inventário de caminhos de saída, reserva anterior à chamada, contadores por conta, política explícita de autorização, testes de concorrência e prova de gratuidade do ambiente selecionado. Saldo desconhecido deve ser apresentado como desconhecido. Os testes desta tarefa não consumiram serviços externos.

## Testes do módulo de políticas

`src/server/authPolicy.test.ts`: sete testes de origem legítima/hostil, mutações, CLI, limite de tentativas, proxy forjado, memória limitada, recuperação após janela, tamanho de entradas e status explícito de conta.

`src/db/users.test.ts`: dois testes de isolamento no SQL e conflito sem falso sucesso.

`src/server/adminRecovery.test.ts`: seis testes de recuperação exclusivamente fictícia. Verificam prévia sem gravação, recusa de identidade/e-mail/função incorretos, senha insuficiente, necessidade de UID em base existente, recusa de corrupção, preservação dos demais dados, backup privado com igualdade de bytes, SHA-256 da cópia externa simulada e restauração em arquivo separado. O teste HTTP usa cópia do backend com configuração Firebase fictícia: antes da recuperação a senha antiga entra e a nova é recusada; após parar o processo, recuperar e reiniciar, a antiga é recusada e a nova entra, com acesso administrativo comprovado. Nenhum backend foi iniciado contra a base original.

Resultado desses três arquivos: **15 testes aprovados, 0 falhas, 0 ignorados**. O relatório consolidado deve informar também os testes HTTP adicionais e a suíte anterior. A simulação externa usa outro diretório na mesma máquina; não comprova resiliência de um provedor externo ou disco separado. A aplicação real continua condicionada a autorização e verificação operacional do destino independente.
