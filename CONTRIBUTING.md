# Como contribuir

Contribuições de código, documentação, testes e levantamento de fontes são bem-vindas. O projeto é independente, informativo e sem propaganda eleitoral.

## Preparar o ambiente

1. Faça um fork e clone sua cópia.
2. Use Node.js 22 ou superior.
3. Execute `npm ci` e `npm run dev`.
4. Crie uma branch para sua contribuição.

A base inicial abre sem banco ou credenciais e mostra claramente as integrações em preparação. No Windows do mantenedor, use o prefixo `rtk proxy` nos comandos.

## Propor uma prefeitura

Abra uma issue de **Nova integração municipal** com:

- Município e fontes oficiais verificáveis.
- Documentação da API, paginação, autenticação e limites conhecidos.
- Módulos disponíveis: contratos, obras e/ou receitas.
- Campos ausentes e limitações de cobertura.
- Exemplo sintético do formato, sem credenciais ou dados pessoais desnecessários.

Não é necessário implementar os três módulos para começar. A cobertura deve ser explícita; um endpoint não verificado não comprova disponibilidade.

## Implementar uma integração

1. Cadastre o município em `src/municipalities/`, inicialmente como planejado.
2. Documente fontes e comportamento em `src/connectors/<municipio>/`.
3. Siga os contratos em `src/core/`; proponha alterações quando a fonte exigir um caso ainda não previsto.
4. Inclua fixtures sintéticas e testes para paginação, campos ausentes, falhas, dinheiro, datas e escopo municipal.
5. Demonstre que coleta parcial não substitui a revisão válida.
6. Submeta o PR para revisão. A ativação depende de validação da fonte e do fluxo completo de armazenamento.

Porto Velho possui um conector de consulta paginada de Contratos com cache opcional Redis em Docker na VPS de uma hora, por página e ficha, sem coleta completa. Veja docs/contratos-porto-velho.md. O pipeline de publicação e o histórico ainda não foram implementados; consultar uma página não comprova cobertura de todo o catálogo.

## Antes do PR

```sh
npm test
npm run typecheck
npm run build
npm run format:check
git diff --check
```

Descreva a mudança, as fontes consultadas, os testes executados e as limitações. Alterações visuais precisam ser conferidas em desktop e celular.

Não publique tokens, arquivos `.env`, respostas brutas contendo dados pessoais ou credenciais de produção. Não execute coletas, altere DNS ou faça deploy como efeito colateral de uma contribuição.

## Identidade

Preserve o fundo escuro e o dourado existentes. A bandeira de Rondônia deve manter a composição e as cores do arquivo de origem. Veja os créditos em `docs/identidade-visual.md`.
