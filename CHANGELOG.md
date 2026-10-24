# Changelog

## Não publicado

- Mantine integrado com tema escuro e paleta amarela original centralizada, compartilhada com os estilos existentes.
- Busca municipal, controles do mapa, navegação, cartões e consultas passam a usar componentes Mantine, preservando filtros, teclado, valores, links e regras de cobertura.
- Modos claro e escuro com seletor no cabeçalho e preferência persistida no navegador; contraste e cores de mapa, tabelas e filtros adaptados aos dois temas.

## [0.4.0] — 2026-10-24

### Integrações municipais

- Contratos, Obras e Receitas da Prefeitura de Ji-Paraná (UG 2) e de Ariquemes (UG 1), com páginas, filtros por exercício, fichas e downloads próprios.
- Implementação compartilhada da plataforma Pública, com origem, unidade gestora, identidade dos registros, cache e limites de consulta separados por município.
- Receitas de Ji-Paraná e Ariquemes apresenta rubricas anuais de arrecadação direta e transferências estaduais e federais, com cobertura parcial explícita, sem inferir total municipal ou série mensal.
- Navegação entre Contratos, Obras e Receitas preserva o município, inclusive nas fichas de Contratos. Filtros recebem maior destaque, e o retorno às listagens preserva a consulta.

### Cobertura e integridade

- Obras de Ji-Paraná admite, por autorização do mantenedor, exatamente uma linha ausente na última página, com `complete: false`, contagens e aviso persistente na lista e nas fichas.
- Obras de Ariquemes pode exibir os registros recebidos quando o total declarado supera as linhas retornadas, após consultar todas as páginas com metadados válidos e estáveis. O aviso de dados inconsistentes preserva as contagens e não presume quais registros faltam ou se o contador está correto.
- As duas consultas parciais agrupam somente repetições equivalentes do mesmo ID após normalização, distinguindo linhas recebidas, repetições e obras únicas. Não são gravadas nem reutilizadas no Redis e não substituem uma carga completa válida; conflitos e demais falhas continuam bloqueados.
- Documentação das fontes e testes com fixtures sintéticas para paginação, valores, identidade municipal, consultas parciais, isolamento e preservação da última versão válida.

### Segurança e operação

- Next.js atualizado de 16.4.0 para 16.4.3 por correção de segurança, com `experimental.agentUpgrade: "security"` e lockfile das dependências correspondentes.
- O worker de Receitas atende os três municípios, mantendo filas, leases, publicação atômica e verificação de saúde por município, com renovação e retenção das versões válidas.
- O comando local do worker aceita `.env` e `.env.local` opcionais; `.env.local` prevalece sobre `.env`, preservando a prioridade das variáveis do processo.

Esta entrada prepara a versão 0.4.0. Implementação e validação local não comprovam publicação: CI remoto, release e deploy devem ser verificados separadamente. Os demais municípios permanecem em preparação.

## [0.3.1] — 2026-10-20

### Pipeline e releases

- Validação e construção reunidas em um workflow reutilizável. PRs executam testes sem permissão de publicação nem segredos de produção.
- O CI da master constrói e testa uma imagem Docker, publica no GHCR e registra seu digest em um manifesto. A release e o deploy manual reutilizam essa imagem, sem novos builds.
- O deploy confere repositório, commit, origem e conclusão do CI, identidade do artefato e digest. Artefatos de PR, forks, outras branches e manifestos inválidos não são aceitos.
- Node.js 22 definido em `.node-version` e usado nos workflows, alinhado aos estágios do Dockerfile.
- Regras versionadas para exigir PR e o check `CI aprovado` na master, impedir force push/exclusão e impedir alteração/exclusão das tags `v*`.
- Testes do resolvedor cobrem origem não confiável, manifesto adulterado ou expirado, falhas da API e espera pelo CI. Testes de saúde da aplicação e do worker usam redes Docker sem acesso à Prefeitura.

### Operação

- Segredos, acesso SSH restrito, Cloudflare Tunnel e rollback local permanecem no fluxo existente.
- Manifestos são guardados por 90 dias. Sem manifesto válido, o deploy falha explicitamente; não reconstrói uma imagem como fallback. Tags anteriores a este fluxo continuam publicadas, mas não possuem o novo manifesto.

**Changelog completo:** [v0.3.0...v0.3.1](https://github.com/santidev95/observatorio-rondonia/compare/v0.3.0...v0.3.1)

## [0.3.0] — 2026-10-19

### Novidades

- **Busca por município:** pesquisa no cadastro local, sem diferenciar acentos, com resultados que informam a situação da integração. A home mantém o mapa como destaque e oferece acesso direto às consultas de Porto Velho.
- **Termos de Uso:** nova página `/termos-de-uso`, com condições de consulta e reutilização, limites de cobertura e atualização, uso responsável, referências legais e créditos dos materiais.

### Experiência visual

- Tipografia Geist compartilhada pelas páginas, contraste reforçado nos textos de apoio e superfícies mais distintas, preservando o tema escuro e o dourado.
- Cartões municipais com ícones, descrições mais curtas e botões alinhados. Os avisos de integrações indisponíveis e os limites das fontes permanecem explícitos.
- Cabeçalho alinhado à esquerda, com mais espaço entre a bandeira e o nome do projeto. Bandeira circular no cabeçalho e no favicon, com cores e estrela preservadas; o SVG retangular original continua disponível.
- Rodapé simplificado com os links “Termos de uso” e “Contribuir no GitHub”, acompanhados de ícones. O acesso para contribuir deixa o cabeçalho.
- Valores financeiros mais legíveis, com algarismos tabulares, além de ajustes nos campos, nas tabelas e na navegação entre módulos.
- Layouts adaptados a celular, controles de mapa com área de toque ampliada, foco visível e respeito à preferência por movimento reduzido.

### Validação local

- 90 testes aprovados e dois testes de integração com Redis real ignorados por dependerem de uma instância configurada.
- TypeScript, build Next.js, formatação e verificação do diff aprovados.
- Home, páginas municipais e Termos de Uso conferidos em desktop e larguras de 320 e 390 px, incluindo busca sem acentos, navegação por teclado, zoom do mapa e links do rodapé. Consulta de Obras revisada com fixtures sintéticas, sem coleta da Prefeitura.

### Escopo

- As mudanças preservam a cobertura municipal e as regras dos conectores, valores, fontes, cache e atualização em segundo plano. Outros municípios continuam em preparação.
- A validação desta versão é local; CI remoto e publicação em produção devem ser verificados separadamente.

**Changelog completo:** [v0.2.1...v0.3.0](https://github.com/santidev95/observatorio-rondonia/compare/v0.2.1...v0.3.0)

## [0.2.1] — 2026-10-19

### Novidades

- **Receitas em segundo plano:** worker Docker separado, com renovação horária do exercício corrente e carga dos demais exercícios sob demanda, renovável após um dia. Páginas e downloads leem o Redis sem coletar a Prefeitura durante a requisição.
- **Continuidade dos dados:** última carga completa e validada retida por até sete dias, preservando o horário original da fonte. Falhas mantêm essa versão dentro do prazo e permitem nova tentativa após cinco minutos.
- **Estado de atualização na interface:** primeira carga pendente, atualização em andamento e falhas são informadas sem totais fictícios. A tela verifica novas versões e preserva os filtros, com ajustes na primeira carga em celular.
- **Produção na VPS:** deploy pelo GitHub Actions, imagem Docker no GHCR por digest, SSH com comando restrito, Redis privado e acesso HTTPS pelo Cloudflare Tunnel. Obras, Contratos e Receitas de Porto Velho passam a constar como consultas disponíveis; outros municípios permanecem em preparação.

### Integridade e operação

- Lease por exercício, renovação do lock e publicação atômica com conferência do token impedem que uma execução antiga substitua outra carga. Site e worker compartilham o limite de consultas à API municipal.
- Receitas inclui metadados de atualização e endpoint `/api/porto-velho/receitas/status`. O JSON retorna HTTP 202 com `data: null` durante a primeira carga e HTTP 503 quando indisponível; versões válidas retornam HTTP 200 com cache `hit` ou `stale`.
- Compose local inclui o worker na mesma imagem da aplicação. Em produção, aplicação e worker têm verificações de saúde e rollback compatível com a imagem anterior.
- A verificação pública do deploy parte da VPS, atravessa a Cloudflare e confirma o commit em `/api/health`, preservando as regras existentes de acesso por país.
- CI valida a integração com Redis isolado, testes de domínio, TypeScript, formatação, scripts de deploy, build e saúde da imagem. O teste do worker usa uma rede Docker sem acesso à Prefeitura.
- Documentação de produção, credenciais, cache, atualização e recuperação do worker adicionada.

### Limites

- Redis continua sendo armazenamento temporário: pressão de memória pode remover entradas antes dos sete dias. Arquivo durável, histórico e backup dos dados públicos não estão implementados.
- Sem uma versão válida, Receitas depende do Redis e do worker para concluir a carga. Contratos e Obras mantêm cache por uma hora e fallback à API.
- Publicar uma release estável aciona o workflow de produção; a disponibilidade da revisão deve ser conferida no Actions e em `/api/health`.

**Changelog completo:** [v0.2.0...v0.2.1](https://github.com/santidev95/observatorio-rondonia/compare/v0.2.0...v0.2.1)

## [0.2.0] — 2026-10-19

## Novidades

- **Obras de Porto Velho:** catálogo da API oficial, busca e filtros no padrão do Observatório PVH, ordenação, paginação e detalhes com medições e documentos. Vínculos com contratos usam exclusivamente o ID oficial publicado.
- **Receitas e orçamento:** integração dos documentos de arrecadação e das previsões anuais do portal da Prefeitura, com filtros por exercício, unidade gestora, tipo, categoria e mês; indicadores, evolução mensal, tabela por conta/fonte e download JSON.
- **Cache Redis por uma hora:** catálogo de Obras e resumos anuais de Receitas, isolados por módulo e exercício, com validação de cobertura, horário original e fallback à API quando o Redis estiver indisponível.
- **Mapa municipal:** clique, Enter ou Espaço abrem diretamente a página do município, sem confirmação intermediária. A legenda das integrações e os controles de zoom foram preservados.
- **Docker local:** Dockerfile com build em estágios e saída standalone, Compose com aplicação e Redis local, healthcheck, volume de cache e guia de configuração. Execute `docker compose up --build -d` e acesse `http://localhost:3000`.

## Integridade e experiência

- Listagens e filtros de Obras e Receitas adaptados do Observatório PVH, com layout responsivo e retorno à busca de Obras preservando filtros e posição.
- Previsão anual separada da arrecadação; valores negativos, zero e ausências mantêm seus significados. Códigos contábeis de 11 dígitos são preservados sem serem confundidos com CPF.
- Verificação de páginas, IDs, portal, exercício e competência antes de apresentar resumos; minimização de dados pessoais antes do cache e dos downloads.
- Ritmo de consultas à Prefeitura limitado dentro do processo, tentativas limitadas para falhas transitórias e cancelamento ao atingir o prazo.
- Datas de consulta no fuso de Rondônia e valores compactos nos indicadores, como no Observatório PVH.

## Validação

- 78 testes locais passaram, além de TypeScript, build Next.js, formatação e verificação do diff.
- Configuração do Compose validada. Os contêineres não foram executados nesta máquina porque o Docker Desktop estava parado.
- Interface conferida em desktop e viewport de 390 px, incluindo busca de Obras, navegação direta no mapa e filtro mensal de Receitas.
- Leitura real de Receitas de 2026 validou 62.133 documentos e 431 linhas de previsão; o cache retornou MISS e depois HIT. Essas contagens descrevem a consulta de validação e podem mudar na origem.

## Limites

- A primeira consulta completa de Receitas pode levar até dois minutos. Redis é cache temporário, sem retenção histórica; não há coleta agendada ou lock distribuído.
- Somente Porto Velho possui conectores. A release publica o código; não executa deploy do site.

**Changelog completo:** [v0.1.0...v0.2.0](https://github.com/santidev95/observatorio-rondonia/compare/v0.1.0...v0.2.0)

[0.4.0]: https://github.com/santidev95/observatorio-rondonia/releases/tag/v0.4.0
[0.3.1]: https://github.com/santidev95/observatorio-rondonia/releases/tag/v0.3.1
[0.3.0]: https://github.com/santidev95/observatorio-rondonia/releases/tag/v0.3.0
[0.2.1]: https://github.com/santidev95/observatorio-rondonia/releases/tag/v0.2.1
[0.2.0]: https://github.com/santidev95/observatorio-rondonia/releases/tag/v0.2.0
