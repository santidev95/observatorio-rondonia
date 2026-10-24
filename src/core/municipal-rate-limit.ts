import type { RedisScriptStore } from "./redis-cache-store";
export function redisMunicipalReservation(
  store: RedisScriptStore,
  failOpen: boolean,
  municipality = "porto-velho",
) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(municipality))
    throw new Error("Município inválido");
  const key = `observatorio:RO:${municipality}:source:v1:pace`;
  return async () => {
    try {
      const wait = await store.eval(
        `
        local t=redis.call('TIME'); local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000);
        local start=math.max(now,tonumber(redis.call('GET',KEYS[1])) or now);
        if start-now>11000 then return -1 end
        redis.call('SET',KEYS[1],start+1100,'PX',start-now+2200); return start-now;
      `,
        [key],
        [],
      );
      if (typeof wait !== "number")
        throw new Error("Limite de consultas indisponível");
      return wait;
    } catch {
      if (failOpen) return null;
      throw new Error("Limite de consultas indisponível");
    }
  };
}
