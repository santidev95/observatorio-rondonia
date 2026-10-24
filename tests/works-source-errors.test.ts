import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchJiParanaWorks } from "../src/connectors/ji-parana/works";
import { readSource } from "../src/core/contracts-reader";
import { ContractsDataError } from "../src/core/contracts-query";
import { createCachedWorksReader } from "../src/core/municipal-cache";
import {
  jiParanaWorkRow as row,
  jiParanaWorksPage as envelope,
} from "./fixtures/ji-parana-works";

const now = Date.parse("2026-10-23T12:00:00Z");

function cachedSource(fetcher: typeof fetch) {
  const entries = new Map<string, unknown>();
  let writes = 0;
  const read = createCachedWorksReader({
    cacheKey: "observatorio:RO:ji-parana:obras:v1:year:2026:catalog",
    sourceUrl: "https://transparencia.ji-parana.ro.gov.br/api/obras/2026/2",
    now: () => now,
    cache: () => ({
      get: async (key) => entries.get(key),
      set: async (key, value) => {
        writes++;
        entries.set(key, value);
      },
    }),
    read: () =>
      readSource((signal) => fetchJiParanaWorks(signal, 2026, fetcher), {
        now: () => now,
      }),
  });
  return { read, entries, writes: () => writes };
}

test("Obras: divergência 112/113 retorna cobertura parcial explícita sem cache", async () => {
  let calls = 0;
  const source = cachedSource(async () => {
    calls++;
    return Response.json(
      envelope(
        Array.from({ length: 112 }, (_, index) => row(index + 1)),
        1,
        113,
        200,
      ),
    );
  });

  const result = await source.read();
  assert.equal(result.data.complete, false);
  assert.equal(result.data.total, 112);
  assert.equal(result.data.records.length, 112);
  assert.deepEqual(result.data.coverage, {
    reportedRows: 113,
    receivedRows: 112,
    repeatedRows: 0,
    assumedMissingRows: 1,
  });
  assert.deepEqual(result.cache, { status: "miss", expiresAt: null });
  assert.equal(result.fetchedAt, new Date(now).toISOString());
  assert.equal(calls, 1);
  assert.equal(source.writes(), 0);
  assert.equal(source.entries.size, 0);
});

test("Obras: IDs repetidos em página consistente conservam diagnóstico sem cache", async () => {
  const secret = "fornecedor-sintetico-nao-republicar";
  const source = cachedSource(async () =>
    Response.json(
      envelope([row(1), row(2), row(1, { NOMEFOR: secret })], 1, 3, 200),
    ),
  );

  await assert.rejects(source.read, (error: unknown) => {
    assert.ok(error instanceof Error);
    const failure = error as Error & {
      code: unknown;
      issue: unknown;
      publicMessage: string;
    };
    assert.equal(failure.code, "source-inconsistent");
    assert.deepEqual(failure.issue, {
      kind: "duplicate-identifiers",
      received: 3,
      unique: 2,
    });
    assert.ok(!failure.publicMessage.includes(secret));
    assert.ok(!JSON.stringify(failure).includes(secret));
    return true;
  });
  assert.equal(source.writes(), 0);
  assert.equal(source.entries.size, 0);
});

test("readSource: erro que imita diagnóstico público continua sanitizado", async () => {
  const secret = "segredo-sintetico-nao-expor";
  const forged = Object.assign(new Error(secret), {
    code: "source-inconsistent",
    issue: { kind: "duplicate-identifiers", received: 3, unique: 2 },
    publicMessage: secret,
  });

  await assert.rejects(
    () =>
      readSource(async () => {
        throw forged;
      }, {}),
    (error: unknown) => {
      assert.ok(error instanceof ContractsDataError);
      assert.equal(error.code, "source-unavailable");
      assert.notStrictEqual(error, forged);
      assert.ok(!error.message.includes(secret));
      assert.ok(!JSON.stringify(error).includes(secret));
      return true;
    },
  );
});
