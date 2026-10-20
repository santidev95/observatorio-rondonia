import { setTimeout as delay } from "node:timers/promises";
import { redisConfig } from "../src/core/redis-config";
import { createRedisCacheStore } from "../src/core/redis-cache-store";
import { createRedisRevenueBackend } from "../src/core/redis-revenue-backend";
import { createRevenueWorker } from "../src/core/revenue-worker";
import { redisMunicipalReservation } from "../src/core/municipal-rate-limit";
import { configureMunicipalRateLimit } from "../src/connectors/porto-velho/transport";
import { readSource } from "../src/core/contracts-reader";
import { fetchRevenues } from "../src/connectors/porto-velho/revenues";

async function main() {
  const config = redisConfig(process.env);
  if (!config) throw new Error("Redis não configurado para o worker");
  const store = createRedisCacheStore(config),
    backend = createRedisRevenueBackend(store);
  const revision = process.env.APP_REVISION ?? "development";
  if (process.argv.includes("--healthcheck")) {
    try {
      if (!(await backend.healthy(revision))) process.exitCode = 1;
    } finally {
      store.close();
    }
    return;
  }
  const stop = new AbortController();
  process.once("SIGTERM", () => stop.abort());
  process.once("SIGINT", () => stop.abort());
  configureMunicipalRateLimit(redisMunicipalReservation(store, false));
  const run = createRevenueWorker({
    backend,
    read: (year, signal) =>
      readSource(
        (inner) => fetchRevenues(year, AbortSignal.any([inner, signal])),
        { timeoutMs: 8 * 60_000 },
      ),
    log: (event) =>
      console.log(JSON.stringify({ worker: "receitas", ...event })),
  });
  let beating = false;
  const beat = async () => {
    if (beating) return;
    beating = true;
    try {
      await backend.heartbeat(revision);
    } catch {
      console.error("Worker de Receitas: Redis indisponível.");
    } finally {
      beating = false;
    }
  };
  await beat();
  const heartbeat = setInterval(beat, 15_000);
  try {
    do {
      try {
        if (await run(stop.signal)) continue;
      } catch {
        if (!stop.signal.aborted)
          console.error(
            "Worker de Receitas: processamento temporariamente indisponível.",
          );
      }
      await delay(5000, undefined, { signal: stop.signal }).catch(() => {});
    } while (!stop.signal.aborted);
  } finally {
    clearInterval(heartbeat);
    store.close();
  }
}
main().catch(() => {
  console.error(
    "Não foi possível iniciar o worker de Receitas. Verifique a configuração privada do Redis.",
  );
  process.exitCode = 1;
});
