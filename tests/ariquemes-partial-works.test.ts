import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchAriquemesWorks,
  normalizeAriquemesWork,
} from "../src/connectors/ariquemes/works";
import { publicaTransport } from "../src/connectors/publica/transport";
import { readSource } from "../src/core/contracts-reader";
import { ContractsDataError } from "../src/core/contracts-query";
import type { ContractsCacheStore } from "../src/core/contracts-cache";
import { createCachedWorksReader } from "../src/core/municipal-cache";
import { worksCatalogSchema, type WorksCatalog } from "../src/core/works";
import { ariquemesWorkRow as row } from "./fixtures/ariquemes-works";
import { jiParanaWorksPage as envelope } from "./fixtures/ji-parana-works";

const signal = () => new AbortController().signal;
const sourceUrl = "https://transparencia.ariquemes.ro.gov.br/api/obras/2026/1";
const cacheKey = "observatorio:RO:ariquemes:obras:v1:year:2026:catalog";
const now = Date.parse("2026-10-24T16:00:00Z");
const fetchedAt = new Date(now).toISOString();
const fixture =
  (body: unknown): typeof fetch =>
  async () =>
    Response.json(body);

function completeCatalog(): WorksCatalog {
  return {
    records: [normalizeAriquemesWork(row(1), 2026)],
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
      reportedRows: 3,
      receivedRows: 1,
      repeatedRows: 0,
      rowDifference: 2,
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

test("Ari Obras inconsistente: lê as duas páginas e separa 176 recebidos de 212 declarados", async () => {
  const pages: number[] = [];
  const catalog = await fetchAriquemesWorks(signal(), 2026, async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://transparencia.ariquemes.ro.gov.br");
    assert.equal(url.pathname, "/api/obras/2026/1");
    assert.equal(url.searchParams.get("perPage"), "200");
    const page = Number(url.searchParams.get("page"));
    pages.push(page);
    return Response.json(
      envelope(
        page === 1
          ? Array.from({ length: 176 }, (_, index) => row(index + 1))
          : [],
        page,
        212,
        200,
      ),
    );
  });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(catalog.complete, false);
  assert.equal(catalog.total, 176);
  assert.equal(catalog.records.length, 176);
  assert.deepEqual(catalog.coverage, {
    reportedRows: 212,
    receivedRows: 176,
    repeatedRows: 0,
    rowDifference: 36,
  });
  assert.deepEqual(
    catalog.records.map((work) => work.id),
    Array.from({ length: 176 }, (_, index) => `ariquemes-2026-${index + 1}`),
  );
  assert.ok(catalog.warnings.some((warning) => /inconsisten/i.test(warning)));
  assert.ok(
    !catalog.warnings.some((warning) => /^Catálogo completo/.test(warning)),
  );
  assert.ok(!JSON.stringify(catalog).includes("Fornecedor sintético"));
});

test("Ari Obras inconsistente: contagens são dinâmicas e todas as páginas são consideradas", async () => {
  const pages: number[] = [];
  const catalog = await fetchAriquemesWorks(signal(), 2026, async (input) => {
    const page = Number(new URL(String(input)).searchParams.get("page"));
    pages.push(page);
    return Response.json(
      envelope(page === 1 ? [row(1)] : page === 2 ? [] : [row(7)], page, 8, 3),
    );
  });
  assert.deepEqual(pages, [1, 2, 3]);
  assert.equal(catalog.total, 2);
  assert.equal(catalog.complete, false);
  assert.deepEqual(catalog.coverage, {
    reportedRows: 8,
    receivedRows: 2,
    repeatedRows: 0,
    rowDifference: 6,
  });
});

test("Ari Obras inconsistente: metadados alterados ou linhas excedentes continuam bloqueados", async () => {
  const last = envelope([], 2, 4, 2);
  for (const second of [
    { ...last, total: 5, last_page: 3 },
    envelope([], 2, 4, 3),
    { ...last, current_page: 1 },
    { ...last, last_page: 3 },
    { ...last, from: 3 },
    { ...last, to: 4 },
    { ...last, per_page: "2" },
    envelope([row(3), row(4), row(5)], 2, 4, 2),
  ]) {
    let calls = 0;
    await assert.rejects(() =>
      fetchAriquemesWorks(signal(), 2026, async () =>
        Response.json(++calls === 1 ? envelope([row(1)], 1, 4, 2) : second),
      ),
    );
  }
  await assert.rejects(() =>
    fetchAriquemesWorks(
      signal(),
      2026,
      fixture(envelope([row(1), row(2), row(3)], 1, 2, 2)),
    ),
  );
});

test("Ari Obras inconsistente: 176 linhas equivalentes resultam em 38 obras sem inflar o total", async () => {
  const rows = Array.from({ length: 176 }, (_, index) =>
    row((index % 38) + 1, {
      NOMEFOR: `Fornecedor privado sintético ${index}`,
      VALOR: index % 2 ? "9876.54" : "9.876,54",
    }),
  );
  const pages: number[] = [];
  const catalog = await fetchAriquemesWorks(signal(), 2026, async (input) => {
    const page = Number(new URL(String(input)).searchParams.get("page"));
    pages.push(page);
    return Response.json(envelope(page === 1 ? rows : [], page, 212, 200));
  });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(catalog.complete, false);
  assert.equal(catalog.total, 38);
  assert.equal(catalog.records.length, 38);
  assert.deepEqual(catalog.coverage, {
    reportedRows: 212,
    receivedRows: 176,
    repeatedRows: 138,
    rowDifference: 36,
  });
  assert.deepEqual(
    catalog.records.map((work) => work.sourceId),
    Array.from({ length: 38 }, (_, index) => index + 1),
  );
  assert.equal(catalog.records[0].declaredValueCents, 987654);
  assert.equal(catalog.records[0].paidCents, null);
  assert.ok(!JSON.stringify(catalog).includes("Fornecedor privado sintético"));
});

test("Ari Obras inconsistente: IDs equivalentes entre páginas são agrupados após normalização", async () => {
  const catalog = await fetchAriquemesWorks(signal(), 2026, async (input) => {
    const page = Number(new URL(String(input)).searchParams.get("page"));
    return Response.json(
      envelope([row(1, { NOMEFOR: `Fornecedor privado ${page}` })], page, 4, 2),
    );
  });
  assert.equal(catalog.total, 1);
  assert.deepEqual(catalog.coverage, {
    reportedRows: 4,
    receivedRows: 2,
    repeatedRows: 1,
    rowDifference: 2,
  });
});

test("Ari Obras: duplicatas conflitantes, duplicatas em catálogo completo e registros inválidos bloqueiam", async () => {
  for (const change of [
    { VALOR: "1,00" },
    { DESCRICAO: "Outra descrição sintética" },
    { SITUACAO: "Paralisada" },
    { PERCENTUALEXECUTADO: "0" },
    { LOCALIZACAO: "Outro local sintético" },
    { DATAINI: "03/02/2026" },
    { NOMEFOR: null },
  ])
    await assert.rejects(() =>
      fetchAriquemesWorks(
        signal(),
        2026,
        fixture(envelope([row(1), row(1, change)], 1, 4, 200)),
      ),
    );
  await assert.rejects(() =>
    fetchAriquemesWorks(
      signal(),
      2026,
      fixture(envelope([row(1), row(1)], 1, 2, 200)),
    ),
  );
  for (const change of [
    { EMPRESA: 2 },
    { EXERCICIO: 2025 },
    { SEQUENCIAL: 0 },
    { DESCRICAO: null },
    { VALOR: "1.234,567" },
    { DATAINI: "31/02/2026" },
  ])
    await assert.rejects(() =>
      fetchAriquemesWorks(
        signal(),
        2026,
        fixture(envelope([row(1, change)], 1, 3, 200)),
      ),
    );
});

test("Ari Obras inconsistente: catálogo inteiramente vazio não oculta um total declarado positivo", async () => {
  let calls = 0;
  await assert.rejects(() =>
    fetchAriquemesWorks(signal(), 2026, async (input) => {
      calls++;
      const page = Number(new URL(String(input)).searchParams.get("page"));
      return Response.json(envelope([], page, 3, 2));
    }),
  );
  assert.equal(calls, 2);
});

test("Ari Obras inconsistente: falha ou cancelamento depois da primeira página não produz consulta parcial", async () => {
  for (const second of [
    async () => new Response("mensagem privada", { status: 503 }),
    async () =>
      new Response("inválido", {
        headers: { "content-type": "application/json" },
      }),
  ]) {
    let calls = 0;
    await assert.rejects(() =>
      fetchAriquemesWorks(signal(), 2026, async () =>
        ++calls === 1 ? Response.json(envelope([row(1)], 1, 3, 2)) : second(),
      ),
    );
    assert.equal(calls, 2);
  }
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(() =>
    fetchAriquemesWorks(controller.signal, 2026, async () => {
      calls++;
      if (calls === 1) return Response.json(envelope([row(1)], 1, 3, 2));
      controller.abort();
      return Response.json(envelope([], 2, 3, 2));
    }),
  );
  assert.equal(calls, 2);
});

test("Ari Obras inconsistente: timeout na página final não aproveita as linhas anteriores", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      readSource(
        (abort) =>
          fetchAriquemesWorks(abort, 2026, async (_input, init) => {
            if (++calls === 1)
              return Response.json(envelope([row(1)], 1, 3, 2));
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

test("Ari Obras inconsistente: tolerância não se estende a outros módulos ou à fonte de Ji", async () => {
  for (const [municipality, path] of [
    ["ariquemes", "/api/contratos/2026/1"],
    ["ariquemes", "/api/receitas/arrecadadas-diretamente/2026/1"],
    ["ariquemes", "/api/obras/2026/2"],
    ["ji-parana", "/api/obras/2026/2"],
  ] as const)
    await assert.rejects(() =>
      publicaTransport(municipality).collectPages(
        path,
        signal(),
        fixture(envelope([row(1)], 1, 3, 200)),
        { allowShortPages: true },
      ),
    );
});

test("schema Ari Obras: cobertura exige contagens coerentes e identidade municipal de todas as obras", () => {
  const partial = partialCatalog();
  assert.equal(worksCatalogSchema.safeParse(partial).success, true);
  for (const coverage of [
    undefined,
    { reportedRows: 3, receivedRows: 1, rowDifference: 2 },
    { reportedRows: 3, receivedRows: 1, repeatedRows: 1, rowDifference: 2 },
    { reportedRows: 3, receivedRows: 1, repeatedRows: -1, rowDifference: 2 },
    { reportedRows: 3, receivedRows: 2, repeatedRows: 0, rowDifference: 2 },
    { reportedRows: 2, receivedRows: 1, repeatedRows: 0, rowDifference: 2 },
    { reportedRows: 1, receivedRows: 1, repeatedRows: 0, rowDifference: 0 },
    { reportedRows: 3, receivedRows: 1, repeatedRows: 0, rowDifference: -2 },
    {
      reportedRows: 2001,
      receivedRows: 1,
      repeatedRows: 0,
      rowDifference: 2000,
    },
    {
      reportedRows: 3,
      receivedRows: 1,
      repeatedRows: 0,
      rowDifference: 2,
      raw: "privado",
    },
    {
      reportedRows: 2,
      receivedRows: 1,
      repeatedRows: 0,
      assumedMissingRows: 1,
    },
  ])
    assert.equal(
      worksCatalogSchema.safeParse({ ...partial, coverage }).success,
      false,
    );
  for (const change of [
    { complete: true },
    { total: 2 },
    { sourceUrl: sourceUrl.replace("/1", "/2") },
    { sourceUrl: sourceUrl.replace("2026", "2025") },
    { sourceUrl: "https://transparencia.ji-parana.ro.gov.br/api/obras/2026/2" },
    {
      sourceUrl: "https://api.portovelho.ro.gov.br/api/v1/obras?por-pagina=100",
    },
    { records: [{ ...partial.records[0], id: "ji-parana-2026-1" }] },
    { records: [{ ...partial.records[0], sourceYear: 2025 }] },
    {
      records: [
        { ...partial.records[0], sourceUrl: sourceUrl.replace("/1", "/2") },
      ],
    },
    {
      records: [],
      total: 0,
      coverage: {
        reportedRows: 2,
        receivedRows: 0,
        repeatedRows: 0,
        rowDifference: 2,
      },
    },
  ])
    assert.equal(
      worksCatalogSchema.safeParse({ ...partial, ...change }).success,
      false,
    );
});

test("cache Ari Obras: respostas inconsistentes não são gravadas nem reutilizadas", async () => {
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
  for (let index = 0; index < 2; index++) {
    const result = await read();
    assert.equal(result.data.complete, false);
    assert.deepEqual(result.cache, { status: "miss", expiresAt: null });
  }
  assert.equal(calls, 2);
  assert.equal(cache.writes, 0);
  assert.equal(cache.entries.size, 0);
});

test("cache Ari Obras: entrada parcial forjada é ignorada e carga válida permanece preservada", async () => {
  const cache = new MemoryCache();
  cache.entries.set(cacheKey, {
    key: cacheKey,
    result: { data: partialCatalog(), fetchedAt },
    expiresAt: new Date(now + 3600_000).toISOString(),
  });
  let clock = now;
  let calls = 0;
  const read = createCachedWorksReader({
    cache: () => cache,
    now: () => clock,
    cacheKey,
    sourceUrl,
    read: async () => ({
      data: ++calls === 1 ? completeCatalog() : partialCatalog(),
      fetchedAt: new Date(clock).toISOString(),
    }),
  });
  const complete = await read();
  assert.equal(complete.data.complete, true);
  assert.equal(complete.cache.status, "miss");
  assert.equal(calls, 1);
  assert.equal(cache.writes, 1);
  const valid = structuredClone(cache.entries.get(cacheKey));
  clock += 60_000;
  assert.equal((await read()).cache.status, "hit");
  clock = now + 3600_000;
  const partial = await read();
  assert.equal(partial.data.complete, false);
  assert.deepEqual(partial.cache, { status: "miss", expiresAt: null });
  assert.equal(calls, 2);
  assert.equal(cache.writes, 1);
  assert.deepEqual(cache.entries.get(cacheKey), valid);
});
