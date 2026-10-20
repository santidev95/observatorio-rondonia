# Rodar localmente com Docker

Requisitos: Docker Engine ou Docker Desktop em execução, com suporte a contêineres Linux e Compose v2. Não é necessário instalar Node.js ou Redis na máquina.

Na raiz do repositório:

```sh
docker compose up --build -d
```

Abra [http://localhost:3000](http://localhost:3000). No Windows do mantenedor, os comandos podem ser executados com o prefixo `rtk proxy`.

O Compose constrói o Next.js em modo de produção e sobe um Redis próprio. O aplicativo espera o healthcheck do Redis. O build instala as versões do lockfile; dados municipais são consultados apenas ao abrir os módulos. A primeira consulta de Receitas pode levar até dois minutos. Depois, o resumo fica em cache por uma hora.

## Operação

```sh
docker compose logs -f app
docker compose down
```

Para reconstruir após alterações no código, repita `docker compose up --build -d`. O contêiner serve o build; não há hot reload neste modo.

## Configuração opcional

Nenhum arquivo de ambiente é obrigatório para o Compose. A porta padrão é 3000; a senha de desenvolvimento é local. Para personalizar, crie um arquivo `.env` (ignorado pelo Git):

```dotenv
LOCAL_PORT=3021
LOCAL_REDIS_PASSWORD=uma-senha-local-de-sua-escolha
```

Essas variáveis se destinam apenas ao Compose. O aplicativo recebe internamente `REDIS_URL=redis://redis:6379` e a mesma senha configurada no serviço Redis. O Compose não importa `.env.local` e a imagem exclui os arquivos `.env*`; a configuração da VPS não entra no build. Um `REDIS_URL` externo não é usado por este Compose.

A porta do site é publicada apenas em 127.0.0.1. Redis não publica porta no host e só é acessado na rede interna do projeto. O volume `redis_data` conserva o cache entre reinícios; as chaves mantêm o TTL de uma hora. Esse volume não é banco histórico dos dados municipais. A senha padrão é para desenvolvimento local; este arquivo não configura uma publicação em produção.

O Dockerfile usa estágios separados para dependências, build e execução, e executa o servidor com o usuário `node`. A opção `DOCKER_BUILD=1` habilita a saída standalone somente na construção da imagem, sem mudar o fluxo normal de desenvolvimento local.
