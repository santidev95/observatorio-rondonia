import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchAriquemesExpensesPage } from "../src/connectors/ariquemes/expenses";
import type { ContractsCacheStore } from "../src/core/contracts-cache";
import { ContractsDataError } from "../src/core/contracts-query";
import { readSource } from "../src/core/contracts-reader";
import {
  expensePageSchema,
  parseExpensesQuery,
  type ExpensePage,
  type ExpensesQuery,
} from "../src/core/expenses";
import {
  createCachedExpensesReader,
  expensesCacheKey,
} from "../src/core/expenses-cache";
import { isExpensesMunicipality } from "../src/core/municipal-sources";

const origin = "https://transparencia.ariquemes.ro.gov.br";
const signal = () => new AbortController().signal;
const commitments = (page = 1): ExpensesQuery => ({
  page,
  year: 2026,
  view: "empenhos",
});
const payments = (page = 1): ExpensesQuery => ({
  page,
  year: 2026,
  view: "pagamentos",
});

const common = (index: number) => ({
  EMPRESA_NOME: "Prefeitura sintética de Ariquemes",
  NEMPG: 5000 + index,
  TPEM: "GL",
  PKEMP: 900000 + index,
  PROC: `${index}/2026`,
  INSMF: "11.222.333/0001-81",
  NOME: "Empresa sintética",
  ORGAO: "0002 - Órgão sintético",
  FUNCAO: "12 - Educação",
  PROGRAMA: "0001 - Programa sintético",
  PROJATIV: "2001 - Ação sintética",
  CATEC: "3.3.90.30.01 - Material sintético",
  FONTECODIGO: "500 - Recursos sintéticos",
});
function commitment(index: number, overrides: Record<string, unknown> = {}) {
  return {
    ...common(index),
    EMPRESA: 1,
    DTEMPENHO: "02/01/2026",
    ANO_EMPENHO: 2026,
    EMPENHADO: "1.000,10",
    ANULADO: "0,00",
    LIQUIDADO: "500,05",
    PAGO: "0,00",
    RETIDO: "0,00",
    ...overrides,
  };
}
function payment(index: number, overrides: Record<string, unknown> = {}) {
  return {
    ...common(index),
    EXERCICIO: "2026",
    NUMSUB: index,
    ORDPGSEQ: 1,
    VAPAG: "99,90",
    DTLIQUIDACAO: "03/01/2026",
    DTVENCIMENTO: "04/01/2026",
    DTPAG: "05/01/2026",
    ...overrides,
  };
}

function body(
  view: ExpensesQuery["view"],
  rows: unknown[],
  { page = 1, total = rows.length, perPage = 10 } = {},
) {
  const received = rows.length;
  return {
    [view]: {
      [view]: {
        current_page: page,
        data: rows,
        from: received ? (page - 1) * perPage + 1 : null,
        last_page: Math.max(1, Math.ceil(total / perPage)),
        per_page: perPage,
        to: received ? (page - 1) * perPage + received : null,
        total,
      },
      totais:
        view === "empenhos"
          ? {
              TOTAL_EMPENHADO: "214.069.271,63",
              TOTAL_LIQUIDADO: "161.497.701,43",
              TOTAL_PAGO: "158.886.835,31",
              TOTAL_ANULADO: "-25.538.124,71",
            }
          : { TOTAL_PAGO: "158.886.835,31" },
    },
  };
}
function fixture(payload: unknown, requested: string[] = []): typeof fetch {
  return async (input, init) => {
    requested.push(String(input));
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
    });
  };
}

test("Despesas: empenhos leem uma única página e preservam centavos e totais da fonte", async () => {
  const requested: string[] = [];
  const page = await fetchAriquemesExpensesPage(
    commitments(2),
    signal(),
    fixture(
      body(
        "empenhos",
        Array.from({ length: 10 }, (_, i) => commitment(i + 11)),
        { page: 2, total: 6627 },
      ),
      requested,
    ),
  );
  assert.deepEqual(requested, [
    `${origin}/api/despesas/empenhos/2026/1?page=2`,
  ]);
  assert.equal(page.view, "empenhos");
  assert.deepEqual(page.pagination, {
    currentPage: 2,
    lastPage: 663,
    perPage: 10,
    total: 6627,
  });
  if (page.view !== "empenhos") return;
  assert.equal(page.records[0].id, "2026-900011");
  assert.equal(page.records[0].committedCents, 100010);
  assert.equal(page.records[0].liquidatedCents, 50005);
  assert.equal(page.records[0].committedOn, "2026-01-02");
  assert.deepEqual(page.totals, {
    committedCents: 21406927163,
    liquidatedCents: 16149770143,
    paidCents: 15888683531,
    canceledCents: -2553812471,
  });
});

test("Despesas: anulação conserva valor negativo publicado sem somar etapas", async () => {
  const page = await fetchAriquemesExpensesPage(
    commitments(),
    signal(),
    fixture(
      body("empenhos", [
        commitment(1, {
          TPEM: "AN",
          EMPENHADO: "-4.750,00",
          ANULADO: "-4.750,00",
        }),
      ]),
    ),
  );
  assert.equal(page.view, "empenhos");
  if (page.view !== "empenhos") return;
  assert.equal(page.records[0].commitmentType, "AN");
  assert.equal(page.records[0].committedCents, -475000);
  assert.equal(page.records[0].canceledCents, -475000);
  assert.equal(page.records[0].liquidatedCents, 50005);
});

test("Despesas: pagamentos usam chave própria e datas separadas", async () => {
  const page = await fetchAriquemesExpensesPage(
    payments(),
    signal(),
    fixture(body("pagamentos", [payment(1), payment(2)])),
  );
  assert.equal(page.view, "pagamentos");
  if (page.view !== "pagamentos") return;
  assert.equal(page.records[0].id, "2026-900001-1-1");
  assert.equal(page.records[0].paidCents, 9990);
  assert.equal(page.records[0].settledOn, "2026-01-03");
  assert.equal(page.records[0].dueOn, "2026-01-04");
  assert.equal(page.records[0].paidOn, "2026-01-05");
  assert.deepEqual(page.totals, { paidCents: 15888683531 });
});

test("Despesas: restos a pagar preservam o exercício informado do empenho", async () => {
  const page = await fetchAriquemesExpensesPage(
    payments(),
    signal(),
    fixture(body("pagamentos", [payment(1, { EXERCICIO: "2024" })])),
  );
  assert.equal(page.records[0].commitmentYear, 2024);
  assert.equal(page.records[0].sourceYear, 2026);
});

test("Despesas: CPF mascarado ou documento ausente não republicam o nome", async () => {
  const name = "Nome Sintético de Pessoa";
  const page = await fetchAriquemesExpensesPage(
    commitments(),
    signal(),
    fixture(
      body("empenhos", [
        commitment(1, { INSMF: "***.123.456-**", NOME: name }),
        commitment(2, { INSMF: "123.456.789-09", NOME: name }),
        commitment(3, { INSMF: null, NOME: name }),
        commitment(4, { INSMF: "", NOME: name }),
      ]),
    ),
  );
  const published = JSON.stringify(page);
  assert.equal(published.includes(name), false);
  assert.equal(published.includes("123.456"), false);
  assert.equal(
    page.records[0].creditorName,
    "Pessoa física (nome não republicado)",
  );
  assert.equal(
    page.records[1].creditorName,
    "Pessoa física (nome não republicado)",
  );
  assert.equal(
    page.records[2].creditorName,
    "Credor sem CNPJ (nome não republicado)",
  );
  assert.equal(
    page.records[3].creditorName,
    "Credor sem CNPJ (nome não republicado)",
  );
  for (const record of page.records) assert.equal(record.creditorCnpj, null);
});

test("Despesas: empresa com CNPJ mantém nome e não expõe código do credor", async () => {
  const page = await fetchAriquemesExpensesPage(
    commitments(),
    signal(),
    fixture(body("empenhos", [commitment(1, { CODIF: 777123 })])),
  );
  assert.equal(page.records[0].creditorName, "Empresa sintética");
  assert.equal(page.records[0].creditorCnpj, "11222333000181");
  assert.equal(JSON.stringify(page).includes("777123"), false);
});

test("Despesas: exercício sem registros é uma página vazia válida", async () => {
  const page = await fetchAriquemesExpensesPage(
    commitments(),
    signal(),
    fixture(body("empenhos", [])),
  );
  assert.equal(page.records.length, 0);
  assert.equal(page.pagination.total, 0);
  assert.equal(page.pagination.lastPage, 1);
});

test("Despesas: resposta divergente nunca vira página publicável", async () => {
  const rejected: [string, ExpensesQuery, unknown][] = [
    [
      "outra UG",
      commitments(),
      body("empenhos", [commitment(1, { EMPRESA: 2 })]),
    ],
    ["sem envelope", commitments(), { empenhos: { data: [] } }],
    ["sem totais", commitments(), { empenhos: { empenhos: {} } }],
    ["envelope trocado", commitments(), body("pagamentos", [payment(1)])],
    [
      "página menor que o total",
      commitments(),
      body("empenhos", [commitment(1)], { total: 5 }),
    ],
    [
      "tamanho alterado",
      commitments(),
      body("empenhos", [commitment(1)], { perPage: 25 }),
    ],
    [
      "empenho repetido",
      commitments(),
      body("empenhos", [commitment(1), commitment(1)]),
    ],
    [
      "pagamento repetido",
      payments(),
      body("pagamentos", [payment(1), payment(1)]),
    ],
    [
      "valor inválido",
      commitments(),
      body("empenhos", [commitment(1, { EMPENHADO: "abc" })]),
    ],
    [
      "data impossível",
      commitments(),
      body("empenhos", [commitment(1, { DTEMPENHO: "31/02/2026" })]),
    ],
    ["campo ausente", commitments(), body("empenhos", [{ PKEMP: 1 }])],
  ];
  for (const [label, query, payload] of rejected)
    await assert.rejects(
      fetchAriquemesExpensesPage(query, signal(), fixture(payload)),
      label,
    );
});

test("Despesas: página além do fim é distinta de falha da fonte", async () => {
  const load = (abort: AbortSignal) =>
    fetchAriquemesExpensesPage(
      commitments(9),
      abort,
      fixture(body("empenhos", [], { page: 9, total: 10 })),
    );
  const outOfRange = (error: unknown) =>
    error instanceof ContractsDataError &&
    error.code === "page-out-of-range" &&
    error.status === 404;
  await assert.rejects(load(signal()), outOfRange);
  await assert.rejects(readSource(load, { timeoutMs: 1000 }), outOfRange);
  await assert.rejects(
    readSource(() => Promise.reject(new Error("Falha do conector.")), {
      timeoutMs: 1000,
    }),
    (error) =>
      error instanceof ContractsDataError &&
      error.code === "source-unavailable",
  );
});

test("Despesas: falha HTTP e consulta inválida não produzem catálogo vazio", async () => {
  const failing: typeof fetch = async () =>
    new Response("erro", { status: 500 });
  await assert.rejects(
    fetchAriquemesExpensesPage(commitments(), signal(), failing),
  );
  let called = false;
  const spy: typeof fetch = async () => {
    called = true;
    return new Response("{}");
  };
  await assert.rejects(
    fetchAriquemesExpensesPage({ ...commitments(), year: 1999 }, signal(), spy),
  );
  assert.equal(called, false);
});

test("Despesas: leitura lenta da fonte tem prazo próprio além dos 12 s do transporte", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let aborted = false;
  const slow: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) =>
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("cancelada"));
      }),
    );
  const pending = fetchAriquemesExpensesPage(payments(), signal(), slow);
  t.mock.timers.tick(13_800);
  await Promise.resolve();
  assert.equal(aborted, false);
  t.mock.timers.tick(11_200);
  await assert.rejects(pending);
  assert.equal(aborted, true);
});

test("Despesas: parâmetros têm padrão explícito e rejeitam entradas ambíguas", () => {
  assert.deepEqual(parseExpensesQuery({}, 2026), commitments());
  assert.deepEqual(
    parseExpensesQuery({ visao: "pagamentos", ano: "2025", page: "3" }, 2026),
    { page: 3, year: 2025, view: "pagamentos" },
  );
  for (const input of [
    { visao: "folha" },
    { ano: "1999" },
    { ano: "abc" },
    { page: "0" },
    { page: ["1", "2"] },
    { extra: "1" },
  ])
    assert.throws(() => parseExpensesQuery(input, 2026), ContractsDataError);
});

test("Despesas: somente Ariquemes foi validada", () => {
  assert.equal(isExpensesMunicipality("ariquemes"), true);
  assert.equal(isExpensesMunicipality("ji-parana"), false);
  assert.equal(isExpensesMunicipality("porto-velho"), false);
  assert.equal(isExpensesMunicipality("__proto__"), false);
});

function page(query: ExpensesQuery): ExpensePage {
  return expensePageSchema.parse({
    view: "pagamentos",
    year: query.year,
    warnings: [],
    records: [],
    totals: { paidCents: 100 },
    pagination: {
      currentPage: query.page,
      lastPage: 1,
      perPage: 10,
      total: 0,
    },
    sourceUrl: `${origin}/api/despesas/pagamentos/${query.year}/1?page=${query.page}`,
  });
}
function memoryCache() {
  const entries = new Map<string, unknown>();
  const store: ContractsCacheStore = {
    get: async (key) => entries.get(key) ?? null,
    set: async (key, value) => void entries.set(key, value),
  };
  return { entries, store };
}

test("cache Despesas: isola exercício, visão e página, e reutiliza por uma hora", async () => {
  const keys = new Set(
    [payments(), payments(2), commitments(), { ...payments(), year: 2025 }].map(
      (query) => expensesCacheKey(query, "ariquemes"),
    ),
  );
  assert.equal(keys.size, 4);
  const { store } = memoryCache();
  let reads = 0;
  const now = Date.parse("2026-11-03T12:00:00.000Z");
  const reader = createCachedExpensesReader({
    municipality: "ariquemes",
    cache: () => store,
    now: () => now,
    read: async (query) => {
      reads++;
      return { data: page(query), fetchedAt: new Date(now).toISOString() };
    },
  });
  assert.equal((await reader(payments())).cache.status, "miss");
  assert.equal((await reader(payments())).cache.status, "hit");
  assert.equal(reads, 1);
});

test("cache Despesas: entrada de outra fonte é ignorada e erro não é gravado", async () => {
  const { entries, store } = memoryCache();
  const now = Date.parse("2026-11-03T12:00:00.000Z");
  const fetchedAt = new Date(now).toISOString();
  const key = expensesCacheKey(payments(), "ariquemes");
  const forged = page(payments());
  entries.set(key, {
    key,
    result: {
      data: {
        ...forged,
        sourceUrl: `${origin}/api/despesas/pagamentos/2026/2?page=1`,
      },
      fetchedAt,
    },
    expiresAt: new Date(now + 3_600_000).toISOString(),
  });
  let reads = 0;
  const reader = createCachedExpensesReader({
    municipality: "ariquemes",
    cache: () => store,
    now: () => now,
    read: async (query) => {
      reads++;
      return { data: page(query), fetchedAt };
    },
  });
  assert.equal((await reader(payments())).cache.status, "miss");
  assert.equal(reads, 1);

  const failing = memoryCache();
  const broken = createCachedExpensesReader({
    municipality: "ariquemes",
    cache: () => failing.store,
    read: async () => {
      throw new Error("fonte fora do ar");
    },
  });
  await assert.rejects(broken(payments()));
  assert.equal(failing.entries.size, 0);
});
