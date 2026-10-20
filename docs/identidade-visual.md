# Identidade visual

Nome: **Observatório de Rondônia**.

A tela inicial prioriza o mapa municipal SVG do IBGE, preservando as cores do portal.

A identidade reutiliza o esquema de cores do Observatório de Porto Velho, com a bandeira de Rondônia no cabeçalho, na apresentação inicial e no favicon.

| Token            | Cor       | Aplicação                               |
| ---------------- | --------- | --------------------------------------- |
| `--paper`        | `#131313` | Fundo principal                         |
| `--surface`      | `#201f1f` | Superfícies                             |
| `--surface-soft` | `#1c1b1b` | Cartões                                 |
| `--gold`         | `#f2c230` | Destaques e ações                       |
| `--gold-soft`    | `#ffe199` | Destaques suaves                        |
| `--ink`          | `#e5e2e1` | Texto principal                         |
| `--muted`        | `#d1c5ad` | Texto secundário                        |
| `--line`         | `#353534` | Bordas                                  |
| `--green`        | `#34d399` | Estado positivo quando houver evidência |

Origem dos tokens: `src/app/globals.css` do Observatório de Porto Velho, commit `6669841b1ed5ee39fb3c517d5413f59bed516fff`. Aviso MIT preservado em `LICENSE`.

## Bandeira

Arquivo original local: `public/images/bandeira-rondonia.svg`. Mantém o desenho e as cores originais, sem recorte ou recoloração.

O cabeçalho e o favicon usam `public/images/bandeira-rondonia-circular.svg`, uma adaptação com recorte circular e cantos transparentes, preservando as cores e a estrela do arquivo original. A imagem retangular original permanece disponível. No cabeçalho, a versão circular mede 48 × 48 px no desktop e 40 × 40 px no celular.

O cabeçalho alinha a bandeira à esquerda do conteúdo, seguida do nome e da frase do projeto, com espaçamento próprio entre símbolo e texto. O acesso para contribuir fica no rodapé.

- [Arquivo e procedência na Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bandeira_de_Rond%C3%B4nia.svg).
- Autor informado: E2m. A página do arquivo declara domínio público pelo autor.
- [SVG original](https://upload.wikimedia.org/wikipedia/commons/f/fa/Bandeira_de_Rond%C3%B4nia.svg).
- Referência oficial consultada: [Símbolos oficiais de Rondônia](https://rondonia.ro.gov.br/casa-militar/institucional/simbolos-oficiais/).
- Incorporado em 18/10/2026. Créditos também acessíveis nos Termos de Uso, pelo rodapé.

A bandeira representa o território. A interface identifica explicitamente o caráter cívico independente do projeto, sem vínculo governamental.

## Interface

Tema escuro, dourado nas ações, hierarquia tipográfica e foco visível. Cartões e navegação se adaptam a celular. Respeite preferência por movimento reduzido e mantenha links reconhecíveis.

A tipografia Geist é compartilhada pela navegação, páginas municipais e consultas, servida localmente pelo Next.js. O texto de apoio usa `--dim: #b5aa94` para melhorar a leitura no tema escuro; os demais tokens de identidade são preservados.

A home mantém o mapa como elemento principal, em uma superfície delimitada, com busca por nome e acesso direto a Porto Velho. Os cartões municipais usam ícones, descrições curtas e ações alinhadas. Estados em preparação conservam rótulos explícitos e não oferecem consultas indisponíveis. Valores financeiros usam algarismos tabulares, preservando a formatação e os dados originais.

Não use verde ou indicadores de sucesso para módulos ainda em preparação.

O rodapé apresenta somente os links “Termos de uso” e “Contribuir no GitHub”, centralizados, com ícones e foco visível. A página `/termos-de-uso` reúne as condições de consulta e reutilização, limites das fontes, caráter independente do projeto e créditos dos materiais.
