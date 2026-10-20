<p align="center"><img src="public/images/bandeira-rondonia.svg" width="140" alt="Bandeira de Rondônia"></p>

# Observatório de Rondônia

Plataforma cívica independente e colaborativa para consultar dados públicos dos municípios de Rondônia. Voltada a cidadãos, jornalistas e pesquisa sobre a gestão municipal, com fontes oficiais, datas e limites de cobertura.

**Estado atual: piloto em desenvolvimento.** O mapa permite escolher os 52 municípios de Rondônia. Contratos de Porto Velho possui consulta direta à API oficial, com filtro de ano, paginação e JSON normalizado em `/porto-velho/contratos`. A publicação em produção foi verificada em 19/10/2026. Obras e Receitas de Porto Velho também possuem consulta oficial, com listagens e filtros adaptados do Observatório PVH. Outros municípios permanecem em preparação.

## Rodar com Docker

```sh
docker compose up --build -d
```

Abra [http://localhost:3000](http://localhost:3000). O Compose inclui um Redis local e não exige configurar a VPS. Veja [Docker local](docs/docker-local.md) para portas, senha e comandos.

## Executar localmente com Node.js

Use Node.js 22, conforme `.node-version`, para reproduzir o CI e o Docker de produção. O cache usa Redis em Docker na VPS: copie `.env.example` para `.env.local` e configure `REDIS_URL` e `REDIS_PASSWORD` somente no servidor. Sem essas variáveis, Obras e Contratos consultam a API diretamente. Não é necessário PostgreSQL. Para Receitas, configure Redis e execute o worker em outro terminal; o site lê a última carga válida e não espera uma coleta durante a requisição.

```sh
npm ci
npm run dev
# Em outro terminal, com Redis configurado no .env.local:
npm run worker:receitas
```

Abra o endereço indicado pelo Next.js. No Windows do mantenedor, prefixe os comandos com `rtk proxy`.

```sh
npm run typecheck
npm test
npm run build
npm run format:check
```

## Estrutura

| Caminho               | Responsabilidade                                               |
| --------------------- | -------------------------------------------------------------- |
| `src/app/`            | Portal estadual e rotas `/[municipio]`                         |
| `src/municipalities/` | Cadastro dos municípios e cobertura de cada módulo             |
| `src/geography/`      | Caminhos SVG e códigos municipais derivados do IBGE            |
| `src/core/`           | Contratos de integração, capacidades e namespace dos snapshots |
| `src/connectors/`     | Conectores e normalização das fontes municipais                |
| `src/components/`     | Identidade e componentes compartilhados                        |
| `tests/`              | Regras do cadastro e isolamento dos dados                      |
| `docs/`               | Arquitetura, identidade e próximos passos                      |

O site está em [rondonia.dadosabertos.org](https://rondonia.dadosabertos.org), com caminhos como `/porto-velho` e `/ji-parana`. A produção usa VPS Hostinger com Docker, Redis privado, Cloudflare Tunnel e GitHub Actions. PRs validam sem publicar; a master constrói e testa uma imagem, publica no GHCR e guarda seu digest. Releases estáveis e acionamento manual implantam essa imagem aprovada, sem reconstrução. Veja [produção, segredos e limites](docs/producao.md).

## Consulta de dados

Requisição → validação dos filtros → cache Redis → em caso de ausência ou expiração, API municipal → normalização → cache por uma hora → HTML ou JSON, preservando o horário original da consulta à fonte.

Obras e Contratos têm cache de uma hora. Receitas é atualizada por worker: a cada hora para o exercício corrente e sob demanda após um dia para os demais, mantendo a última versão válida por até sete dias, com data e aviso de desatualização. [Fluxo e estados de Receitas](docs/receitas-background.md). Todos os módulos usam chaves independentes por UF, município, módulo e versão. Se o cache de Obras ou Contratos falhar, a aplicação tenta a API diretamente. Receitas informa indisponibilidade temporária se o Redis não puder ser lido; não inicia uma coleta na requisição. Erros e contratos inexistentes não substituem dados válidos. O JSON informa `cache.status` e `cache.expiresAt`. Cache não é histórico: não há arquivo durável ou restauração de revisões.

O catálogo em `/porto-velho/contratos` aceita `ano` e `page`. O JSON normalizado está em `/api/porto-velho/contratos`, com os mesmos parâmetros. São 25 registros por página, sem totais financeiros calculados sobre dados parciais.

- [Obras e Receitas: fontes, filtros e cobertura](docs/obras-receitas-porto-velho.md)
- [Redis na VPS e configuração da conexão](docs/redis.md)
- [Contratos de Porto Velho e operação](docs/contratos-porto-velho.md)

- [Mapa municipal e fontes IBGE](docs/mapa-municipal.md)
- [Arquitetura e integridade](docs/arquitetura.md)
- [Identidade visual e créditos](docs/identidade-visual.md)
- [Próximas etapas](docs/roteiro.md)
- [Como contribuir](CONTRIBUTING.md)

## Princípios

- Dado ausente permanece indisponível; zero publicado permanece zero.
- Contratado, pago e executado são campos distintos.
- Cada município tem fontes e capacidades próprias.
- Uma coleta incompleta não substitui a última base válida.
- Nenhuma divergência representa conclusão automática de irregularidade.
- Dados pessoais e credenciais devem ser minimizados e protegidos.

## Origem e licença

O projeto deriva das decisões e da identidade do [Observatório de Porto Velho](https://github.com/santidev95/observatorio-pvh), que continua independente. O esquema de cores foi reaproveitado sob licença MIT, com o aviso preservado em `LICENSE`.

Código sob licença MIT. A bandeira é um arquivo de terceiros, com procedência e declaração de domínio público documentadas em [identidade visual](docs/identidade-visual.md).
