import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchJiParanaContract,
  fetchJiParanaContractsPage,
  jiParanaContractId,
  parseJiParanaContractId,
} from "../src/connectors/ji-parana/contracts";
import {
  JI_PARANA_ORIGIN,
  collectJiParanaPages,
  currentJiParanaYear,
  fetchJiParanaJson,
  jiDate,
  jiMoney,
  jiText,
} from "../src/connectors/ji-parana/transport";

const signal = () => new AbortController().signal;
function row(index: number, overrides: Record<string, unknown> = {}) {
  return {
    CODIGO: `${String(index).padStart(4, "0")}/26`,
    EMPRESA: 2,
    EMPRESA_NOME: "Prefeitura sintética",
    CONTRATONUM: `Contrato sintético ${index}/2026`,
    ANO: 2026,
    OBJETO: "Objeto resumido sintético",
    OBJETO_COMPLETO: "Objeto completo sintético",
    VIGENI: "01/10/2026",
    VIGENF: "01/10/2027",
    ULTVIGENF: "01/11/2027",
    VALCON: "1.234,56",
    PROCLIC: "000001/26",
    NPROLI: "   Processo sintético 1/2026",
    NOMEFORNECEDOR: "Fornecedor sintético",
    INSMF: "11.222.333/0001-81",
    DTANULA: null,
    ...overrides,
  };
}

function envelope(rows: unknown[], total: number, page: number, perPage = 10) {
  return {
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
    from: rows.length ? (page - 1) * perPage + 1 : null,
    to: rows.length ? (page - 1) * perPage + rows.length : null,
    data: rows,
    // São deliberadamente maliciosos: o conector constrói as próprias URLs.
    next_page_url: "https://externo.example.invalid/?cpf=12345678901",
  };
}

function fixture(
  allRows: unknown[],
  requested: string[] = [],
  mutate: (body: ReturnType<typeof envelope>) => unknown = (body) => body,
): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input));
    requested.push(url.href);
    assert.equal(url.origin, JI_PARANA_ORIGIN);
    assert.equal(url.pathname, "/api/contratos/2026/2");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.equal(
      init?.headers && new Headers(init.headers).get("Accept"),
      "application/json",
    );
    const page = Number(url.searchParams.get("page") ?? "1");
    return Response.json(
      mutate(
        envelope(
          allRows.slice((page - 1) * 10, page * 10),
          allRows.length,
          page,
        ),
      ),
    );
  };
}

test("Ji-Paraná: adapta páginas oficiais de 10 para janelas de 25 e mantém total", async () => {
  const rows = Array.from({ length: 57 }, (_, index) => row(index + 1));
  for (const [page, expectedIds, expectedRequests] of [
    [1, [1, 25], [1, 2, 3]],
    [2, [26, 50], [1, 3, 4, 5]],
    [3, [51, 57], [1, 6]],
  ] as const) {
    const requested: string[] = [];
    const result = await fetchJiParanaContractsPage(
      { year: 2026, page },
      signal(),
      fixture(rows, requested),
    );
    assert.equal(result.records[0].sourceId, row(expectedIds[0]).CODIGO);
    assert.equal(result.records.at(-1)?.sourceId, row(expectedIds[1]).CODIGO);
    assert.equal(result.records.length, page === 3 ? 7 : 25);
    assert.deepEqual(result.pagination, {
      currentPage: page,
      lastPage: 3,
      perPage: 25,
      total: 57,
    });
    assert.deepEqual(
      requested.map((url) => Number(new URL(url).searchParams.get("page"))),
      expectedRequests,
    );
    assert.ok(
      result.warnings.some((warning) => warning.includes("10 registros")),
    );
    assert.ok(!JSON.stringify(result).includes("externo.example"));
  }
});

test("Ji-Paraná: identificador preserva código e ano sem depender da posição na lista", async () => {
  const id = jiParanaContractId(2026, "0002/26");
  assert.deepEqual(parseJiParanaContractId(id), {
    year: 2026,
    sourceId: "0002/26",
  });
  assert.notEqual(id, jiParanaContractId(2025, "0002/26"));
  const rows = [row(3), row(2), row(1)];
  const result = await fetchJiParanaContract(id, signal(), fixture(rows));
  assert.equal(result?.sourceId, "0002/26");
  assert.equal(result?.number, "Contrato sintético 2/2026");
  assert.equal(
    await fetchJiParanaContract(
      jiParanaContractId(2026, "9999/26"),
      signal(),
      fixture(rows),
    ),
    null,
  );
  for (const invalid of ["1", "2026-Lw=", "2026-!", "1999-YQ", "2026-_w"])
    assert.equal(parseJiParanaContractId(invalid), null);
});

test("Ji-Paraná: detalhe rejeita coleta parcial, duplicatas e falhas sem produzir falso 404", async () => {
  const rows = Array.from({ length: 11 }, (_, index) => row(index + 1));
  const id = jiParanaContractId(2026, row(1).CODIGO);
  await assert.rejects(
    fetchJiParanaContract(
      id,
      signal(),
      fixture(rows, [], (body) =>
        body.current_page === 2 ? { ...body, total: 12 } : body,
      ),
    ),
  );
  await assert.rejects(
    fetchJiParanaContract(id, signal(), fixture([row(1), row(1)])),
  );
  await assert.rejects(
    fetchJiParanaContract(
      id,
      signal(),
      async () => new Response("Falha interna", { status: 500 }),
    ),
  );
});

test("Ji-Paraná: preserva centavos, zero e ausentes sem inferir pagamentos ou vigência", async () => {
  const result = await fetchJiParanaContractsPage(
    { page: 1, year: 2026 },
    signal(),
    fixture([
      row(1),
      row(2, { VALCON: "0", DTANULA: "02/10/2026" }),
      row(3, { VALCON: null, VIGENI: null, VIGENF: null, ULTVIGENF: null }),
    ]),
  );
  assert.deepEqual(
    result.records.map((record) => record.amountCents),
    [123456, 0, null],
  );
  assert.deepEqual(
    result.records.map((record) => record.status),
    [null, "Anulado", null],
  );
  assert.equal(result.records[0].object, "Objeto completo sintético");
  assert.equal(result.records[0].endsOn, "2027-11-01");
  assert.ok(
    result.records[0].issues.some((issue) => issue.includes("2027-10-01")),
  );
  for (const record of result.records) {
    assert.equal(record.paidAmountCents, null);
    assert.equal(record.executedAmountCents, null);
    assert.equal(record.sourceUpdatedAt, null);
    assert.equal(record.signedOn, null);
    assert.equal(record.procurement, null);
    assert.deepEqual(record.documents, []);
    assert.equal(record.sourceUrl, `${JI_PARANA_ORIGIN}/api/contratos/2026/2`);
  }
});

test("Ji-Paraná: minimiza CPF e não republica nome de fornecedor pessoa física", async () => {
  const result = await fetchJiParanaContractsPage(
    { page: 1, year: 2026 },
    signal(),
    fixture([
      row(1, {
        INSMF: "123.456.789-01",
        NOMEFORNECEDOR: "Nome pessoal sintético",
        OBJETO_COMPLETO: "Documento &#49;23.456.789-01",
      }),
      row(2, {
        INSMF: "***.456.789-**",
        NOMEFORNECEDOR: "Outro nome pessoal sintético",
      }),
      row(3, {
        INSMF: "CPF: parcialmente omitido",
        NOMEFORNECEDOR: "Terceiro nome pessoal sintético",
      }),
    ]),
  );
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("123.456.789-01"));
  assert.ok(!serialized.includes("nome pessoal"));
  for (const record of result.records) {
    assert.equal(record.contractorCnpj, null);
    assert.equal(record.contractorName, "Pessoa física (nome não republicado)");
  }
  assert.equal(result.records[0].object, "Documento [CPF não republicado]");
});

test("Ji-Paraná: rejeita Câmara, valor inválido, data impossível e página repetida", async () => {
  for (const overrides of [
    { EMPRESA: 1 },
    { VALCON: "1.001" },
    { VALCON: "-1,00" },
    { VIGENI: "31/02/2026" },
    { CODIGO: "12345678901" },
  ])
    await assert.rejects(
      fetchJiParanaContractsPage(
        { page: 1, year: 2026 },
        signal(),
        fixture([row(1, overrides)]),
      ),
    );
  await assert.rejects(
    fetchJiParanaContractsPage(
      { page: 1, year: 2026 },
      signal(),
      fixture([row(1), row(1)]),
    ),
  );
  const rows = Array.from({ length: 26 }, (_, index) => row(index + 1));
  await assert.rejects(
    fetchJiParanaContractsPage(
      { page: 1, year: 2026 },
      signal(),
      fixture(rows, [], (body) =>
        body.current_page === 2 ? { ...body, current_page: 1 } : body,
      ),
    ),
  );
});

test("Ji-Paraná: preserva ano do contrato diferente do exercício e mantém identidade da consulta", async () => {
  const result = await fetchJiParanaContractsPage(
    { page: 1, year: 2026 },
    signal(),
    fixture([row(1, { ANO: 2025, CODIGO: "0001/25" })]),
  );
  const record = result.records[0];
  assert.equal(record.year, 2025);
  assert.equal(record.sourceYear, 2026);
  assert.equal(record.id, jiParanaContractId(2026, "0001/25"));
  assert.equal(record.sourceId, "0001/25");
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("1 contrato(s) com ano diferente"),
    ),
  );
  const detail = await fetchJiParanaContract(
    record.id,
    signal(),
    fixture([row(1, { ANO: 2025, CODIGO: "0001/25" })]),
  );
  assert.equal(detail?.id, record.id);
  assert.equal(detail?.year, 2025);
});

test("Ji-Paraná: catálogo vazio válido e ano corrente explícito", async () => {
  const year = currentJiParanaYear();
  const result = await fetchJiParanaContractsPage(
    { page: 1, year: null },
    signal(),
    async (input) => {
      assert.equal(new URL(String(input)).pathname, `/api/contratos/${year}/2`);
      return Response.json(envelope([], 0, 1));
    },
  );
  assert.equal(result.pagination.total, 0);
  assert.deepEqual(result.records, []);
  assert.ok(result.warnings.some((warning) => warning.includes(String(year))));
  assert.equal(currentJiParanaYear(new Date("2027-01-01T02:00:00Z")), 2026);
});

test("Ji-Paraná: transporte rejeita host externo, redirecionamento, tipo e tamanho inválidos", async () => {
  let called = false;
  const fetcher: typeof fetch = async () => {
    called = true;
    return Response.json({});
  };
  await assert.rejects(
    fetchJiParanaJson(
      "https://externo.example.invalid/api/obras/2026/2",
      signal(),
      fetcher,
    ),
  );
  assert.equal(called, false);
  for (const response of [
    new Response(null, {
      status: 302,
      headers: { Location: "https://externo.example.invalid" },
    }),
    new Response("<html>teste</html>", {
      headers: { "Content-Type": "text/html" },
    }),
    new Response("{}", {
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(5 * 1024 * 1024 + 1),
      },
    }),
    new Response("JSON inválido", {
      headers: { "Content-Type": "application/json" },
    }),
  ])
    await assert.rejects(
      fetchJiParanaJson(
        "/api/contratos/2026/2",
        signal(),
        async () => response,
      ),
    );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchJiParanaJson("/api/contratos/2026/2", controller.signal, fetcher),
  );
});

test("Ji-Paraná: coletor confere envelope, limites e estabilidade de cobertura", async () => {
  const rows = Array.from({ length: 11 }, (_, index) => row(index + 1));
  const requested: string[] = [];
  await assert.rejects(
    collectJiParanaPages(
      "/api/contratos/2026/2",
      signal(),
      fixture(rows, requested),
      { maxRecords: 10 },
    ),
  );
  assert.equal(requested.length, 1);
  const result = await collectJiParanaPages(
    "/api/contratos/2026/2",
    signal(),
    async (input) => {
      const page = Number(new URL(String(input)).searchParams.get("page"));
      return Response.json({
        arrecadacoes: envelope(
          rows.slice((page - 1) * 10, page * 10),
          rows.length,
          page,
        ),
      });
    },
    { envelope: "arrecadacoes" },
  );
  assert.equal(result.records.length, 11);
  await assert.rejects(
    collectJiParanaPages("/api/contratos/2026/2", signal(), fixture(rows), {
      envelope: "arrecadacoes",
    }),
  );
});

test("Ji-Paraná: helpers usam centavos exatos e texto público", () => {
  assert.equal(jiMoney("11864950.560"), 1186495056);
  assert.equal(jiMoney("-10,20", true), -1020);
  assert.equal(jiMoney(null), null);
  assert.equal(jiMoney("0"), 0);
  for (const invalid of ["1.001", "1,0001", Infinity, "900719925474099.00"])
    assert.throws(() => jiMoney(invalid));
  assert.equal(jiDate("29/02/2024"), "2024-02-29");
  assert.throws(() => jiDate("29/02/2025"));
  assert.equal(
    jiText("&lt;b&gt;CPF 12345678901&lt;/b&gt;"),
    "CPF [CPF não republicado]",
  );
});
