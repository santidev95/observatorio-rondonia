import "server-only";
import { connection } from "next/server";
import { createRevenueReader } from "../core/revenue-refresh";
import { createRedisRevenueBackend } from "../core/redis-revenue-backend";
import { getContractsCache } from "./redis";
const read = createRevenueReader(() => {
  const store = getContractsCache();
  return store ? createRedisRevenueBackend(store) : null;
});
export async function getRevenues(year: number) {
  await connection();
  return read(year);
}
