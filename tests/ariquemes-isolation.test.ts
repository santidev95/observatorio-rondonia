import assert from "node:assert/strict";
import { test } from "node:test";
import { createPublicaContracts } from "../src/connectors/publica/contracts";
import { createPublicaWorks } from "../src/connectors/publica/works";
import {
  contractsPageCacheKey,
  contractCacheKey,
  createCachedContractsReader,
  createCachedContractReader,
  type ContractsCacheStore,
} from "../src/core/contracts-cache";
import { createCachedWorksReader } from "../src/core/municipal-cache";
import {
  publicaSource,
  type PublicaMunicipality,
} from "../src/core/municipal-sources";
import { contractsReturnUrl } from "../src/features/contracts/navigation";
import { defaultFilters } from "../src/features/works/filters";
import { worksReturnUrl, worksUrl } from "../src/features/works/navigation";
import type { ContractPage, ContractRecord } from "../src/core/contracts";
import type { WorksCatalog } from "../src/core/works";

const now = Date.parse("2026-10-23T16:00:00Z");
const fetchedAt = new Date(now).toISOString();
const query = { page: 1, year: 2026 };
class MemoryCache implements ContractsCacheStore {
  entries = new Map<string, unknown>();
  async get(key: string) {
    return structuredClone(this.entries.get(key) ?? null);
  }
  async set(key: string, value: unknown, ttl: number) {
    assert.equal(ttl, 3600);
    this.entries.set(key, structuredClone(value));
  }
}

async function page(municipality: PublicaMunicipality) {
  const source = publicaSource(municipality);
  return createPublicaContracts(municipality).fetchPage(
    query,
    new AbortController().signal,
    async (input) => {
      assert.equal(
        new URL(String(input)).pathname,
        `/api/contratos/2026/${source.company}`,
      );
      return Response.json({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 1,
        from: 1,
        to: 1,
        data: [
          {
            CODIGO: "0001/26",
            EMPRESA: source.company,
            EMPRESA_NOME: `Prefeitura sintética ${source.name}`,
            CONTRATONUM: "Contrato sintético",
            ANO: 2026,
            OBJETO: "Objeto sintético",
            OBJETO_COMPLETO: null,
            VIGENI: null,
            VIGENF: null,
            ULTVIGENF: null,
            VALCON: "0,00",
            PROCLIC: null,
            NPROLI: null,
            NOMEFORNECEDOR: null,
            INSMF: null,
            DTANULA: null,
          },
        ],
      });
    },
  );
}
function works(municipality: PublicaMunicipality): WorksCatalog {
  const source = publicaSource(municipality);
  const record = createPublicaWorks(municipality).normalizeWork(
    {
      SEQUENCIAL: 1,
      EXERCICIO: 2026,
      EMPRESA: source.company,
      EMPRESA_NOME: `Prefeitura sintética ${source.name}`,
      DESCRICAO: `Obra sintética ${source.name}`,
      VALOR: "0,00",
    },
    2026,
  );
  return {
    records: [record],
    complete: true,
    total: 1,
    sourceUrl: record.sourceUrl,
    warnings: [],
  };
}

test("Ariquemes/Ji: mesmos código e exercício geram namespaces separados na página e no detalhe", async () => {
  const cache = new MemoryCache();
  const calls: string[] = [];
  const catalogs = {
    ariquemes: await page("ariquemes"),
    "ji-parana": await page("ji-parana"),
  };
  assert.equal(
    catalogs.ariquemes.records[0].id,
    catalogs["ji-parana"].records[0].id,
  );
  for (const municipality of ["ariquemes", "ji-parana"] as const) {
    const list = createCachedContractsReader({
      municipality,
      cache: () => cache,
      now: () => now,
      read: async () => {
        calls.push(`list:${municipality}`);
        return { data: catalogs[municipality], fetchedAt };
      },
    });
    const detail = createCachedContractReader({
      municipality,
      cache: () => cache,
      now: () => now,
      read: async () => {
        calls.push(`detail:${municipality}`);
        return { data: catalogs[municipality].records[0], fetchedAt };
      },
    });
    assert.equal((await list(query)).cache.status, "miss");
    assert.equal((await list(query)).cache.status, "hit");
    const id = catalogs[municipality].records[0].id;
    assert.equal((await detail(id)).cache.status, "miss");
    assert.equal((await detail(id)).cache.status, "hit");
  }
  assert.equal(cache.entries.size, 4);
  assert.equal(calls.length, 4);
  assert.notEqual(
    contractsPageCacheKey(query, "ariquemes"),
    contractsPageCacheKey(query, "ji-parana"),
  );
});

test("Ariquemes: página em cache rejeita payload Ji, UG da Câmara e exercício divergente", async () => {
  const ji = await page("ji-parana");
  for (const corrupt of [
    (data: ContractPage) => {
      data.records = ji.records;
    },
    (data: ContractPage) => {
      Object.assign(data, ji);
    },
    (data: ContractPage) => {
      data.sourceUrl = data.sourceUrl.replace("/2026/1", "/2026/2");
    },
    (data: ContractPage) => {
      data.records[0].sourceYear = 2025;
    },
    (data: ContractPage) => {
      data.records[0].sourceUrl = data.records[0].sourceUrl.replace(
        "/2026/1",
        "/2026/2",
      );
    },
  ]) {
    const cache = new MemoryCache();
    let calls = 0;
    const read = createCachedContractsReader({
      municipality: "ariquemes",
      cache: () => cache,
      now: () => now,
      read: async () => {
        calls++;
        return { data: await page("ariquemes"), fetchedAt };
      },
    });
    await read(query);
    const key = contractsPageCacheKey(query, "ariquemes");
    const entry = structuredClone(cache.entries.get(key)) as {
      result: { data: ContractPage };
    };
    corrupt(entry.result.data);
    cache.entries.set(key, entry);
    assert.equal((await read(query)).cache.status, "miss", corrupt.toString());
    assert.equal(calls, 2);
  }
});

test("Ariquemes: detalhe em cache rejeita mesmo ID de Ji-Paraná, Câmara, ano e código divergentes", async () => {
  const ariquemes = (await page("ariquemes")).records[0];
  const ji = (await page("ji-parana")).records[0];
  for (const corrupt of [
    (data: ContractRecord) => {
      Object.assign(data, ji);
    },
    (data: ContractRecord) => {
      data.sourceUrl = data.sourceUrl.replace("/2026/1", "/2026/2");
    },
    (data: ContractRecord) => {
      data.sourceYear = 2025;
    },
    (data: ContractRecord) => {
      data.sourceId = "outro-codigo";
    },
  ]) {
    const cache = new MemoryCache();
    let calls = 0;
    const read = createCachedContractReader({
      municipality: "ariquemes",
      cache: () => cache,
      now: () => now,
      read: async () => {
        calls++;
        return { data: ariquemes, fetchedAt };
      },
    });
    await read(ariquemes.id);
    const key = contractCacheKey(ariquemes.id, "ariquemes");
    const entry = structuredClone(cache.entries.get(key)) as {
      result: { data: ContractRecord };
    };
    corrupt(entry.result.data);
    cache.entries.set(key, entry);
    assert.equal(
      (await read(ariquemes.id)).cache.status,
      "miss",
      corrupt.toString(),
    );
    assert.equal(calls, 2);
  }
});

test("Ariquemes/Ji: cache de Obras isola os mesmos IDs oficiais e rejeita payload cruzado", async () => {
  const cache = new MemoryCache();
  const calls = new Map<string, number>();
  const readers = new Map<
    PublicaMunicipality,
    ReturnType<typeof createCachedWorksReader>
  >();
  for (const municipality of ["ariquemes", "ji-parana"] as const) {
    readers.set(
      municipality,
      createCachedWorksReader({
        cache: () => cache,
        now: () => now,
        cacheKey: `observatorio:RO:${municipality}:obras:v1:year:2026:catalog`,
        sourceUrl: works(municipality).sourceUrl,
        read: async () => {
          calls.set(municipality, (calls.get(municipality) ?? 0) + 1);
          return { data: works(municipality), fetchedAt };
        },
      }),
    );
    const read = readers.get(municipality)!;
    assert.equal((await read()).cache.status, "miss");
    assert.equal((await read()).cache.status, "hit");
  }
  assert.equal(cache.entries.size, 2);
  const key = "observatorio:RO:ariquemes:obras:v1:year:2026:catalog";
  const entry = structuredClone(cache.entries.get(key)) as {
    result: { data: WorksCatalog };
  };
  entry.result.data.records = works("ji-parana").records;
  cache.entries.set(key, entry);
  assert.equal((await readers.get("ariquemes")!()).cache.status, "miss");
  assert.equal(calls.get("ariquemes"), 2);
  assert.equal(calls.get("ji-parana"), 1);
});

test("Ariquemes: retorno de Contratos e Obras preserva exercício histórico e município", () => {
  const id = createPublicaContracts("ariquemes").contractId(2025, "0001/25");
  assert.equal(
    contractsReturnUrl({}, "ariquemes", id),
    "/ariquemes/contratos?ano=2025",
  );
  assert.equal(
    contractsReturnUrl({ page: "2" }, "ariquemes", id),
    "/ariquemes/contratos?page=2&ano=2025",
  );
  assert.equal(
    contractsReturnUrl(
      { from: "https://externo.example.invalid" },
      "ariquemes",
      id,
    ),
    "/ariquemes/contratos?ano=2025",
  );
  assert.equal(
    contractsReturnUrl({}, "porto-velho", "1"),
    "/porto-velho/contratos",
  );
  const context = { municipality: "ariquemes" as const, year: 2025 };
  const path = worksUrl({ ...defaultFilters, q: "escola" }, 3, context);
  assert.equal(
    worksReturnUrl("?from=" + encodeURIComponent(path), context),
    path,
  );
  assert.equal(
    worksReturnUrl(
      "?from=" + encodeURIComponent("/ji-parana/obras/?ano=2025"),
      context,
    ),
    "/ariquemes/obras/?ano=2025",
  );
});
