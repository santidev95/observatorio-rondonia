# Ariquemes

## Escopo e fonte

A terceira integração implementa localmente Contratos, Obras e Receitas da Prefeitura de Ariquemes. Fonte: [Portal da Transparência](https://transparencia.ariquemes.ro.gov.br/) e [documentação da API Pública](https://transparencia.ariquemes.ro.gov.br/api/doc). A configuração usa `https://transparencia.ariquemes.ro.gov.br`, **UG 1 = Prefeitura**. A UG 2 é a Câmara e não integra este recorte. Essa numeração difere de Ji-Paraná, cuja Prefeitura usa UG 2; não é herdada automaticamente.

Os algoritmos da plataforma ficam em `src/connectors/publica/`, com wrappers municipais em `src/connectors/ariquemes/`. Host, UG, IDs, chaves de cache e limitador são isolados por município. A semelhança da plataforma não comprova igualdade de cobertura ou disponibilidade entre prefeituras.

Todos os módulos exigem exercício; a omissão escolhe o ano corrente no fuso de Rondônia. Contratos e Obras aceitam de 2000 a 2100 sem prometer dados para todos os anos. A interface de Receitas permite o exercício corrente e o anterior. Implementação, testes e consultas locais não comprovam CI remoto, deploy ou disponibilidade em produção.

## Contratos

Endpoint: `/api/contratos/{exercicio}/1`. A fonte publica páginas de 10, reorganizadas na apresentação em grupos de 25 após validar totais, intervalos, identidade municipal e códigos únicos. Busca textual, filtros locais e ordenação atuam somente sobre a página carregada, sem soma financeira global.

O contrato normalizado preserva `CODIGO` em `sourceId` e combina exercício e código em Base64 URL no ID de navegação. `ANO` permanece em `year`; `sourceYear` registra o exercício consultado. Se os anos divergirem, o registro original é preservado com aviso, sem presumir o critério interno da fonte.

`CONTRATONUM` identifica o número publicado; `OBJETO_COMPLETO` e `OBJETO` fornecem a descrição. `VALCON` é convertido exatamente para centavos. `VIGENI`, `VIGENF` e `ULTVIGENF` preservam as datas e priorizam a última vigência informada com aviso quando ela difere da original. `NPROLI` ou `PROCLIC` conserva a referência do processo; não cria vínculo com Obras por semelhança textual. `DTANULA` permite informar anulação sem inferir outras situações pela data.

Nomes/documentos de fornecedores passam por minimização de CPF e de pessoas físicas identificadas como tal. Pagamentos, execução financeira, data de assinatura, documentos, aditivos confirmados e horário de atualização individual permanecem ausentes neste endpoint. Ausência não é zero.

A API não oferece detalhe por código. A ficha depende da leitura integral do exercício, limitada a 5.000 registros e 500 páginas; solicita `perPage=100`, aceito nas verificações de Ariquemes e Ji-Paraná, e valida os metadados efetivamente retornados. Falha ou limite excedido não são tratados como registro inexistente.

## Obras

Endpoint: `/api/obras/{exercicio}/1`. A implementação só publica `complete: true` após validar todas as páginas e IDs do catálogo do exercício, até 2.000 registros e 200 páginas. A identidade interna é `ariquemes-{exercicio}-{SEQUENCIAL}`, preservando os componentes em `sourceId` e `sourceYear`. `EMPRESA` deve ser 1 e `EXERCICIO` deve corresponder à consulta; `ANO` é preservado em observação, inclusive quando divergente.

`DESCRICAO`, `SITUACAO`, `STATUS`, `CATEGORIA`, `TIPO` e `LOCALIZACAO` preservam o contexto publicado. `VALOR` é **valor total informado**, separado de contratado, pago e a medir, que ficam ausentes. `PERCENTUALEXECUTADO` é republicado sem cálculo próprio de execução física. `DATAINI` e `DATACONCLUSAO` são datas informadas; uma data de conclusão não comprova conclusão efetiva.

Não há pagamentos, medições, documentos, contrato vinculado ou data de atualização individual nesse endpoint. O nome em `NOMEFOR` não acompanha documento/tipo de pessoa e não é republicado. A localização livre não é interpretada automaticamente como bairro ou coordenada. O link da fonte abre o catálogo do exercício, não uma ficha individual documentada.

**Em 23/10/2026, a fonte apresentou cobertura inconsistente:** o total declarou 212, mas uma página única solicitada com `perPage=300` retornou 176, com intervalo 1–176. A última página do tamanho padrão, página 22, retornou vazia para o mesmo total. Os 176 registros retornados normalizaram individualmente sem erro, mas o catálogo completo foi rejeitado naquela validação.

**Em 24/10/2026**, a consulta oficial com `perPage=200` entregou 176 linhas na primeira página e nenhuma na segunda, mantendo `total: 212` nas duas respostas. A consulta de página única com `perPage=300` também entregou 176 para o total declarado de 212. A diferença entre as contagens é de 36 linhas; isso não identifica quais IDs estariam ausentes nem comprova que o total declarado está correto. A normalização das 176 linhas identificou 38 IDs únicos e 138 repetições equivalentes dos mesmos campos públicos, sem conflitos: são 38 obras únicas recebidas, e não 176 obras distintas.

### Exceção de consulta parcial autorizada

Por autorização explícita do mantenedor, Obras de Ariquemes pode exibir os registros recebidos mesmo quando a contagem retornada é menor que o total declarado. O conector consulta todas as páginas declaradas, respeita os limites de coleta e exige metadados válidos e estáveis, identidade municipal e exercício corretos e normalização de todos os registros. Repetições do mesmo ID são agrupadas somente quando todos os campos públicos normalizados forem equivalentes, mantendo IDs únicos na apresentação. Falhas HTTP, cancelamento, metadados inválidos ou alterados, linhas excedentes, registros inválidos e repetições com campos públicos conflitantes continuam bloqueando a consulta. Uma resposta sem registros para um total positivo não é exibida como catálogo vazio; uma resposta completa mantém a rejeição de IDs repetidos.

O contrato normalizado usa `complete: false`, `total` igual à quantidade de obras únicas recebidas e `coverage` com `reportedRows`, `receivedRows`, `repeatedRows` e `rowDifference`. A diferença compara as linhas declaradas e recebidas; as repetições são contadas separadamente. A listagem e as fichas mantêm o aviso **“Dados inconsistentes na fonte”**, com as contagens, o agrupamento de repetições quando houver e a completude não garantida; o JSON conserva essa cobertura. Não é possível determinar pela diferença se há erro no contador ou omissão de registros, e nenhum registro é inventado. Um ID não recebido nesse recorte não vira 404.

Essa consulta parcial não é gravada nem reutilizada no Redis e não substitui uma carga completa válida. A regra é exclusiva de Obras da Prefeitura de Ariquemes (UG 1); Contratos, Receitas e a exceção unitária de Ji-Paraná mantêm suas validações próprias. As contagens da interface são dinâmicas e continuam sujeitas ao comportamento da fonte.

## Receitas

O recorte é **parcial**, composto por três listas anuais da Prefeitura UG 1:

- `/api/receitas/arrecadadas-diretamente/{exercicio}/1`;
- `/api/receitas/transferencias/estaduais/{exercicio}/1`;
- `/api/receitas/transferencias/federais/{exercicio}/1`.

Todas as páginas dos três grupos precisam ser validadas antes da publicação de uma versão. `CODRE` preserva o código da rubrica; `NOMRE`, `NIVEL_2` e `NIVEL_3` mantêm a descrição e classificação disponíveis. `ORCADO` e `ARRECADADO` são valores anuais informados, convertidos em centavos preservando zero, ausentes e negativos previstos no domínio.

O snapshot usa `aggregation: "annual-accounts"` e `coverage: "partial"`. Não há série mensal ou documentos individuais, data do último documento, soma global, percentual da previsão ou total municipal inferido. Não está comprovada a aditividade entre contas/grupos nem a abrangência de todas as receitas. Esse resumo não equivale ao modelo de documentos mensais de Porto Velho, orçamento consolidado ou saldo em caixa.

## Cache, worker e consulta local

Contratos e catálogos completos de Obras usam Redis por uma hora, com chaves `observatorio:RO:ariquemes:<módulo>:v1:...`; Obras acrescenta `year:<ano>:catalog`. Somente resultados normalizados e validados são armazenados, preservando o horário original. Hits não estendem a validade; erros, respostas brutas e consultas parciais não são cacheados. Uma consulta parcial não substitui uma carga completa válida. Sem Redis, esses módulos podem consultar a API diretamente.

Receitas depende do Redis e do serviço Node/Docker `revenues-worker`, com namespace `observatorio:RO:ariquemes:receitas:v2`, fila e lease próprios. O ano corrente é renovado após uma hora e outro exercício consultado após um dia; a última versão válida fica retida por até sete dias. Falhas preservam a versão anterior dentro da retenção. As requisições de página e JSON leem Redis e solicitam atualização à fila, sem coletar a fonte. O limitador é isolado por município e compartilhado entre site e worker.

Use Node.js 22 conforme `.node-version`, `.env.local` próprio e `.env.example`. Para executar os serviços locais:

```powershell
rtk proxy docker compose up --build -d
```

| Módulo    | Página                                 | JSON                                       |
| --------- | -------------------------------------- | ------------------------------------------ |
| Contratos | `/ariquemes/contratos?ano=2026&page=1` | `/api/ariquemes/contratos?ano=2026&page=1` |
| Obras     | `/ariquemes/obras?ano=2026`            | `/api/ariquemes/obras?ano=2026`            |
| Receitas  | `/ariquemes/receitas?ano=2026`         | `/api/ariquemes/receitas?ano=2026`         |

O estado de atualização fica em `/api/ariquemes/receitas/status?ano=2026`, sem consulta à fonte. Receitas retorna 200 (`ready`), 202 (`pending`) ou 503 (`unavailable`); filtros inválidos geram 400. As respostas JSON usam `Cache-Control: no-store`.

Abrir Contratos/Obras pode consultar a Prefeitura em cache miss. Iniciar o worker agenda o ano corrente e pode coletar Receitas. Testes automatizados usam fixtures sintéticas, sem registros municipais reais. Não há arquivo histórico durável implementado; Redis é temporário.

## Evidência da validação

Em **23/10/2026**, a lista de empresas oficial confirmou Prefeitura = 1 e Câmara = 2. Swagger e consulta limitada de Contratos confirmaram o formato compartilhado. As duas primeiras páginas normalizadas da apresentação retornaram 25 registros cada, total oficial 501, 21 páginas de apresentação e ano original 2026 nessas 50 linhas. A origem indicou 51 páginas de dez registros; o detalhe pode solicitar páginas maiores, sem alterar o agrupamento da listagem.

Uma ficha individual de Contratos foi validada após leitura completa das 501 linhas em seis requisições com `perPage=100`, total estável, identificação do exercício 2026 e URL canônica da UG 1. A leitura levou aproximadamente 6,35 segundos naquela verificação. Isso confirma o fluxo daquela ficha e a cobertura do endpoint naquele momento, sem comprovar todas as fichas, completude do cadastro municipal ou disponibilidade contínua.

Obras foi consultada com limites de tempo/tamanho e limitador normal: a coleta do catálogo foi rejeitada por paginação incompatível; a alternativa de página única confirmou 176 registros para total 212. As respostas brutas e dados pessoais não foram persistidos, e as fixtures são sintéticas.

Receitas teve os três grupos anuais de 2026 coletados e validados localmente, com 47 rubricas. Essa contagem descreve as linhas do recorte e não total financeiro, número de documentos ou cobertura municipal completa. Não houve publicação em produção nesta validação.

Os testes cobrem isolamento de Ariquemes e Ji-Paraná, UG 1 versus UG 2, IDs, exercício, centavos, minimização, paginação completa, truncamento, duplicidade, cancelamento, falhas e limites. Validação local não representa publicação em produção; as evidências de cada módulo devem ser mantidas separadas.
