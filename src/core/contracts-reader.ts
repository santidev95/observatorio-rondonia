import {
  normalizeContractsQuery,
  ContractsDataError,
  isContractId,
} from "./contracts-query";
import type { ContractPage, ContractRecord, ContractsQuery } from "./contracts";
import { MunicipalSourceError } from "./municipal-source-error";

export type ContractsResult = { data: ContractPage; fetchedAt: string };
export type ContractResult = { data: ContractRecord | null; fetchedAt: string };

type TimingOptions = { now?: () => number; timeoutMs?: number };

export async function readSource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  options: TimingOptions,
): Promise<{ data: T; fetchedAt: string }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const data = await Promise.race([
      Promise.resolve().then(() => load(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new ContractsDataError("source-unavailable"));
        }, options.timeoutMs ?? 12_000);
      }),
    ]);
    return {
      data,
      fetchedAt: new Date((options.now ?? Date.now)()).toISOString(),
    };
  } catch (error) {
    controller.abort();
    if (error instanceof MunicipalSourceError) throw error;
    throw new ContractsDataError("source-unavailable");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function createContractsReader(
  options: TimingOptions & {
    load: (query: ContractsQuery, signal: AbortSignal) => Promise<ContractPage>;
  },
) {
  return async function readContracts(
    input: ContractsQuery,
  ): Promise<ContractsResult> {
    const query = normalizeContractsQuery(input);
    return readSource((signal) => options.load(query, signal), options);
  };
}

export function createContractReader(
  options: TimingOptions & {
    load: (id: string, signal: AbortSignal) => Promise<ContractRecord | null>;
  },
) {
  return async function readContract(id: string): Promise<ContractResult> {
    if (!isContractId(id)) throw new ContractsDataError("invalid-query");
    return readSource((signal) => options.load(id, signal), options);
  };
}
