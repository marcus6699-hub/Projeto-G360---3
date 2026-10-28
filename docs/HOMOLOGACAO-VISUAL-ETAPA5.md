# G360 — homologação visual e funcional, Etapa 5

28/10/2026. Avaliação exclusiva da cópia `/workspace/g360-unificado-v1`, com dados fictícios. Não houve deploy, push, merge, alteração de contas reais ou gastos.

## Visualização disponível

Servidor iniciado somente em loopback: `http://127.0.0.1:3001`. A plataforma não expôs ferramenta de encaminhamento privado compartilhável (capabilities vazias); esse endereço pertence ao container e não corresponde automaticamente ao localhost do Windows. Não foi aberto túnel nem endereço público.

Para avaliar sem acesso ao container, abra `index.html` da galeria ou baixe e descompacte `G360-HOMOLOGACAO-VISUAL-ETAPA5.zip`. São 28 capturas reais de Chromium, em 14 telas/estados nos tamanhos desktop 1440×1000 e celular 390×844. Office também foi exercitado em tablet 820×1180. Capturas longas mostram o conteúdo completo; clique para ampliar. Elas são evidência estática, não uma simulação interativa do aplicativo.

Acesso interativo no ambiente, quando há navegador interno/encaminhamento de porta disponibilizado ao usuário: porta 3001. Se o processo terminar, execute:

```bash
cd /workspace/g360-unificado-v1
python3 scripts/serve-private-review.py
```

O inicializador recusa .env e exige configuração/dados fictícios; reduz o ambiente herdado e bloqueia fetch externo no backend. Credenciais aleatórias de teste ficam somente em `/workspace/g360-homologacao-etapa5-data/TEST-CREDENTIALS-PRIVATE.json` (arquivo privado, fora do projeto). Não estão na galeria, no ZIP ou neste relatório. Não apontar G360_DATA_DIR para dados originais.

Roteiro manual: login local → Dashboard → Prospecção → baixar empresas fictícias → Importar JSON → selecionar Aurora → registrar declarações/evidências → prévia Geogrid → preparar Pacote GBP → revisar/aprovar identidade e itens → enviar ao Site Express → gerar projeto local → editar/salvar → exportar HTML/ZIP → importar e selecionar Horizonte → confirmar que as aprovações de Aurora não reaparecem → consultar CRM/Escritório/Administração. A busca externa deve continuar indisponível sem integração homologada.

## Checklist executado

| Área | Resultado local comprovado | Limite |
|---|---|---|
| Login/logout | Senha incorreta negada; login, sessão, reload, saída e isolamento entre contas testados | Firebase/OAuth reais não testados |
| Dashboard | Contagens dos registros autorizados; ações para os módulos principais | Sem faturamento/indicadores comerciais inferidos |
| Prospecção/importação | Importação JSON pelo usuário, lista, seleção e troca A→B no navegador | OSM externo sem configuração retorna indisponível; importação não comprova fonte/propriedade |
| Auditoria GBP | Evidências registradas no backend e relatório detalhado renderizado | Declarações não viram nota oficial Google |
| Geogrid | 25 coordenadas geométricas; posições indisponíveis | Nenhuma medição real de ranking |
| Pacote GBP/branding | Geração de rascunho local, revisão/aprovação e envio dos itens aprovados | IA remota não homologada; todo texto comercial exige revisão |
| Troca entre empresas | Empresa B não recebe conteúdo/aprovação de A; transferência não aprovada bloqueada | Jornada com duas empresas fictícias |
| Central de IA | Tela, navegação e erro honesto de indisponibilidade testados | Voz, transcrição, imagem, vídeo e chat externos não ativados |
| Site Express/editor | Handoff, canvas sandboxado, edição inline, salvamento persistido e downloads HTML/ZIP reais | Recursos remotos de templates podem depender de rede |
| CRM | Tela, lead fictício e isolamento por usuário | PDF nativo não implementado; exporta HTML para imprimir em PDF |
| Escritório | Consulta autenticada de clientes, minutas, sites, financeiro e histórico | Interface de criação/edição ainda via API; sem assinatura/cobrança real |
| Administração | Renderização e bloqueio de não administradores; configurações externas identificadas como não verificadas | Cadastro/configuração externa e serviços reais dependem de autorização/homologação |
| Visual | Nunito local carregada; desktop/celular sem rolagem horizontal da página nos 28 estados; menus e canvas adaptados | Não equivale a auditoria completa de acessibilidade ou todos os navegadores |

## Defeitos comprovados e correções

- Não havia Dashboard próprio: adicionada visão protegida das contagens locais.
- Administração trazia dados pessoais/chave Pix padrão: campos esvaziados na cópia; preferências Pix agora têm namespace por usuário e tela é restrita a admin. Histórico privado preservado; nenhuma conta real alterada.
- Menu desktop cortava opções e tablet ficava apertado: rótulos compactados, Central de IA/Administração em Mais, navegação mobile ativada também no tablet.
- Editor mobile recortava o canvas desktop e exigia rolagem da barra: toolbar passa a quebrar linhas; viewport se adapta e barra lateral fecha em tela pequena. Texto de estado é “Ativo localmente”, sem alegar publicação.
- Nunito era apenas preferência sem fonte instalada: arquivos WOFF2 locais nos pesos 400/600/700/800, pacote Fontsource 5.3.0 com SHA-512 conferido e licença OFL preservada. Sem nova dependência de runtime ou Google Fonts para a tipografia da interface.
- Central de IA anunciava recursos gratuitos ativados e conversas de modelo inexistentes: retirados mensagens/empresa demonstrativas iniciais; recursos sem autorização retornam 503 antes do transporte; fallback de chat/voz não simula resposta do modelo.
- Administração declarava Firebase/OSM/serviços como ativos sem consulta: registro agora separa presença de configuração de comprovação; sem “ativo” ou saldo gratuito presumido.
- Avaliação prática dependia de busca externa indisponível: importação local JSON limitada a 256 KiB/100 empresas, IDs manuais, campos selecionados e origem declarada. Não atribui propriedade, notas, avaliações ou URLs OSM fictícias.
- Hero de novo site podia introduzir frase comercial do template não aprovada: inicia com nome da empresa e descrição informada/aprovada.
- Rótulos “100% aprovado” e “PDF baixado” eram imprecisos: referem-se agora aos itens revisados e ao arquivo HTML efetivamente produzido, mantendo os fluxos existentes.

Arquivos anteriores alterados foram preservados em `historico/` privado. Esse diretório pode conter padrões antigos e não faz parte do ZIP compartilhável. A fonte dos projetos e backups originais permaneceu intacta.

## Testes após as correções

- Suíte automatizada: **332 aprovados, 0 falhas, 0 ignorados** (`logs/testes-final3.log`), incluindo os testes anteriores e dez novos cenários de indisponibilidade, importação manual, hero e status de integrações.
- `npm run lint`: **sucesso**, análise TypeScript (`logs/types-final3.log`).
- `npm run build`: **sucesso** (`logs/build-validado.log`). Permanecem avisos de chunks grandes, __dirname e import Firebase estático/dinâmico.
- Chromium: **22 verificações aprovadas**, **28 capturas**, **0 findings registrados**, **0 erros JavaScript**, nenhuma rolagem horizontal da página nos estados capturados (`resultado-navegador.json`, `logs/navegador-validado.log`). As verificações incluem importação por arquivo real e troca entre empresas, sem simular a resposta de busca OSM na rodada final.
- Servidor privado real verificado por HTTP: página 200, API privada anônima 401, login local/Office/logout funcionando; fixtures de CRM/Escritório preparadas (`logs/servidor-verificado.json`).
- Rede do navegador bloqueou hosts externos durante os testes; nenhum microfone, mensagem, pagamento, assinatura ou serviço real foi acionado. Falhas/tentativas intermediárias foram preservadas nos logs.

## O que falta para produção

1. Homologar Firebase/Firestore/OAuth e regras efetivamente implantadas; recuperação administrativa e propriedade do legado com autorização, sem migração automática.
2. Configurar e verificar cada API externa, política de uso, origem dos dados, limites e custos; não há comprovação de gratuidade de modelos nem créditos/saldo. Busca OSM real e rankings reais continuam pendentes.
3. Escolher/homologar assinador e gateway em sandbox; comprovação de assinatura e pagamento não se obtém por aprovação interna, link ou WhatsApp. Nenhum serviço foi contratado.
4. Revisar textos, imagens e direitos de uso antes de exportar/publicar sites; verificar independência de cada template e suas dependências remotas.
5. Instalação limpa reprodutível, avisos de dependências (incluindo gRPC/esbuild), recuperação operacional, backup externo e limites de JSON/sessões em instância única.
6. Completar criação/edição do Escritório pela interface, PDF nativo se necessário e testes completos de acessibilidade/múltiplos navegadores.
7. Resolver comprovação das bases Git Antigravity/AI Studio e aprovação final para eventual incorporação. Nada foi incorporado ao original.

A cópia está preparada para avaliação prática local. Não está declarada pronta para produção.
