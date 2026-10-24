import { parseContractsQuery } from "@/core/contracts-query";
import {
  isMunicipalContractId,
  type DataMunicipality,
} from "@/core/municipal-sources";

export function contractsReturnUrl(
  search: Record<string, unknown>,
  municipality: DataMunicipality,
  id: string,
): string {
  const catalog = `/${municipality}/contratos`;
  const fallbackYear =
    municipality !== "porto-velho" && isMunicipalContractId(id, municipality)
      ? Number(id.slice(0, 4))
      : null;
  const fallback = catalog + (fallbackYear ? `?ano=${fallbackYear}` : "");
  try {
    const query = parseContractsQuery(search);
    const context = new URLSearchParams();
    if (search.page !== undefined) context.set("page", String(query.page));
    const year = query.year ?? fallbackYear;
    if (year !== null) context.set("ano", String(year));
    return catalog + (context.size ? "?" + context.toString() : "");
  } catch {
    return fallback;
  }
}
