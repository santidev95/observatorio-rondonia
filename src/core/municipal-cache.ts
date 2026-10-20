import { z } from "zod";
import { cachedReader, type ContractsCacheStore } from "./contracts-cache";
import { worksCatalogSchema, type WorksCatalog } from "./works";
type Result<T> = { data: T; fetchedAt: string };
type Options = {
  cache: () => ContractsCacheStore | null;
  now?: () => number;
  cacheTimeoutMs?: number;
};
export const WORKS_CACHE_KEY = "observatorio:RO:porto-velho:obras:v1:catalog";
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
