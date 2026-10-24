import assert from "node:assert/strict";
import { createRedisCacheStore } from "../src/core/redis-cache-store";
import { createRedisRevenueBackend } from "../src/core/redis-revenue-backend";
import {
  currentRevenueYear,
  makeRevenueVersion,
  parseRevenueVersion,
} from "../src/core/revenue-refresh";
import { revenueMunicipalities } from "../src/core/revenues";
import {
  syntheticRevenues,
  syntheticJiParanaRevenues,
  syntheticAriquemesRevenues,
} from "../tests/fixtures/revenues";
const fixtures = {
  "porto-velho": syntheticRevenues,
  "ji-parana": syntheticJiParanaRevenues,
  ariquemes: syntheticAriquemesRevenues,
};
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
  now = Date.now(),
  year = currentRevenueYear(now);
try {
  for (const municipality of revenueMunicipalities) {
    const backend = createRedisRevenueBackend(store, undefined, municipality);
    if (process.argv.includes("--verify")) {
      const raw = await backend.read(year);
      assert.equal((raw.attempt as { phase: string }).phase, "idle");
      assert.equal(raw.running, false);
      assert.equal(raw.workerOnline, true);
      const version = parseRevenueVersion(raw.version, year, now, municipality);
      assert.ok(version);
      assert.equal(
        version.data.years[0].receipts,
        municipality === "porto-velho" ? 2 : 1,
      );
      assert.equal(version.data.entries[0].plannedCents, 0);
      assert.equal(
        municipality !== "porto-velho"
          ? version.data.entries[0].annual?.cents
          : version.data.entries[0].months[0].cents,
        -123,
      );
      const revision = process.argv[process.argv.indexOf("--revision") + 1];
      assert.match(revision ?? "", /^[a-f0-9]{40}$/);
      assert.ok(await backend.healthy(revision));
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
        fixtures[municipality](year, now),
        new Date(now).toISOString(),
        municipality,
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
  }
} finally {
  store.close();
}
