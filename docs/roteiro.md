# Próximas etapas

## Base e três integrações implementadas

- Identidade estadual, mapa SVG dos 52 municípios do IBGE e páginas municipais.
- Contratos de Porto Velho com consulta direta à API pública, paginação de 25 registros, filtro de ano e JSON normalizado.
- Ji-Paraná implementada localmente: Contratos paginados, Obras por exercício e Receitas anuais com cobertura parcial. Todos os módulos consultam a Prefeitura (UG 2), com conceitos e limites próprios documentados em [Ji-Paraná](ji-parana.md).
- Ariquemes implementada localmente: os três módulos usam a Prefeitura (UG 1), com transporte e algoritmos da Pública compartilhados, mantendo município e UG próprios. Veja [fontes e limites de Ariquemes](ariquemes.md).
- Validação de metadados, valores, ausentes, documentos e minimização de CPF.
- Timeout e mensagens explícitas quando a fonte está indisponível.
- Guia de contribuição, templates e validação de PRs sem publicação. O CI da master guarda uma imagem aprovada para futuras releases.

Obras, Contratos e Receitas de Porto Velho foram publicados e verificados em produção em 19/10/2026; a disponibilidade das fontes continua sujeita à API municipal. Implementação local não comprova publicação: CI remoto, deploy e verificação em produção são etapas separadas. O cadastro possui três pilotos implementados e 49 municípios não iniciados. Na verificação de 23/10/2026, as fontes de Obras de Ji-Paraná e Ariquemes apresentaram totais incompatíveis com os registros retornados; a divergência de Ariquemes foi confirmada em 24/10/2026. Após decisões explícitas do mantenedor, Ji-Paraná admite a falta exata de uma linha na última página, e Ariquemes pode exibir os registros recebidos quando a contagem é menor que a declarada, após consultar todas as páginas com metadados válidos e estáveis e normalizar todos os registros. As consultas parciais agrupam somente repetições equivalentes do mesmo ID, mantendo IDs únicos na apresentação e contagens separadas de linhas e obras. As duas consultas parciais exibem aviso, contagens e não usam cache; demais erros continuam rejeitados. Nenhuma dessas respostas é anunciada como cobertura completa.

## 1. Validar a experiência de pesquisa

Ampliar a revisão do catálogo com as fontes oficiais, decidir sobre busca por CNPJ/processo e detalhes, e documentar limites de cobertura. Nenhum valor financeiro estima execução física nem comprova irregularidade.

## 2. Cache — implementado

Redis em Docker na VPS com validade de uma hora por página/ano e por ficha individual, chaves isoladas, validação na leitura e fallback à API. Os horários originais e a expiração são informados sem simular uma coleta completa. Há compartilhamento de requisições em andamento dentro do processo; controle distribuído e políticas de capacidade serão avaliados conforme o uso.

Obras de Ji-Paraná e Ariquemes usa uma chave por exercício e município, com uma hora de validade, após concluir e validar todas as páginas do endpoint daquele ano. As consultas parciais autorizadas de Ji-Paraná e Ariquemes são somente exibidas, sem gravação ou reutilização no Redis nem substituição de uma carga completa válida. Receitas dos três municípios usa o worker separado, com namespaces próprios, atualização horária do ano corrente e retenção temporária da última versão válida.

Cache não substitui histórico. Arquivo durável, retenção, publicação por revisão e restauração exigem implementação própria antes de qualquer promessa de histórico.

## 3. Expansão implementada — Ji-Paraná e Ariquemes

As fontes foram levantadas e os conectores usam a API Pública, com exercício explícito e configuração municipal: UG 2 em Ji-Paraná e UG 1 em Ariquemes. Contratos reorganiza páginas oficiais de 10 em grupos de 25; Obras exige a leitura de todas as páginas do exercício, com as exceções próprias de cobertura parcial de Ji-Paraná e Ariquemes documentadas acima. Receitas inclui somente receitas arrecadadas diretamente e transferências estaduais e federais, com valores anuais por rubrica, sem série mensal nem total financeiro global.

Próximas verificações: revisar a experiência completa de navegação e estados de falha, conferir o CI da revisão e validar o comportamento após uma publicação autorizada. Não ampliar os rótulos de cobertura com base apenas em documentação Swagger ou testes sintéticos. Outras unidades gestoras, grupos de receitas, documentos e histórico exigem validação específica das fontes.

## 4. Expansão

Ampliar os módulos para outros municípios depois de verificar suas fontes e definir seus contratos e evidências. A adoção da mesma plataforma Pública não garante schema, unidades gestoras, conceitos ou disponibilidade idênticos. Comparações exigem conceitos, períodos e cobertura compatíveis; os resumos anuais parciais não devem ser comparados como totais municipais consolidados.

## 5. Publicação

Produção instalada na VPS Hostinger, com Redis privado, Cloudflare Tunnel, domínio e deploy pelo Actions. Veja [operação e segredos](producao.md). Worker de Receitas implementado com agendamento horário, lease e última carga válida com data e estado visíveis. Veja [operação de Receitas](receitas-background.md). A implantação desta revisão deve ser conferida no Actions e na saúde do worker.
