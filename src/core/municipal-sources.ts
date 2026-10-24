import { normalizeContractsQuery } from "./contracts-query";
import type { ContractsQuery } from "./contracts";

export type DataMunicipality = "porto-velho" | "ji-parana" | "ariquemes";
export type PublicaMunicipality = Exclude<DataMunicipality, "porto-velho">;
export const publicaMunicipalities = ["ji-parana", "ariquemes"] as const;
const sources = {
  "porto-velho": {
    slug: "porto-velho",
    name: "Porto Velho",
    annual: false,
    apiOrigin: "https://api.portovelho.ro.gov.br",
    company: null,
    contracts:
      "https://api.portovelho.ro.gov.br/api/v1/contratos?modelo=Contratos",
    works: "https://api.portovelho.ro.gov.br/api/v1/obras?por-pagina=100",
    revenues: "https://transparencia.portovelho.ro.gov.br/receitas",
    documentation: "https://api.portovelho.ro.gov.br/docs/api",
  },
  "ji-parana": {
    slug: "ji-parana",
    name: "Ji-Paraná",
    annual: true,
    apiOrigin: "https://transparencia.ji-parana.ro.gov.br",
    company: 2,
    contracts: "https://transparencia.ji-parana.ro.gov.br/api/doc",
    works: "https://transparencia.ji-parana.ro.gov.br/api/doc",
    revenues: "https://transparencia.ji-parana.ro.gov.br/api/doc",
    documentation: "https://transparencia.ji-parana.ro.gov.br/api/doc",
  },
  ariquemes: {
    slug: "ariquemes",
    name: "Ariquemes",
    annual: true,
    apiOrigin: "https://transparencia.ariquemes.ro.gov.br",
    company: 1,
    contracts: "https://transparencia.ariquemes.ro.gov.br/api/doc",
    works: "https://transparencia.ariquemes.ro.gov.br/api/doc",
    revenues: "https://transparencia.ariquemes.ro.gov.br/api/doc",
    documentation: "https://transparencia.ariquemes.ro.gov.br/api/doc",
  },
} as const;

export function dataMunicipality(slug: string) {
  return slug === "porto-velho" || slug === "ji-parana" || slug === "ariquemes"
    ? sources[slug]
    : undefined;
}
export function publicaSource(municipality: PublicaMunicipality) {
  if (!publicaMunicipalities.includes(municipality))
    throw new Error("Município sem conector Pública");
  return sources[municipality];
}
export function municipalYear(now = Date.now()) {
  return Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "America/Porto_Velho",
    }).format(now),
  );
}
export function municipalContractsQuery(
  input: ContractsQuery,
  municipality: DataMunicipality,
): ContractsQuery {
  const query = normalizeContractsQuery(input);
  return municipality !== "porto-velho" && query.year === null
    ? { ...query, year: municipalYear() }
    : query;
}
export function isMunicipalContractId(
  id: string,
  municipality: DataMunicipality,
) {
  return municipality === "porto-velho"
    ? /^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id))
    : /^(?:20\d{2}|2100)-[A-Za-z0-9_-]{2,90}$/.test(id);
}
