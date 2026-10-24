export const ariquemesSource = {
  id: "ariquemes-publica-v1-ug1",
  municipality: "ariquemes",
  module: "contratos",
  name: "API de contratos da Prefeitura de Ariquemes (UG 1)",
  url: "https://transparencia.ariquemes.ro.gov.br/api/doc",
  implementation: "implemented",
} as const;

export const ariquemesWorksSource = {
  ...ariquemesSource,
  module: "obras",
  name: "API de obras da Prefeitura de Ariquemes (UG 1)",
} as const;

export const ariquemesRevenuesSource = {
  ...ariquemesSource,
  module: "receitas",
  name: "API de receitas da Prefeitura de Ariquemes (UG 1)",
} as const;
