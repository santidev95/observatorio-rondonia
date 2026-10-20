// Fonte do conector de consulta paginada em contracts.ts.
// O cadastro não afirma disponibilidade atual ou publicação em produção.
export const portoVelhoSource = {
  id: "porto-velho-api-v1",
  municipality: "porto-velho",
  module: "contratos",
  name: "API de contratos da Prefeitura de Porto Velho",
  url: "https://api.portovelho.ro.gov.br/api/v1/contratos?modelo=Contratos",
  implementation: "implemented",
} as const;

export const portoVelhoWorksSource = {
  id: "porto-velho-api-v1",
  municipality: "porto-velho",
  module: "obras",
  name: "API de obras da Prefeitura de Porto Velho",
  url: "https://api.portovelho.ro.gov.br/api/v1/obras?por-pagina=100",
  implementation: "implemented",
} as const;
export const portoVelhoRevenuesSource = {
  id: "porto-velho-api-v1",
  municipality: "porto-velho",
  module: "receitas",
  name: "API de receitas da Prefeitura de Porto Velho",
  url: "https://api.portovelho.ro.gov.br/api/v1/receitas?portal_id=12535",
  implementation: "implemented",
} as const;
