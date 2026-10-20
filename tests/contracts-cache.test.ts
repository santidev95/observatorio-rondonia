import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import {
  createCachedContractsReader,
  createCachedContractReader,
  contractsPageCacheKey,
  contractCacheKey,
  CONTRACTS_CACHE_TTL_SECONDS,
  type ContractsCacheStore,
} from "../src/core/contracts-cache";
import type {
  ContractPage,
  ContractRecord,
  ContractsQuery,
} from "../src/core/contracts";
import { ContractsDataError } from "../src/core/contracts-query";

const start = Date.parse("2026-10-19T12:00:00Z");
const query = { page: 1, year: null };
function page(input: ContractsQuery = query): ContractPage {
  const params = new URLSearchParams({
    modelo: "Contratos",
    "por-pagina": "25",
    page: String(input.page),
  });
  if (input.year !== null) params.set("ano", String(input.year));
  return {
    records: [],
    warnings: [],
    pagination: { currentPage: input.page, lastPage: 1, perPage: 25, total: 0 },
    sourceUrl: "https://api.portovelho.ro.gov.br/api/v1/contratos?" + params,
  };
}
function record(id = "123"): ContractRecord {
  return {
    id,
    number: "Contrato sintético",
    year: 2026,
    object: null,
    department: null,
    departmentName: null,
    contractorName: null,
    contractorCnpj: null,
    suppliers: [],
    status: null,
    process: null,
    category: null,
    addendumReported: null,
    observation: null,
    sourceUrl: "https://api.portovelho.ro.gov.br/api/v1/contratos/" + id,
    sourceUpdatedAt: null,
    amountCents: 0,
    paidAmountCents: null,
    executedAmountCents: null,
    signedOn: null,
    startsOn: null,
    endsOn: null,
    documents: [],
    procurement: null,
    issues: [],
  };
}
class MemoryCache implements ContractsCacheStore {
  entries = new Map<string, unknown>();
  writes: { key: string; ttl: number }[] = [];
  gets = 0;
  async get(key: string) {
    this.gets++;
    return structuredClone(this.entries.get(key) ?? null);
  }
  async set(key: string, value: unknown, ttl: number) {
    this.writes.push({ key, ttl });
    this.entries.set(key, structuredClone(value));
  }
}

test("cache por página usa TTL de uma hora sem renovar o prazo nem a consulta original no hit", async () => {
  const cache = new MemoryCache();
  let clock = start;
  let calls = 0;
  const read = createCachedContractsReader({
    cache: () => cache,
    now: () => clock,
    read: async (input) => {
      calls++;
      return { data: page(input), fetchedAt: new Date(clock).toISOString() };
    },
  });
  const first = await read(query);
  clock += 600_000;
  const second = await read(query);
  assert.equal(calls, 1);
  assert.equal(first.cache.status, "miss");
  assert.equal(second.cache.status, "hit");
  assert.equal(second.fetchedAt, first.fetchedAt);
  assert.equal(
    second.cache.expiresAt,
    new Date(start + 3600_000).toISOString(),
  );
  assert.deepEqual(cache.writes, [
    { key: contractsPageCacheKey(query), ttl: CONTRACTS_CACHE_TTL_SECONDS },
  ]);
  clock = start + 3600_000;
  const expired = await read(query);
  assert.equal(calls, 2);
  assert.equal(expired.cache.status, "miss");
  assert.equal(expired.fetchedAt, new Date(clock).toISOString());
});

test("cache isola tipo, município, ano e página e rejeita query ou ID antes do Redis", () => {
  assert.match(
    contractsPageCacheKey(query),
    /^observatorio:RO:porto-velho:contratos:v1:/,
  );
  assert.equal(
    new Set([
      contractsPageCacheKey(query),
      contractsPageCacheKey({ page: 2, year: null }),
      contractsPageCacheKey({ page: 1, year: 2026 }),
      contractCacheKey("1"),
    ]).size,
    4,
  );
  const cache = new MemoryCache();
  const read = createCachedContractsReader({
    cache: () => cache,
    read: async () => {
      throw new Error("não consultar");
    },
  });
  const detail = createCachedContractReader({
    cache: () => cache,
    read: async () => {
      throw new Error("não consultar");
    },
  });
  assert.throws(() => read({ page: 0, year: null }), ContractsDataError);
  assert.throws(() => detail("001"), ContractsDataError);
  assert.equal(cache.gets, 0);
});

test("cache descarta conteúdo inválido, chave diferente, data futura e expiração adulterada", async () => {
  for (const mutate of [
    (entry: any) => {
      entry.result.data.raw = { cpf: "segredo-sintetico" };
    },
    (entry: any) => {
      entry.key += ":outra-chave";
    },
    (entry: any) => {
      entry.expiresAt = new Date(start + 7200_000).toISOString();
    },
    (entry: any) => {
      entry.result.fetchedAt = new Date(start + 1000).toISOString();
      entry.expiresAt = new Date(start + 3601_000).toISOString();
    },
    (entry: any) => {
      entry.result.data.sourceUrl += "&ano=2026";
    },
    (entry: any) => {
      entry.result.data.pagination.total = 1;
    },
  ]) {
    const cache = new MemoryCache();
    let calls = 0;
    const read = createCachedContractsReader({
      cache: () => cache,
      now: () => start,
      read: async () => {
        calls++;
        return { data: page(), fetchedAt: new Date(start).toISOString() };
      },
    });
    await read(query);
    const key = contractsPageCacheKey(query);
    const entry: any = structuredClone(cache.entries.get(key));
    mutate(entry);
    cache.entries.set(key, entry);
    const result = await read(query);
    assert.equal(calls, 2);
    assert.notEqual(result.cache.status, "hit");
    assert.equal("raw" in result.data, false);
  }
});

test("falha ou timeout do Redis consulta a API sem expor erro e sem repetir gravação", async () => {
  for (const mode of ["throw", "timeout"] as const) {
    let calls = 0;
    let writes = 0;
    const cache: ContractsCacheStore = {
      get: async () => {
        if (mode === "throw") throw new Error("token-sintetico");
        return new Promise(() => {});
      },
      set: async () => {
        writes++;
      },
    };
    const read = createCachedContractsReader({
      cache: () => cache,
      cacheTimeoutMs: 10,
      now: () => start,
      read: async () => {
        calls++;
        return { data: page(), fetchedAt: new Date(start).toISOString() };
      },
    });
    const result = await read(query);
    assert.equal(calls, 1);
    assert.equal(writes, 0);
    assert.deepEqual(result.cache, { status: "unavailable", expiresAt: null });
    assert.equal(JSON.stringify(result).includes("token-sintetico"), false);
  }
});

test("falha na gravação retorna a resposta válida da API e configuração ausente mantém consulta direta", async () => {
  const read = createCachedContractsReader({
    cache: () => ({
      get: async () => null,
      set: async () => {
        throw new Error("token-sintetico");
      },
    }),
    now: () => start,
    read: async () => ({
      data: page(),
      fetchedAt: new Date(start).toISOString(),
    }),
  });
  assert.equal((await read(query)).cache.status, "unavailable");
  let calls = 0;
  const direct = createCachedContractsReader({
    cache: () => null,
    read: async () => {
      calls++;
      return { data: page(), fetchedAt: new Date(start).toISOString() };
    },
  });
  assert.equal((await direct(query)).cache.status, "disabled");
  await direct(query);
  assert.equal(calls, 2);
  const invalidConfig = createCachedContractsReader({
    cache: () => {
      throw new Error("config-sintetica");
    },
    read: async () => ({
      data: page(),
      fetchedAt: new Date(start).toISOString(),
    }),
  });
  assert.equal((await invalidConfig(query)).cache.status, "unavailable");
});

test("erro da origem não é armazenado nem substituído por cache expirado ou página vazia", async () => {
  const cache = new MemoryCache();
  let clock = start;
  let fail = false;
  const read = createCachedContractsReader({
    cache: () => cache,
    now: () => clock,
    read: async () => {
      if (fail) throw new ContractsDataError("source-unavailable");
      return { data: page(), fetchedAt: new Date(clock).toISOString() };
    },
  });
  await read(query);
  fail = true;
  assert.equal((await read(query)).cache.status, "hit");
  clock += 3600_000;
  await assert.rejects(() => read(query), ContractsDataError);
  assert.equal(cache.writes.length, 1);
});

test("fichas usam chave própria, preservam zero e ausência; 404 e ID diferente não entram no cache", async () => {
  const cache = new MemoryCache();
  let calls = 0;
  const read = createCachedContractReader({
    cache: () => cache,
    now: () => start,
    read: async (id) => {
      calls++;
      return {
        data: id === "404" ? null : record(id),
        fetchedAt: new Date(start).toISOString(),
      };
    },
  });
  const first = await read("123");
  const second = await read("123");
  assert.equal(calls, 1);
  assert.equal(second.cache.status, "hit");
  assert.equal(first.data?.amountCents, 0);
  assert.equal(first.data?.paidAmountCents, null);
  await read("404");
  await read("404");
  assert.equal(calls, 3);
  assert.equal(cache.entries.has(contractCacheKey("404")), false);
  const wrong = createCachedContractReader({
    cache: () => cache,
    now: () => start,
    read: async () => ({
      data: record("321"),
      fetchedAt: new Date(start).toISOString(),
    }),
  });
  await assert.rejects(() => wrong("124"), ContractsDataError);
  assert.equal(cache.entries.has(contractCacheKey("124")), false);
});

test("requisições concorrentes da mesma página compartilham somente a consulta em andamento", async () => {
  const cache = new MemoryCache();
  let calls = 0;
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const read = createCachedContractsReader({
    cache: () => cache,
    now: () => start,
    read: async () => {
      calls++;
      await wait;
      return { data: page(), fetchedAt: new Date(start).toISOString() };
    },
  });
  const first = read(query);
  const second = read(query);
  await setImmediate();
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, await second);
  assert.equal((await read(query)).cache.status, "hit");
  assert.equal(cache.gets, 2);
});
