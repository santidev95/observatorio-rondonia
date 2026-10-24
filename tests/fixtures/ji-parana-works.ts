// Synthetic fixtures: no record or identity was copied from the municipal API.
export function jiParanaWorkRow(
  id = 7,
  overrides: Record<string, unknown> = {},
) {
  return {
    SEQUENCIAL: id,
    EXERCICIO: 2026,
    NUMERO: id,
    EMPRESA: 2,
    EMPRESA_NOME: "Prefeitura sintética de Ji-Paraná",
    NOMEFOR: "Nome sintético sem tipo de pessoa",
    ANO: "2026",
    SITUACAO: "02 - Em Andamento",
    DATA: "02/01/2026",
    LOCALIZACAO: "Local sintético",
    DESCRICAO: "Obra sintética de teste",
    STATUS: "02 - Em Andamento",
    DATACONCLUSAO: "03/12/2026",
    DATAINI: "01/02/2026",
    ESTIMATIVA: "12/2026",
    CATEGORIA: "5 - Outros",
    TIPO: "Tipo sintético",
    VALOR: "1.234,56",
    PERCENTUALEXECUTADO: "84.74",
    ...overrides,
  };
}

export function jiParanaWorksPage(
  data: unknown[],
  page = 1,
  total = data.length,
  perPage = 10,
) {
  return {
    current_page: page,
    data,
    from: data.length ? (page - 1) * perPage + 1 : null,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    to: data.length ? (page - 1) * perPage + data.length : null,
    total,
    // These response links are untrusted and must never be followed.
    next_page_url: "http://externo.example.invalid/nao-seguir",
    last_page_url: "https://externo.example.invalid/nao-seguir",
  };
}
