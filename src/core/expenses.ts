import { z } from "zod";
import { ContractsDataError } from "./contracts-query";
import { municipalYear } from "./municipal-sources";
import { civilDate, municipalUrl, publicText } from "./public-values";

// A fonte publica dez registros por página e cada consulta lê uma única página.
export const EXPENSES_PAGE_SIZE = 10;
export const expenseViews = ["empenhos", "pagamentos"] as const;
export type ExpenseView = (typeof expenseViews)[number];

export const expensesQuerySchema = z
  .object({
    page: z.number().int().positive().max(10000),
    year: z.number().int().min(2000).max(2100),
    view: z.enum(expenseViews),
  })
  .strict();
export type ExpensesQuery = z.infer<typeof expensesQuerySchema>;

export function normalizeExpensesQuery(query: unknown): ExpensesQuery {
  const result = expensesQuerySchema.safeParse(query);
  if (!result.success) throw new ContractsDataError("invalid-query");
  return result.data;
}

export function parseExpensesQuery(
  input: Record<string, unknown>,
  currentYear = municipalYear(),
): ExpensesQuery {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => key !== "page" && key !== "ano" && key !== "visao",
    )
  )
    throw new ContractsDataError("invalid-query");

  function integer(value: unknown, fallback: number): number {
    if (value === undefined || value === "") return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value))
      throw new ContractsDataError("invalid-query");
    return Number(value);
  }

  return normalizeExpensesQuery({
    page: integer(input.page, 1),
    year: integer(input.ano, currentYear),
    view: input.visao === undefined ? "empenhos" : input.visao,
  });
}

// Empenhos aparecem negativos em anulações; o sinal publicado é preservado.
const signedCents = z
  .number()
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
const text = publicText.nullable();
const cnpj = z
  .string()
  .regex(/^[A-Z0-9]{12}[0-9]{2}$/)
  .nullable();
const date = civilDate.nullable();
const sourceYear = z.number().int().min(2000).max(2100);
const commitmentYear = z.number().int().min(1).max(9999).nullable();

const recordBase = {
  sourceYear,
  commitmentNumber: z.number().int().nonnegative(),
  commitmentType: text,
  commitmentYear,
  process: text,
  creditorName: text,
  creditorCnpj: cnpj,
  managingEntity: text,
  department: text,
  budgetFunction: text,
  program: text,
  action: text,
  economicCategory: text,
  fundingSource: text,
};

export const commitmentRecordSchema = z
  .object({
    ...recordBase,
    id: z.string().regex(/^(?:20\d{2}|2100)-\d{1,16}$/),
    committedOn: date,
    committedCents: signedCents,
    canceledCents: signedCents,
    liquidatedCents: signedCents,
    paidCents: signedCents,
    retainedCents: signedCents,
  })
  .strict();
export type CommitmentRecord = z.infer<typeof commitmentRecordSchema>;

export const paymentRecordSchema = z
  .object({
    ...recordBase,
    id: z.string().regex(/^(?:20\d{2}|2100)-\d{1,16}-\d{1,16}-\d{1,16}$/),
    settledOn: date,
    dueOn: date,
    paidOn: date,
    paidCents: signedCents,
  })
  .strict();
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;

const pagination = z
  .object({
    currentPage: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    lastPage: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    perPage: z.literal(EXPENSES_PAGE_SIZE),
    total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

const pageBase = {
  year: sourceYear,
  warnings: z.array(publicText),
  pagination,
  sourceUrl: municipalUrl,
};

export const expensePageSchema = z
  .discriminatedUnion("view", [
    z
      .object({
        ...pageBase,
        view: z.literal("empenhos"),
        records: z.array(commitmentRecordSchema).max(EXPENSES_PAGE_SIZE),
        totals: z
          .object({
            committedCents: signedCents,
            liquidatedCents: signedCents,
            paidCents: signedCents,
            canceledCents: signedCents,
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        ...pageBase,
        view: z.literal("pagamentos"),
        records: z.array(paymentRecordSchema).max(EXPENSES_PAGE_SIZE),
        totals: z.object({ paidCents: signedCents }).strict(),
      })
      .strict(),
  ])
  .superRefine((page, context) => {
    const { currentPage, lastPage, total } = page.pagination;
    const expectedLast = Math.max(1, Math.ceil(total / EXPENSES_PAGE_SIZE));
    const expectedCount = Math.min(
      EXPENSES_PAGE_SIZE,
      Math.max(0, total - (currentPage - 1) * EXPENSES_PAGE_SIZE),
    );
    if (lastPage !== expectedLast || currentPage > lastPage)
      context.addIssue({
        code: "custom",
        message: "Metadados de paginação inconsistentes.",
      });
    if (page.records.length !== expectedCount)
      context.addIssue({ code: "custom", message: "Página incompleta." });
    if (
      new Set(page.records.map((record) => record.id)).size !==
      page.records.length
    )
      context.addIssue({
        code: "custom",
        message: "Identificadores repetidos na página.",
      });
  });
export type ExpensePage = z.infer<typeof expensePageSchema>;
