import "server-only";
import {
  createRedisCacheStore,
  type RedisScriptStore,
} from "../core/redis-cache-store";
import { redisConfig } from "../core/redis-config";
import { redisMunicipalReservation } from "../core/municipal-rate-limit";
import { configureMunicipalRateLimit } from "../connectors/porto-velho/transport";
import { publicaTransport } from "../connectors/publica/transport";
import { publicaMunicipalities } from "../core/municipal-sources";

let store: RedisScriptStore | undefined;
export function getContractsCache(): RedisScriptStore | null {
  const config = redisConfig(process.env);
  if (!config) return null;
  if (!store) {
    store = createRedisCacheStore(config);
    configureMunicipalRateLimit(redisMunicipalReservation(store, true));
    for (const municipality of publicaMunicipalities)
      publicaTransport(municipality).configureRateLimit(
        redisMunicipalReservation(store, true, municipality),
      );
  }
  return store;
}
