# Contratos de Porto Velho

## Escopo implementado

O piloto consulta diretamente o modelo **Contratos** da API pública da Prefeitura de Porto Velho. A interface em `/porto-velho/contratos` e o JSON em `/api/porto-velho/contratos` usam o mesmo leitor no servidor.

A consulta é paginada, com 25 registros por página e filtro opcional de ano. Cada registro abre uma ficha em /porto-velho/contratos/{id}, consultada diretamente pelo ID oficial. Há cache opcional Redis em Docker na VPS de uma hora por página/ano e por ficha. Não há coleta completa, importação da base anterior ou rotina agendada. Obras, Receitas e outras prefeituras permanecem em preparação.

## Fonte e interpretação

- [API oficial de Contratos](https://api.portovelho.ro.gov.br/api/v1/contratos?modelo=Contratos).
- [Documentação da API municipal](https://api.portovelho.ro.gov.br/docs/api).
- O conector monta a URL HTTPS com `modelo=Contratos`, `por-pagina=25`, `page` e, quando informado, `ano`. Não segue os links de paginação da resposta, que podem omitir filtros.
- A documentação e uma página limitada da fonte foram conferidas em 18/10/2026. Isso não comprova cobertura histórica completa nem disponibilidade contínua.
- IDs oficiais, documentos, datas, campos ausentes e zero publicado são preservados no contrato normalizado.
- Valores monetários são inteiros em centavos. `valor_executado` é identificado como **Executado informado**, com definição não confirmada, separado do contratado. Não é tratado como total pago ou progresso físico.
- O total de registros pertence aos metadados da fonte para aquele filtro. Não há total financeiro calculado sobre uma página parcial.
- CPF é removido dos campos republicados, e nomes de fornecedores identificados como pessoas físicas não são republicados. Documentos com URL incompatível, identificador pessoal ou domínio fora da prefeitura são omitidos do DTO. A resposta bruta não é persistida.

A publicação de um documento pode ser uma data ou uma referência textual a diário, edição e página. Datas inequívocas são normalizadas; referências textuais são preservadas e a data fica indisponível, sem inferência.

Metadados e registros precisam ser consistentes com a página solicitada, incluindo contagem, intervalo e IDs únicos. O parâmetro de ano é enviado à fonte sem presumir seu critério interno: em uma consulta limitada de 2026, a origem retornou também um registro marcado como 2025. Anos divergentes ou ausentes são preservados, com aviso na tela e em warnings no JSON; registros e totais da origem não são recalculados como se o recorte tivesse sido confirmado. Página incompleta, JSON inválido ou mudança incompatível de formato produzem indisponibilidade explícita.

## Apresentação e referência

A listagem segue os padrões de Contratos do Observatório de Porto Velho: tabela comparativa, processo, empresas, valor, vigência e situação publicada pela fonte. O painel de busca e filtros, a tipografia Geist e as medidas da tabela seguem o mesmo catálogo. Em celular, mantém a tabela com rolagem horizontal, como Contratos no PVH. A ficha separa dados gerais, empresas, documentos e aditivos; a origem e as limitações permanecem acessíveis.

O PVH pesquisa um catálogo completo persistido. A API consultada aqui não documenta pesquisa textual nem ordenação. A busca por contrato, objeto, empresa, CNPJ ou processo, os filtros de órgão e situação e a ordenação atuam somente sobre os registros da página carregada, com esse limite indicado no painel e na contagem. Não alteram o total informado pela fonte nem consultam páginas adicionais. O filtro de ano e a paginação representam a consulta à origem; mudar de página ou ano reinicia os filtros locais. Nenhuma vinculação com Obras é anunciada nesta etapa.

## Cache Redis em Docker na VPS

Listagem, JSON e ficha individual usam cache no servidor por até uma hora. Em caso de ausência, expiração ou conteúdo inválido, o leitor busca a API com `cache: "no-store"`, limite de resposta e timeout de 12 segundos. Redis tem timeout de 1,5 segundo por operação completa, sem fila offline ou reconexão automática em loop; falha do cache leva à consulta direta. `connection()` mantém o fluxo fora do build; a rota JSON responde com `Cache-Control: no-store`, sem uma segunda camada de cache HTTP.

Somente DTOs normalizados são armazenados, com `EX 3600` e chaves por UF, município, módulo, versão, página/ano ou ID. Hits preservam `fetchedAt` e não renovam a expiração. Erros, 404 e entradas vencidas não são servidos. O JSON informa `cache.status` e `cache.expiresAt`; a interface exibe a consulta original e a validade nos detalhes da fonte.

Os horários se referem à consulta à fonte feita por esta aplicação. HTML e JSON com os mesmos filtros compartilham a entrada de cache enquanto válida; páginas ou fichas distintas podem refletir momentos diferentes. Não representam uma revisão histórica completa.

Falha da fonte não retorna zero nem uma lista vazia como substituição. Não há fallback para dados antigos. Parâmetros inválidos são rejeitados antes de chamar a prefeitura; outros municípios não usam o conector de Porto Velho.

## Executar localmente

Node.js 22 ou superior. Para ativar o Redis da VPS, configure `REDIS_URL` e `REDIS_PASSWORD` em `.env.local` conforme `.env.example`. A senha pertence apenas ao servidor. Sem as duas variáveis, a aplicação consulta diretamente a API. Não é necessário Docker ou PostgreSQL.

```sh
npm ci
npm run dev
```

Abra `/porto-velho/contratos`. Exemplos com filtros:

- `/porto-velho/contratos?ano=2026&page=1`
- `/api/porto-velho/contratos?ano=2026&page=1`

No Windows do mantenedor, prefixe os comandos com `rtk proxy`. Consultar essas rotas busca uma página real na fonte oficial.

## Verificação e limites

- `npm test`: fixtures sintéticas de normalização, paginação, parâmetros, timeout e falhas; não executa coleta real.
- `npm run typecheck`, `npm run build`, `npm run format:check`: verificações locais.
- O runtime atual é **Node.js**. Hospedagem, CI remoto e publicação são verificações separadas.
- O mapa mantém o piloto em andamento enquanto a integração pública desta instalação não for publicada e validada.
- Cache Redis não substitui histórico. Histórico, restauração, coleta completa e reconciliação entre páginas não estão implementados.
