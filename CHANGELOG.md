# Changelog

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

[0.2.0]: https://github.com/santidev95/observatorio-rondonia/releases/tag/v0.2.0
