# Mapa municipal de Rondônia

A tela inicial usa SVG para selecionar os municípios de Rondônia. A referência de interação fornecida foi [seuimposto.com](https://seuimposto.com/1turno/#governadores-ro); seu código e dados eleitorais não foram incorporados.

## Origem geográfica

- [Documentação oficial da API de Malhas Geográficas v3 do IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3).
- [SVG com limites municipais de Rondônia, qualidade intermediária](https://servicodados.ibge.gov.br/api/v3/malhas/estados/11?formato=image/svg+xml&qualidade=intermediaria&intrarregiao=municipio).
- [Lista oficial de municípios de Rondônia](https://servicodados.ibge.gov.br/api/v1/localidades/estados/11/municipios?orderBy=nome).
- Incorporados em 18/10/2026. A lista e a malha contêm 52 municípios.
- A data de incorporação não é o ano de referência dos limites. O SVG é uma malha simplificada para navegação, sem uso para cálculos territoriais.

As respostas públicas estão em `public/maps/`. Os caminhos foram extraídos do SVG sem redesenho ou projeção adicional, preservando IDs IBGE, `viewBox` e transformação do grupo original. Nome e slug são associados pelo código oficial.

`scripts/build-municipal-map.mjs` gera `src/geography/rondonia-map.json` a partir desses arquivos locais, sem rede. Ele exige correspondência completa entre IDs da malha e da lista e rejeita duplicações. O JSON inclui URLs de procedência e SHA-256 do SVG original.

Para reproduzir:

```sh
node scripts/build-municipal-map.mjs
npm run format
npm test
```

No Windows do mantenedor, prefixe com `rtk proxy`. A atualização das fontes geográficas é manual e deve ser revisada; não há download durante o build ou nas consultas do site.

## Interação

- A tela inicial prioriza o mapa, com uma instrução curta, sem dropdown ou painel lateral.
- Hover ou foco identifica o município; clique, Enter ou Espaço mostra apenas nome, estágio e link de acesso.
- No SVG, Tab entra no município ativo; setas percorrem a ordem alfabética, Home/End vão ao primeiro/último e Escape limpa a seleção.
- Controles permitem ampliar, reduzir e restaurar o mapa. Com zoom, a área tem rolagem nativa.
- A seleção mostra uma faixa compacta sobre o mapa para abrir a página, em desktop e celular.
- Sem JavaScript, uma lista de links é exibida como alternativa ao mapa.
- Slugs desconhecidos continuam retornando 404.

## Cobertura

As 52 páginas representam o cadastro geográfico, sem afirmar integração de dados:

- Porto Velho: piloto em preparação.
- Ji-Paraná: integração proposta.
- Demais municípios: integração não iniciada.
- Nenhum catálogo está publicado nesta etapa.

A legenda compacta abaixo do mapa identifica a situação das integrações:

- **Integrados (verde):** ao menos um módulo declarado disponível no cadastro. Essa situação deve ser usada somente após publicar e validar o catálogo; nenhum município está marcado assim nesta etapa.
- **Em andamento (dourado):** preparação do piloto, atualmente Porto Velho. Não indica coleta em execução nem catálogo publicado.
- **Não integrados (cinza):** proposta sem trabalho iniciado ou integração não iniciada, incluindo Ji-Paraná.

Hover e seleção preservam a cor da situação e destacam o contorno. O detalhe da seleção mantém o estágio específico do município. As cores não representam dados eleitorais, financeiros, avaliação de gestão ou indicadores municipais.
