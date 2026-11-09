import { createPublicaExpenses } from "../publica/expenses";

export const fetchAriquemesExpensesPage =
  createPublicaExpenses("ariquemes").fetchPage;
