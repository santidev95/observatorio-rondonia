import { z } from "zod";
import { publicText, municipalUrl, civilDate } from "./public-values";
const cents = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
const text = publicText.nullable();
export const workSchema = z
  .object({
    id: z.string().regex(/^pvh-[1-9]\d*$/),
    sourceId: z.number().int().positive(),
    title: publicText.min(1),
    status: publicText,
    category: text,
    organization: text,
    organizationName: text,
    neighborhood: text,
    locations: z.array(publicText),
    contractedCents: cents,
    paidCents: cents,
    toMeasureCents: cents,
    reportedExecutionPercent: z.number().finite().nullable(),
    contractNumber: text,
    contractId: z.number().int().positive().nullable(),
    contractDateFromWork: civilDate.nullable(),
    startedAt: civilDate.nullable(),
    agreementEndsAt: civilDate.nullable(),
    executionRaw: text,
    agreement: text,
    procurement: text,
    process: text,
    supplier: text,
    observation: text,
    measurements: z.array(
      z
        .object({
          title: publicText,
          amountCents: cents,
          paidAt: civilDate.nullable(),
        })
        .strict(),
    ),
    documents: z.array(
      z
        .object({
          title: publicText,
          url: municipalUrl,
          kind: z.enum(["obra", "contrato", "medicao"]),
        })
        .strict(),
    ),
    sourceUrl: municipalUrl,
    sourceUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
    issues: z.array(publicText),
  })
  .strict();
export const worksCatalogSchema = z
  .object({
    records: z.array(workSchema).max(2000),
    sourceUrl: municipalUrl,
    complete: z.literal(true),
    total: z.number().int().nonnegative(),
    warnings: z.array(publicText),
  })
  .strict()
  .refine(
    (x) =>
      x.records.length === x.total &&
      new Set(x.records.map((r) => r.sourceId)).size === x.total,
  );
export type Work = z.infer<typeof workSchema>;
export type WorksCatalog = z.infer<typeof worksCatalogSchema>;
