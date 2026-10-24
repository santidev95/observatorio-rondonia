# Receitas em segundo plano

O serviço Docker `revenues-worker` consulta e valida as APIs de Porto Velho, Ji-Paraná e Ariquemes, sequencialmente, com apenas uma coleta ativa por processo. A página e o JSON leem somente a última versão válida do respectivo município no Redis; a primeira visita ou uma expiração não iniciam uma coleta síncrona. As regras de normalização, cobertura, valores negativos, centavos e minimização ficam em cada conector.

Porto Velho preserva a agregação de documentos mensais e a previsão obtida em endpoint próprio. Ji-Paraná e Ariquemes publicam resumos anuais por rubrica, limitados à Prefeitura: unidade gestora 2 em Ji-Paraná e 1 em Ariquemes. Os conectores compartilham a normalização da plataforma Pública, com configuração municipal de origem, UG e prefixo de ID. São coletados os grupos de arrecadação direta e transferências estaduais e federais. O conector percorre todas as páginas desses três grupos antes de publicar, preservando `CODRE`, links oficiais, `ORCADO` e `ARRECADADO`. Essa cobertura é parcial: outros grupos e unidades não integram o recorte. Não há série mensal, data do último documento, soma global nem percentual da previsão nestas integrações; a aditividade entre os grupos não está comprovada. O resumo informa essas limitações explicitamente, e rubricas não são apresentadas como documentos individuais.

## Política

- Exercício corrente, no fuso de Rondônia: agendado ao iniciar, renovado após uma hora. Reiniciar o worker não força nova coleta se já houver uma versão fresca e agendamento válido.
- Outros exercícios: carga solicitada ao consultar, com renovação após um dia se houver novo acesso. Não são coletados todos os anos a cada hora.
- Última versão válida: retida por até sete dias a partir da consulta original. Uma falha não altera os dados nem estende esse prazo. Redis continua sendo armazenamento temporário, sujeito a expulsão por memória e perda de volume; isso não oferece histórico ou backup.
- Falhas: nova tentativa após cinco minutos. Visitas e verificações repetidas não antecipam essa tentativa.
- Coleta: uma por processo, com lease de 60 segundos por município e exercício, renovada a cada 20 segundos. O timeout da carga completa é de oito minutos. Uma execução que perde a lease não pode publicar ou apagar o lock de outra.
- Ritmo da fonte: site e worker compartilham uma reserva a cada 1,1 segundo via Redis por município, com chaves independentes entre as três APIs. A fila de reservas de cada fonte é limitada a 11 segundos. Contratos/Obras mantêm o limitador local se o Redis falhar; o worker interrompe a carga e preserva a última versão.

Os namespaces são `observatorio:RO:porto-velho:receitas:v2`, `observatorio:RO:ji-parana:receitas:v2` e `observatorio:RO:ariquemes:receitas:v2`. Cada um tem sua fila, snapshot, tentativa, lock por exercício e heartbeat. A fila usa um sorted set com o horário da próxima tentativa. A publicação e a conferência do token do lock ocorrem no mesmo script Lua. A leitura valida a identidade municipal, exercício, origem, unidade gestora e modelo: snapshots não podem atender outro município. Somente Porto Velho pode reaproveitar uma entrada v1 ainda válida ao iniciar, sem mudar a data da consulta. Entrada v1 expirada ou inválida não é ressuscitada.

## Interface e HTTP

`GET /api/porto-velho/receitas?ano=2026`, `GET /api/ji-parana/receitas?ano=2026` e `GET /api/ariquemes/receitas?ano=2026` devolvem:

| HTTP | Estado            | Dados                                                    |
| ---- | ----------------- | -------------------------------------------------------- |
| 200  | `ready`           | Última versão válida, cache `hit` ou `stale`             |
| 202  | `pending`         | `data: null`, atualização solicitada ou em andamento     |
| 503  | `unavailable`     | Redis inacessível ou atualização não pôde ser registrada |
| 400  | consulta inválida | Nenhuma carga é solicitada                               |

Os metadados incluem `fetchedAt`, `cache.expiresAt` (prazo de renovação), `cache.retainedUntil` (limite de retenção) e `refresh` (estado, última tentativa, próxima tentativa e heartbeat do worker). Uma versão antiga não é apresentada como atual. Todas as respostas usam `Cache-Control: no-store`; respostas sem dados usam `Retry-After`.

`GET /api/[municipio]/receitas/status?ano=2026` retorna somente metadados para os três municípios integrados. A interface consulta esse endpoint enquanto visível, mantém os filtros e atualiza o catálogo quando aparece uma nova versão validada. A primeira carga mostra uma mensagem de processamento, sem totais fictícios. Falhas mostram o estado e preservam os dados disponíveis dentro da retenção.

Heartbeat indica que o processo acessa Redis, não que a Prefeitura está disponível. O worker pode estar saudável e reportar uma tentativa de coleta com falha.

## Executar

Com Docker:

```sh
docker compose up --build -d
docker compose ps
docker compose logs -f revenues-worker
```

Com Node.js, configure `REDIS_URL` e `REDIS_PASSWORD` em `.env.local` ou `.env` e abra dois terminais. O comando do worker aceita os dois arquivos: `.env.local` prevalece sobre `.env`, e variáveis já definidas no processo têm prioridade. A ausência de um arquivo não impede usar o outro nem as variáveis do servidor:

```sh
npm run dev
npm run worker:receitas
```

Sem Redis ou worker, Receitas informa o estado correspondente. A página não tenta contornar essa ausência coletando o exercício durante a requisição. Para desenvolvimento sem Redis, Obras e Contratos continuam oferecendo consulta direta.

O build independente é `npm run build:worker`; o Docker inclui `revenues-worker.cjs` na imagem. O processo não importa páginas Next.js nem usa chave de API pública. A configuração privada de Redis pertence ao runtime.

## Operação e verificação

No Compose de produção, `revenues-worker` não publica portas, roda como `node`, tem filesystem somente de leitura, limite de memória e capacidades removidas. A saúde executa `node revenues-worker.cjs --healthcheck`, conferindo os heartbeats dos três municípios, com validade de até 60 segundos e a revisão da imagem.

Em SIGTERM, a coleta é cancelada e sua solicitação volta a ficar disponível. Em encerramento forçado, a lease expira; a fila continua registrada. Uma falha no Redis durante a publicação impede a troca do snapshot. Reiniciar o worker retoma as tarefas vencidas.

O CI testa Lua com Redis local isolado e valida o worker em rede Docker sem saída para as Prefeituras. O smoke test semeia versões e agendamentos frescos sintéticos dos três municípios antes de iniciar o worker e verifica todos os heartbeats e snapshots; nenhum desses testes coleta APIs reais. Fixtures sintéticas não entram na imagem de produção. Depois do deploy, confira o heartbeat, o JSON, a indicação de atualização e a data da fonte de cada município; um build ou teste local não comprova atualização em produção. As implementações de Ji-Paraná e Ariquemes ainda precisam de publicação e verificação em produção.
