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

- A tela inicial prioriza o mapa, com uma instrução curta, busca por nome e acesso direto às consultas de Porto Velho.
- A busca usa o cadastro local, aceita nomes sem acentos e informa a situação da integração. Os resultados são links navegáveis por Tab; Escape ou o botão de limpar restaura a busca. Não há consulta a APIs durante a busca.
- Hover ou foco identifica o município; clique, Enter ou Espaço abre diretamente sua página.
- No SVG, Tab entra no município ativo; setas percorrem a ordem alfabética, Home/End vão ao primeiro/último.
- Controles permitem ampliar, reduzir e restaurar o mapa. Com zoom, a área tem rolagem nativa.
- Sem JavaScript, uma lista de links é exibida como alternativa ao mapa.
- Slugs desconhecidos continuam retornando 404.

## Cobertura

As 52 páginas representam o cadastro geográfico, sem afirmar integração de dados:

- Porto Velho: Obras, Contratos e Receitas disponíveis; a disponibilidade atual das fontes e a cobertura são informadas nos módulos.
- Ji-Paraná: integração proposta.
- Demais municípios: integração não iniciada.

A legenda compacta abaixo do mapa identifica a situação das integrações:

- **Integrados (verde):** ao menos um módulo declarado disponível no cadastro, atualmente Porto Velho. Essa situação deve ser usada somente após publicar e validar o catálogo.
- **Em andamento (dourado):** preparação de um piloto sem módulos disponíveis. Não indica coleta em execução nem catálogo publicado.
- **Não integrados (cinza):** proposta sem trabalho iniciado ou integração não iniciada, incluindo Ji-Paraná.

Hover e foco preservam a cor da situação e destacam o contorno. As cores não representam dados eleitorais, financeiros, avaliação de gestão ou indicadores municipais.

A ativação de um município por clique, Enter ou Espaço navega diretamente para seu path. Setas, Home e End apenas movem o foco; a legenda das integrações e os controles de zoom são preservados.
