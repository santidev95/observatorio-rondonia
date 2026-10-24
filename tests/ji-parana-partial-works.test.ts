import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchJiParanaWorks,
  normalizeJiParanaWork,
} from "../src/connectors/ji-parana/works";
import {
  fetchAriquemesWorks,
  normalizeAriquemesWork,
} from "../src/connectors/ariquemes/works";
import { readSource } from "../src/core/contracts-reader";
import { ContractsDataError } from "../src/core/contracts-query";
import type { ContractsCacheStore } from "../src/core/contracts-cache";
import { createCachedWorksReader } from "../src/core/municipal-cache";
import { worksCatalogSchema, type WorksCatalog } from "../src/core/works";
import {
  jiParanaWorkRow as row,
  jiParanaWorksPage as envelope,
} from "./fixtures/ji-parana-works";
import { ariquemesWorkRow } from "./fixtures/ariquemes-works";

const signal = () => new AbortController().signal;
const sourceUrl = "https://transparencia.ji-parana.ro.gov.br/api/obras/2026/2";
const cacheKey = "observatorio:RO:ji-parana:obras:v1:year:2026:catalog";
const now = Date.parse("2026-10-23T12:00:00Z");
const fetchedAt = new Date(now).toISOString();
const fixture =
  (body: unknown): typeof fetch =>
  async () =>
    Response.json(body);

function completeCatalog(): WorksCatalog {
  return {
    records: [normalizeJiParanaWork(row(1), 2026)],
    total: 1,
    complete: true,
    sourceUrl,
    warnings: [],
  };
}

function partialCatalog(): WorksCatalog {
  return worksCatalogSchema.parse({
    ...completeCatalog(),
    complete: false,
    coverage: {
      reportedRows: 2,
      receivedRows: 1,
      repeatedRows: 0,
      assumedMissingRows: 1,
    },
  });
}

class MemoryCache implements ContractsCacheStore {
  entries = new Map<string, unknown>();
  writes = 0;
  async get(key: string) {
    return structuredClone(this.entries.get(key) ?? null);
  }
  async set(key: string, value: unknown, ttl: number) {
    assert.equal(ttl, 3600);
    this.writes++;
    this.entries.set(key, structuredClone(value));
  }
}

test("Ji Obras parcial: 112 linhas, 83 obras e falta presumida de uma linha ficam separados", async () => {
  const secret = "fornecedor-sintetico-nao-republicar";
  const rows = [
    ...Array.from({ length: 83 }, (_, index) => row(index + 1)),
    ...Array.from({ length: 29 }, (_, index) =>
      row(2, { NOMEFOR: `${secret}-${index}` }),
    ),
  ];
  const catalog = await fetchJiParanaWorks(
    signal(),
    2026,
    fixture(envelope(rows, 1, 113, 200)),
  );
  assert.equal(catalog.complete, false);
  assert.equal(catalog.total, 83);
  assert.equal(catalog.records.length, 83);
  assert.equal(new Set(catalog.records.map((work) => work.id)).size, 83);
  assert.deepEqual(catalog.coverage, {
    reportedRows: 113,
    receivedRows: 112,
    repeatedRows: 29,
    assumedMissingRows: 1,
  });
  assert.deepEqual(
    catalog.records.map((work) => work.sourceId),
    Array.from({ length: 83 }, (_, index) => index + 1),
  );
  assert.equal(catalog.records[1].declaredValueCents, 123456);
  assert.equal(catalog.records[1].paidCents, null);
  assert.ok(catalog.warnings.length > 0);
  assert.ok(!JSON.stringify(catalog).includes(secret));
  assert.ok(
    !catalog.warnings.some((warning) => /^Catálogo completo/.test(warning)),
  );
});

test("Ji Obras parcial: última página curta em uma linha exige a leitura de todas as páginas", async () => {
  const pages: number[] = [];
  const catalog = await fetchJiParanaWorks(signal(), 2026, async (input) => {
    const page = Number(new URL(String(input)).searchParams.get("page"));
    pages.push(page);
    return Response.json(
      envelope(
        Array.from({ length: page < 3 ? 2 : 1 }, (_, index) =>
          row((page - 1) * 2 + index + 1),
        ),
        page,
        6,
        2,
      ),
    );
  });
  assert.deepEqual(pages, [1, 2, 3]);
  assert.equal(catalog.complete, false);
  assert.equal(catalog.total, 5);
  assert.deepEqual(catalog.coverage, {
    reportedRows: 6,
    receivedRows: 5,
    repeatedRows: 0,
    assumedMissingRows: 1,
  });
});

test("Ji Obras parcial: última página vazia com uma linha esperada preserva as anteriores", async () => {
  let calls = 0;
  const catalog = await fetchJiParanaWorks(signal(), 2026, async () =>
    Response.json(
      ++calls === 1
        ? envelope([row(1), row(2)], 1, 3, 2)
        : envelope([], 2, 3, 2),
    ),
  );
  assert.equal(calls, 2);
  assert.equal(catalog.complete, false);
  assert.equal(catalog.total, 2);
  assert.deepEqual(catalog.coverage, {
    reportedRows: 3,
    receivedRows: 2,
    repeatedRows: 0,
    assumedMissingRows: 1,
  });
});

test("Ji Obras parcial: não aceita duas linhas faltantes nem resposta com linhas excedentes", async () => {
  for (const body of [
    envelope([row(1)], 1, 3, 10),
    envelope([], 1, 2, 10),
    envelope([row(1), row(2), row(3)], 1, 2, 10),
  ])
    await assert.rejects(() =>
      fetchJiParanaWorks(signal(), 2026, fixture(body)),
    );
});

test("Ji Obras parcial: uma linha faltante em página intermediária continua bloqueada", async () => {
  let calls = 0;
  await assert.rejects(() =>
    fetchJiParanaWorks(signal(), 2026, async (input) => {
      calls++;
      const page = Number(new URL(String(input)).searchParams.get("page"));
      return Response.json(
        envelope(
          page === 2
            ? [row(3)]
            : [row((page - 1) * 2 + 1), row((page - 1) * 2 + 2)],
          page,
          6,
          2,
        ),
      );
    }),
  );
  assert.equal(calls, 2);
});

test("Ji Obras parcial: variação de total, tamanho ou intervalo da página não é tolerada", async () => {
  const last = envelope([row(3)], 2, 4, 2);
  for (const second of [
    { ...last, total: 5, last_page: 3 },
    envelope([row(3)], 2, 4, 3),
    { ...last, current_page: 1 },
    { ...last, last_page: 3 },
    { ...last, from: 2 },
    { ...last, to: 4 },
    { ...last, per_page: "2" },
  ]) {
    let calls = 0;
    await assert.rejects(() =>
      fetchJiParanaWorks(signal(), 2026, async () =>
        Response.json(
          ++calls === 1 ? envelope([row(1), row(2)], 1, 4, 2) : second,
        ),
      ),
    );
  }
});

test("Ji Obras parcial: IDs repetidos só são colapsados quando todos os campos públicos coincidem", async () => {
  for (const change of [
    { DESCRICAO: "Outra obra sintética" },
    { VALOR: "2.345,67" },
    { PERCENTUALEXECUTADO: "0" },
    { SITUACAO: "Paralisada" },
    { LOCALIZACAO: "Outro local sintético" },
    { DATAINI: "02/02/2026" },
    { NOMEFOR: null },
  ])
    await assert.rejects(() =>
      fetchJiParanaWorks(
        signal(),
        2026,
        fixture(envelope([row(1), row(1, change)], 1, 3, 200)),
      ),
    );

  const equivalent = await fetchJiParanaWorks(
    signal(),
    2026,
    fixture(
      envelope(
        [row(1), row(1, { VALOR: "1234.56", NOMEFOR: "Outro nome privado" })],
        1,
        3,
        200,
      ),
    ),
  );
  assert.equal(equivalent.total, 1);
  assert.ok(equivalent.coverage && "repeatedRows" in equivalent.coverage);
  assert.equal(equivalent.coverage.repeatedRows, 1);
});

test("Ji Obras: carga completa continua sem cobertura parcial e rejeita IDs repetidos", async () => {
  const complete = await fetchJiParanaWorks(
    signal(),
    2026,
    fixture(envelope([row(1), row(2)], 1, 2, 200)),
  );
  assert.equal(complete.complete, true);
  assert.equal(complete.total, 2);
  assert.equal("coverage" in complete, false);
  await assert.rejects(() =>
    fetchJiParanaWorks(
      signal(),
      2026,
      fixture(envelope([row(1), row(1)], 1, 2, 200)),
    ),
  );
});

test("Ji Obras parcial: falhas HTTP, cancelamento e dados inválidos continuam erros", async () => {
  for (const response of [
    async () => new Response("erro privado", { status: 503 }),
    async () =>
      new Response("JSON inválido", {
        headers: { "content-type": "application/json" },
      }),
    fixture({ ...envelope([row(1)], 1, 2, 200), data: "inválido" }),
    fixture(envelope([row(1, { EMPRESA: 1 })], 1, 2, 200)),
    fixture(envelope([row(1, { EXERCICIO: 2025 })], 1, 2, 200)),
    fixture(envelope([row(1, { VALOR: "1.234,567" })], 1, 2, 200)),
  ])
    await assert.rejects(() => fetchJiParanaWorks(signal(), 2026, response));

  const cancelled = new AbortController();
  let calls = 0;
  await assert.rejects(() =>
    fetchJiParanaWorks(cancelled.signal, 2026, async () => {
      calls++;
      cancelled.abort();
      return Response.json(envelope([row(1)], 1, 2, 200));
    }),
  );
  assert.equal(calls, 1);
});

test("Ji Obras parcial: timeout durante a última página não retorna os registros anteriores", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      readSource(
        (abort) =>
          fetchJiParanaWorks(abort, 2026, async (_input, init) => {
            calls++;
            if (calls === 1)
              return Response.json(envelope([row(1), row(2)], 1, 3, 2));
            return new Promise<Response>((_resolve, reject) => {
              const cancel = () =>
                reject(new Error("timeout sintético privado"));
              init?.signal?.addEventListener("abort", cancel, { once: true });
              if (init?.signal?.aborted) cancel();
            });
          }),
        { timeoutMs: 20 },
      ),
    ContractsDataError,
  );
  assert.equal(calls, 2);
});

test("Obras parcial: Ariquemes declara inconsistência sem assumir o registro ausente de Ji", async () => {
  const catalog = await fetchAriquemesWorks(
    signal(),
    2026,
    fixture(envelope([ariquemesWorkRow(1)], 1, 2, 200)),
  );
  assert.equal(catalog.complete, false);
  assert.deepEqual(catalog.coverage, {
    reportedRows: 2,
    receivedRows: 1,
    repeatedRows: 0,
    rowDifference: 1,
  });
  assert.equal("assumedMissingRows" in catalog.coverage!, false);
});

test("schema Obras: cobertura parcial exige aritmética íntegra, falta unitária e identidade Ji", () => {
  const partial = partialCatalog();
  assert.equal(worksCatalogSchema.safeParse(completeCatalog()).success, true);
  assert.equal(worksCatalogSchema.safeParse(partial).success, true);
  const { coverage: _coverage, ...withoutCoverage } = partial;
  assert.equal(worksCatalogSchema.safeParse(withoutCoverage).success, false);
  for (const coverage of [
    { ...partial.coverage, reportedRows: 3 },
    { ...partial.coverage, receivedRows: 2 },
    { ...partial.coverage, repeatedRows: 1 },
    { ...partial.coverage, repeatedRows: -1 },
    { ...partial.coverage, assumedMissingRows: 0 },
    { ...partial.coverage, assumedMissingRows: 2 },
    { ...partial.coverage, raw: "não permitido" },
  ])
    assert.equal(
      worksCatalogSchema.safeParse({ ...partial, coverage }).success,
      false,
    );
  assert.equal(
    worksCatalogSchema.safeParse({ ...partial, total: partial.total + 1 })
      .success,
    false,
  );
  assert.equal(
    worksCatalogSchema.safeParse({ ...partial, complete: true }).success,
    false,
  );
  for (const changed of [
    { sourceUrl: "https://transparencia.ariquemes.ro.gov.br/api/obras/2026/1" },
    {
      sourceUrl: "https://api.portovelho.ro.gov.br/api/v1/obras?por-pagina=100",
    },
    { sourceUrl: "https://transparencia.ji-parana.ro.gov.br/api/obras/2026/1" },
    { records: [normalizeAriquemesWork(ariquemesWorkRow(1), 2026)] },
    { records: [{ ...partial.records[0], id: "pvh-1" }] },
    { records: [{ ...partial.records[0], sourceYear: 2025 }] },
    {
      records: [
        { ...partial.records[0], sourceUrl: sourceUrl.replace("/2", "/1") },
      ],
    },
  ])
    assert.equal(
      worksCatalogSchema.safeParse({ ...partial, ...changed }).success,
      false,
    );
});

test("cache Obras: consulta parcial não é gravada nem reutilizada em outra chamada", async () => {
  const cache = new MemoryCache();
  let calls = 0;
  const read = createCachedWorksReader({
    cache: () => cache,
    now: () => now,
    cacheKey,
    sourceUrl,
    read: async () => {
      calls++;
      return { data: partialCatalog(), fetchedAt };
    },
  });
  const first = await read();
  const second = await read();
  assert.equal(first.data.complete, false);
  assert.equal(second.data.complete, false);
  assert.deepEqual(first.cache, { status: "miss", expiresAt: null });
  assert.deepEqual(second.cache, { status: "miss", expiresAt: null });
  assert.equal(calls, 2);
  assert.equal(cache.writes, 0);
  assert.equal(cache.entries.size, 0);
});

test("cache Obras: uma entrada parcial forjada não é servida como hit", async () => {
  const cache = new MemoryCache();
  cache.entries.set(cacheKey, {
    key: cacheKey,
    result: { data: partialCatalog(), fetchedAt },
    expiresAt: new Date(now + 3600_000).toISOString(),
  });
  let calls = 0;
  const read = createCachedWorksReader({
    cache: () => cache,
    now: () => now,
    cacheKey,
    sourceUrl,
    read: async () => {
      calls++;
      return { data: completeCatalog(), fetchedAt };
    },
  });
  const result = await read();
  assert.equal(calls, 1);
  assert.equal(result.cache.status, "miss");
  assert.equal(result.data.complete, true);
  assert.equal(cache.writes, 1);
});

test("cache Obras: carga parcial não substitui a última entrada completa após expiração", async () => {
  const cache = new MemoryCache();
  let clock = now;
  let calls = 0;
  const read = createCachedWorksReader({
    cache: () => cache,
    now: () => clock,
    cacheKey,
    sourceUrl,
    read: async () => {
      calls++;
      return {
        data: calls === 1 ? completeCatalog() : partialCatalog(),
        fetchedAt: new Date(clock).toISOString(),
      };
    },
  });
  assert.equal((await read()).data.complete, true);
  const validEntry = structuredClone(cache.entries.get(cacheKey));
  clock += 60_000;
  assert.equal((await read()).cache.status, "hit");
  assert.equal(calls, 1);
  clock = now + 3600_000;
  const result = await read();
  assert.equal(result.data.complete, false);
  assert.deepEqual(result.cache, { status: "miss", expiresAt: null });
  assert.equal(cache.writes, 1);
  assert.deepEqual(cache.entries.get(cacheKey), validEntry);
  assert.equal(calls, 2);
});
