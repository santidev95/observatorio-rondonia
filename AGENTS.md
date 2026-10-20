# Orientações para agentes

- Responda em português e preserve a linguagem da interface.
- No Windows do mantenedor, siga `C:\Users\santi\.codex\RTK.md`. Prefixe comandos com `rtk`; use `rtk proxy` para saída sem filtros.
- Leia o código, consumidores, testes e documentação antes de editar. Preserve trabalho local de outras tarefas.
- Consulte `docs/arquitetura.md`, `docs/identidade-visual.md` e `docs/roteiro.md`.
- O projeto é cívico e independente. Não atribua irregularidade por inferência.
- Obras, Contratos e Receitas de Porto Velho possuem consulta publicada; outros municípios permanecem em preparação. Não introduza estatísticas ou registros demonstrativos na interface.
- APIs municipais variam: regras específicas ficam em `src/connectors/`; a apresentação consome contratos normalizados.
- Preserve IDs e links oficiais, valores em centavos, null, zero e negativos quando previstos no domínio.
- Cadastros em preparação não devem ser anunciados como integrações disponíveis.
- Redis em Docker na VPS guarda Contratos e Obras por uma hora, com fallback à API. Receitas usa worker separado: renovação horária do exercício corrente, demais exercícios sob demanda após um dia, retenção da última carga válida por até sete dias. A requisição de Receitas nunca coleta a fonte; sem versão retorna estado pendente, e falhas preservam a versão anterior dentro da retenção. Arquivo durável e histórico não estão implementados. Preserve o horário original da consulta à fonte e não armazene erros, 404 ou respostas brutas.
- O worker usa lease por exercício, publicação atômica conferindo o token e limite de consultas compartilhado pelo site. Preserve as datas originais e os estados de atualização visíveis. Veja `docs/receitas-background.md`.
- Planeje chaves isoladas por UF, município, módulo e versão. Publique uma revisão somente após coleta completa e validação; uma falha preserva a última válida.
- Segredos pertencem ao servidor e ao coletor, nunca a `NEXT_PUBLIC_`, ao navegador ou aos logs. Não copie arquivos `.env` de outros projetos.
- Testes usam fixtures sintéticas. Coletas reais, commits, pushes, DNS e deploy precisam integrar o pedido autorizado.
- Use Node.js 22 conforme `.node-version`, alinhado ao Docker. Comandos: `npm ci`, `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run format:check`.
- Mudanças de código: typecheck e testes pertinentes; rotas/build: build; mudanças visuais: desktop, celular, navegação e acessibilidade.
- Informe validação local, CI remoto e publicação separadamente. O CI chama `validate-build.yml`; PRs somente validam, e a master publica a imagem testada e seu manifesto. O deploy em `.github/workflows/deploy.yml` aceita apenas o digest de um CI aprovado da master para o mesmo commit, sem build, mantendo SSH restrito e Cloudflare Tunnel. Veja `docs/producao.md`. A master exige PR e `CI aprovado`; tags `v*` não devem ser movidas ou apagadas. O ambiente está instalado; verifique o Actions e `/api/health` antes de afirmar qual revisão está em produção.
- Antes de escrever código Next.js, leia a documentação correspondente em `node_modules/next/dist/docs/`. Esta versão pode diferir de exemplos antigos.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
