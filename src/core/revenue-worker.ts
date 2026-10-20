import { randomUUID } from "node:crypto";
import {
  currentRevenueYear,
  makeRevenueVersion,
  parseLegacyRevenue,
  REVENUE_RETRY_MS,
  type RevenueBackend,
} from "./revenue-refresh";
import type { RevenueSnapshot } from "./revenues";

type Options = {
  backend: RevenueBackend;
  read: (
    year: number,
    signal: AbortSignal,
  ) => Promise<{ data: RevenueSnapshot; fetchedAt: string }>;
  now?: () => number;
  token?: () => string;
  leaseIntervalMs?: number;
  log?: (event: {
    year: number;
    status: "published" | "migrated" | "failed" | "lease-lost" | "cancelled";
  }) => void;
};
export function createRevenueWorker(options: Options) {
  const now = options.now ?? Date.now,
    backend = options.backend;
  return async (signal: AbortSignal): Promise<boolean> => {
    signal.throwIfAborted();
    await backend.ensureCurrent(currentRevenueYear(now()));
    for (const year of await backend.due()) {
      signal.throwIfAborted();
      const token = (options.token ?? randomUUID)(),
        attemptedAt = new Date(now()).toISOString();
      if (
        !(await backend.claim(year, token, {
          phase: "running",
          attemptedAt,
          nextAttemptAt: attemptedAt,
        }))
      )
        continue;
      const lease = new AbortController(),
        combined = AbortSignal.any([signal, lease.signal]);
      let renewing = false;
      const timer = setInterval(async () => {
        if (renewing) return;
        renewing = true;
        try {
          if (!(await backend.renew(year, token))) lease.abort();
        } catch {
          lease.abort();
        } finally {
          renewing = false;
        }
      }, options.leaseIntervalMs ?? 20_000);
      try {
        const legacy = parseLegacyRevenue(
          await backend.legacy(year),
          year,
          now(),
        );
        const result =
          legacy ??
          (await (async () => {
            const loaded = await options.read(year, combined);
            return makeRevenueVersion(year, loaded.data, loaded.fetchedAt);
          })());
        combined.throwIfAborted();
        const published = await backend.publish(year, token, result, {
          phase: "idle",
          attemptedAt,
          nextAttemptAt: result.refreshAfter,
        });
        options.log?.({
          year,
          status: published
            ? legacy
              ? "migrated"
              : "published"
            : "lease-lost",
        });
      } catch {
        const cancelled = signal.aborted;
        try {
          await backend.finish(year, token, {
            phase: cancelled ? "queued" : "failed",
            attemptedAt,
            nextAttemptAt: new Date(
              now() + (cancelled ? 0 : REVENUE_RETRY_MS),
            ).toISOString(),
          });
        } catch {
          /* Lease expira; nenhuma versão válida é removida. */
        }
        options.log?.({
          year,
          status: cancelled
            ? "cancelled"
            : lease.signal.aborted
              ? "lease-lost"
              : "failed",
        });
      } finally {
        clearInterval(timer);
      }
      return true;
    }
    return false;
  };
}
