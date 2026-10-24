import type { RedisScriptStore } from "./redis-cache-store";
import {
  assertRevenueYear,
  currentRevenueYear,
  revenuePrefix,
  parseRevenueVersion,
  REVENUE_LEASE_MS,
  type RevenueBackend,
  type RevenueAttempt,
  type RevenueVersion,
} from "./revenue-refresh";
import type { RevenueMunicipality } from "./revenues";

// Todas as publicações conferem o proprietário da lease no mesmo script que grava.
// Os timestamps de vencimento e agendamento são comparados com TIME do Redis.
const time = `local t=redis.call('TIME'); local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000);`;
const json = (raw: unknown) => {
  try {
    return typeof raw === "string" ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
};
export function createRedisRevenueBackend(
  store: RedisScriptStore,
  prefix?: string,
  municipality: RevenueMunicipality = "porto-velho",
): RevenueBackend {
  prefix ??= revenuePrefix(municipality);
  const queue = prefix + ":queue",
    heartbeat = prefix + ":heartbeat";
  const keys = (year: number) => {
    assertRevenueYear(year);
    return [
      prefix + `:year:${year}:snapshot`,
      prefix + `:year:${year}:attempt`,
      prefix + `:year:${year}:lock`,
      queue,
    ];
  };
  const end = async (
    year: number,
    token: string,
    next: RevenueAttempt,
    version?: RevenueVersion,
  ) => {
    const response = await store.eval(
      `${time}
      if redis.call('GET',KEYS[3])~=ARGV[1] then return 0 end
      if ARGV[3]~='' then
        local ttl=tonumber(ARGV[4])-now;
        if ttl<=0 then return 0 end
        redis.call('SET',KEYS[1],ARGV[3],'PX',ttl);
      end
      redis.call('SET',KEYS[2],ARGV[2],'EX',604800);
      if ARGV[7]=='remove' then redis.call('ZREM',KEYS[4],ARGV[6]); else redis.call('ZADD',KEYS[4],ARGV[5],ARGV[6]); end
      redis.call('DEL',KEYS[3]); return 1;`,
      keys(year),
      [
        token,
        JSON.stringify(next),
        version ? JSON.stringify(version) : "",
        version ? String(Date.parse(version.retainUntil)) : "0",
        String(Date.parse(next.nextAttemptAt)),
        String(year),
        version && year !== currentRevenueYear(Date.parse(version.fetchedAt))
          ? "remove"
          : "keep",
      ],
    );
    return response === 1;
  };
  return {
    async read(year) {
      const raw = await store.eval(
        `return {redis.call('GET',KEYS[1]) or '',redis.call('GET',KEYS[2]) or '',redis.call('PTTL',KEYS[3]),redis.call('PTTL',KEYS[4])};`,
        [...keys(year).slice(0, 3), heartbeat],
        [],
      );
      if (!Array.isArray(raw) || raw.length !== 4)
        throw new Error("Cache indisponível");
      const attempt = json(raw[1]);
      if (attempt && typeof attempt === "object" && "retryAtMs" in attempt)
        delete attempt.retryAtMs;
      return {
        version: json(raw[0]),
        attempt,
        running: Number(raw[2]) > 0,
        workerOnline: Number(raw[3]) > 0,
      };
    },
    async request(year) {
      await store.eval(
        `${time}
        local due=now; local raw=redis.call('GET',KEYS[2]);
        if raw then local ok,s=pcall(cjson.decode,raw); if ok and type(s)=='table' and s.phase=='failed' and s.retryAtMs then due=math.min(now+300000,math.max(now,tonumber(s.retryAtMs) or now)); end end
        local score=redis.call('ZSCORE',KEYS[4],ARGV[1]);
        if not score or tonumber(score)>due then redis.call('ZADD',KEYS[4],due,ARGV[1]); end
        return 1;`,
        keys(year),
        [String(year)],
      );
    },
    async ensureCurrent(year) {
      await store.eval(
        `return redis.call('ZADD',KEYS[1],'NX',0,ARGV[1]);`,
        [queue],
        [String(year)],
      );
    },
    async due() {
      const raw = await store.eval(
        `${time} return redis.call('ZRANGEBYSCORE',KEYS[1],'-inf',now,'LIMIT',0,101);`,
        [queue],
        [],
      );
      if (!Array.isArray(raw)) throw new Error("Fila indisponível");
      return raw
        .map(Number)
        .filter((y) => Number.isInteger(y) && y >= 2000 && y <= 2100);
    },
    async claim(year, token, attempt) {
      return (
        (await store.eval(
          `${time}
        local due=redis.call('ZSCORE',KEYS[4],ARGV[1]);
        if not due or tonumber(due)>now then return 0 end
        if not redis.call('SET',KEYS[3],ARGV[2],'NX','PX',ARGV[3]) then return 0 end
        redis.call('SET',KEYS[2],ARGV[4],'EX',604800); return 1;`,
          keys(year),
          [
            String(year),
            token,
            String(REVENUE_LEASE_MS),
            JSON.stringify(attempt),
          ],
        )) === 1
      );
    },
    async renew(year, token) {
      return (
        (await store.eval(
          `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end return redis.call('PEXPIRE',KEYS[1],ARGV[2]);`,
          [keys(year)[2]],
          [token, String(REVENUE_LEASE_MS)],
        )) === 1
      );
    },
    publish: (year, token, version, next) =>
      parseRevenueVersion(version, year, Date.now(), municipality)
        ? end(year, token, next, version)
        : Promise.resolve(false),
    async finish(year, token, next) {
      // retryAtMs é interno; o schema público lê apenas campos conhecidos.
      const stored =
        next.phase === "failed"
          ? { ...next, retryAtMs: Date.parse(next.nextAttemptAt) }
          : next;
      return end(year, token, stored);
    },
    async heartbeat(revision) {
      await store.set(heartbeat, { revision }, 60);
    },
    async healthy(revision) {
      const raw = await store.get(heartbeat);
      return (
        !!raw &&
        typeof raw === "object" &&
        "revision" in raw &&
        raw.revision === revision
      );
    },
    legacy: (year) => {
      assertRevenueYear(year);
      if (municipality !== "porto-velho") return Promise.resolve(null);
      return store.get(
        `observatorio:RO:porto-velho:receitas:v1:year:${year}:portal:12535`,
      );
    },
  };
}
