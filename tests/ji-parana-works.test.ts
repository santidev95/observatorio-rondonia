import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchJiParanaWorks,
  normalizeJiParanaWork,
} from "../src/connectors/ji-parana/works";
import { currentJiParanaYear } from "../src/connectors/ji-parana/transport";
import {
  jiParanaWorkRow as row,
  jiParanaWorksPage as envelope,
} from "./fixtures/ji-parana-works";

const signal = () => new AbortController().signal;
const fixture =
  (body: unknown): typeof fetch =>
  async () =>
    Response.json(body);

test("Ji-Paraná Obras: preserva identidade, exercício e os conceitos financeiros publicados", () => {
  const work = normalizeJiParanaWork(row(), 2026);
  assert.equal(work.id, "ji-parana-2026-7");
  assert.equal(work.sourceId, 7);
  assert.equal(work.sourceYear, 2026);
  assert.equal(work.declaredValueCents, 123456);
  assert.equal(work.contractedCents, null);
  assert.equal(work.paidCents, null);
  assert.equal(work.toMeasureCents, null);
  assert.equal(work.contractDateFromWork, null);
  assert.equal(work.startedAt, "2026-02-01");
  assert.equal(work.reportedCompletionAt, "2026-12-03");
  assert.equal(work.reportedExecutionPercent, 84.74);
  assert.equal(work.sourceUpdatedAt, null);
  assert.equal(
    work.sourceUrl,
    "https://transparencia.ji-parana.ro.gov.br/api/obras/2026/2",
  );
  assert.equal(work.category, "5 - Outros");
  assert.equal(work.contractId, null);
  assert.deepEqual(work.documents, []);
  assert.deepEqual(work.measurements, []);
  assert.ok(
    work.issues.some((issue) => issue.includes("não confirma conclusão")),
  );
});

test("Ji-Paraná Obras: mantém zero, ausência e percentual publicado sem estimativa própria", () => {
  const zero = normalizeJiParanaWork(
    row(1, { VALOR: "0,00", PERCENTUALEXECUTADO: "0" }),
    2026,
  );
  const absent = normalizeJiParanaWork(
    row(2, {
      VALOR: null,
      PERCENTUALEXECUTADO: null,
      DATAINI: null,
      DATACONCLUSAO: null,
    }),
    2026,
  );
  const outlier = normalizeJiParanaWork(
    row(3, { PERCENTUALEXECUTADO: "120,25" }),
    2026,
  );
  assert.equal(zero.declaredValueCents, 0);
  assert.equal(zero.reportedExecutionPercent, 0);
  assert.equal(absent.declaredValueCents, null);
  assert.equal(absent.reportedExecutionPercent, null);
  assert.equal(absent.startedAt, null);
  assert.equal(absent.reportedCompletionAt, null);
  assert.equal(outlier.reportedExecutionPercent, 120.25);
  assert.equal(outlier.paidCents, null);
});

test("Ji-Paraná Obras: só aceita registros da Prefeitura e exercício consultados", () => {
  for (const patch of [
    { EMPRESA: 1 },
    { EXERCICIO: 2025 },
    { EXERCICIO: "2026" },
    { SEQUENCIAL: 0 },
    { SEQUENCIAL: "7" },
    { DESCRICAO: null },
    { VALOR: "1.234,567" },
    { VALOR: "-1,00" },
    { DATAINI: "31/02/2026" },
    { PERCENTUALEXECUTADO: "84%" },
  ])
    assert.throws(() => normalizeJiParanaWork(row(7, patch), 2026));
  assert.throws(() => normalizeJiParanaWork([], 2026));
  const olderYear = normalizeJiParanaWork(row(7, { ANO: "2024" }), 2026);
  assert.ok(olderYear.issues.some((issue) => issue.includes("ano informado")));
  assert.match(olderYear.observation ?? "", /Ano informado no registro: 2024/);
});

test("Ji-Paraná Obras: minimiza CPF, fornecedores sem tipo e campos privados extras", () => {
  const work = normalizeJiParanaWork(
    row(8, {
      DESCRICAO: "<b>Obra</b> &#49;&#50;&#51;.456.789-01",
      LOCALIZACAO: "Local 12345678901",
      NOMEFOR: "Pessoa sintética confidencial",
      telefone: "telefone confidencial",
      CPF: "12345678901",
      EMAIL: "email-confidencial@example.invalid",
      anexos: [{ url: "https://externo.example.invalid/?cpf=12345678901" }],
    }),
    2026,
  );
  const publicJson = JSON.stringify(work);
  assert.equal(work.supplier, "Fornecedor não republicado");
  assert.ok(work.title.includes("[CPF não republicado]"));
  for (const secret of [
    "12345678901",
    "123.456.789-01",
    "Pessoa sintética confidencial",
    "telefone confidencial",
    "email-confidencial",
    "externo.example",
    "<b>",
  ])
    assert.ok(!publicJson.includes(secret));
});

test("Ji-Paraná Obras: coleta todas as páginas com origem própria e conserva o recorte", async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    urls.push(url.href);
    assert.equal(url.origin, "https://transparencia.ji-parana.ro.gov.br");
    assert.equal(url.pathname, "/api/obras/2026/2");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    return Response.json(
      url.searchParams.get("page") === "1"
        ? envelope([row(1), row(2)], 1, 3, 2)
        : envelope([row(3)], 2, 3, 2),
    );
  };
  const catalog = await fetchJiParanaWorks(signal(), 2026, fetcher);
  assert.equal(catalog.complete, true);
  assert.equal(catalog.total, 3);
  assert.equal(
    catalog.sourceUrl,
    "https://transparencia.ji-parana.ro.gov.br/api/obras/2026/2",
  );
  assert.deepEqual(
    catalog.records.map((work) => work.sourceId),
    [1, 2, 3],
  );
  assert.deepEqual(
    urls.map((url) => new URL(url).searchParams.get("page")),
    ["1", "2"],
  );
  assert.ok(
    catalog.warnings.some((warning) =>
      warning.includes("não abrange outros exercícios"),
    ),
  );
  assert.ok(!JSON.stringify(catalog).includes("externo.example"));
});

test("Ji-Paraná Obras: rejeita metadados alterados e duplicidade em carga completa", async () => {
  for (const second of [
    envelope([row(3), row(4)], 2, 4, 2),
    envelope([row(1)], 2, 3, 2),
  ]) {
    let calls = 0;
    await assert.rejects(() =>
      fetchJiParanaWorks(signal(), 2026, async () =>
        Response.json(
          ++calls === 1 ? envelope([row(1), row(2)], 1, 3, 2) : second,
        ),
      ),
    );
  }
});

test("Ji-Paraná Obras: 112 registros para total oficial de 113 não formam catálogo completo", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (input) => {
    const page = Number(new URL(String(input)).searchParams.get("page"));
    calls++;
    const length = page < 12 ? 10 : 2;
    return Response.json(
      envelope(
        Array.from({ length }, (_, index) => row((page - 1) * 10 + index + 1)),
        page,
        113,
        10,
      ),
    );
  };
  const catalog = await fetchJiParanaWorks(signal(), 2026, fetcher);
  assert.equal(catalog.complete, false);
  assert.equal(catalog.total, 112);
  assert.equal(catalog.records.length, 112);
  assert.deepEqual(catalog.coverage, {
    reportedRows: 113,
    receivedRows: 112,
    repeatedRows: 0,
    assumedMissingRows: 1,
  });
  assert.equal(calls, 12);
});

test("Ji-Paraná Obras: falha posterior e resposta excessiva não viram catálogo vazio", async () => {
  let calls = 0;
  await assert.rejects(() =>
    fetchJiParanaWorks(signal(), 2026, async () =>
      ++calls === 1
        ? Response.json(envelope([row(1)], 1, 2, 1))
        : new Response("conteúdo de erro privado", { status: 503 }),
    ),
  );
  assert.equal(calls, 2);
  await assert.rejects(() =>
    fetchJiParanaWorks(
      signal(),
      2026,
      async () =>
        new Response("{}", {
          headers: {
            "content-type": "application/json",
            "content-length": "6000000",
          },
        }),
    ),
  );
  const empty = await fetchJiParanaWorks(signal(), 2026, fixture(envelope([])));
  assert.equal(empty.complete, true);
  assert.equal(empty.total, 0);
});

test("Ji-Paraná Obras: aplica limite antes da segunda página e respeita cancelamento", async () => {
  let calls = 0;
  await assert.rejects(() =>
    fetchJiParanaWorks(signal(), 2026, async () => {
      calls++;
      return Response.json(
        envelope(
          Array.from({ length: 10 }, (_, index) => row(index + 1)),
          1,
          2001,
        ),
      );
    }),
  );
  assert.equal(calls, 1);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(() =>
    fetchJiParanaWorks(cancelled.signal, 2026, async () => {
      throw new Error("Não deve consultar a fonte");
    }),
  );
  const during = new AbortController();
  calls = 0;
  await assert.rejects(() =>
    fetchJiParanaWorks(during.signal, 2026, async () => {
      calls++;
      if (calls === 2) during.abort();
      return Response.json(envelope([row(calls)], calls, 2, 1));
    }),
  );
  assert.equal(calls, 2);
});

test("Ji-Paraná Obras: exercício padrão é o corrente em Rondônia e entrada inválida não consulta", async () => {
  const current = currentJiParanaYear();
  let calls = 0;
  const fetcher: typeof fetch = async (input) => {
    calls++;
    assert.equal(new URL(String(input)).pathname, `/api/obras/${current}/2`);
    return Response.json(envelope([]));
  };
  assert.equal(
    (await fetchJiParanaWorks(signal(), undefined, fetcher)).total,
    0,
  );
  assert.equal(calls, 1);
  for (const year of [1999, 2101, NaN, 2026.5])
    await assert.rejects(() => fetchJiParanaWorks(signal(), year, fetcher));
  assert.equal(calls, 1);
});
