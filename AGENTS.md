# Orientações para agentes

- Responda em português e preserve a linguagem da interface.
- No Windows do mantenedor, siga `C:\Users\santi\.codex\RTK.md`. Prefixe comandos com `rtk`; use `rtk proxy` para saída sem filtros.
- Leia o código, consumidores, testes e documentação antes de editar. Preserve trabalho local de outras tarefas.
- Consulte `docs/arquitetura.md`, `docs/identidade-visual.md` e `docs/roteiro.md`.
- O projeto é cívico e independente. Não atribua irregularidade por inferência.
- Nenhum módulo possui dados publicados nesta etapa. Não introduza estatísticas ou registros demonstrativos na interface.
- APIs municipais variam: regras específicas ficam em `src/connectors/`; a apresentação consome contratos normalizados.
- Preserve IDs e links oficiais, valores em centavos, null, zero e negativos quando previstos no domínio.
- Cadastros em preparação não devem ser anunciados como integrações disponíveis.
- Redis em Docker na VPS armazena páginas/fichas de Contratos, catálogo completo de Obras e resumos anuais de Receitas normalizados por até uma hora, com validação na leitura e fallback direto à API se o cache falhar. Arquivo durável e histórico não estão implementados. Preserve o horário original da consulta à fonte e não armazene erros, 404 ou respostas brutas.
- Planeje chaves isoladas por UF, município, módulo e versão. Publique uma revisão somente após coleta completa e validação; uma falha preserva a última válida.
- Segredos pertencem ao servidor e ao coletor, nunca a `NEXT_PUBLIC_`, ao navegador ou aos logs. Não copie arquivos `.env` de outros projetos.
- Testes usam fixtures sintéticas. Coletas reais, commits, pushes, DNS e deploy precisam integrar o pedido autorizado.
- Comandos: `npm ci`, `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run format:check`.
- Mudanças de código: typecheck e testes pertinentes; rotas/build: build; mudanças visuais: desktop, celular, navegação e acessibilidade.
- Informe validação local, CI remoto e publicação separadamente. Não há deploy configurado.
- Antes de escrever código Next.js, leia a documentação correspondente em `node_modules/next/dist/docs/`. Esta versão pode diferir de exemplos antigos.
