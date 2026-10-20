# Receitas em segundo plano

O serviço Docker `revenues-worker` consulta e valida a API municipal. A página e o JSON leem somente a última versão válida no Redis; a primeira visita ou uma expiração não iniciam uma coleta síncrona. As demais regras de normalização, cobertura, valores negativos, centavos e minimização permanecem no conector existente.

## Política

- Exercício corrente, no fuso de Rondônia: agendado ao iniciar, renovado após uma hora. Reiniciar o worker não força nova coleta se já houver uma versão fresca e agendamento válido.
- Outros exercícios: carga solicitada ao consultar, com renovação após um dia se houver novo acesso. Não são coletados todos os anos a cada hora.
- Última versão válida: retida por até sete dias a partir da consulta original. Uma falha não altera os dados nem estende esse prazo. Redis continua sendo armazenamento temporário, sujeito a expulsão por memória e perda de volume; isso não oferece histórico ou backup.
- Falhas: nova tentativa após cinco minutos. Visitas e verificações repetidas não antecipam essa tentativa.
- Coleta: uma por processo, com lease de 60 segundos por exercício, renovada a cada 20 segundos. O timeout da carga completa é de oito minutos. Uma execução que perde a lease não pode publicar ou apagar o lock de outra.
- Ritmo da fonte: site e worker compartilham uma reserva a cada 1,1 segundo via Redis. A fila de reservas da fonte é limitada a 11 segundos. Contratos/Obras mantêm o limitador local se o Redis falhar; o worker interrompe a carga e preserva a última versão.

O namespace é `observatorio:RO:porto-velho:receitas:v2`. A fila usa um sorted set com o horário da próxima tentativa; snapshot, tentativa e lock têm chaves por exercício. A publicação e a conferência do token do lock ocorrem no mesmo script Lua. O worker pode reaproveitar uma entrada v1 ainda válida ao iniciar, sem mudar a data da consulta. Entrada v1 expirada ou inválida não é ressuscitada.

## Interface e HTTP

`GET /api/porto-velho/receitas?ano=2026` devolve:

| HTTP | Estado            | Dados                                                    |
| ---- | ----------------- | -------------------------------------------------------- |
| 200  | `ready`           | Última versão válida, cache `hit` ou `stale`             |
| 202  | `pending`         | `data: null`, atualização solicitada ou em andamento     |
| 503  | `unavailable`     | Redis inacessível ou atualização não pôde ser registrada |
| 400  | consulta inválida | Nenhuma carga é solicitada                               |

Os metadados incluem `fetchedAt`, `cache.expiresAt` (prazo de renovação), `cache.retainedUntil` (limite de retenção) e `refresh` (estado, última tentativa, próxima tentativa e heartbeat do worker). Uma versão antiga não é apresentada como atual. Todas as respostas usam `Cache-Control: no-store`; respostas sem dados usam `Retry-After`.

`GET /api/porto-velho/receitas/status?ano=2026` retorna somente metadados. A interface consulta esse endpoint enquanto visível, mantém os filtros e atualiza o catálogo quando aparece uma nova versão validada. A primeira carga mostra uma mensagem de processamento, sem totais fictícios. Falhas mostram o estado e preservam os dados disponíveis dentro da retenção.

Heartbeat indica que o processo acessa Redis, não que a Prefeitura está disponível. O worker pode estar saudável e reportar uma tentativa de coleta com falha.

## Executar

Com Docker:

```sh
docker compose up --build -d
docker compose ps
docker compose logs -f revenues-worker
```

Com Node.js, configure `REDIS_URL` e `REDIS_PASSWORD` em `.env.local` e abra dois terminais:

```sh
npm run dev
npm run worker:receitas
```

Sem Redis ou worker, Receitas informa o estado correspondente. A página não tenta contornar essa ausência coletando o exercício durante a requisição. Para desenvolvimento sem Redis, Obras e Contratos continuam oferecendo consulta direta.

O build independente é `npm run build:worker`; o Docker inclui `revenues-worker.cjs` na imagem. O processo não importa páginas Next.js nem usa chave de API pública. A configuração privada de Redis pertence ao runtime.

## Operação e verificação

No Compose de produção, `revenues-worker` não publica portas, roda como `node`, tem filesystem somente de leitura, limite de memória e capacidades removidas. A saúde executa `node revenues-worker.cjs --healthcheck`, conferindo um heartbeat de até 60 segundos e a revisão da imagem.

Em SIGTERM, a coleta é cancelada e sua solicitação volta a ficar disponível. Em encerramento forçado, a lease expira; a fila continua registrada. Uma falha no Redis durante a publicação impede a troca do snapshot. Reiniciar o worker retoma as tarefas vencidas.

O CI testa Lua com Redis local isolado e valida o worker em rede Docker sem saída para a Prefeitura. Fixtures sintéticas não entram na imagem de produção. Depois do deploy, confira o heartbeat, o JSON, a indicação de atualização e a data da fonte; um build ou teste local não comprova atualização em produção.
