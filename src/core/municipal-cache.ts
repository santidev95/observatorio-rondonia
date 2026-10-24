import { z } from "zod";
import { cachedReader, type ContractsCacheStore } from "./contracts-cache";
import { worksCatalogSchema, type WorksCatalog } from "./works";
import { publicaSource } from "./municipal-sources";
import { ContractsDataError } from "./contracts-query";
type Result<T> = { data: T; fetchedAt: string };
type Options = {
  cache: () => ContractsCacheStore | null;
  now?: () => number;
  cacheTimeoutMs?: number;
};
export const WORKS_CACHE_KEY = "observatorio:RO:porto-velho:obras:v1:catalog";
export function createCachedWorksReader(
  options: Options & {
    read: () => Promise<Result<WorksCatalog>>;
    cacheKey?: string;
    sourceUrl?: string;
  },
) {
  const resultSchema = z
    .object({ data: worksCatalogSchema, fetchedAt: z.iso.datetime() })
    .strict();
  const matchesSource = (r: Result<WorksCatalog>, key: string) => {
    if (
      key !== (options.cacheKey ?? WORKS_CACHE_KEY) ||
      r.data.sourceUrl !==
        (options.sourceUrl ??
          "https://api.portovelho.ro.gov.br/api/v1/obras?por-pagina=100")
    )
      return false;
    if (key === WORKS_CACHE_KEY)
      return r.data.records.every(
        (work) =>
          work.id === `pvh-${work.sourceId}` &&
          work.sourceUrl ===
            `https://api.portovelho.ro.gov.br/api/v1/obras/${work.sourceId}`,
      );
    const match =
      /^observatorio:RO:(ji-parana|ariquemes):obras:v1:year:(20\d{2}|2100):catalog$/.exec(
        key,
      );
    if (!match) return false;
    const municipality = match[1] as "ji-parana" | "ariquemes";
    const config = publicaSource(municipality);
    const source = `${config.apiOrigin}/api/obras/${match[2]}/${config.company}`;
    return (
      r.data.sourceUrl === source &&
      r.data.records.every(
        (work) =>
          work.sourceYear === Number(match[2]) &&
          work.id === `${municipality}-${match[2]}-${work.sourceId}` &&
          work.sourceUrl === source,
      )
    );
  };
  const read = cachedReader(
    options,
    resultSchema,
    (result, key) => result.data.complete && matchesSource(result, key),
    (result) => result.data.complete,
  );
  return () => {
    const key = options.cacheKey ?? WORKS_CACHE_KEY;
    return read(key, async () => {
      const result = resultSchema.parse(await options.read());
      if (!matchesSource(result, key))
        throw new ContractsDataError("source-unavailable");
      return result;
    });
  };
}
