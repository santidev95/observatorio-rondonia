import "server-only";
import { connection } from "next/server";
import { createPublicaExpenses } from "../connectors/publica/expenses";
import { readSource } from "../core/contracts-reader";
import { normalizeExpensesQuery, type ExpensesQuery } from "../core/expenses";
import { createCachedExpensesReader } from "../core/expenses-cache";
import {
  expensesMunicipalities,
  type ExpensesMunicipality,
} from "../core/municipal-sources";
import { getContractsCache } from "./redis";

const readers = new Map(
  expensesMunicipalities.map((municipality) => {
    const connector = createPublicaExpenses(municipality);
    return [
      municipality,
      createCachedExpensesReader({
        municipality,
        cache: getContractsCache,
        read: (query) =>
          readSource((signal) => connector.fetchPage(query, signal), {
            timeoutMs: 30_000,
          }),
      }),
    ] as const;
  }),
);

export async function getExpenses(
  query: ExpensesQuery,
  municipality: ExpensesMunicipality,
) {
  const validated = normalizeExpensesQuery(query);
  await connection();
  return readers.get(municipality)!(validated);
}
