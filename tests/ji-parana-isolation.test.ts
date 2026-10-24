import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contractCacheKey,
  contractsPageCacheKey,
  createCachedContractReader,
  createCachedContractsReader,
  type ContractsCacheStore,
} from "../src/core/contracts-cache";
import {
  createCachedWorksReader,
  WORKS_CACHE_KEY,
} from "../src/core/municipal-cache";
import {
  dataMunicipality,
  isMunicipalContractId,
  municipalContractsQuery,
  municipalYear,
} from "../src/core/municipal-sources";
import { redisMunicipalReservation } from "../src/core/municipal-rate-limit";
import type { RedisScriptStore } from "../src/core/redis-cache-store";
import type { ContractPage, ContractsQuery } from "../src/core/contracts";
import {
  fetchJiParanaContractsPage,
  jiParanaContractId,
} from "../src/connectors/ji-parana/contracts";
import { fetchPortoVelhoContractsPage } from "../src/connectors/porto-velho/contracts";
import { normalizeJiParanaWork } from "../src/connectors/ji-parana/works";
import { defaultFilters } from "../src/features/works/filters";
import {
  worksReturnUrl,
  worksUrl,
  workStorageKeys,
} from "../src/features/works/navigation";

const now = Date.parse("2026-10-23T16:00:00Z");
const fetchedAt = new Date(now).toISOString();
const query = { year: 2026, page: 1 };

class MemoryCache implements ContractsCacheStore {
  entries = new Map<string, unknown>();
  writes: string[] = [];
  async get(key: string) {
    return structuredClone(this.entries.get(key) ?? null);
  }
  async set(key: string, value: unknown, ttl: number) {
    assert.equal(ttl, 3600);
    this.writes.push(key);
    this.entries.set(key, structuredClone(value));
  }
}

async function jiPage(year = 2026): Promise<ContractPage> {
  return fetchJiParanaContractsPage(
    { year, page: 1 },
    new AbortController().signal,
    async () =>
      Response.json({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 1,
        from: 1,
        to: 1,
        data: [
          {
            CODIGO: "0001/26",
            EMPRESA: 2,
            EMPRESA_NOME: "Prefeitura sintética",
            CONTRATONUM: "Contrato sintético",
            ANO: year,
            OBJETO: "Objeto sintético",
            OBJETO_COMPLETO: null,
            VIGENI: null,
            VIGENF: null,
            ULTVIGENF: null,
            VALCON: "0,00",
            PROCLIC: null,
            NPROLI: null,
            NOMEFORNECEDOR: "Empresa sintética",
            INSMF: "11.222.333/0001-81",
            DTANULA: null,
          },
        ],
      }),
  );
}

async function pvhPage(input: ContractsQuery = query): Promise<ContractPage> {
  return fetchPortoVelhoContractsPage(
    input,
    new AbortController().signal,
    async () =>
      Response.json({
        data: [
          {
            id: 1,
            numero: "Contrato sintético",
            contrato_ano: input.year,
            modelo: "Contratos",
            valor: 0,
            valor_executado: null,
          },
        ],
        links: { next: null },
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 25,
          total: 1,
          from: 1,
          to: 1,
        },
      }),
  );
}

type PageEntry = {
  key: string;
  result: { data: ContractPage; fetchedAt: string };
  expiresAt: string;
};

test("cache: municípios e exercícios de Contratos têm chaves e cargas isoladas", async () => {
  const cache = new MemoryCache();
  let pvhCalls = 0;
  let jiCalls = 0;
  const pvh = createCachedContractsReader({
    cache: () => cache,
    now: () => now,
    read: async (input) => {
      pvhCalls++;
      return { data: await pvhPage(input), fetchedAt };
    },
  });
  const ji = createCachedContractsReader({
    municipality: "ji-parana",
    cache: () => cache,
    now: () => now,
    read: async (input) => {
      jiCalls++;
      return { data: await jiPage(input.year!), fetchedAt };
    },
  });
  assert.equal((await pvh(query)).cache.status, "miss");
  assert.equal((await ji(query)).cache.status, "miss");
  assert.equal((await ji({ ...query, year: 2025 })).cache.status, "miss");
  assert.equal((await pvh(query)).cache.status, "hit");
  assert.equal((await ji(query)).cache.status, "hit");
  assert.equal((await ji({ ...query, year: 2025 })).cache.status, "hit");
  assert.equal(pvhCalls, 1);
  assert.equal(jiCalls, 2);
  assert.equal(cache.entries.size, 3);
  assert.notEqual(
    contractsPageCacheKey(query),
    contractsPageCacheKey(query, "ji-parana"),
  );
  assert.notEqual(
    contractsPageCacheKey(query, "ji-parana"),
    contractsPageCacheKey({ ...query, year: 2025 }, "ji-parana"),
  );
  assert.notEqual(
    contractCacheKey("1"),
    contractCacheKey(jiParanaContractId(2026, "1"), "ji-parana"),
  );
});

test("cache Ji: rejeita entrada com ano, UG, caminho, código ou município divergente nos registros", async () => {
  const pvh = await pvhPage();
  for (const corrupt of [
    (page: ContractPage) => {
      page.sourceUrl = page.sourceUrl.replace("/2026/2", "/2025/2");
    },
    (page: ContractPage) => {
      page.sourceUrl = page.sourceUrl.replace("/2026/2", "/2026/1");
    },
    (page: ContractPage) => {
      page.records[0].sourceYear = 2025;
    },
    (page: ContractPage) => {
      page.records[0].sourceUrl = page.records[0].sourceUrl.replace(
        "/2026/2",
        "/2026/1",
      );
    },
    (page: ContractPage) => {
      page.records[0].sourceUrl =
        "https://transparencia.ji-parana.ro.gov.br/api/obras/2026/2";
    },
    (page: ContractPage) => {
      page.records[0].id = jiParanaContractId(2025, "0001/26");
    },
    (page: ContractPage) => {
      page.records[0].sourceId = "outro-codigo";
    },
    (page: ContractPage) => {
      page.records[0] = pvh.records[0];
    },
  ]) {
    const cache = new MemoryCache();
    let calls = 0;
    const read = createCachedContractsReader({
      municipality: "ji-parana",
      cache: () => cache,
      now: () => now,
      read: async () => {
        calls++;
        return { data: await jiPage(), fetchedAt };
      },
    });
    await read(query);
    const key = contractsPageCacheKey(query, "ji-parana");
    const entry = structuredClone(cache.entries.get(key)) as PageEntry;
    corrupt(entry.result.data);
    cache.entries.set(key, entry);
    assert.equal((await read(query)).cache.status, "miss", corrupt.toString());
    assert.equal(calls, 2);
  }
});

test("cache PVH: não aceita registro de Ji-Paraná numa página de Porto Velho", async () => {
  const cache = new MemoryCache();
  let calls = 0;
  const read = createCachedContractsReader({
    cache: () => cache,
    now: () => now,
    read: async () => {
      calls++;
      return { data: await pvhPage(), fetchedAt };
    },
  });
  await read(query);
  const key = contractsPageCacheKey(query);
  const entry = structuredClone(cache.entries.get(key)) as PageEntry;
  entry.result.data.records = (await jiPage()).records;
  cache.entries.set(key, entry);
  assert.equal((await read(query)).cache.status, "miss");
  assert.equal(calls, 2);
});

test("cache Ji: ano original pode divergir, mas exercício da consulta continua obrigatório", async () => {
  const cache = new MemoryCache();
  const page = await jiPage();
  page.records[0].year = 2025;
  page.warnings.push(
    "A fonte retornou contrato com ano diferente do exercício solicitado; ano original preservado.",
  );
  let calls = 0;
  const read = createCachedContractsReader({
    municipality: "ji-parana",
    cache: () => cache,
    now: () => now,
    read: async () => {
      calls++;
      return { data: page, fetchedAt };
    },
  });
  assert.equal((await read(query)).cache.status, "miss");
  const cached = await read(query);
  assert.equal(cached.cache.status, "hit");
  assert.equal(cached.data.records[0].year, 2025);
  assert.equal(cached.data.records[0].sourceYear, 2026);
  assert.equal(calls, 1);
  const detail = createCachedContractReader({
    municipality: "ji-parana",
    cache: () => cache,
    now: () => now,
    read: async () => ({ data: page.records[0], fetchedAt }),
  });
  assert.equal((await detail(page.records[0].id)).cache.status, "miss");
  const cachedDetail = await detail(page.records[0].id);
  assert.equal(cachedDetail.cache.status, "hit");
  assert.equal(cachedDetail.data?.year, 2025);
  assert.equal(cachedDetail.data?.sourceYear, 2026);
});

test("cache detalhe Ji: exige origem, UG, exercício e identidade exatos", async () => {
  const record = (await jiPage()).records[0];
  const id = record.id;
  for (const corrupt of [
    (row: typeof record) => {
      row.sourceUrl = "https://api.portovelho.ro.gov.br/api/v1/contratos/1";
    },
    (row: typeof record) => {
      row.sourceUrl = row.sourceUrl.replace("/2026/2", "/2026/1");
    },
    (row: typeof record) => {
      row.sourceUrl = row.sourceUrl.replace("/2026/2", "/2025/2");
    },
    (row: typeof record) => {
      row.sourceId = "outro-codigo";
    },
    (row: typeof record) => {
      row.sourceYear = 2025;
    },
  ]) {
    const cache = new MemoryCache();
    let calls = 0;
    const read = createCachedContractReader({
      municipality: "ji-parana",
      cache: () => cache,
      now: () => now,
      read: async () => {
        calls++;
        return { data: record, fetchedAt };
      },
    });
    await read(id);
    const key = contractCacheKey(id, "ji-parana");
    const entry = structuredClone(cache.entries.get(key)) as {
      result: { data: typeof record };
    };
    corrupt(entry.result.data);
    cache.entries.set(key, entry);
    assert.equal((await read(id)).cache.status, "miss", corrupt.toString());
    assert.equal(calls, 2);
  }
});

function workCatalog(year = 2026) {
  const work = normalizeJiParanaWork(
    {
      SEQUENCIAL: 1,
      EXERCICIO: year,
      EMPRESA: 2,
      EMPRESA_NOME: "Prefeitura sintética",
      DESCRICAO: "Obra sintética",
      VALOR: "0,00",
    },
    year,
  );
  return {
    records: [work],
    total: 1,
    complete: true as const,
    sourceUrl: work.sourceUrl,
    warnings: [],
  };
}

test("cache Obras: factory permite namespace municipal e exercício sem alterar PVH", async () => {
  const cache = new MemoryCache();
  const calls = new Map<number, number>();
  const readers = [2025, 2026].map((year) =>
    createCachedWorksReader({
      cache: () => cache,
      now: () => now,
      cacheKey: `observatorio:RO:ji-parana:obras:v1:year:${year}:catalog`,
      sourceUrl: `https://transparencia.ji-parana.ro.gov.br/api/obras/${year}/2`,
      read: async () => {
        calls.set(year, (calls.get(year) ?? 0) + 1);
        return { data: workCatalog(year), fetchedAt };
      },
    }),
  );
  for (const read of readers) {
    assert.equal((await read()).cache.status, "miss");
    assert.equal((await read()).cache.status, "hit");
  }
  assert.deepEqual([...calls.values()], [1, 1]);
  assert.equal(cache.entries.size, 2);
  assert.ok(!cache.entries.has(WORKS_CACHE_KEY));
});

test("cache Obras: rejeita registro de outra cidade ou exercício dentro do catálogo Ji", async () => {
  for (const corrupt of [
    (catalog: ReturnType<typeof workCatalog>) => {
      catalog.records[0].sourceYear = 2025;
    },
    (catalog: ReturnType<typeof workCatalog>) => {
      catalog.records[0].sourceUrl =
        "https://api.portovelho.ro.gov.br/api/v1/obras/1";
    },
    (catalog: ReturnType<typeof workCatalog>) => {
      catalog.records[0].id = "pvh-1";
    },
  ]) {
    const cache = new MemoryCache();
    let calls = 0;
    const key = "observatorio:RO:ji-parana:obras:v1:year:2026:catalog";
    const read = createCachedWorksReader({
      cache: () => cache,
      now: () => now,
      cacheKey: key,
      sourceUrl: workCatalog().sourceUrl,
      read: async () => {
        calls++;
        return { data: workCatalog(), fetchedAt };
      },
    });
    await read();
    const entry = structuredClone(cache.entries.get(key)) as {
      result: { data: ReturnType<typeof workCatalog> };
    };
    corrupt(entry.result.data);
    cache.entries.set(key, entry);
    assert.equal((await read()).cache.status, "miss", corrupt.toString());
    assert.equal(calls, 2);
  }
});

test("navegação: município e exercício permanecem no retorno sem open redirect", () => {
  const context = { municipality: "ji-parana" as const, year: 2025 };
  const path = worksUrl(
    { ...defaultFilters, q: "escola", status: "Em andamento" },
    3,
    context,
  );
  assert.ok(path.startsWith("/ji-parana/obras/?"));
  assert.equal(
    new URL(path, "https://example.invalid").searchParams.get("ano"),
    "2025",
  );
  assert.equal(
    worksReturnUrl("?from=" + encodeURIComponent(path), context),
    path,
  );
  const fallback = worksUrl(defaultFilters, 1, context);
  for (const from of [
    "https://externo.example.invalid",
    "//externo.example.invalid",
    "/porto-velho/obras/?ano=2025",
    "/ji-parana/obras/../receitas",
    "/ji-parana/obras/?q=x#frag",
  ])
    assert.equal(
      worksReturnUrl("?from=" + encodeURIComponent(from), context),
      fallback,
    );
  assert.notDeepEqual(
    workStorageKeys("porto-velho"),
    workStorageKeys("ji-parana"),
  );
  assert.ok(
    worksReturnUrl(
      "?from=" + encodeURIComponent("/ji-parana/obras/?ano=2026&q=posto"),
      context,
    ).includes("ano=2025"),
  );
});

test("municípios: ano municipal respeita fuso de RO e IDs são exclusivos por conector", () => {
  assert.equal(municipalYear(Date.parse("2027-01-01T02:00:00Z")), 2026);
  assert.equal(municipalYear(Date.parse("2027-01-01T04:00:00Z")), 2027);
  assert.equal(dataMunicipality("ji-parana")?.annual, true);
  assert.equal(dataMunicipality("porto-velho")?.annual, false);
  assert.equal(dataMunicipality("cacoal"), undefined);
  assert.equal(
    municipalContractsQuery({ page: 1, year: null }, "porto-velho").year,
    null,
  );
  assert.equal(
    municipalContractsQuery({ page: 1, year: null }, "ji-parana").year,
    municipalYear(),
  );
  assert.deepEqual(
    municipalContractsQuery({ page: 2, year: 2025 }, "ji-parana"),
    { page: 2, year: 2025 },
  );
  assert.equal(isMunicipalContractId("1", "porto-velho"), true);
  assert.equal(isMunicipalContractId("1", "ji-parana"), false);
  const id = jiParanaContractId(2026, "0001/26");
  assert.equal(isMunicipalContractId(id, "ji-parana"), true);
  assert.equal(isMunicipalContractId(id, "porto-velho"), false);
  for (const invalid of [
    "../1",
    "https://externo.example.invalid",
    "2026-!!",
    "0",
  ])
    for (const city of ["porto-velho", "ji-parana"] as const)
      assert.equal(isMunicipalContractId(invalid, city), false);
});

test("rate limit: site e worker compartilham somente o namespace da própria prefeitura", async () => {
  const keys: string[] = [];
  const store: RedisScriptStore = {
    async get() {
      return null;
    },
    async set() {},
    close() {},
    async eval(_script, requested) {
      keys.push(...requested);
      return 0;
    },
  };
  await redisMunicipalReservation(store, true)();
  await redisMunicipalReservation(store, false, "ji-parana")();
  await redisMunicipalReservation(store, true, "ji-parana")();
  assert.deepEqual(keys, [
    "observatorio:RO:porto-velho:source:v1:pace",
    "observatorio:RO:ji-parana:source:v1:pace",
    "observatorio:RO:ji-parana:source:v1:pace",
  ]);
  assert.throws(() => redisMunicipalReservation(store, true, "../porto-velho"));
});
