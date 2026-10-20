import assert from "node:assert/strict";
import { createRedisCacheStore } from "../src/core/redis-cache-store";
import { createRedisRevenueBackend } from "../src/core/redis-revenue-backend";
import {
  currentRevenueYear,
  makeRevenueVersion,
} from "../src/core/revenue-refresh";
import { syntheticRevenues } from "../tests/fixtures/revenues";
const url = process.env.TEST_REDIS_URL;
if (
  process.env.CI !== "true" ||
  !url ||
  !["127.0.0.1", "localhost"].includes(new URL(url).hostname)
)
  throw new Error("Fixture permitida somente no Redis local do CI.");
const store = createRedisCacheStore({
    url,
    password: process.env.TEST_REDIS_PASSWORD!,
  }),
  backend = createRedisRevenueBackend(store),
  now = Date.now(),
  year = currentRevenueYear(now);
try {
  if (process.argv.includes("--verify")) {
    const raw = await backend.read(year);
    assert.equal((raw.attempt as { phase: string }).phase, "idle");
    assert.equal(raw.running, false);
    assert.equal(raw.workerOnline, true);
    assert.equal(
      (raw.version as { data: { years: { receipts: number }[] } }).data.years[0]
        .receipts,
      2,
    );
    assert.deepEqual(await backend.due(), []);
  } else {
    await backend.request(year);
    assert.ok(
      await backend.claim(year, "fixture-smoke", {
        phase: "running",
        attemptedAt: new Date(now).toISOString(),
        nextAttemptAt: new Date(now).toISOString(),
      }),
    );
    const version = makeRevenueVersion(
      year,
      syntheticRevenues(year, now),
      new Date(now).toISOString(),
    );
    assert.ok(
      await backend.publish(year, "fixture-smoke", version, {
        phase: "idle",
        attemptedAt: new Date(now).toISOString(),
        nextAttemptAt: version.refreshAfter,
      }),
    );
    assert.deepEqual(await backend.due(), []);
  }
} finally {
  store.close();
}
