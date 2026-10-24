import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRedisCacheStore } from "../src/core/redis-cache-store";
import { createRedisRevenueBackend } from "../src/core/redis-revenue-backend";
import {
  makeRevenueVersion,
  currentRevenueYear,
  REVENUE_RETENTION_MS,
} from "../src/core/revenue-refresh";
import { redisMunicipalReservation } from "../src/core/municipal-rate-limit";
import {
  syntheticRevenues,
  syntheticJiParanaRevenues,
  syntheticAriquemesRevenues,
} from "./fixtures/revenues";

test(
  "Redis real: Lua garante exclusão, fencing, retenção, backoff e isolamento dos exercícios",
  { skip: !process.env.TEST_REDIS_URL },
  async (t) => {
    const url = process.env.TEST_REDIS_URL!;
    assert.ok(
      ["127.0.0.1", "localhost"].includes(new URL(url).hostname),
      "Teste deve usar somente Redis local isolado.",
    );
    const config = { url, password: process.env.TEST_REDIS_PASSWORD ?? "" },
      store = createRedisCacheStore(config),
      other = createRedisCacheStore(config);
    const prefix = "fixture:revenues:" + randomUUID(),
      backend = createRedisRevenueBackend(store, prefix),
      competitor = createRedisRevenueBackend(other, prefix);
    const now = Date.now(),
      year = currentRevenueYear(now),
      attempt = {
        phase: "running" as const,
        attemptedAt: new Date(now).toISOString(),
        nextAttemptAt: new Date(now).toISOString(),
      };
    t.after(async () => {
      await store.eval(
        "return redis.call('DEL',unpack(KEYS));",
        [
          ...Array.from({ length: 2 }, (_, i) => year - i).flatMap((y) => [
            `${prefix}:year:${y}:snapshot`,
            `${prefix}:year:${y}:attempt`,
            `${prefix}:year:${y}:lock`,
          ]),
          prefix + ":queue",
          prefix + ":heartbeat",
        ],
        [],
      );
      store.close();
      other.close();
    });
    await backend.request(year);
    const claims = await Promise.all([
      backend.claim(year, "owner-a", attempt),
      competitor.claim(year, "owner-b", attempt),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    const owner = claims[0] ? "owner-a" : "owner-b";
    const version = makeRevenueVersion(
        year,
        syntheticRevenues(year, now),
        new Date(now).toISOString(),
      ),
      next = {
        phase: "idle" as const,
        attemptedAt: attempt.attemptedAt,
        nextAttemptAt: version.refreshAfter,
      };
    assert.equal(
      await backend.publish(year, "wrong-owner", version, next),
      false,
    );
    assert.equal(await backend.publish(year, owner, version, next), true);
    assert.deepEqual((await backend.read(year)).version, version);
    const ttl = Number(
      await store.eval(
        "return redis.call('PTTL',KEYS[1]);",
        [`${prefix}:year:${year}:snapshot`],
        [],
      ),
    );
    assert.ok(
      ttl > REVENUE_RETENTION_MS - 10_000 && ttl <= REVENUE_RETENTION_MS,
    );
    await store.eval(
      "return redis.call('ZADD',KEYS[1],0,ARGV[1]);",
      [prefix + ":queue"],
      [String(year)],
    );
    assert.equal(await backend.claim(year, "old", attempt), true);
    await store.eval(
      "return redis.call('DEL',KEYS[1]);",
      [`${prefix}:year:${year}:lock`],
      [],
    );
    assert.equal(await competitor.claim(year, "new", attempt), true);
    assert.equal(
      await backend.finish(year, "old", { ...next, phase: "failed" }),
      false,
    );
    assert.equal(await backend.publish(year, "old", version, next), false);
    const retry = new Date(Date.now() + 300_000).toISOString();
    assert.equal(
      await competitor.finish(year, "new", {
        phase: "failed",
        attemptedAt: attempt.attemptedAt,
        nextAttemptAt: retry,
      }),
      true,
    );
    await Promise.all(Array.from({ length: 20 }, () => backend.request(year)));
    assert.deepEqual(await backend.due(), []);
    const after = await backend.read(year);
    assert.deepEqual(after.version, version);
    assert.deepEqual(after.attempt, {
      phase: "failed",
      attemptedAt: attempt.attemptedAt,
      nextAttemptAt: retry,
    });
    assert.ok(
      Number(
        await store.eval(
          "return redis.call('PTTL',KEYS[1]);",
          [`${prefix}:year:${year}:snapshot`],
          [],
        ),
      ) <= ttl,
    );
    const historic = year - 1;
    await backend.request(historic);
    assert.equal(await backend.claim(historic, "history", attempt), true);
    const h = makeRevenueVersion(
      historic,
      syntheticRevenues(historic, now),
      new Date(now).toISOString(),
    );
    await backend.publish(historic, "history", h, {
      ...next,
      nextAttemptAt: h.refreshAfter,
    });
    assert.equal(
      await store.eval(
        "return redis.call('ZSCORE',KEYS[1],ARGV[1]);",
        [prefix + ":queue"],
        [String(historic)],
      ),
      null,
    );
  },
);
test(
  "Redis real: municípios isolam lease e publicação e rejeitam snapshot de outra cidade",
  { skip: !process.env.TEST_REDIS_URL },
  async (t) => {
    const url = process.env.TEST_REDIS_URL!;
    assert.ok(["127.0.0.1", "localhost"].includes(new URL(url).hostname));
    const store = createRedisCacheStore({
      url,
      password: process.env.TEST_REDIS_PASSWORD ?? "",
    });
    const base = "fixture:revenues:" + randomUUID();
    const prefixes = [
      `${base}:porto-velho`,
      `${base}:ji-parana`,
      `${base}:ariquemes`,
    ];
    const pvh = createRedisRevenueBackend(store, prefixes[0]);
    const ji = createRedisRevenueBackend(store, prefixes[1], "ji-parana");
    const ari = createRedisRevenueBackend(store, prefixes[2], "ariquemes");
    const now = Date.now(),
      year = currentRevenueYear(now),
      at = new Date(now).toISOString();
    const attempt = {
      phase: "running" as const,
      attemptedAt: at,
      nextAttemptAt: at,
    };
    const pvhVersion = makeRevenueVersion(
      year,
      syntheticRevenues(year, now),
      at,
    );
    const jiVersion = makeRevenueVersion(
      year,
      syntheticJiParanaRevenues(year, now),
      at,
      "ji-parana",
    );
    const ariVersion = makeRevenueVersion(
      year,
      syntheticAriquemesRevenues(year, now),
      at,
      "ariquemes",
    );
    t.after(async () => {
      await store.eval(
        "return redis.call('DEL',unpack(KEYS));",
        prefixes.flatMap((prefix) => [
          `${prefix}:year:${year}:snapshot`,
          `${prefix}:year:${year}:attempt`,
          `${prefix}:year:${year}:lock`,
          `${prefix}:queue`,
          `${prefix}:heartbeat`,
        ]),
        [],
      );
      store.close();
    });
    await Promise.all([pvh.request(year), ji.request(year), ari.request(year)]);
    assert.deepEqual(
      await Promise.all([
        pvh.claim(year, "same-token", attempt),
        ji.claim(year, "same-token", attempt),
        ari.claim(year, "same-token", attempt),
      ]),
      [true, true, true],
    );
    const next = {
      phase: "idle" as const,
      attemptedAt: at,
      nextAttemptAt: pvhVersion.refreshAfter,
    };
    assert.equal(await ji.publish(year, "same-token", pvhVersion, next), false);
    assert.equal(
      await ari.publish(year, "same-token", pvhVersion, next),
      false,
    );
    assert.equal(await ari.publish(year, "same-token", jiVersion, next), false);
    assert.equal((await ari.read(year)).version, null);
    assert.equal((await ari.read(year)).running, true);
    assert.equal((await ji.read(year)).version, null);
    assert.equal((await ji.read(year)).running, true);
    assert.equal(await pvh.publish(year, "same-token", pvhVersion, next), true);
    assert.equal(
      await ji.publish(year, "same-token", jiVersion, {
        ...next,
        nextAttemptAt: jiVersion.refreshAfter,
      }),
      true,
    );
    assert.deepEqual((await pvh.read(year)).version, pvhVersion);
    assert.deepEqual((await ji.read(year)).version, jiVersion);
    assert.equal(
      await ari.publish(year, "same-token", ariVersion, {
        ...next,
        nextAttemptAt: ariVersion.refreshAfter,
      }),
      true,
    );
    assert.deepEqual((await ari.read(year)).version, ariVersion);
    await pvh.heartbeat("pvh-revision");
    assert.equal((await ji.read(year)).workerOnline, false);
    assert.equal((await ari.read(year)).workerOnline, false);
    await ji.heartbeat("ji-revision");
    assert.equal(await ji.healthy("ji-revision"), true);
    assert.equal(await ji.healthy("pvh-revision"), false);
    await ari.heartbeat("ari-revision");
    assert.equal(await ari.healthy("ari-revision"), true);
    assert.equal(await ari.healthy("ji-revision"), false);
  },
);

test(
  "Redis real: site e worker reservam o mesmo limite de consultas sem filas ilimitadas",
  { skip: !process.env.TEST_REDIS_URL },
  async () => {
    const url = process.env.TEST_REDIS_URL!;
    assert.ok(["127.0.0.1", "localhost"].includes(new URL(url).hostname));
    const config = { url, password: process.env.TEST_REDIS_PASSWORD ?? "" },
      a = createRedisCacheStore(config),
      b = createRedisCacheStore(config),
      key = "observatorio:RO:porto-velho:source:v1:pace";
    try {
      await a.eval("return redis.call('DEL',KEYS[1]);", [key], []);
      const reserveA = redisMunicipalReservation(a, false),
        reserveB = redisMunicipalReservation(b, false);
      const first = await reserveA(),
        second = await reserveB();
      assert.equal(first, 0);
      assert.ok(second !== null && second >= 1000);
      const burst = await Promise.all(
        Array.from({ length: 20 }, () => reserveA()),
      );
      assert.ok(burst.some((v) => v === -1));
      assert.ok(burst.every((v) => v !== null && v <= 11000));
    } finally {
      await a.eval("return redis.call('DEL',KEYS[1]);", [key], []);
      a.close();
      b.close();
    }
  },
);
