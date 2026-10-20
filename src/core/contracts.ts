import { z } from "zod";

export const CONTRACTS_PAGE_SIZE = 25;

export type ContractsQuery = {
  page: number;
  year: number | null;
};

export const contractsQuerySchema = z
  .object({
    page: z.number().int().positive().max(10000),
    year: z.number().int().min(2000).max(2100).nullable(),
  })
  .strict();

// O contrato público inclui somente campos normalizados e documentos minimizados.
export function containsPersonalDocument(value: string): boolean {
  return /(?<!\d)\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}(?!\d)/u.test(value);
}

const publicText = z
  .string()
  .refine((value) => !containsPersonalDocument(value), {
    message: "O texto público não pode conter CPF completo.",
  });
const nullableText = publicText.nullable();
const cents = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  })
  .nullable();
const publicUrl = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      let decoded = value;
      for (let attempt = 0; attempt < 3; attempt++) {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      }
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !containsPersonalDocument(decoded) &&
        ![...url.searchParams.keys()].some((key) => /cpf/i.test(key))
      );
    } catch {
      return false;
    }
  });

const cnpj = z
  .string()
  .regex(/^[A-Z0-9]{12}[0-9]{2}$/)
  .nullable();
const sourceUpdatedAt = z.iso.datetime({ offset: true }).nullable();

export const contractRecordSchema = z
  .object({
    id: z.string().regex(/^[1-9]\d*$/),
    number: nullableText,
    year: z.number().int().min(1).max(9999).nullable(),
    object: nullableText,
    department: nullableText,
    departmentName: nullableText,
    contractorName: nullableText,
    contractorCnpj: cnpj,
    suppliers: z.array(z.object({ name: nullableText, cnpj }).strict()),
    status: nullableText,
    process: nullableText,
    category: nullableText,
    addendumReported: z.boolean().nullable(),
    observation: nullableText,
    sourceUrl: publicUrl,
    sourceUpdatedAt,
    amountCents: cents,
    paidAmountCents: cents,
    executedAmountCents: cents,
    signedOn: date,
    startsOn: date,
    endsOn: date,
    documents: z.array(
      z
        .object({
          label: publicText,
          url: publicUrl,
          status: nullableText,
          publishedOn: date,
          publicationReference: nullableText,
          signedOn: date,
          startsOn: date,
          endsOn: date,
          amountCents: cents,
        })
        .strict(),
    ),
    procurement: z
      .object({
        id: z.string().regex(/^[1-9]\d*$/),
        title: publicText,
        url: publicUrl,
      })
      .strict()
      .nullable(),
    issues: z.array(publicText),
  })
  .strict();

export type ContractRecord = z.infer<typeof contractRecordSchema>;

export const contractPageSchema = z
  .object({
    warnings: z.array(publicText),
    records: z.array(contractRecordSchema).max(CONTRACTS_PAGE_SIZE),
    pagination: z
      .object({
        currentPage: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        lastPage: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        perPage: z.literal(CONTRACTS_PAGE_SIZE),
        total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      })
      .strict(),
    sourceUrl: publicUrl,
  })
  .strict()
  .superRefine((page, context) => {
    const { currentPage, lastPage, total } = page.pagination;
    const expectedLast = Math.max(1, Math.ceil(total / CONTRACTS_PAGE_SIZE));
    const expectedCount = Math.min(
      CONTRACTS_PAGE_SIZE,
      Math.max(0, total - (currentPage - 1) * CONTRACTS_PAGE_SIZE),
    );
    if (lastPage !== expectedLast || currentPage > lastPage)
      context.addIssue({
        code: "custom",
        message: "Metadados de paginação inconsistentes.",
      });
    if (page.records.length !== expectedCount)
      context.addIssue({
        code: "custom",
        message: "Página incompleta.",
      });
    if (
      new Set(page.records.map((record) => record.id)).size !==
      page.records.length
    )
      context.addIssue({
        code: "custom",
        message: "IDs oficiais duplicados.",
      });
  });

export type ContractPage = z.infer<typeof contractPageSchema>;
