import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAriquemesRevenues } from "../src/connectors/ariquemes/revenues";
import { revenueSnapshotSchema } from "../src/core/revenues";
import {
  createRevenueReader,
  makeRevenueVersion,
  parseRevenueVersion,
  parseLegacyRevenue,
  type RevenueBackend,
} from "../src/core/revenue-refresh";
import { createRevenueWorker } from "../src/core/revenue-worker";
import { createRedisRevenueBackend } from "../src/core/redis-revenue-backend";
import type { RedisScriptStore } from "../src/core/redis-cache-store";
import { revenueDashboardView } from "../src/features/revenues/dashboard-view";
import { periodValue, revenueTotals } from "../src/features/revenues/filters";
import {
  syntheticRevenues,
  syntheticJiParanaRevenues,
} from "./fixtures/revenues";

const signal = () => new AbortController().signal;
const codes = [
  "1112.50.0.0.00.00.00.00",
  "1112.53.0.0.00.00.00.00",
  "1721.50.0.0.00.00.00.00",
  "1711.51.1.0.00.00.00.00",
];
const row = (index: number) => ({
  CODRE: codes[index],
  NOMRE: "Receita sintética " + index,
  ORCADO: index === 0 ? "1234.560" : index === 1 ? "0,00" : null,
  ARRECADADO: index === 0 ? "-1.230" : index === 1 ? "0,00" : null,
  ...(index < 2
    ? { EMPRESA: 1, EMPRESA_NOME: "Prefeitura Municipal de Ariquemes" }
    : {}),
  NOME_COMPLETO: "Campo não republicável",
  CONTAC: "conta não republicável",
});

type Patch = (
  rows: Record<string, unknown>[],
  group: string,
  page: number,
) => void;
function fixture(patch?: Patch, inconsistent = false) {
  const urls: URL[] = [];
  const request = (async (input: unknown) => {
    const u = new URL(String(input));
    urls.push(u);
    const direct = u.pathname.includes("arrecadadas-diretamente");
    const state = u.pathname.includes("estaduais");
    const group = direct ? "direct" : state ? "state" : "federal";
    const page = Number(u.searchParams.get("page"));
    const data: Record<string, unknown>[] = [
      row(direct ? page - 1 : state ? 2 : 3),
    ];
    patch?.(data, group, page);
    const total = direct ? 2 : 1;
    return Response.json({
      [direct ? "arrecadacoes" : "transferencias"]: {
        data,
        current_page: page,
        last_page: inconsistent && page === 2 ? 3 : total,
        per_page: 1,
        total: inconsistent && page === 2 ? 3 : total,
        from: page,
        to: page,
      },
      totalArrecadado: [
        { TOTALORCADO: "99999999999999", NOME_COMPLETO: "Não republicar" },
      ],
    });
  }) as typeof fetch;
  return { request, urls };
}

test("Receitas Ariquemes percorre todos os grupos/páginas da UG1 e preserva valores anuais sem inventar meses", async () => {
  const f = fixture();
  const snapshot = await fetchAriquemesRevenues(2026, signal(), f.request);
  assert.equal(f.urls.length, 4);
  assert.ok(
    f.urls.every(
      (u) =>
        u.origin === "https://transparencia.ariquemes.ro.gov.br" &&
        u.pathname.endsWith("/2026/1"),
    ),
  );
  assert.equal(snapshot.municipality, "ariquemes");
  assert.equal(snapshot.aggregation, "annual-accounts");
  assert.equal(snapshot.coverage, "partial");
  assert.equal(snapshot.years[0].lastDocumentDate, null);
  assert.equal(snapshot.years[0].receipts, 4);
  const first = snapshot.entries.find((e) => e.sourceId === codes[0])!;
  const zero = snapshot.entries.find((e) => e.sourceId === codes[1])!;
  const missing = snapshot.entries.find((e) => e.sourceId === codes[2])!;
  assert.equal(first.plannedCents, 123456);
  assert.deepEqual(first.annual, { cents: -123, records: 1, missingValues: 0 });
  assert.deepEqual(first.months, []);
  assert.equal(zero.plannedCents, 0);
  assert.equal(zero.annual?.cents, 0);
  assert.equal(missing.annual?.cents, null);
  assert.equal(missing.annual?.missingValues, 1);
  assert.equal(periodValue(first).cents, -123);
  assert.equal(periodValue(first, "1").cents, null);
  const json = JSON.stringify(snapshot);
  assert.ok(!json.includes("não republicável"));
  assert.ok(!json.includes("99999999999999"));
  assert.ok(
    snapshot.warnings?.some((warning) => warning.includes("aditividade")),
  );
});

test("Receitas Ariquemes rejeita mudança de cobertura, códigos repetidos, UG/ano divergentes e precisão desconhecida", async () => {
  await assert.rejects(() =>
    fetchAriquemesRevenues(2026, signal(), fixture(undefined, true).request),
  );
  for (const patch of [
    { EMPRESA: 2 },
    { EXERCICIO: 2025 },
    { ANO: 2025 },
    { CODRE: "" },
    { NOMRE: "" },
    { ORCADO: "1.001" },
    { ARRECADADO: "malformado" },
  ]) {
    const f = fixture((rows, group, page) => {
      if (group === "direct" && page === 1) Object.assign(rows[0], patch);
    });
    await assert.rejects(() =>
      fetchAriquemesRevenues(2026, signal(), f.request),
    );
  }
  const duplicate = fixture((rows, group) => {
    if (group === "state") rows[0].CODRE = codes[0];
  });
  await assert.rejects(() =>
    fetchAriquemesRevenues(2026, signal(), duplicate.request),
  );
  await assert.rejects(() =>
    fetchAriquemesRevenues(
      2026,
      signal(),
      (async () => new Response(null, { status: 500 })) as typeof fetch,
    ),
  );
});

test("Dashboard Ariquemes apresenta valores por rubrica, sem soma global, percentual ou série mensal", async () => {
  const snapshot = await fetchAriquemesRevenues(
    2026,
    signal(),
    fixture().request,
  );
  const view = revenueDashboardView(
    snapshot,
    "ano=2026&mes=1&tipo=extra&q=sintetica&ordem=planned",
    2026,
  );
  assert.equal(view.aggregation, "annual-accounts");
  assert.equal(view.municipality, "ariquemes");
  assert.equal(view.filters.month, "");
  assert.equal(view.filters.kind, "budget");
  assert.ok(!view.query.includes("tipo="));
  assert.ok(!view.query.includes("mes="));
  assert.deepEqual(view.monthly, []);
  assert.equal(view.count, 4);
  assert.equal(view.rows[0].plannedCents, 123456);
  assert.equal(view.rows[0].received.cents, -123);
  assert.equal(view.rows[0].sourceId, codes[0]);
  assert.equal(view.totals.documents, 4);
  assert.equal(view.totals.plannedCents, null);
  assert.equal(view.totals.realizedCents, null);
  assert.equal(view.totals.percent, null);
  assert.equal(revenueTotals(snapshot.entries.slice(0, 1)).realizedCents, null);
});

test("Snapshots e cache de Receitas impedem cruzamento entre Ariquemes, Ji-Paraná e Porto Velho", async () => {
  const data = await fetchAriquemesRevenues(2026, signal(), fixture().request);
  const time = Date.parse(data.generatedAt);
  const ari = makeRevenueVersion(2026, data, data.generatedAt, "ariquemes");
  const pvh = makeRevenueVersion(
    2026,
    syntheticRevenues(2026, time),
    data.generatedAt,
  );
  assert.deepEqual(parseRevenueVersion(ari, 2026, time, "ariquemes"), ari);
  assert.equal(parseRevenueVersion(ari, 2026, time), null);
  assert.equal(parseRevenueVersion(pvh, 2026, time, "ariquemes"), null);
  const jiData = syntheticJiParanaRevenues(2026, time);
  const ji = makeRevenueVersion(2026, jiData, data.generatedAt, "ji-parana");
  assert.equal(parseRevenueVersion(ji, 2026, time, "ariquemes"), null);
  assert.equal(
    parseRevenueVersion(ji, 2026, time, "ji-parana")?.data.municipality,
    "ji-parana",
  );
  assert.equal(parseRevenueVersion(ji, 2026, time), null);
  assert.equal(parseRevenueVersion(ari, 2026, time, "ji-parana"), null);
  assert.equal(parseLegacyRevenue({}, 2026, time, "ariquemes"), null);
  assert.equal(
    revenueSnapshotSchema.safeParse({ ...data, portalId: 12535 }).success,
    false,
  );
  for (const patch of [
    { unitId: "2" },
    { sourceUrl: jiData.entries[0].sourceUrl },
    { id: jiData.entries[0].id },
  ]) {
    assert.equal(
      revenueSnapshotSchema.safeParse({
        ...data,
        entries: [{ ...data.entries[0], ...patch }],
        years: [{ ...data.years[0], planned: 1, receipts: 1 }],
      }).success,
      false,
    );
  }
  assert.equal(
    revenueSnapshotSchema.safeParse({
      ...data,
      entries: [{ ...data.entries[0], id: "pvh-receita-" + "a".repeat(24) }],
      years: [{ ...data.years[0], planned: 1, receipts: 1 }],
    }).success,
    false,
  );

  let requests = 0;
  const backend = {
    read: async () => ({
      version: pvh,
      attempt: null,
      running: false,
      workerOnline: true,
    }),
    request: async () => {
      requests++;
    },
  } as unknown as RevenueBackend;
  const read = await createRevenueReader(
    () => backend,
    () => time,
    "ariquemes",
  )(2026);
  assert.equal(read.state, "pending");
  assert.equal(read.data, null);
  assert.equal(requests, 1);
});

test("Worker Ariquemes mantém versão anterior e retenção quando a nova coleta falha", async () => {
  const data = await fetchAriquemesRevenues(2026, signal(), fixture().request);
  const time = Date.parse(data.generatedAt);
  const version = makeRevenueVersion(2026, data, data.generatedAt, "ariquemes");
  let stored = version;
  let published = 0,
    failed = 0,
    legacyCalls = 0;
  const backend = {
    ensureCurrent: async () => {},
    due: async () => [2026],
    claim: async () => true,
    legacy: async () => {
      legacyCalls++;
      return null;
    },
    publish: async (
      _year: number,
      _token: string,
      nextVersion: typeof version,
    ) => {
      published++;
      stored = nextVersion;
      return true;
    },
    finish: async (
      _year: number,
      _token: string,
      attempt: { phase: string },
    ) => {
      if (attempt.phase === "failed") failed++;
      return true;
    },
  } as unknown as RevenueBackend;
  await createRevenueWorker({
    municipality: "ariquemes",
    backend,
    now: () => time + 3600001,
    read: async () => {
      throw new Error("Origem indisponível");
    },
  })(signal());
  assert.equal(published, 0);
  assert.equal(failed, 1);
  assert.equal(legacyCalls, 1);
  assert.deepEqual(stored, version);
  assert.equal(
    version.retainUntil,
    new Date(time + 7 * 86400000).toISOString(),
  );
});

test("Worker Ariquemes publica somente snapshot da cidade e rejeita resultado de Porto Velho", async () => {
  const data = await fetchAriquemesRevenues(2026, signal(), fixture().request);
  const time = Date.parse(data.generatedAt);
  for (const loaded of [
    data,
    syntheticRevenues(2026, time),
    syntheticJiParanaRevenues(2026, time),
  ]) {
    const published: unknown[] = [];
    const backend = {
      ensureCurrent: async () => {},
      due: async () => [2026],
      claim: async () => true,
      legacy: async () => null,
      publish: async (_year: number, _token: string, version: unknown) => {
        published.push(version);
        return true;
      },
      finish: async () => true,
    } as unknown as RevenueBackend;
    await createRevenueWorker({
      municipality: "ariquemes",
      backend,
      now: () => time,
      read: async () => ({ data: loaded, fetchedAt: data.generatedAt }),
    })(signal());
    if (loaded === data) {
      assert.equal(published.length, 1);
      assert.ok(parseRevenueVersion(published[0], 2026, time, "ariquemes"));
      assert.equal(parseRevenueVersion(published[0], 2026, time), null);
    } else assert.deepEqual(published, []);
  }
});

test("Backend Redis isola fila, snapshot, lease e heartbeat por município, sem migrar PVH para Ariquemes", async () => {
  const calls: { keys: string[] }[] = [];
  let gets = 0;
  const store = {
    eval: async (_script: string, keys: string[]) => {
      calls.push({ keys });
      return 1;
    },
    get: async () => {
      gets++;
      return null;
    },
    set: async (key: string) => {
      calls.push({ keys: [key] });
    },
  } as unknown as RedisScriptStore;
  const pvh = createRedisRevenueBackend(store);
  const ji = createRedisRevenueBackend(store, undefined, "ariquemes");
  await pvh.request(2026);
  await ji.request(2026);
  await ji.heartbeat("fixture");
  assert.ok(calls[0].keys.every((key) => key.includes(":porto-velho:")));
  assert.ok(calls[1].keys.every((key) => key.includes(":ariquemes:")));
  assert.equal(
    calls[2].keys[0],
    "observatorio:RO:ariquemes:receitas:v2:heartbeat",
  );
  assert.equal(await ji.legacy(2026), null);
  assert.equal(gets, 0);
});
