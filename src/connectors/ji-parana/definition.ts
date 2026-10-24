export const jiParanaSource = {
  id: "ji-parana-publica-v1-ug2",
  municipality: "ji-parana",
  module: "contratos",
  name: "API de contratos da Prefeitura de Ji-Paraná (UG 2)",
  url: "https://transparencia.ji-parana.ro.gov.br/api/doc",
  implementation: "implemented",
} as const;

export const jiParanaWorksSource = {
  ...jiParanaSource,
  module: "obras",
  name: "API de obras da Prefeitura de Ji-Paraná (UG 2)",
} as const;

export const jiParanaRevenuesSource = {
  ...jiParanaSource,
  module: "receitas",
  name: "API de receitas da Prefeitura de Ji-Paraná (UG 2)",
} as const;
