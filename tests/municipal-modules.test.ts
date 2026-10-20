import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWork, fetchWorks } from "../src/connectors/porto-velho/works";
import { fetchRevenues } from "../src/connectors/porto-velho/revenues";
import { RevenueAccumulator } from "../src/connectors/porto-velho/revenue-accumulator";
import {
  moneyToCents,
  allPages,
  officialUrl,
} from "../src/connectors/porto-velho/public-data";
import { filterWorks, defaultFilters } from "../src/features/works/filters";
import { revenueDashboardView } from "../src/features/revenues/dashboard-view";
import { revenueTotals, periodValue } from "../src/features/revenues/filters";
import { parseRevenueQuery } from "../src/core/municipal-query";
import {
  createCachedWorksReader,
  WORKS_CACHE_KEY,
} from "../src/core/municipal-cache";
import { revenueSnapshotSchema } from "../src/core/revenues";
const at = "2026-10-19T12:00:00.000Z";
const signal = () => new AbortController().signal;
const rawWork = (id = 1) => ({
  id,
  nome: "ESCOLA SINTÉTICA",
  situacao: "Em Andamento",
  valor_contratado: { value: 100 },
  valor_pago: 0,
  valor_a_medir: null,
  porcentagem_executado: "120.25",
  updated_at: at,
  contrato: { id: 9, numero: "Contrato 9" },
  localizacoes: [{ nome: "Bairro sintético" }],
  medicoes: [],
  anexos: [],
  fornecedor: {
    documento: "123.456.789-01",
    nome: "Pessoa sintética",
    telefone: "sigiloso",
  },
});
const rawReceipt = (id = "r1", amount: unknown = "-12.30") => ({
  id,
  portal: { id: 12535 },
  unidade_gestora_id: "unit-1",
  unidade_gestora: { nome: "Unidade sintética", telefone: "segredo" },
  ano: 2026,
  mes: "01 - Janeiro",
  data_documento: "2026-01-31",
  receita_sigla: "O",
  valor_documento: amount,
  valor_orcamento: 99999999,
  nome: "Contribuinte não republicável",
  natureza_orcamentaria: {
    plano_conta: "111 - Conta sintética",
    fonte_recurso: "1500 - Fonte sintética",
    plano_conta_categoria: "100 - Categoria sintética",
  },
});
const forecast = (amount: unknown = 100) => ({
  ...rawReceipt(),
  id: 0,
  portal_id: 12535,
  valor_orcamento: amount,
});
function snapshot() {
  const acc = new RevenueAccumulator(2026, at);
  acc.add(rawReceipt(), false);
  acc.add(rawReceipt("r2", 0), false);
  acc.add(forecast(), true);
  acc.add(forecast(0), true);
  return revenueSnapshotSchema.parse({
    schemaVersion: 1,
    portalId: 12535,
    generatedAt: at,
    lastAttemptAt: at,
    syncStatus: "ok",
    syncError: null,
    years: [
      {
        year: 2026,
        receipts: 2,
        planned: 2,
        lastDocumentDate: acc.lastDocumentDate,
      },
    ],
    entries: acc.finish(),
    sourceUrl:
      "https://api.portovelho.ro.gov.br/api/v1/receitas?portal_id=12535&ano=2026",
  });
}
const apiPage = (rows: unknown[], page = 1, total = rows.length, size = 1000) =>
  Response.json({
    data: rows,
    meta: {
      current_page: page,
      last_page: Math.max(1, Math.ceil(total / size)),
      per_page: size,
      total,
    },
  });
test("Obras preserva contratado, pago zero, ausência e percentual sem estimar execução física", () => {
  const w = normalizeWork(rawWork());
  assert.equal(w.contractedCents, 10000);
  assert.equal(w.paidCents, 0);
  assert.equal(w.toMeasureCents, null);
  assert.equal(w.reportedExecutionPercent, 120.25);
  assert.equal(w.contractId, 9);
  const json = JSON.stringify(w);
  assert.ok(!json.includes("123.456.789-01"));
  assert.ok(!json.includes("sigiloso"));
  assert.ok(!json.includes("Pessoa sintética"));
  assert.equal(w.organization, null);
});
test("Obras mantém busca sem acentos, filtros combinados, ordenação e vínculos oficiais", () => {
  const a = normalizeWork(rawWork()),
    b = normalizeWork({
      ...rawWork(2),
      nome: "Outra obra",
      situacao: "Concluída",
      valor_contratado: 200,
    });
  assert.deepEqual(
    filterWorks([a, b], {
      ...defaultFilters,
      q: "escola sintetica",
      status: "Em Andamento",
    }).map((w) => w.sourceId),
    [1],
  );
  assert.equal(
    filterWorks([a, b], { ...defaultFilters, sort: "value" })[0].sourceId,
    2,
  );
  assert.equal(officialUrl("https://externo.example/doc"), null);
  assert.equal(officialUrl("https://api.portovelho.ro.gov.br/a?cpf=123"), null);
});
test("Receitas soma previsão separada, id zero repetido, negativos e zero sem dados de contribuintes", () => {
  const s = snapshot(),
    entry = s.entries[0];
  assert.equal(entry.plannedCents, 10000);
  assert.equal(entry.plannedLines, 2);
  assert.equal(periodValue(entry).cents, -1230);
  assert.equal(periodValue(entry, "2").cents, null);
  assert.equal(revenueTotals(s.entries, "2").plannedCents, 10000);
  assert.equal(revenueTotals(s.entries).percent, -12.3);
  assert.ok(!JSON.stringify(s).includes("Contribuinte"));
  assert.ok(!JSON.stringify(s).includes("segredo"));
  assert.equal(moneyToCents("R$ -1.234,56"), -123456);
  assert.throws(() => moneyToCents("1,234,56"));
});
test("Receitas rejeita portal, ano, competência, IDs repetidos e previsão duplicada positiva", () => {
  for (const patch of [
    { portal: { id: 1 } },
    { ano: 2025 },
    { data_documento: "2026-02-01" },
    { mes: "13 - Inválido" },
  ])
    assert.throws(() =>
      new RevenueAccumulator(2026, at).add(
        { ...rawReceipt(), ...patch },
        false,
      ),
    );
  const acc = new RevenueAccumulator(2026, at);
  acc.add(rawReceipt(), false);
  assert.throws(() => acc.add(rawReceipt(), false));
  acc.add({ ...forecast(), id: 2 }, true);
  assert.throws(() => acc.add({ ...forecast(), id: 2 }, true));
});
test("Receitas oferece os mesmos filtros de unidade, tipo, categoria, mês, busca e ordenação", () => {
  const s = snapshot();
  const view = revenueDashboardView(
    s,
    "ano=2026&q=conta&mes=2&ordem=planned",
    2026,
  );
  assert.equal(view.count, 1);
  assert.equal(view.totals.realizedCents, null);
  assert.equal(view.totals.plannedCents, 10000);
  assert.deepEqual(
    view.years.map((y) => y.year),
    [2026, 2025],
  );
  assert.equal(view.rows[0].received.documents, 0);
  assert.equal(revenueDashboardView(s, "ano=2026&tipo=extra", 2026).count, 0);
  assert.equal(
    revenueDashboardView(s, "ano=2026&unidade=outra", 2026).count,
    0,
  );
});
test("Parâmetros rejeitam duplicações, exercício fora do recorte e filtros malformados antes da fonte", () => {
  assert.equal(parseRevenueQuery({}, 2026).year, 2026);
  assert.equal(parseRevenueQuery({ ano: "2025" }, 2026).year, 2025);
  for (const q of [
    { ano: ["2026", "2025"] },
    { ano: "2024" },
    { mes: "13" },
    { tipo: "inventado" },
    { page: "0" },
    { desconhecido: "x" },
  ])
    assert.throws(() => parseRevenueQuery(q, 2026));
});
test("Paginação usa origem fixa, preserva portal/ano e rejeita cobertura truncada ou alterada", async () => {
  const urls: string[] = [];
  const request = (async (url: unknown) => {
    const u = new URL(String(url));
    urls.push(u.href);
    const page = Number(u.searchParams.get("page"));
    return apiPage(
      Array.from({ length: page === 1 ? 2 : 1 }, (_, i) => ({
        id: page * 10 + i,
      })),
      page,
      3,
      2,
    );
  }) as typeof fetch;
  const rows: unknown[] = [];
  await allPages(
    "https://api.portovelho.ro.gov.br/api/v1/receitas?portal_id=12535&ano=2026",
    2,
    5,
    signal(),
    (r) => rows.push(...r),
    request,
  );
  assert.equal(rows.length, 3);
  assert.ok(
    urls.every((u) => u.includes("portal_id=12535") && u.includes("ano=2026")),
  );
  await assert.rejects(() =>
    allPages(
      "https://api.portovelho.ro.gov.br/x",
      2,
      5,
      signal(),
      () => {},
      (async () => apiPage([], 1, 3, 2)) as typeof fetch,
    ),
  );
});
test("Conectores só publicam catálogo completo e a previsão vem do endpoint próprio", async () => {
  const urls: string[] = [];
  const request = (async (url: unknown) => {
    urls.push(String(url));
    return String(url).includes("/previstas")
      ? apiPage([forecast()])
      : apiPage([rawReceipt()]);
  }) as typeof fetch;
  const data = await fetchRevenues(2026, signal(), request);
  assert.equal(data.entries[0].plannedCents, 10000);
  assert.equal(urls.length, 2);
  await assert.rejects(() =>
    fetchWorks(signal(), (async () =>
      apiPage([rawWork()], 1, 2, 100)) as typeof fetch),
  );
});
test("Falha 500 transitória é repetida com limite e não vira catálogo vazio", async () => {
  let calls = 0;
  const r = await fetchWorks(signal(), (async () =>
    ++calls === 1
      ? new Response(null, { status: 500 })
      : apiPage([rawWork()], 1, 1, 100)) as typeof fetch);
  assert.equal(calls, 2);
  assert.equal(r.total, 1);
});

test("Códigos contábeis oficiais de onze dígitos não são tratados como CPF nem fundem contas", () => {
  const a = new RevenueAccumulator(2026, at);
  for (const code of ["11145114000", "11145115000"]) {
    const raw = {
      ...forecast(),
      id: 8,
      natureza_orcamentaria: {
        ...forecast().natureza_orcamentaria,
        plano_conta: code + " - Conta sintética",
      },
    };
    a.add(raw, true);
  }
  const entries = a.finish();
  assert.equal(entries.length, 2);
  assert.ok(entries.some((e) => e.account.startsWith("11145114000")));
  assert.ok(entries.some((e) => e.account.startsWith("11145115000")));
});

import { currency, dateLabel } from "../src/features/shared/display";
test("Apresentação segue o PVH com moeda compacta nos indicadores e consulta no fuso de Rondônia", () => {
  assert.equal(dateLabel("2026-10-20T00:30:00Z"), "19/10/2026");
  assert.equal(dateLabel("2026-10-20"), "20/10/2026");
  assert.equal(currency(0), "R$ 0,00");
  assert.equal(currency(null), "Não informado");
  assert.ok(currency(235755306200, true).length < 18);
});

test("Obras conserva cache por uma hora e não grava falhas da fonte", async () => {
  const entries = new Map<string, unknown>();
  const cache = {
    get: async (k: string) => entries.get(k),
    set: async (k: string, v: unknown, ttl: number) => {
      assert.equal(ttl, 3600);
      entries.set(k, v);
    },
  };
  let calls = 0;
  const read = createCachedWorksReader({
    cache: () => cache,
    now: () => Date.parse(at) + 1000,
    read: async () => {
      calls++;
      return {
        data: {
          records: [normalizeWork(rawWork())],
          sourceUrl:
            "https://api.portovelho.ro.gov.br/api/v1/obras?por-pagina=100",
          complete: true,
          total: 1,
          warnings: [],
        },
        fetchedAt: at,
      };
    },
  });
  assert.equal((await read()).cache.status, "miss");
  assert.equal((await read()).cache.status, "hit");
  assert.equal(calls, 1);
  entries.delete(WORKS_CACHE_KEY);
  const failure = createCachedWorksReader({
    cache: () => cache,
    read: async () => {
      throw new Error("Fonte falhou");
    },
  });
  await assert.rejects(() => failure());
  assert.ok(!entries.has(WORKS_CACHE_KEY));
});
