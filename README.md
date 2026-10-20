<p align="center"><img src="public/images/bandeira-rondonia.svg" width="140" alt="Bandeira de Rondônia"></p>

# Observatório de Rondônia

Plataforma cívica independente e colaborativa para consultar dados públicos dos municípios de Rondônia. Voltada a cidadãos, jornalistas e pesquisa sobre a gestão municipal, com fontes oficiais, datas e limites de cobertura.

**Estado atual: piloto em desenvolvimento.** O mapa permite escolher os 52 municípios de Rondônia. Contratos de Porto Velho possui consulta direta à API oficial, com filtro de ano, paginação e JSON normalizado em `/porto-velho/contratos`. A implementação local não comprova publicação em produção. Obras e Receitas de Porto Velho também possuem consulta oficial, com listagens e filtros adaptados do Observatório PVH. Outros municípios permanecem em preparação.

## Rodar com Docker

```sh
docker compose up --build -d
```

Abra [http://localhost:3000](http://localhost:3000). O Compose inclui um Redis local e não exige configurar a VPS. Veja [Docker local](docs/docker-local.md) para portas, senha e comandos.

## Executar localmente com Node.js

Node.js 22 ou superior e npm. O cache usa Redis em Docker na VPS: copie `.env.example` para `.env.local` e configure `REDIS_URL` e `REDIS_PASSWORD` somente no servidor. Sem essas variáveis, a consulta funciona diretamente pela API, sem cache. Não é necessário Docker ou PostgreSQL.

```sh
npm ci
npm run dev
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

O endereço proposto é `rondonia.dadosabertos.org`, com caminhos como `/porto-velho` e `/ji-parana`. Domínio, DNS e hospedagem ainda não foram configurados.

## Consulta de dados

Requisição → validação dos filtros → cache Redis → em caso de ausência ou expiração, API municipal → normalização → cache por uma hora → HTML ou JSON, preservando o horário original da consulta à fonte.

Catálogo de Obras, resumos anuais de Receitas e páginas/fichas de Contratos têm chaves independentes no Redis, isoladas por UF, município, módulo e versão, com validade de uma hora. Se o cache falhar, a aplicação tenta a API diretamente; erros e contratos inexistentes não são armazenados. O JSON informa `cache.status` e `cache.expiresAt`. Cache não é histórico: não há arquivo durável ou restauração de revisões.

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
