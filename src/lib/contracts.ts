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
import { createPublicaContracts } from "../connectors/publica/contracts";
import {
  isMunicipalContractId,
  municipalContractsQuery,
  publicaMunicipalities,
  type DataMunicipality,
} from "../core/municipal-sources";

const readContracts = createCachedContractsReader({
  read: createContractsReader({ load: fetchPortoVelhoContractsPage }),
  cache: getContractsCache,
});
const readContract = createCachedContractReader({
  read: createContractReader({ load: fetchPortoVelhoContract }),
  cache: getContractsCache,
});
const publicaReaders = new Map(
  publicaMunicipalities.map((municipality) => {
    const connector = createPublicaContracts(municipality);
    return [
      municipality,
      {
        page: createCachedContractsReader({
          read: createContractsReader({
            load: connector.fetchPage,
            timeoutMs: 30_000,
          }),
          cache: getContractsCache,
          municipality,
        }),
        detail: createCachedContractReader({
          read: createContractReader({
            load: connector.fetchContract,
            timeoutMs: 90_000,
          }),
          cache: getContractsCache,
          municipality,
        }),
      },
    ] as const;
  }),
);

export async function getContracts(
  query: ContractsQuery,
  municipality: DataMunicipality = "porto-velho",
) {
  const validated = municipalContractsQuery(
    normalizeContractsQuery(query),
    municipality,
  );
  await connection();
  return municipality === "porto-velho"
    ? readContracts(validated)
    : publicaReaders.get(municipality)!.page(validated);
}

export async function getContract(
  id: string,
  municipality: DataMunicipality = "porto-velho",
) {
  if (!isContractId(id) || !isMunicipalContractId(id, municipality))
    throw new ContractsDataError("invalid-query");
  await connection();
  return municipality === "porto-velho"
    ? readContract(id)
    : publicaReaders.get(municipality)!.detail(id);
}
