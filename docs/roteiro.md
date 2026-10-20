# Próximas etapas

## Base e primeira integração implementadas

- Identidade estadual, mapa SVG dos 52 municípios do IBGE e páginas municipais.
- Contratos de Porto Velho com consulta direta à API pública, paginação de 25 registros, filtro de ano e JSON normalizado.
- Validação de metadados, valores, ausentes, documentos e minimização de CPF.
- Timeout e mensagens explícitas quando a fonte está indisponível.
- Guia de contribuição, templates e CI sem publicação.

Obras, Contratos e Receitas de Porto Velho foram publicados e verificados em produção em 19/10/2026; a disponibilidade das fontes continua sujeita à API municipal. Outros municípios permanecem em preparação.

## 1. Validar a experiência de pesquisa

Ampliar a revisão do catálogo com as fontes oficiais, decidir sobre busca por CNPJ/processo e detalhes, e documentar limites de cobertura. Nenhum valor financeiro estima execução física nem comprova irregularidade.

## 2. Cache — implementado

Redis em Docker na VPS com validade de uma hora por página/ano e por ficha individual, chaves isoladas, validação na leitura e fallback à API. Os horários originais e a expiração são informados sem simular uma coleta completa. Há compartilhamento de requisições em andamento dentro do processo; controle distribuído e políticas de capacidade serão avaliados conforme o uso.

Cache não substitui histórico. Arquivo durável, retenção, publicação por revisão e restauração exigem implementação própria antes de qualquer promessa de histórico.

## 3. Segunda prefeitura

Levantar as fontes de Ji-Paraná ou de outro município escolhido. Validar diferenças reais de API antes de generalizar o conector. Informar módulos indisponíveis e cobertura parcial.

## 4. Expansão

Ampliar Obras e Receitas para outros municípios depois de verificar suas fontes e definir seus contratos e evidências. Comparações exigem conceitos, períodos e cobertura compatíveis.

## 5. Publicação

Produção instalada na VPS Hostinger, com Redis privado, Cloudflare Tunnel, domínio e deploy pelo Actions. Veja [operação e segredos](producao.md). Worker de Receitas implementado com agendamento horário, lease e última carga válida com data e estado visíveis. Veja [operação de Receitas](receitas-background.md). A implantação desta revisão deve ser conferida no Actions e na saúde do worker.
