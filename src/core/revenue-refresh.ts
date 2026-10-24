import { z } from "zod";
import {
  revenueSnapshotSchema,
  revenueSourceUrl,
  type RevenueMunicipality,
  type RevenueSnapshot,
} from "./revenues";

export const REVENUE_RETENTION_MS = 7 * 24 * 3600_000;
export const REVENUE_RETRY_MS = 5 * 60_000;
export const REVENUE_LEASE_MS = 60_000;
export const REVENUE_PREFIX = "observatorio:RO:porto-velho:receitas:v2";
export const revenuePrefix = (
  municipality: RevenueMunicipality = "porto-velho",
) => `observatorio:RO:${municipality}:receitas:v2`;
export function assertRevenueYear(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw new Error("Exercício inválido");
}
export function currentRevenueYear(now = Date.now()) {
  return Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "America/Porto_Velho",
    }).format(now),
  );
}
export function revenueFreshnessMs(year: number, now: number) {
  return year === currentRevenueYear(now) ? 3600_000 : 24 * 3600_000;
}
export const revenueVersionSchema = z
  .object({
    version: z.literal(2),
    year: z.number().int().min(2000).max(2100),
    data: revenueSnapshotSchema,
    fetchedAt: z.iso.datetime(),
    refreshAfter: z.iso.datetime(),
    retainUntil: z.iso.datetime(),
  })
  .strict();
export type RevenueVersion = z.infer<typeof revenueVersionSchema>;
export const revenueAttemptSchema = z
  .object({
    phase: z.enum(["idle", "queued", "running", "failed"]),
    attemptedAt: z.iso.datetime().nullable(),
    nextAttemptAt: z.iso.datetime(),
  })
  .strict();
export type RevenueAttempt = z.infer<typeof revenueAttemptSchema>;
export type RevenueRefreshMetadata = {
  status: RevenueAttempt["phase"] | "unavailable";
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  workerOnline: boolean;
};
export type RevenueStatus = {
  state: "ready" | "pending" | "unavailable";
  fetchedAt: string | null;
  cache: {
    status: "hit" | "stale" | "pending" | "unavailable";
    expiresAt: string | null;
    retainedUntil: string | null;
  };
  refresh: RevenueRefreshMetadata;
};
export type RevenueReadResult = RevenueStatus & {
  data: RevenueSnapshot | null;
};
export interface RevenueBackend {
  read(year: number): Promise<{
    version: unknown;
    attempt: unknown;
    running: boolean;
    workerOnline: boolean;
  }>;
  request(year: number): Promise<void>;
  ensureCurrent(year: number): Promise<void>;
  due(): Promise<number[]>;
  claim(year: number, token: string, attempt: RevenueAttempt): Promise<boolean>;
  renew(year: number, token: string): Promise<boolean>;
  publish(
    year: number,
    token: string,
    version: RevenueVersion,
    next: RevenueAttempt,
  ): Promise<boolean>;
  finish(year: number, token: string, next: RevenueAttempt): Promise<boolean>;
  heartbeat(revision: string): Promise<void>;
  healthy(revision: string): Promise<boolean>;
  legacy(year: number): Promise<unknown>;
}
export function parseRevenueVersion(
  raw: unknown,
  year: number,
  now: number,
  municipality: RevenueMunicipality = "porto-velho",
): RevenueVersion | null {
  const p = revenueVersionSchema.safeParse(raw);
  if (!p.success) return null;
  const v = p.data,
    fetched = Date.parse(v.fetchedAt),
    fresh = Date.parse(v.refreshAfter);
  if (
    v.year !== year ||
    v.data.years[0].year !== year ||
    v.data.sourceUrl !== revenueSourceUrl(municipality, year) ||
    (municipality !== "porto-velho"
      ? v.data.municipality !== municipality
      : v.data.portalId !== 12535) ||
    fetched > now ||
    Date.parse(v.data.generatedAt) > fetched ||
    fresh - fetched !== revenueFreshnessMs(year, fetched) ||
    Date.parse(v.retainUntil) !== fetched + REVENUE_RETENTION_MS ||
    now >= Date.parse(v.retainUntil)
  )
    return null;
  return v;
}
export function makeRevenueVersion(
  year: number,
  data: RevenueSnapshot,
  fetchedAt: string,
  municipality: RevenueMunicipality = "porto-velho",
): RevenueVersion {
  const at = Date.parse(fetchedAt);
  const raw = {
    version: 2,
    year,
    data,
    fetchedAt,
    refreshAfter: new Date(at + revenueFreshnessMs(year, at)).toISOString(),
    retainUntil: new Date(at + REVENUE_RETENTION_MS).toISOString(),
  };
  const parsed = parseRevenueVersion(raw, year, at, municipality);
  if (!parsed) throw new Error("Resumo de receitas inválido");
  return parsed;
}
export function parseLegacyRevenue(
  raw: unknown,
  year: number,
  now: number,
  municipality: RevenueMunicipality = "porto-velho",
): RevenueVersion | null {
  if (municipality !== "porto-velho") return null;
  const legacy = z
    .object({
      key: z.string(),
      result: z
        .object({ data: revenueSnapshotSchema, fetchedAt: z.iso.datetime() })
        .strict(),
      expiresAt: z.iso.datetime(),
    })
    .strict()
    .safeParse(raw);
  if (!legacy.success) return null;
  const v = legacy.data;
  if (
    v.key !==
      `observatorio:RO:porto-velho:receitas:v1:year:${year}:portal:12535` ||
    Date.parse(v.expiresAt) !== Date.parse(v.result.fetchedAt) + 3600_000 ||
    now >= Date.parse(v.expiresAt)
  )
    return null;
  try {
    return parseRevenueVersion(
      makeRevenueVersion(year, v.result.data, v.result.fetchedAt),
      year,
      now,
    );
  } catch {
    return null;
  }
}

export function createRevenueReader(
  backend: () => RevenueBackend | null,
  now: () => number = Date.now,
  municipality: RevenueMunicipality = "porto-velho",
) {
  return async (year: number): Promise<RevenueReadResult> => {
    assertRevenueYear(year);
    const empty: RevenueReadResult = {
      state: "unavailable",
      data: null,
      fetchedAt: null,
      cache: { status: "unavailable", expiresAt: null, retainedUntil: null },
      refresh: {
        status: "unavailable",
        lastAttemptAt: null,
        nextAttemptAt: null,
        workerOnline: false,
      },
    };
    try {
      const store = backend();
      if (!store) return empty;
      const raw = await store.read(year),
        time = now();
      const version = parseRevenueVersion(
        raw.version,
        year,
        time,
        municipality,
      );
      const attempt = revenueAttemptSchema.safeParse(raw.attempt);
      const fresh = version !== null && time < Date.parse(version.refreshAfter);
      let queued = false;
      if (!fresh) {
        try {
          await store.request(year);
          queued = true;
        } catch {
          /* Versão válida continua disponível. */
        }
      }
      const status = raw.running
        ? "running"
        : attempt.success && attempt.data.phase === "failed"
          ? "failed"
          : fresh
            ? "idle"
            : queued
              ? "queued"
              : "unavailable";
      return {
        state: version
          ? "ready"
          : queued || raw.running
            ? "pending"
            : "unavailable",
        data: version?.data ?? null,
        fetchedAt: version?.fetchedAt ?? null,
        cache: {
          status: version
            ? fresh
              ? "hit"
              : "stale"
            : queued
              ? "pending"
              : "unavailable",
          expiresAt: version?.refreshAfter ?? null,
          retainedUntil: version?.retainUntil ?? null,
        },
        refresh: {
          status,
          lastAttemptAt: attempt.success ? attempt.data.attemptedAt : null,
          nextAttemptAt: attempt.success
            ? attempt.data.nextAttemptAt
            : queued
              ? new Date(time).toISOString()
              : null,
          workerOnline: raw.workerOnline,
        },
      };
    } catch {
      return empty;
    }
  };
}
