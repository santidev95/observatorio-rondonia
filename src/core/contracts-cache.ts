import { z } from "zod";
import {
  contractPageSchema,
  contractRecordSchema,
  type ContractsQuery,
} from "./contracts";
import {
  normalizeContractsQuery,
  isContractId,
  ContractsDataError,
} from "./contracts-query";
import type { ContractsResult, ContractResult } from "./contracts-reader";
import {
  publicaSource,
  type DataMunicipality,
  type PublicaMunicipality,
} from "./municipal-sources";
import { Buffer } from "node:buffer";
import type { ContractRecord } from "./contracts";

function matchesPublicaContract(
  record: ContractRecord,
  year: number,
  municipality: PublicaMunicipality,
) {
  const source = publicaSource(municipality);
  const url = new URL(record.sourceUrl);
  return (
    record.sourceYear === year &&
    typeof record.sourceId === "string" &&
    record.id ===
      `${year}-${Buffer.from(record.sourceId, "utf8").toString("base64url")}` &&
    url.origin === source.apiOrigin &&
    url.pathname === `/api/contratos/${year}/${source.company}` &&
    url.search === ""
  );
}

export const CONTRACTS_CACHE_TTL_SECONDS = 3600;
export const CONTRACTS_CACHE_PREFIX =
  "observatorio:RO:porto-velho:contratos:v1";
export type CacheMetadata = {
  status: "hit" | "miss" | "disabled" | "unavailable";
  expiresAt: string | null;
};
export type CachedResult<T> = T & { cache: CacheMetadata };
export interface ContractsCacheStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}
const pageResultSchema = z
  .object({ data: contractPageSchema, fetchedAt: z.iso.datetime() })
  .strict();
const origin = "https://api.portovelho.ro.gov.br/api/v1/contratos";

export function contractsPageCacheKey(
  input: ContractsQuery,
  municipality: DataMunicipality = "porto-velho",
): string {
  const query = normalizeContractsQuery(input);
  return (
    `observatorio:RO:${municipality}:contratos:v1` +
    ":list:year:" +
    (query.year ?? "all") +
    ":page:" +
    query.page +
    ":size:25"
  );
}
export function contractCacheKey(
  id: string,
  municipality: DataMunicipality = "porto-velho",
): string {
  if (!isContractId(id)) throw new ContractsDataError("invalid-query");
  return `observatorio:RO:${municipality}:contratos:v1:detail:` + id;
}

type Options = {
  cache: () => ContractsCacheStore | null;
  now?: () => number;
  cacheTimeoutMs?: number;
};

// Os prazos de cache não substituem o timeout e o cancelamento do transporte.
async function cacheOperation<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Cache indisponível")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function cachedReader<T extends { fetchedAt: string }>(
  options: Options,
  schema: z.ZodType<T>,
  matches: (value: T, key: string) => boolean,
  cacheable: (value: T) => boolean,
) {
  const inFlight = new Map<string, Promise<CachedResult<T>>>();
  const entrySchema = z
    .object({ key: z.string(), result: schema, expiresAt: z.iso.datetime() })
    .strict();
  const now = options.now ?? Date.now;
  const timeout = options.cacheTimeoutMs ?? 1500;

  async function read(
    key: string,
    load: () => Promise<T>,
  ): Promise<CachedResult<T>> {
    let cache: ContractsCacheStore | null;
    let available = true;
    try {
      cache = options.cache();
    } catch {
      cache = null;
      available = false;
    }
    if (cache === null)
      return {
        ...(await load()),
        cache: {
          status: available ? "disabled" : "unavailable",
          expiresAt: null,
        },
      };
    try {
      const raw = await cacheOperation(() => cache.get(key), timeout);
      const parsed = entrySchema.safeParse(raw);
      if (parsed.success) {
        const entry = parsed.data;
        const fetched = Date.parse(entry.result.fetchedAt);
        const expires = Date.parse(entry.expiresAt);
        if (
          entry.key === key &&
          fetched <= now() &&
          expires === fetched + CONTRACTS_CACHE_TTL_SECONDS * 1000 &&
          now() < expires &&
          matches(entry.result, key)
        ) {
          return {
            ...entry.result,
            cache: { status: "hit", expiresAt: entry.expiresAt },
          };
        }
      }
    } catch {
      available = false;
    }

    const result = await load();
    if (!available)
      return { ...result, cache: { status: "unavailable", expiresAt: null } };
    if (!cacheable(result))
      return { ...result, cache: { status: "miss", expiresAt: null } };
    // Valida de novo antes de gravar: nunca persistir DTO bruto ou parcial.
    const validated = schema.parse(result);
    if (!matches(validated, key))
      throw new ContractsDataError("source-unavailable");
    const expiresAt = new Date(
      Date.parse(result.fetchedAt) + CONTRACTS_CACHE_TTL_SECONDS * 1000,
    ).toISOString();
    try {
      await cacheOperation(
        () =>
          cache.set(
            key,
            { key, result: validated, expiresAt },
            CONTRACTS_CACHE_TTL_SECONDS,
          ),
        timeout,
      );
      return { ...result, cache: { status: "miss", expiresAt } };
    } catch {
      return { ...result, cache: { status: "unavailable", expiresAt: null } };
    }
  }

  return (key: string, load: () => Promise<T>) => {
    const pending = inFlight.get(key);
    if (pending) return pending;
    const promise = read(key, load).finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, promise);
    return promise;
  };
}

export function createCachedContractsReader(
  options: Options & {
    read: (query: ContractsQuery) => Promise<ContractsResult>;
    municipality?: DataMunicipality;
  },
) {
  const municipality = options.municipality ?? "porto-velho";
  const read = cachedReader(
    options,
    pageResultSchema,
    (result, key) => {
      const url = new URL(result.data.sourceUrl);
      if (municipality !== "porto-velho") {
        const source = publicaSource(municipality);
        const match = /^\/api\/contratos\/(20\d{2}|2100)\/([1-9]\d*)$/.exec(
          url.pathname,
        );
        return (
          url.origin === source.apiOrigin &&
          match !== null &&
          Number(match[2]) === source.company &&
          url.searchParams.size === 1 &&
          /^[1-9]\d*$/.test(url.searchParams.get("page") ?? "") &&
          contractsPageCacheKey(
            {
              page: result.data.pagination.currentPage,
              year: Number(match[1]),
            },
            municipality,
          ) === key &&
          result.data.records.every((record) =>
            matchesPublicaContract(record, Number(match[1]), municipality),
          )
        );
      }
      const query = {
        page: result.data.pagination.currentPage,
        year: url.searchParams.has("ano")
          ? Number(url.searchParams.get("ano"))
          : null,
      };
      return (
        url.origin + url.pathname === origin &&
        url.searchParams.get("modelo") === "Contratos" &&
        url.searchParams.get("por-pagina") === "25" &&
        url.searchParams.get("page") === String(query.page) &&
        result.data.records.every(
          (record) =>
            /^[1-9]\d*$/.test(record.id) &&
            record.sourceUrl === origin + "/" + record.id,
        ) &&
        contractsPageCacheKey(query) === key
      );
    },
    () => true,
  );
  return (input: ContractsQuery) => {
    const query = normalizeContractsQuery(input);
    return read(contractsPageCacheKey(query, options.municipality), () =>
      options.read(query),
    );
  };
}

export function createCachedContractReader(
  options: Options & {
    read: (id: string) => Promise<ContractResult>;
    municipality?: DataMunicipality;
  },
) {
  const municipality = options.municipality ?? "porto-velho";
  // O schema aceita null para manter a resposta 404, mas esse resultado não é armazenado.
  const schema = z
    .object({
      data: contractRecordSchema.nullable(),
      fetchedAt: z.iso.datetime(),
    })
    .strict();
  const read = cachedReader(
    options,
    schema,
    (result, key) => {
      if (!result.data) return false;
      if (municipality !== "porto-velho") {
        return (
          result.data.sourceYear !== undefined &&
          matchesPublicaContract(
            result.data,
            result.data.sourceYear,
            municipality,
          ) &&
          contractCacheKey(result.data.id, municipality) === key
        );
      }
      return (
        result.data.sourceUrl === origin + "/" + result.data.id &&
        contractCacheKey(result.data.id) === key
      );
    },
    (result) => result.data !== null,
  );
  return (id: string) =>
    read(contractCacheKey(id, options.municipality), () => options.read(id));
}
