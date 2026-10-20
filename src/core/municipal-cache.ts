import { z } from "zod";
import { cachedReader, type ContractsCacheStore } from "./contracts-cache";
import { worksCatalogSchema, type WorksCatalog } from "./works";
import { revenueSnapshotSchema, type RevenueSnapshot } from "./revenues";
type Result<T> = { data: T; fetchedAt: string };
type Options = {
  cache: () => ContractsCacheStore | null;
  now?: () => number;
  cacheTimeoutMs?: number;
};
export const WORKS_CACHE_KEY = "observatorio:RO:porto-velho:obras:v1:catalog";
export function revenuesCacheKey(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw new Error("Exercício inválido");
  return (
    "observatorio:RO:porto-velho:receitas:v1:year:" + year + ":portal:12535"
  );
}
export function createCachedWorksReader(
  options: Options & { read: () => Promise<Result<WorksCatalog>> },
) {
  const read = cachedReader(
    options,
    z
      .object({ data: worksCatalogSchema, fetchedAt: z.iso.datetime() })
      .strict(),
    (r, key) =>
      key === WORKS_CACHE_KEY &&
      r.data.sourceUrl ===
        "https://api.portovelho.ro.gov.br/api/v1/obras?por-pagina=100",
    () => true,
  );
  return () => read(WORKS_CACHE_KEY, options.read);
}
export function createCachedRevenuesReader(
  options: Options & {
    read: (year: number) => Promise<Result<RevenueSnapshot>>;
  },
) {
  const read = cachedReader(
    options,
    z
      .object({ data: revenueSnapshotSchema, fetchedAt: z.iso.datetime() })
      .strict(),
    (r, key) =>
      key === revenuesCacheKey(r.data.years[0].year) &&
      r.data.sourceUrl ===
        "https://api.portovelho.ro.gov.br/api/v1/receitas?portal_id=12535&ano=" +
          r.data.years[0].year,
    () => true,
  );
  return (year: number) =>
    read(revenuesCacheKey(year), () => options.read(year));
}
