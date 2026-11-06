import { z } from "zod";
import { cachedReader, type ContractsCacheStore } from "./contracts-cache";
import { ContractsDataError } from "./contracts-query";
import {
  expensePageSchema,
  normalizeExpensesQuery,
  type ExpensePage,
  type ExpensesQuery,
} from "./expenses";
import { publicaSource, type ExpensesMunicipality } from "./municipal-sources";

type Result = { data: ExpensePage; fetchedAt: string };
type Options = {
  cache: () => ContractsCacheStore | null;
  now?: () => number;
  cacheTimeoutMs?: number;
  municipality: ExpensesMunicipality;
  read: (query: ExpensesQuery) => Promise<Result>;
};

export function expensesCacheKey(
  input: ExpensesQuery,
  municipality: ExpensesMunicipality,
): string {
  const query = normalizeExpensesQuery(input);
  return `observatorio:RO:${municipality}:despesas:v1:year:${query.year}:view:${query.view}:page:${query.page}`;
}

export function createCachedExpensesReader(options: Options) {
  const { municipality } = options;
  const source = publicaSource(municipality);
  const schema = z
    .object({ data: expensePageSchema, fetchedAt: z.iso.datetime() })
    .strict();
  const read = cachedReader(
    options,
    schema,
    ({ data }, key) => {
      const url = new URL(data.sourceUrl);
      return (
        url.origin === source.apiOrigin &&
        url.pathname ===
          `/api/despesas/${data.view}/${data.year}/${source.company}` &&
        url.searchParams.size === 1 &&
        url.searchParams.get("page") === String(data.pagination.currentPage) &&
        data.records.every(
          (record) =>
            record.sourceYear === data.year &&
            record.id.startsWith(`${data.year}-`),
        ) &&
        expensesCacheKey(
          {
            page: data.pagination.currentPage,
            year: data.year,
            view: data.view,
          },
          municipality,
        ) === key
      );
    },
    () => true,
  );
  return (input: ExpensesQuery) => {
    const query = normalizeExpensesQuery(input);
    return read(expensesCacheKey(query, municipality), async () => {
      const result = schema.safeParse(await options.read(query));
      if (!result.success) throw new ContractsDataError("source-unavailable");
      return result.data;
    });
  };
}
