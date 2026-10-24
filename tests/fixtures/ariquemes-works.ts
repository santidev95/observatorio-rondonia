// Synthetic records; none of these values was copied from the municipal API.
export function ariquemesWorkRow(
  id = 3,
  overrides: Record<string, unknown> = {},
) {
  return {
    SEQUENCIAL: id,
    EXERCICIO: 2026,
    NUMERO: id,
    EMPRESA: 1,
    EMPRESA_NOME: "Prefeitura sintética de Ariquemes",
    NOMEFOR: "Fornecedor sintético sem tipo de pessoa",
    ANO: "2026",
    SITUACAO: "02 - Em Andamento",
    DATA: "03/01/2026",
    LOCALIZACAO: "Local sintético de Ariquemes",
    DESCRICAO: "Obra sintética em Ariquemes",
    STATUS: "02 - Em Andamento",
    DATACONCLUSAO: null,
    DATAINI: "02/02/2026",
    ESTIMATIVA: "12/2027",
    CATEGORIA: "5 - Outros",
    TIPO: "Tipo sintético",
    VALOR: "9.876,54",
    PERCENTUALEXECUTADO: null,
    ...overrides,
  };
}
