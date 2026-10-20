import { z } from "zod";
import {
  publicText,
  civilDate,
  municipalUrl,
  publicAccountingText,
} from "./public-values";
const count = z.number().int().nonnegative().max(200000);
const cents = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
export const revenueEntrySchema = z
  .object({
    id: z.string().regex(/^pvh-receita-[a-f0-9]{24}$/),
    year: z.number().int().min(2000).max(2100),
    unitId: z.string().regex(/^[A-Za-z0-9-]{1,100}$/),
    unitName: publicText,
    account: publicAccountingText,
    category: publicAccountingText,
    origin: publicAccountingText,
    fundingSource: publicAccountingText,
    kind: z.enum(["budget", "extra", "unknown"]),
    plannedCents: cents,
    plannedLines: count,
    missingPlannedValues: count,
    months: z
      .array(
        z
          .object({
            month: z.number().int().min(1).max(12),
            cents,
            documents: count.min(1),
            missingValues: count,
          })
          .strict()
          .refine((m) => m.missingValues <= m.documents),
      )
      .max(12),
    inLatestSnapshot: z.literal(true),
  })
  .strict()
  .refine(
    (e) =>
      new Set(e.months.map((m) => m.month)).size === e.months.length &&
      e.missingPlannedValues <= e.plannedLines,
  );
export const revenueSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    portalId: z.literal(12535),
    generatedAt: z.iso.datetime(),
    lastAttemptAt: z.iso.datetime(),
    syncStatus: z.literal("ok"),
    syncError: z.null(),
    years: z
      .array(
        z
          .object({
            year: z.number().int().min(2000).max(2100),
            receipts: count,
            planned: count,
            lastDocumentDate: civilDate.nullable(),
          })
          .strict(),
      )
      .length(1),
    entries: z.array(revenueEntrySchema).max(200000),
    sourceUrl: municipalUrl,
  })
  .strict()
  .refine(
    (s) =>
      s.entries.every((e) => e.year === s.years[0].year) &&
      new Set(s.entries.map((e) => e.id)).size === s.entries.length &&
      s.entries.reduce((n, e) => n + e.plannedLines, 0) ===
        s.years[0].planned &&
      s.entries.reduce(
        (n, e) => n + e.months.reduce((a, m) => a + m.documents, 0),
        0,
      ) === s.years[0].receipts,
  );
export type RevenueEntry = z.infer<typeof revenueEntrySchema>;
export type RevenueSnapshot = z.infer<typeof revenueSnapshotSchema>;
