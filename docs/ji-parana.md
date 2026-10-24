# Ji-Paraná

## Escopo da segunda integração

Contratos, Obras e Receitas de Ji-Paraná estão implementados localmente em `src/connectors/ji-parana/`, reutilizando os contratos normalizados, leitores no servidor e componentes do portal. Esta documentação não comprova publicação em produção. CI remoto, deploy e consultas à instalação pública devem ser verificados separadamente.

Na verificação de **23/10/2026**, Obras apresentou paginação inconsistente na fonte: 112 linhas retornadas para um total declarado de 113. A carga foi inicialmente rejeitada. Em seguida, o mantenedor pediu explicitamente **“assuma que falta uma”**: a implementação permite exibir esse recorte como consulta parcial, com um registro ausente assumido, 29 repetições equivalentes agrupadas e 83 obras únicas disponíveis. Essa hipótese não identifica o registro ausente nem comprova que o total declarado esteja correto. Veja as [evidências da verificação](#evidências-e-limites-da-verificação).

A origem é o [Portal da Transparência de Ji-Paraná](https://transparencia.ji-parana.ro.gov.br/), plataforma Pública, com [Swagger](https://transparencia.ji-parana.ro.gov.br/api/doc) e [OpenAPI](https://transparencia.ji-parana.ro.gov.br/docs?api-docs.json). A unidade gestora usada é **2, Prefeitura**. A unidade 1 corresponde à Câmara e não integra este recorte. Os exemplos da documentação municipal podem usar UG 1; o conector sempre monta as rotas da UG 2.

Todos os módulos exigem exercício. O padrão do portal é o ano corrente no fuso `America/Porto_Velho`; não há opção implícita de todos os anos. Contratos e Obras aceitam exercícios de 2000 a 2100, sem prometer que a fonte possua registros em todo esse intervalo. A interface atual de Receitas permite o exercício corrente e o anterior. Uma lista vazia validada é diferente de fonte indisponível.

## Contratos

Fonte: `/api/contratos/{exercicio}/2`. A origem publica 10 registros por página e ignorou os parâmetros alternativos de tamanho nas consultas limitadas. A apresentação mantém grupos de 25 registros, lendo as páginas oficiais necessárias e validando os totais, os intervalos, o exercício, a UG e os códigos únicos. Não há soma financeira sobre a página parcial.

| Campo da fonte                  | Interpretação no Observatório                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `CODIGO`                        | ID oficial em `sourceId`; o ID de navegação combina exercício e código em Base64 URL, sem substituir o código preservado. |
| `CONTRATONUM`, `ANO`            | Número e ano informados; `year` preserva `ANO` e `sourceYear` guarda o exercício consultado, mesmo quando divergentes.    |
| `OBJETO_COMPLETO`, `OBJETO`     | Objeto completo quando disponível, com alternativa para o objeto resumido.                                                |
| `VALCON`                        | Valor informado do contrato, convertido exatamente para centavos. Não implica pagamento ou execução física.               |
| `EMPRESA_NOME`                  | Unidade responsável publicada pela origem.                                                                                |
| `NOMEFORNECEDOR`, `INSMF`       | Fornecedor e documento minimizado; nomes de pessoas físicas identificadas como tal e CPF não são republicados.            |
| `NPROLI`, `PROCLIC`             | Referência de processo publicada, sem gerar vínculo com outra entidade por semelhança textual.                            |
| `VIGENI`, `VIGENF`, `ULTVIGENF` | Início, fim original e último fim de vigência. A última vigência prevalece quando informada; divergências são explicadas. |
| `DTANULA`                       | Data de anulação, quando informada; não são deduzidas outras situações pela data de vigência.                             |

O exercício é enviado à fonte sem presumir seu critério interno. A consulta de 2026 retornou também contratos com `ANO` 2025; esses registros, seus anos originais e o total oficial são preservados, com aviso explícito. O ID de navegação e as chaves de cache usam o exercício consultado, não reclassificam o ano original nem descartam os registros divergentes.

Pagamentos, execução financeira, data de assinatura, documentos, aditivos confirmados e atualização individual não estão disponíveis neste endpoint e permanecem ausentes. `null` não é convertido em zero. A fonte não oferece detalhe de contrato por código: para abrir uma ficha, o conector precisa concluir a leitura do exercício, limitada a 5.000 registros e 500 páginas. A ficha solicita `perPage=100`, aceito nas verificações de Ji-Paraná e Ariquemes, e valida os metadados efetivamente retornados. Cobertura alterada, página incompleta ou limite excedido causam indisponibilidade; não produzem falso 404.

Busca, filtros de órgão e situação e ordenação atuam somente sobre os 25 registros carregados. O filtro de exercício e a navegação de páginas consultam a origem. Links de ficha são gerados pela própria listagem e carregam a identidade do exercício.

## Obras

Fonte: `/api/obras/{exercicio}/2`. O conector solicita `perPage=200` para reduzir as chamadas, mas valida o tamanho de página e os demais metadados efetivamente retornados. Só publica `complete: true` depois de ler e validar todas as páginas do endpoint naquele exercício. O limite é de 2.000 registros e 200 páginas. Esse marcador descreve a coleta do endpoint selecionado, sem garantir que a Prefeitura tenha cadastrado todas as obras municipais.

### Exceção de consulta parcial autorizada

A decisão explícita do mantenedor permite exibir os dados recebidos **somente quando a última página entrega exatamente uma linha a menos do que o total declarado**. Todas as páginas anteriores, os demais metadados, a UG, o exercício e os registros recebidos continuam sujeitos à validação. Repetições de um mesmo ID só podem ser agrupadas quando os campos normalizados são equivalentes; diferenças no campo `NOMEFOR`, que não é republicado, não criam obras distintas. Repetições conflitantes, ausência em página intermediária, falta de mais de uma linha ou qualquer outra inconsistência continuam causando indisponibilidade. Essa exceção pertence ao conector de Obras de Ji-Paraná; não modifica Ariquemes, Contratos ou Receitas.

O contrato normalizado usa `complete: false` e inclui `coverage` com `reportedRows`, `receivedRows`, `repeatedRows` e `assumedMissingRows: 1`. `total` e `records` contêm apenas as obras únicas efetivamente disponíveis. No recorte observado de 2026, isso corresponde a 113 linhas declaradas, 112 recebidas, 29 repetições equivalentes e 83 obras únicas. As contagens são calculadas a cada consulta, sem valores fixos na interface.

A listagem e as fichas exibem o aviso persistente **“Consulta parcial — 1 registro ausente (assumido)”**, com as contagens e o link da origem. O JSON mantém os mesmos metadados; não declara catálogo completo. A ficha de uma obra recebida permanece acessível. Se o ID solicitado não estiver no recorte parcial, a página informa essa ausência com acesso à lista e à fonte, sem inventar uma ficha nem concluir que a obra não existe. O 404 por ID não encontrado continua reservado a um catálogo completo validado.

Essa resposta parcial não é gravada nem reutilizada no Redis e não substitui uma carga completa válida. O horário original da consulta é preservado. O sistema não cria um registro sintético para preencher a diferença nem transforma linhas declaradas em uma contagem de obras municipais.

| Campo da fonte                        | Interpretação no Observatório                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `SEQUENCIAL`, `EXERCICIO`, `EMPRESA`  | ID oficial, exercício e UG. O ID interno é `ji-parana-{exercicio}-{SEQUENCIAL}`; `sourceId` e `sourceYear` preservam os componentes. |
| `DESCRICAO`, `SITUACAO`, `STATUS`     | Descrição e situação publicadas; não são inferidas a partir de valores ou datas.                                                     |
| `CATEGORIA`, `TIPO`, `LOCALIZACAO`    | Categoria, tipo e localização informados. Localização livre não é convertida automaticamente em bairro ou coordenada.                |
| `VALOR`                               | **Valor total informado**, em `declaredValueCents`. Não é tratado como contratado, pago ou a medir.                                  |
| `PERCENTUALEXECUTADO`                 | Percentual republicado da fonte, sem cálculo ou validação de execução física pelo Observatório.                                      |
| `DATAINI`, `DATACONCLUSAO`            | Início e data de conclusão informados. Uma data de conclusão, inclusive futura, não comprova conclusão efetiva.                      |
| `NUMERO`, `ANO`, `DATA`, `ESTIMATIVA` | Preservados como observações rotuladas. `ANO` pode divergir do exercício da consulta e gera aviso, sem descartar o registro.         |

O endpoint não publica pagamentos, medições, documentos, contrato vinculado nem horário de atualização do registro. Esses campos ficam ausentes. `NOMEFOR` não acompanha documento ou tipo de pessoa; o nome não é republicado, sem inferir pessoa jurídica pela aparência do texto. O link da fonte identifica o catálogo oficial do exercício, pois não há endpoint de detalhe de obra documentado nesta API.

Busca, situação e ordenação atuam sobre o catálogo do exercício já carregado. A escolha de outro exercício consulta outra chave de cache e outro catálogo. Não são somados exercícios distintos para produzir um suposto total municipal.

## Receitas

A integração possui **cobertura parcial** da Prefeitura (UG 2), limitada às três listas anuais:

- `/api/receitas/arrecadadas-diretamente/{exercicio}/2`;
- `/api/receitas/transferencias/estaduais/{exercicio}/2`;
- `/api/receitas/transferencias/federais/{exercicio}/2`.

Cada lista é paginada. Todas as páginas dos três grupos precisam passar pela validação antes de substituir uma versão válida. Isso confirma somente a cobertura dos endpoints implementados, não todas as receitas municipais. Outros grupos, outras unidades gestoras e documentos individuais não foram integrados.

| Campo da fonte                | Interpretação no Observatório                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `CODRE`                       | Código oficial da rubrica, preservado em `sourceId`. A identidade interna inclui município, exercício e UG. |
| `NOMRE`, `NIVEL_2`, `NIVEL_3` | Descrição e classificações publicadas; o grupo da consulta é usado quando a classificação não é informada.  |
| `ORCADO`                      | Previsão anual informada da rubrica, em centavos.                                                           |
| `ARRECADADO`                  | Arrecadação anual informada da rubrica, em centavos, separada da previsão.                                  |

O snapshot declara `aggregation: "annual-accounts"` e `coverage: "partial"`. As linhas representam rubricas agregadas pela fonte; não são contagens de documentos de arrecadação. Não existe série mensal nesta integração, e a fonte não informa a data do último documento. Valores negativos, zero e ausência são preservados quando previstos no domínio.

**Não há soma global, percentual de realização da previsão nem total municipal inferido.** A aditividade das classificações e a cobertura entre os três grupos não foram comprovadas. Os valores de cada rubrica permanecem como publicados. O painel e o JSON não devem apresentar esse recorte como equivalente ao resumo de documentos mensais de Porto Velho, orçamento consolidado ou saldo em caixa.

## Transporte, cache e atualização

O transporte monta URLs HTTPS no host oficial, com exercício, UG 2 e página explícitos; não segue links de paginação retornados pela origem. Confere HTTP, JSON, tamanho, contagens e intervalos. Há limite de 5 MiB por resposta, timeout de 12 segundos por requisição, cancelamento e mensagens de erro sem conteúdo bruto. As cargas completas também têm timeout no leitor. Mudança de schema ou cobertura causa erro explícito.

Contratos e catálogos completos de Obras usam cache Redis por uma hora, somente no servidor, com fallback à API quando o cache não está disponível ou a entrada não é válida. Os namespaces são isolados por UF, município, módulo e versão; Obras acrescenta o exercício: `observatorio:RO:ji-parana:obras:v1:year:<ano>:catalog`. `fetchedAt` conserva a consulta original e um hit não renova a validade. Erros, respostas brutas e a consulta parcial autorizada de Obras não são armazenados.

Receitas usa o mesmo serviço Docker/Node `revenues-worker` de Porto Velho, Ji-Paraná e Ariquemes, com fila, lease, heartbeat e publicações atômicas separados em `observatorio:RO:ji-parana:receitas:v2`. O ano corrente é renovado após uma hora; outro exercício solicitado é renovado após um dia. A última versão válida é retida por até sete dias; falha não estende esse prazo nem troca dados válidos por catálogo vazio. O site lê Redis e solicita atualização à fila; a requisição de página ou JSON nunca coleta a fonte. Sem versão, há estado pendente explícito. Veja o [fluxo em segundo plano](receitas-background.md), cujos exemplos de URLs são de Porto Velho; Ji-Paraná usa seu próprio slug e namespace.

O limitador de consultas é isolado por município e compartilhado entre site e worker via Redis. Uma falha do cache não autoriza aumentar a concorrência contra a Prefeitura. Não há arquivo histórico durável, restauração histórica ou garantia transacional entre páginas lidas em momentos diferentes.

## Consultar localmente

Use Node.js 22, conforme `.node-version`. Contratos e Obras funcionam sem Redis, consultando a API diretamente. Receitas exige Redis e o worker. Configure somente os valores do próprio projeto em `.env.local`, seguindo `.env.example`; não use variáveis públicas de navegador para segredos.

No Windows do mantenedor:

```powershell
rtk proxy npm ci
rtk proxy npm run dev
```

Com o Docker Compose local, os serviços incluem aplicação, Redis e worker:

```powershell
rtk proxy docker compose up --build -d
```

Exemplos de páginas e JSON; o ano 2026 é explícito e deve ser atualizado conforme o período desejado:

| Módulo    | Página                                 | JSON                                       |
| --------- | -------------------------------------- | ------------------------------------------ |
| Contratos | `/ji-parana/contratos?ano=2026&page=1` | `/api/ji-parana/contratos?ano=2026&page=1` |
| Obras     | `/ji-parana/obras?ano=2026`            | `/api/ji-parana/obras?ano=2026`            |
| Receitas  | `/ji-parana/receitas?ano=2026`         | `/api/ji-parana/receitas?ano=2026`         |

Receitas também oferece `/api/ji-parana/receitas/status?ano=2026`, com metadados de atualização e sem consultar a fonte. Respostas de Receitas podem ser 200 (`ready`), 202 (`pending`) ou 503 (`unavailable`); filtros inválidos geram 400. JSON utiliza `Cache-Control: no-store`.

Abrir páginas de Contratos ou Obras pode iniciar consultas reais em cache miss. Iniciar o worker agenda o exercício corrente e pode iniciar coleta real de Receitas. Os testes automatizados usam fixtures sintéticas e não exigem essas consultas.

## Evidências e limites da verificação

Em **23/10/2026**, foram consultados o OpenAPI, a lista de empresas de 2026 e os endpoints da UG 2. A origem confirmou Prefeitura = 2 e Câmara = 1. Contratos teve páginas de 2026 e uma página de 2025 conferidas. As duas primeiras páginas da apresentação foram validadas com 25 registros cada e total oficial de 144; a segunda continha nove registros com ano original 2025 dentro da consulta de exercício 2026, preservados com aviso. Isso não foi coleta completa de Contratos nem verificação de todas as fichas.

Obras teve o formato e todas as 12 páginas do endpoint de 2026 conferidos. A origem declarou 113 registros, mas retornou 112: as primeiras 11 páginas continham dez registros cada e a última somente dois, com intervalo 111–112. O parâmetro oficial `perPage` também foi aceito: com 100, a segunda página terminou no registro 112; com 200, a página única retornou 112 para o mesmo total de 113. A inconsistência persistiu nas três formas consultadas. A coleta foi rejeitada como incompleta e não foi publicada como catálogo completo. Os 112 registros retornados passaram individualmente pela normalização, sem armazenar respostas brutas. Os rótulos do portal oficial para valor total, percentual e datas também foram conferidos. Isso não audita situação física, pagamentos ou completude do cadastro municipal.

Na rechecagem de **23/10/2026**, a [API com uma página de até 200 registros](https://transparencia.ji-parana.ro.gov.br/api/obras/2026/2?perPage=200&page=1) continuou retornando 112 linhas para 113 declaradas, com `from: 1`, `to: 112` e `last_page: 1`. Entre essas linhas havia 83 valores distintos de `SEQUENCIAL`: o código 2 apareceu em 30 linhas, que variavam somente em `NOMEFOR`. Os nomes não foram armazenados ou republicados. Essa é uma observação das respostas públicas, sem atribuição de causa ao sistema da Prefeitura; as linhas não foram deduplicadas silenciosamente.

A [listagem do portal oficial filtrada para a Prefeitura, UG 2](https://transparencia.ji-parana.ro.gov.br/novo/EXECUTIVO/obras/2026/67?empresa%5B0%5D=2&perPage=200&page=1) apresentou o mesmo resultado de 112 linhas para 113 declaradas e 83 identificadores distintos. A [exportação CSV oficial do mesmo recorte](https://transparencia.ji-parana.ro.gov.br/novo/EXECUTIVO/obras/2026/67?empresa%5B0%5D=2&perPage=200&page=1&export=csv) também retornou 112 linhas de dados após o cabeçalho. Essas alternativas não forneceram evidência de cobertura completa e não substituíram o endpoint da integração.

O tratamento inicial distinguiu essa falha como `source-inconsistent`, com contagens validadas para explicar a divergência. Após o pedido explícito do mantenedor, a falta de uma linha na última página passou a ser a exceção parcial descrita acima, acompanhada de agrupamento explícito das repetições equivalentes. As demais inconsistências continuam produzindo esse erro, sem exposição de respostas brutas ou armazenamento no cache. Somente uma carga completa e validada pode ser reutilizada como catálogo completo válido. Esse tratamento não corrige os registros da fonte nem comprova a publicação da alteração em produção.

Receitas teve coleta e validação do schema das três listas anuais de 2026: 38 rubricas, sendo 21 de arrecadação direta, sete de transferências estaduais e dez de federais. Essa evidência confirma o recorte implementado naquele momento; não comprova aditividade entre rubricas nem cobertura municipal integral. A coleta de validação local não foi publicação em produção.

Os testes sintéticos cobrem normalização, centavos, ausência e zero, minimização de CPF, UG/exercício, paginação, duplicidade, cancelamento, limites e falhas. Testes de Receitas também verificam separação de municípios no cache e preservação da última versão válida. Aprovação local desses testes, typecheck ou build não comprova CI remoto ou publicação. Nenhum JSON bruto municipal foi incluído nas fixtures.
