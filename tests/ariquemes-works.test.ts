import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAriquemesWork,
  fetchAriquemesWorks,
} from "../src/connectors/ariquemes/works";
import { normalizeJiParanaWork } from "../src/connectors/ji-parana/works";
import { ariquemesWorkRow as row } from "./fixtures/ariquemes-works";
import { jiParanaWorksPage as envelope } from "./fixtures/ji-parana-works";

const signal = () => new AbortController().signal;
const fixture =
  (data: unknown): typeof fetch =>
  async () =>
    Response.json(data);

test("Ariquemes Obras: identifica a Prefeitura UG 1 sem cruzar identidade com Ji-Paraná", () => {
  const work = normalizeAriquemesWork(row(), 2026);
  assert.equal(work.id, "ariquemes-2026-3");
  assert.equal(work.sourceId, 3);
  assert.equal(work.sourceYear, 2026);
  assert.equal(
    work.sourceUrl,
    "https://transparencia.ariquemes.ro.gov.br/api/obras/2026/1",
  );
  assert.equal(work.organizationName, "Prefeitura sintética de Ariquemes");
  assert.ok(!JSON.stringify(work).includes("ji-parana"));
  assert.throws(() => normalizeAriquemesWork(row(3, { EMPRESA: 2 }), 2026));
  assert.throws(() => normalizeJiParanaWork(row(), 2026));
  assert.throws(() =>
    normalizeAriquemesWork(row(3, { EXERCICIO: 2025 }), 2026),
  );
});

test("Ariquemes Obras: separa valor total de contratado, pago, medição e percentual ausente", () => {
  const work = normalizeAriquemesWork(row(), 2026);
  assert.equal(work.declaredValueCents, 987654);
  assert.equal(work.contractedCents, null);
  assert.equal(work.paidCents, null);
  assert.equal(work.toMeasureCents, null);
  assert.equal(work.reportedExecutionPercent, null);
  assert.equal(work.reportedCompletionAt, null);
  assert.deepEqual(work.measurements, []);
  assert.deepEqual(work.documents, []);
  assert.equal(work.sourceUpdatedAt, null);
  const zero = normalizeAriquemesWork(
    row(4, { VALOR: "0,00", PERCENTUALEXECUTADO: "0" }),
    2026,
  );
  assert.equal(zero.declaredValueCents, 0);
  assert.equal(zero.reportedExecutionPercent, 0);
  assert.equal(
    normalizeAriquemesWork(row(5, { VALOR: null }), 2026).declaredValueCents,
    null,
  );
});

test("Ariquemes Obras: preserva ano original divergente com aviso e minimiza campos pessoais", () => {
  const work = normalizeAriquemesWork(
    row(3, {
      ANO: "2024",
      DESCRICAO: "Obra <b>sintética</b> 123.456.789-01",
      NOMEFOR: "Pessoa sintética privada",
      EMAIL: "privado@example.invalid",
      CPF: "12345678901",
    }),
    2026,
  );
  assert.equal(work.sourceYear, 2026);
  assert.match(work.observation ?? "", /Ano informado no registro: 2024/);
  assert.ok(work.issues.some((issue) => issue.includes("difere do exercício")));
  const text = JSON.stringify(work);
  for (const privateValue of [
    "123.456.789-01",
    "12345678901",
    "Pessoa sintética privada",
    "privado@example",
    "<b>",
  ])
    assert.ok(!text.includes(privateValue));
});

test("Ariquemes Obras: reconhece catálogo completo do exercício e origem selecionados", async () => {
  const calls: string[] = [];
  const catalog = await fetchAriquemesWorks(signal(), 2026, async (input) => {
    const url = new URL(String(input));
    calls.push(url.href);
    assert.equal(url.origin, "https://transparencia.ariquemes.ro.gov.br");
    assert.equal(url.pathname, "/api/obras/2026/1");
    const page = Number(url.searchParams.get("page"));
    return Response.json(
      page === 1
        ? envelope([row(1), row(2)], 1, 3, 2)
        : envelope([row(3)], 2, 3, 2),
    );
  });
  assert.equal(catalog.complete, true);
  assert.equal(catalog.total, 3);
  assert.equal(calls.length, 2);
  assert.equal(
    catalog.sourceUrl,
    "https://transparencia.ariquemes.ro.gov.br/api/obras/2026/1",
  );
  assert.ok(
    catalog.warnings.some((warning) => warning.includes("Ariquemes (UG 1)")),
  );
});

test("Ariquemes Obras: rejeita duplicidade e cobertura alterada", async () => {
  for (const second of [
    envelope([row(1)], 2, 3, 2),
    envelope([row(3), row(4)], 2, 4, 2),
  ]) {
    let calls = 0;
    await assert.rejects(() =>
      fetchAriquemesWorks(signal(), 2026, async () =>
        Response.json(
          ++calls === 1 ? envelope([row(1), row(2)], 1, 3, 2) : second,
        ),
      ),
    );
  }
});

test("Ariquemes Obras: página única com 176 de 212 mantém a inconsistência explícita", async () => {
  const catalog = await fetchAriquemesWorks(
    signal(),
    2026,
    fixture(
      envelope(
        Array.from({ length: 176 }, (_, index) => row(index + 1)),
        1,
        212,
        300,
      ),
    ),
  );
  assert.equal(catalog.complete, false);
  assert.equal(catalog.total, 176);
  assert.deepEqual(catalog.coverage, {
    reportedRows: 212,
    receivedRows: 176,
    repeatedRows: 0,
    rowDifference: 36,
  });
});

test("Ariquemes Obras: falhas e limites não retornam vazio e cancelamento não acessa a fonte", async () => {
  await assert.rejects(() =>
    fetchAriquemesWorks(
      signal(),
      2026,
      async () => new Response(null, { status: 503 }),
    ),
  );
  let calls = 0;
  await assert.rejects(() =>
    fetchAriquemesWorks(signal(), 2026, async () => {
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
    fetchAriquemesWorks(cancelled.signal, 2026, async () => {
      calls++;
      return Response.json(envelope([]));
    }),
  );
  assert.equal(calls, 1);
  const empty = await fetchAriquemesWorks(
    signal(),
    2026,
    fixture(envelope([])),
  );
  assert.equal(empty.total, 0);
  assert.equal(empty.complete, true);
});
