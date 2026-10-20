import "server-only";
import {
  createCachedContractsReader,
  createCachedContractReader,
} from "../core/contracts-cache";
import { getContractsCache } from "./redis";
import { connection } from "next/server";
import {
  createContractsReader,
  createContractReader,
} from "../core/contracts-reader";
import {
  normalizeContractsQuery,
  isContractId,
  ContractsDataError,
} from "../core/contracts-query";
import type { ContractsQuery } from "../core/contracts";
import {
  fetchPortoVelhoContractsPage,
  fetchPortoVelhoContract,
} from "../connectors/porto-velho/contracts";

const readContracts = createCachedContractsReader({
  read: createContractsReader({ load: fetchPortoVelhoContractsPage }),
  cache: getContractsCache,
});
const readContract = createCachedContractReader({
  read: createContractReader({ load: fetchPortoVelhoContract }),
  cache: getContractsCache,
});

export async function getContracts(query: ContractsQuery) {
  const validated = normalizeContractsQuery(query);
  await connection();
  return readContracts(validated);
}

export async function getContract(id: string) {
  if (!isContractId(id)) throw new ContractsDataError("invalid-query");
  await connection();
  return readContract(id);
}
