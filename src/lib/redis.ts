import "server-only";
import type { ContractsCacheStore } from "../core/contracts-cache";
import { createRedisCacheStore } from "../core/redis-cache-store";

let store: ContractsCacheStore | undefined;

export function getContractsCache(): ContractsCacheStore | null {
  const url = process.env.REDIS_URL?.trim();
  const password = process.env.REDIS_PASSWORD;
  if (!url && !password) return null;
  if (!url || !password) throw new Error("Configuração do cache incompleta");
  const address = new URL(url);
  if (
    !["redis:", "rediss:"].includes(address.protocol) ||
    address.username ||
    address.password ||
    address.search ||
    address.hash
  ) {
    throw new Error("Endereço Redis inválido; informe a senha separadamente");
  }
  if (!store) store = createRedisCacheStore({ url, password });
  return store;
}
