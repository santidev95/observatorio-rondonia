import { contractsQuerySchema, type ContractsQuery } from "./contracts";

export type ContractsDataErrorCode = "source-unavailable" | "invalid-query";

const errorMessages: Record<ContractsDataErrorCode, string> = {
  "source-unavailable":
    "A fonte oficial não respondeu com uma página válida. Tente novamente mais tarde.",
  "invalid-query": "Consulta inválida. Confira a página e o ano informados.",
};

export class ContractsDataError extends Error {
  readonly code: ContractsDataErrorCode;
  readonly status: number;

  constructor(code: ContractsDataErrorCode) {
    super(errorMessages[code]);
    this.name = "ContractsDataError";
    this.code = code;
    this.status = code === "invalid-query" ? 400 : 502;
  }
}

export function normalizeContractsQuery(query: unknown): ContractsQuery {
  const result = contractsQuerySchema.safeParse(query);
  if (!result.success) throw new ContractsDataError("invalid-query");
  return result.data;
}

export function parseContractsQuery(
  input: Record<string, unknown>,
): ContractsQuery {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => key !== "page" && key !== "ano")
  )
    throw new ContractsDataError("invalid-query");

  function integer(value: unknown, fallback: number | null): number | null {
    if (value === undefined || value === "") return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value))
      throw new ContractsDataError("invalid-query");
    return Number(value);
  }

  return normalizeContractsQuery({
    page: integer(input.page, 1),
    year: integer(input.ano, null),
  });
}

export function isContractId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ((/^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value))) ||
      /^(?:20\d{2}|2100)-[A-Za-z0-9_-]{2,90}$/.test(value))
  );
}
