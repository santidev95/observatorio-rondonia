import "server-only";
import { connection } from "next/server";
import { createRevenueReader } from "../core/revenue-refresh";
import { createRedisRevenueBackend } from "../core/redis-revenue-backend";
import { getContractsCache } from "./redis";
import {
  revenueMunicipalities,
  type RevenueMunicipality,
} from "../core/revenues";
const readers = Object.fromEntries(
  revenueMunicipalities.map((municipality) => [
    municipality,
    createRevenueReader(
      () => {
        const store = getContractsCache();
        return store
          ? createRedisRevenueBackend(store, undefined, municipality)
          : null;
      },
      Date.now,
      municipality,
    ),
  ]),
);
export async function getRevenues(
  year: number,
  municipality: RevenueMunicipality = "porto-velho",
) {
  await connection();
  return readers[municipality](year);
}
