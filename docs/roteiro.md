# Próximas etapas

## Base e primeira integração implementadas

- Identidade estadual, mapa SVG dos 52 municípios do IBGE e páginas municipais.
- Contratos de Porto Velho com consulta direta à API pública, paginação de 25 registros, filtro de ano e JSON normalizado.
- Validação de metadados, valores, ausentes, documentos e minimização de CPF.
- Timeout e mensagens explícitas quando a fonte está indisponível.
- Guia de contribuição, templates e CI sem publicação.

A implementação não comprova publicação ou disponibilidade em produção. Obras, Receitas e outros municípios continuam em preparação.

## 1. Validar a experiência de pesquisa

Ampliar a revisão do catálogo com as fontes oficiais, decidir sobre busca por CNPJ/processo e detalhes, e documentar limites de cobertura. Nenhum valor financeiro estima execução física nem comprova irregularidade.

## 2. Cache — implementado

Redis em Docker na VPS com validade de uma hora por página/ano e por ficha individual, chaves isoladas, validação na leitura e fallback à API. Os horários originais e a expiração são informados sem simular uma coleta completa. Há compartilhamento de requisições em andamento dentro do processo; controle distribuído e políticas de capacidade serão avaliados conforme o uso.

Cache não substitui histórico. Arquivo durável, retenção, publicação por revisão e restauração exigem implementação própria antes de qualquer promessa de histórico.

## 3. Segunda prefeitura

Levantar as fontes de Ji-Paraná ou de outro município escolhido. Validar diferenças reais de API antes de generalizar o conector. Informar módulos indisponíveis e cobertura parcial.

## 4. Expansão

Adicionar Obras e Receitas por município depois de definir seus contratos e evidências. Comparações exigem conceitos, períodos e cobertura compatíveis.

## 5. Publicação

Escolher hospedagem, validar runtime, configurar domínio e executar verificações de produção. Coletas completas, agendamento, commits, pushes e deploy dependem de pedido autorizado.
