# Redis em Docker na VPS

O cache do servidor usa o cliente oficial `redis` por TCP, com validade de uma hora. A listagem é isolada por página/ano e cada ficha possui sua chave. Redis não substitui histórico ou coleta completa.

## Configuração do servidor

Defina somente no ambiente do Next.js ou no `.env.local` ignorado pelo Git:

```dotenv
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=
```

Preencha a senha no ambiente privado; não a inclua na URL, no Compose versionado ou em variáveis `NEXT_PUBLIC_`. Reinicie a aplicação após alterar a configuração. Sem URL e senha, a aplicação consulta a prefeitura diretamente. Configuração incompleta ou falha de conexão produz `cache.status=unavailable` e tenta a API.

`redis:6379` funciona quando aplicação e serviço Redis compartilham uma rede Docker. Projetos Compose separados precisam participar de uma rede comum; o nome do serviço não é resolvido automaticamente entre redes isoladas.

Para o acesso externo configurado nesta instalação, use no ambiente privado a URL `redis://<IP_DA_VPS>:32768`. A porta `32768` foi identificada no painel do mantenedor e a autenticação foi validada em 19/10/2026. Não é um valor padrão do Redis nem uma configuração fixa do código.

## Porta publicada e transporte

No Compose fornecido, `ports: ["6379"]` publica a porta do contêiner em uma porta do host escolhida pelo Docker. Ela pode mudar quando o contêiner é recriado. Para produção na mesma VPS, prefira acesso pela rede interna Docker, sem publicar uma porta para a internet.

`redis://` não cifra o tráfego. Para desenvolvimento remoto, prefira um túnel SSH ou uma rede privada. Para o mapeamento atual, um exemplo de túnel é:

```sh
ssh -N -L 16379:127.0.0.1:32768 usuario@IP_DA_VPS
```

Com o túnel ativo, configure `REDIS_URL=redis://127.0.0.1:16379`. Para uma conexão TLS já configurada no servidor, o cliente também aceita `rediss://`, mantendo a validação do certificado. Não desative essa validação. Restrinja o acesso à porta publicada aos clientes autorizados.

Não foi feita alteração remota no Compose, no firewall ou no volume `redis_data`. O `--save 60 1` fornecido pelo mantenedor continua sendo responsabilidade do serviço Docker. Snapshot Redis não representa histórico documental do Observatório.

## Comportamento do cache

- `SET ... EX 3600`, sem renovação do prazo em leituras.
- Dados normalizados e minimizados; validação do schema e da identidade da consulta ao ler.
- Conexão reutilizada; sem fila offline ou reconexão automática em loop.
- Limite de 1,5 segundo para conexão e operação completa. Após falha, a próxima consulta pode abrir nova conexão.
- Erros não expõem endereço autenticado, senha ou conteúdo bruto.
- `fetchedAt` conserva a consulta original à prefeitura. `cache.status`, `cache.expiresAt` e `X-Observatorio-Cache` permitem verificar o comportamento.
- Falhas do Redis tentam a API; erros da origem, 404 e entradas vencidas não são servidos como sucesso.

Os testes de transporte usam uma fixture RESP local com senha sintética; não acessam a VPS. O build também não consulta Redis ou a prefeitura. Testar a conexão real é uma verificação operacional separada.

## Referências

- [Cliente oficial Node.js](https://github.com/redis/node-redis).
- [Configuração do cliente](https://github.com/redis/node-redis/blob/master/docs/client-configuration.md).
- [Segurança e isolamento de rede](https://redis.io/docs/latest/operate/oss_and_stack/management/security/).

No Windows do mantenedor, prefixe comandos com `rtk proxy`.

## Receitas: retenção e worker

Receitas usa o namespace `observatorio:RO:porto-velho:receitas:v2`, com fila, lease, tentativa e última versão válida por exercício. A renovação é horária para o exercício corrente; outros exercícios são renovados sob demanda após um dia. A versão válida é retida por até sete dias. Erros não renovam esse prazo nem substituem a versão. Leitura indisponível resulta em estado público explícito, sem coleta síncrona. Veja [detalhes do worker](receitas-background.md). Contratos e Obras mantêm seu cache de uma hora e fallback à fonte.
