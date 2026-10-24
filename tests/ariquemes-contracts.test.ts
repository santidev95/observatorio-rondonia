import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ariquemesContractId,
  fetchAriquemesContract,
  fetchAriquemesContractsPage,
  parseAriquemesContractId,
} from "../src/connectors/ariquemes/contracts";
import {
  fetchJiParanaContractsPage,
  jiParanaContractId,
} from "../src/connectors/ji-parana/contracts";
import { publicaTransport } from "../src/connectors/publica/transport";
import {
  contractCacheKey,
  contractsPageCacheKey,
  createCachedContractsReader,
  type ContractsCacheStore,
} from "../src/core/contracts-cache";
import type { ContractPage } from "../src/core/contracts";

const origin = "https://transparencia.ariquemes.ro.gov.br";
const signal = () => new AbortController().signal;
function row(index: number, overrides: Record<string, unknown> = {}) {
  return {
    CODIGO: `${String(index).padStart(4, "0")}/26`,
    EMPRESA: 1,
    EMPRESA_NOME: "Prefeitura sintética de Ariquemes",
    CONTRATONUM: `Contrato sintético ${index}`,
    ANO: 2026,
    OBJETO: "Objeto sintético",
    OBJETO_COMPLETO: null,
    VIGENI: "01/10/2026",
    VIGENF: "01/10/2027",
    ULTVIGENF: null,
    VALCON: "1.000,10",
    PROCLIC: null,
    NPROLI: "Processo sintético",
    NOMEFORNECEDOR: "Fornecedor sintético",
    INSMF: "11.222.333/0001-81",
    DTANULA: null,
    ...overrides,
  };
}
function fixture(
  rows: unknown[],
  requested: string[] = [],
  expectedOrigin = origin,
  company = 1,
  honorPerPage = false,
): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input));
    requested.push(url.href);
    assert.equal(url.origin, expectedOrigin);
    assert.equal(url.pathname, `/api/contratos/2026/${company}`);
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    const page = Number(url.searchParams.get("page") ?? "1");
    const perPage = honorPerPage
      ? Number(url.searchParams.get("perPage") ?? "10")
      : 10;
    const records = rows.slice((page - 1) * perPage, page * perPage);
    return Response.json({
      current_page: page,
      last_page: Math.max(1, Math.ceil(rows.length / perPage)),
      per_page: perPage,
      total: rows.length,
      from: records.length ? (page - 1) * perPage + 1 : null,
      to: records.length ? (page - 1) * perPage + records.length : null,
      data: records,
      next_page_url:
        "https://transparencia.ji-parana.ro.gov.br/api/contratos/2026/2?page=2",
    });
  };
}

test("Ariquemes: factory usa origem própria e UG 1 em ambas as janelas de 25", async () => {
  const rows = Array.from({ length: 51 }, (_, index) => row(index + 1));
  for (const page of [1, 2]) {
    const requested: string[] = [];
    const result = await fetchAriquemesContractsPage(
      { page, year: 2026 },
      signal(),
      fixture(rows, requested),
    );
    assert.equal(result.records.length, 25);
    assert.deepEqual(result.pagination, {
      currentPage: page,
      lastPage: 3,
      perPage: 25,
      total: 51,
    });
    assert.equal(result.records[0].sourceId, row((page - 1) * 25 + 1).CODIGO);
    assert.equal(result.records.at(-1)?.sourceId, row(page * 25).CODIGO);
    assert.ok(
      result.records.every(
        (record) => record.sourceUrl === `${origin}/api/contratos/2026/1`,
      ),
    );
    assert.ok(
      result.warnings.some((warning) => warning.includes("Ariquemes (UG 1)")),
    );
    assert.ok(!JSON.stringify(result).includes("ji-parana"));
    assert.deepEqual(
      requested.map((url) => Number(new URL(url).searchParams.get("page"))),
      page === 1 ? [1, 2, 3] : [1, 3, 4, 5],
    );
  }
});

test("Ariquemes: rejeita Câmara UG 2, inclusive quando pertence à Prefeitura em Ji-Paraná", async () => {
  await assert.rejects(
    fetchAriquemesContractsPage(
      { page: 1, year: 2026 },
      signal(),
      fixture([row(1, { EMPRESA: 2 })]),
    ),
  );
  await assert.rejects(
    fetchJiParanaContractsPage(
      { page: 1, year: 2026 },
      signal(),
      fixture([row(1)], [], "https://transparencia.ji-parana.ro.gov.br", 2),
    ),
  );
});

test("Ariquemes: preserva ano original divergente, centavos, zero e null", async () => {
  const result = await fetchAriquemesContractsPage(
    { page: 1, year: 2026 },
    signal(),
    fixture([
      row(1, { ANO: 2025, CODIGO: "0001/25" }),
      row(2, { VALCON: "0" }),
      row(3, { VALCON: null }),
    ]),
  );
  assert.equal(result.records[0].year, 2025);
  assert.equal(result.records[0].sourceYear, 2026);
  assert.equal(result.records[0].id, ariquemesContractId(2026, "0001/25"));
  assert.deepEqual(
    result.records.map((record) => record.amountCents),
    [100010, 0, null],
  );
  assert.ok(
    result.warnings.some((warning) => warning.includes("ano diferente")),
  );
  for (const record of result.records) {
    assert.equal(record.paidAmountCents, null);
    assert.equal(record.executedAmountCents, null);
    assert.equal(record.signedOn, null);
    assert.equal(record.status, null);
    assert.deepEqual(record.documents, []);
  }
});

test("Ariquemes: IDs reversíveis preservam contexto e detalhe não reutiliza host de Ji-Paraná", async () => {
  const id = ariquemesContractId(2026, "0001/26");
  assert.deepEqual(parseAriquemesContractId(id), {
    year: 2026,
    sourceId: "0001/26",
  });
  // O código da API não contém município; namespace e rota garantem o isolamento.
  assert.equal(id, jiParanaContractId(2026, "0001/26"));
  assert.notEqual(
    contractCacheKey(id, "ariquemes"),
    contractCacheKey(id, "ji-parana"),
  );
  const detail = await fetchAriquemesContract(id, signal(), fixture([row(1)]));
  assert.equal(detail?.sourceUrl, `${origin}/api/contratos/2026/1`);
  assert.equal(detail?.contractorCnpj, "11222333000181");
  assert.equal(
    await fetchAriquemesContract(
      ariquemesContractId(2026, "9999/26"),
      signal(),
      fixture([row(1)]),
    ),
    null,
  );
});

test("Ariquemes: fornecedor pessoa física e CPF no objeto são minimizados", async () => {
  const result = await fetchAriquemesContractsPage(
    { page: 1, year: 2026 },
    signal(),
    fixture([
      row(1, {
        INSMF: "123.456.789-01",
        NOMEFORNECEDOR: "Pessoa sintética identificada",
        OBJETO: "Documento 12345678901",
      }),
    ]),
  );
  const record = result.records[0];
  assert.equal(record.contractorCnpj, null);
  assert.equal(record.contractorName, "Pessoa física (nome não republicado)");
  assert.equal(record.object, "Documento [CPF não republicado]");
  assert.ok(!JSON.stringify(record).includes("Pessoa sintética identificada"));
});

test("Pública: detalhe sugere perPage 100, aceita fallback 10 e exige todas as páginas", async () => {
  const id = ariquemesContractId(2026, row(1).CODIGO);
  for (const honorPerPage of [true, false]) {
    const requested: string[] = [];
    const count = honorPerPage ? 101 : 11;
    const rows = Array.from({ length: count }, (_, index) => row(index + 1));
    const fetcher = fixture(rows, requested, origin, 1, honorPerPage);
    const result = await fetchAriquemesContract(id, signal(), fetcher);
    assert.equal(result?.id, id);
    assert.equal(result?.sourceUrl, `${origin}/api/contratos/2026/1`);
    assert.equal(requested.length, 2);
    assert.ok(
      requested.every(
        (url) => new URL(url).searchParams.get("perPage") === "100",
      ),
    );
    const broken: typeof fetch = async (input, init) => {
      const response = await fetcher(input, init);
      const body = await response.json();
      if (new URL(String(input)).searchParams.get("page") === "2")
        body.data = [];
      return Response.json(body);
    };
    // Encontrar o registro na página 1 não permite ignorar uma página 2 incompleta.
    await assert.rejects(fetchAriquemesContract(id, signal(), broken));
  }
});

class MemoryCache implements ContractsCacheStore {
  entries = new Map<string, unknown>();
  async get(key: string) {
    return structuredClone(this.entries.get(key) ?? null);
  }
  async set(key: string, value: unknown) {
    this.entries.set(key, structuredClone(value));
  }
}
test("Ariquemes: cache recusa página de outra prefeitura e mantém dados separados", async () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  const fetchedAt = new Date(now).toISOString();
  const cache = new MemoryCache();
  let calls = 0;
  const read = createCachedContractsReader({
    municipality: "ariquemes",
    cache: () => cache,
    now: () => now,
    read: async () => {
      calls++;
      return {
        data: await fetchAriquemesContractsPage(
          { page: 1, year: 2026 },
          signal(),
          fixture([row(1)]),
        ),
        fetchedAt,
      };
    },
  });
  const query = { page: 1, year: 2026 };
  await read(query);
  assert.equal((await read(query)).cache.status, "hit");
  const key = contractsPageCacheKey(query, "ariquemes");
  const entry = structuredClone(cache.entries.get(key)) as {
    result: { data: ContractPage };
  };
  entry.result.data = await fetchJiParanaContractsPage(
    query,
    signal(),
    fixture(
      [row(1, { EMPRESA: 2 })],
      [],
      "https://transparencia.ji-parana.ro.gov.br",
      2,
    ),
  );
  cache.entries.set(key, entry);
  assert.equal((await read(query)).cache.status, "miss");
  assert.equal(calls, 2);
  assert.notEqual(key, contractsPageCacheKey(query, "ji-parana"));
});

test("Pública: transportes rejeitam origem cruzada sem consultar fetcher", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return Response.json({});
  };
  await assert.rejects(
    publicaTransport("ariquemes").fetchJson(
      "https://transparencia.ji-parana.ro.gov.br/api/contratos/2026/2",
      signal(),
      fetcher,
    ),
  );
  await assert.rejects(
    publicaTransport("ji-parana").fetchJson(
      `${origin}/api/contratos/2026/1`,
      signal(),
      fetcher,
    ),
  );
  assert.equal(calls, 0);
});
