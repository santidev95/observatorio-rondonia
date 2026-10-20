# Obras e Receitas de Porto Velho

Rotas locais implementadas: `/porto-velho/obras/`, `/porto-velho/obras/[id]` e `/porto-velho/receitas/`. Outros municípios continuam sem conectores. A implementação não comprova publicação em produção.

## Interface e filtros

Os componentes de listagem e filtros foram adaptados do Observatório PVH, preservando sua licença MIT, cores e tipografia. Obras usa tabela no desktop e cartões abaixo de 900 px: busca por nome, localização, contrato, empresa e processo; situação; secretaria em “Mais filtros”; bairro apenas quando publicado de forma padronizada; ordenação por atualização, valor contratado ou nome; paginação local de 12 registros e parâmetros na URL. A fonte não publica bairro padronizado, portanto o filtro não é preenchido por inferência.

Receitas conserva busca por conta/fonte, exercício atual e anterior, unidade gestora, tipo orçamentário/extraorçamentário/não informado, categoria, mês e ordenação. Os filtros e a paginação de 12 linhas operam sobre o resumo completo do exercício, sem nova consulta municipal para cada busca enquanto o cache for válido. Os totais e a evolução mensal acompanham os filtros; a previsão continua anual.

## Fontes e significado

- Obras: [API oficial](https://api.portovelho.ro.gov.br/api/v1/obras?por-pagina=100), páginas de 100. IDs oficiais e contagens únicos; limite de 20 páginas (2 mil obras).
- Responsável e documentos de contrato: somente o contrato identificado em `obra.contrato.id`, consultado pelo leitor/cache existente de Contratos. Uma falha de enriquecimento conserva a obra com campos indisponíveis e aviso explícito.
- Receitas: [documentos de arrecadação](https://api.portovelho.ro.gov.br/api/v1/receitas?portal_id=12535&ano=2026&por-pagina=1000) e [previsões anuais](https://api.portovelho.ro.gov.br/api/v1/receitas/previstas?portal_id=12535&ano=2026&por-pagina=1000). Ano e portal são repostos em cada URL, sem seguir links devolvidos pela API.
- Escopo: portal 12535, Prefeitura de Porto Velho e suas unidades; IPAM e Câmara ficam fora.
- Planejamento: pastas oficiais LOA 173, LDO 171 e PPA 168 no Portal da Transparência. Links não são extração dos valores de despesas.

Valores financeiros usam centavos inteiros seguros. Ausência não é zero; valores negativos de receitas são preservados. A previsão vem apenas do endpoint de previstas: o `valor_orcamento` repetido nos documentos não é somado. Previsões com ID zero são linhas válidas e não são eliminadas. Documentos repetidos, portal/ano incorretos, datas incompatíveis ou cobertura divergente interrompem a consulta. O percentual de Obras não comprova avanço físico; não se calcula esse progresso a partir de valores pagos.

Receitas agrupa por exercício, unidade, código de conta, código de fonte e tipo. A aplicação descarta nomes de contribuintes, CPF, contatos e campos brutos antes do cache/JSON; mantém contagens e datas de cobertura. Meses sem documentos permanecem indisponíveis. A data do último documento não prova que todos os dados daquele período tenham sido publicados.

## Leitura e cache

A leitura acontece no servidor sob demanda, após `connection()`. Build e CI não consultam os dados. Na ausência de cache, Receitas percorre todo o exercício solicitado e as previsões, com duas páginas simultâneas, até 200 páginas de documentos e 20 de previsões. O transporte limita os inícios de requisições dos três módulos a um a cada 1,1 segundo dentro do processo, para reduzir limites de frequência. Isso não coordena outros processos ou clientes do mesmo IP. Respostas transitórias 429/500/502/503/504 têm no máximo três tentativas por página. O prazo total é de 120 segundos; Obras tem 90 segundos incluindo enriquecimento. Cada resposta é limitada a 12 MiB. Falhas e cobertura incompleta não geram resumo vazio nem são armazenadas. Não há coleta agendada.

A primeira consulta pode ser demorada. Sem Redis, esse custo se repete em cada requisição; para uso público, mantenha o cache e avalie um processo de atualização independente antes de ampliar o volume. Não há lock distribuído. Requisições da mesma chave compartilham a leitura em andamento dentro do processo.

Chaves com EX 3600:

- `observatorio:RO:porto-velho:obras:v1:catalog`
- `observatorio:RO:porto-velho:receitas:v1:year:<ano>:portal:12535`

O schema, cobertura e identidade da consulta são validados na leitura. O cache não renova o horário original nem é retenção histórica. Uma indisponibilidade do Redis permite consulta direta à fonte. Nenhuma revisão expirada é apresentada silenciosamente como atual.

A API não oferece revisão transacional: conferir contagens, páginas e duplicações reduz inconsistências, mas não prova simultaneidade de todas as alterações. A aplicação não soma outros portais nem usa o orçamento repetido do endpoint de totais como previsão.

## Downloads

- `/api/porto-velho/obras`: catálogo completo normalizado, inclusive documentos oficiais.
- `/api/porto-velho/receitas?ano=2026`: resumo completo normalizado do exercício, sem documentos individuais ou contribuintes. O download não reproduz os filtros locais da tabela.

JSON e HTML usam o mesmo leitor/cache. Metadados incluem consulta e expiração; HTTP usa `Cache-Control: no-store` e `X-Observatorio-Cache`. Os parâmetros inválidos no JSON retornam 400; falha da fonte, 502; município sem conector, 404. As páginas apresentam mensagens explícitas quando não podem consultar.

## Verificação

Fixtures sintéticas cobrem dinheiro com sinal, ausência/zero, filtros e ordenação, separação previsão/arrecadação, IDs, portal, competência, cobertura e cache isolado. Verificações locais não comprovam CI remoto, deploy, disponibilidade contínua ou atualização completa da origem.
