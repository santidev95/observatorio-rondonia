import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import {
  createRevenueReader,
  makeRevenueVersion,
  parseRevenueVersion,
  parseLegacyRevenue,
  REVENUE_RETENTION_MS,
  REVENUE_RETRY_MS,
  type RevenueBackend,
  type RevenueAttempt,
  type RevenueVersion,
} from "../src/core/revenue-refresh";
import { createRevenueWorker } from "../src/core/revenue-worker";
import { revenueHttpResponse } from "../src/core/revenue-http";
import type { RevenueSnapshot } from "../src/core/revenues";

const time = Date.parse("2026-10-19T12:00:00.000Z");
import { syntheticRevenues } from "./fixtures/revenues";
function memory() {
  let now = time,
    lease: string | null = null;
  const versions = new Map<number, unknown>(),
    attempts = new Map<number, RevenueAttempt>(),
    queue = new Map<number, number>();
  let requests = 0,
    renew = true;
  const backend: RevenueBackend = {
    read: async (year) => ({
      version: versions.get(year),
      attempt: attempts.get(year),
      running: lease !== null,
      workerOnline: true,
    }),
    request: async (year) => {
      requests++;
      const a = attempts.get(year);
      const due =
        a?.phase === "failed"
          ? Math.max(now, Date.parse(a.nextAttemptAt))
          : now;
      queue.set(year, Math.min(queue.get(year) ?? Infinity, due));
    },
    ensureCurrent: async (year) => {
      if (!queue.has(year)) queue.set(year, 0);
    },
    due: async () =>
      [...queue].filter(([, at]) => at <= now).map(([year]) => year),
    claim: async (year, token, attempt) => {
      if (lease) return false;
      lease = token;
      attempts.set(year, attempt);
      return true;
    },
    renew: async () => renew,
    publish: async (year, token, version, next) => {
      if (lease !== token) return false;
      versions.set(year, version);
      attempts.set(year, next);
      queue.set(year, Date.parse(next.nextAttemptAt));
      lease = null;
      return true;
    },
    finish: async (year, token, next) => {
      if (lease !== token) return false;
      attempts.set(year, next);
      queue.set(year, Date.parse(next.nextAttemptAt));
      lease = null;
      return true;
    },
    heartbeat: async () => {},
    healthy: async () => true,
    legacy: async () => null,
  };
  return {
    backend,
    versions,
    attempts,
    queue,
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    requests: () => requests,
    loseLease: () => {
      lease = "new-owner";
      renew = false;
    },
  };
}
test("leitura fria agenda a carga sem acessar a prefeitura e retorna 202 sem totais fictícios", async () => {
  const m = memory(),
    read = createRevenueReader(() => m.backend, m.now),
    r = await read(2026);
  assert.equal(r.state, "pending");
  assert.equal(r.data, null);
  assert.equal(r.refresh.status, "queued");
  assert.equal(m.requests(), 1);
  const response = revenueHttpResponse(r);
  assert.equal(response.status, 202);
  assert.equal(response.headers.get("retry-after"), "10");
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("versão fresca mantém consulta e valores, sem renovar prazo ou enfileirar", async () => {
  const m = memory(),
    version = makeRevenueVersion(
      2026,
      syntheticRevenues(),
      new Date(time).toISOString(),
    );
  m.versions.set(2026, version);
  const r = await createRevenueReader(() => m.backend, m.now)(2026);
  assert.equal(r.cache.status, "hit");
  assert.equal(r.data?.entries[0].plannedCents, 0);
  assert.equal(r.data?.entries[0].months[0].cents, -123);
  assert.equal(m.requests(), 0);
  assert.equal(
    r.cache.retainedUntil,
    new Date(time + REVENUE_RETENTION_MS).toISOString(),
  );
});
test("após uma hora serve a mesma versão, sinaliza desatualização e registra renovação", async () => {
  const m = memory(),
    v = makeRevenueVersion(
      2026,
      syntheticRevenues(),
      new Date(time).toISOString(),
    );
  m.versions.set(2026, v);
  m.advance(3600_001);
  const r = await createRevenueReader(() => m.backend, m.now)(2026);
  assert.equal(r.state, "ready");
  assert.equal(r.cache.status, "stale");
  assert.equal(r.fetchedAt, v.fetchedAt);
  assert.deepEqual(r.data, v.data);
  assert.equal(m.requests(), 1);
});
test("falha mantém versão anterior e prazo de retenção, respeitando o intervalo de nova tentativa", async () => {
  const m = memory(),
    v = makeRevenueVersion(
      2026,
      syntheticRevenues(),
      new Date(time).toISOString(),
    );
  m.versions.set(2026, v);
  m.advance(3600_001);
  const job = createRevenueWorker({
    backend: m.backend,
    now: m.now,
    read: async () => {
      throw new Error("segredo da origem");
    },
  });
  await job(new AbortController().signal);
  assert.deepEqual(m.versions.get(2026), v);
  assert.equal(m.queue.get(2026), m.now() + REVENUE_RETRY_MS);
  const r = await createRevenueReader(() => m.backend, m.now)(2026);
  assert.equal(r.refresh.status, "failed");
  assert.equal(r.cache.status, "stale");
  assert.ok(!JSON.stringify(r).includes("segredo"));
  assert.equal(m.queue.get(2026), m.now() + REVENUE_RETRY_MS);
});
test("versão vencida, de outro ano, parcial ou com prazo adulterado não é exibida", async () => {
  const v = makeRevenueVersion(
    2026,
    syntheticRevenues(),
    new Date(time).toISOString(),
  );
  assert.equal(parseRevenueVersion(v, 2025, time), null);
  assert.equal(parseRevenueVersion(v, 2026, time + REVENUE_RETENTION_MS), null);
  assert.equal(
    parseRevenueVersion(
      { ...v, refreshAfter: new Date(time + 86400_000).toISOString() },
      2026,
      time,
    ),
    null,
  );
  assert.equal(
    parseRevenueVersion(
      {
        ...v,
        data: { ...v.data, years: [{ ...v.data.years[0], receipts: 999 }] },
      },
      2026,
      time,
    ),
    null,
  );
  assert.equal(
    parseRevenueVersion(
      {
        ...v,
        data: {
          ...v.data,
          sourceUrl: "https://api.portovelho.ro.gov.br/api/v1/obras",
        },
      },
      2026,
      time,
    ),
    null,
  );
});
test("indisponibilidade do Redis responde rapidamente com 503 e não consulta fonte", async () => {
  const m = memory();
  m.backend.read = async () => {
    throw new Error("senha secreta");
  };
  const r = await createRevenueReader(() => m.backend, m.now)(2026);
  assert.equal(revenueHttpResponse(r).status, 503);
  assert.equal(r.state, "unavailable");
  assert.equal(r.data, null);
  assert.ok(!JSON.stringify(r).includes("senha"));
  await assert.rejects(
    () =>
      createRevenueReader(() => {
        throw new Error("não deve acessar");
      })(NaN),
    /Exercício/,
  );
});
test("metadados podem ser consultados sem transferir o catálogo", async () => {
  const m = memory();
  m.versions.set(
    2026,
    makeRevenueVersion(2026, syntheticRevenues(), new Date(time).toISOString()),
  );
  const r = await createRevenueReader(() => m.backend, m.now)(2026),
    body = await revenueHttpResponse(r, true).json();
  assert.equal(body.state, "ready");
  assert.ok(!Object.hasOwn(body, "data"));
  assert.ok(!JSON.stringify(body).includes("Conta sintética"));
});
test("dois workers não coletam o mesmo exercício ao mesmo tempo", async () => {
  const m = memory();
  let calls = 0;
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  const read = async () => {
    calls++;
    await wait;
    return {
      data: syntheticRevenues(),
      fetchedAt: new Date(time).toISOString(),
    };
  };
  const a = createRevenueWorker({ backend: m.backend, now: m.now, read }),
    b = createRevenueWorker({ backend: m.backend, now: m.now, read });
  const first = a(new AbortController().signal);
  await delay(5);
  assert.equal(await b(new AbortController().signal), false);
  release();
  await first;
  assert.equal(calls, 1);
});
test("perda da lease cancela a leitura e impede publicação pela execução antiga", async () => {
  const m = memory(),
    v = makeRevenueVersion(
      2026,
      syntheticRevenues(),
      new Date(time).toISOString(),
    );
  m.versions.set(2026, v);
  const worker = createRevenueWorker({
    backend: m.backend,
    now: m.now,
    leaseIntervalMs: 5,
    read: async (_year, signal) => {
      m.loseLease();
      await delay(25, undefined, { signal });
      return {
        data: syntheticRevenues(),
        fetchedAt: new Date(time + 1).toISOString(),
      };
    },
  });
  await worker(new AbortController().signal);
  assert.deepEqual(m.versions.get(2026), v);
});
test("shutdown preserva a versão e deixa a carga disponível para outra execução", async () => {
  const m = memory(),
    stop = new AbortController();
  const worker = createRevenueWorker({
    backend: m.backend,
    now: m.now,
    read: async () => {
      stop.abort();
      throw new Error("cancelado");
    },
  });
  await worker(stop.signal);
  assert.equal(m.attempts.get(2026)?.phase, "queued");
  assert.equal(m.queue.get(2026), time);
});
test("migração só aceita cache v1 válido e preserva o horário original", async () => {
  const v = makeRevenueVersion(
    2026,
    syntheticRevenues(),
    new Date(time).toISOString(),
  );
  const raw = {
    key: "observatorio:RO:porto-velho:receitas:v1:year:2026:portal:12535",
    result: { data: v.data, fetchedAt: v.fetchedAt },
    expiresAt: new Date(time + 3600_000).toISOString(),
  };
  assert.deepEqual(parseLegacyRevenue(raw, 2026, time + 10), v);
  assert.equal(parseLegacyRevenue(raw, 2026, time + 3600_000), null);
  assert.equal(parseLegacyRevenue(raw, 2025, time), null);
  const m = memory();
  m.backend.legacy = async () => raw;
  let calls = 0;
  await createRevenueWorker({
    backend: m.backend,
    now: m.now,
    read: async () => {
      calls++;
      throw new Error("não deve coletar");
    },
  })(new AbortController().signal);
  assert.equal(calls, 0);
  assert.deepEqual(m.versions.get(2026), v);
});
test("exercício anterior usa renovação diária e a mudança de ano segue Rondônia", () => {
  const at = Date.parse("2027-01-01T02:00:00Z"),
    data = syntheticRevenues(2026, at);
  assert.equal(
    Date.parse(
      makeRevenueVersion(2026, data, new Date(at).toISOString()).refreshAfter,
    ) - at,
    3600_000,
  );
  const later = Date.parse("2027-01-01T04:00:00Z");
  assert.equal(
    Date.parse(
      makeRevenueVersion(2026, data, new Date(later).toISOString())
        .refreshAfter,
    ) - later,
    86400_000,
  );
});
