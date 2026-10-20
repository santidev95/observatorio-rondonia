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

Arquivo local: `public/images/bandeira-rondonia.svg`. Mantém o desenho e as cores originais, sem recorte ou recoloração.

- [Arquivo e procedência na Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bandeira_de_Rond%C3%B4nia.svg).
- Autor informado: E2m. A página do arquivo declara domínio público pelo autor.
- [SVG original](https://upload.wikimedia.org/wikipedia/commons/f/fa/Bandeira_de_Rond%C3%B4nia.svg).
- Referência oficial consultada: [Símbolos oficiais de Rondônia](https://rondonia.ro.gov.br/casa-militar/institucional/simbolos-oficiais/).
- Incorporado em 18/10/2026. Créditos também acessíveis pelo rodapé.

A bandeira representa o território. A interface identifica explicitamente o caráter cívico independente do projeto, sem vínculo governamental.

## Interface

Tema escuro, dourado nas ações, hierarquia tipográfica e foco visível. Cartões e navegação se adaptam a celular. Respeite preferência por movimento reduzido e mantenha links reconhecíveis.

Não use verde ou indicadores de sucesso para módulos ainda em preparação.
