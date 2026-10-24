import { z } from "zod";
import { publicText, municipalUrl, civilDate } from "./public-values";
const cents = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
const text = publicText.nullable();
const rowCount = z.number().int().nonnegative().max(2000);
const partialCoverageSchema = z
  .object({
    reportedRows: rowCount,
    receivedRows: rowCount,
    repeatedRows: rowCount,
    assumedMissingRows: z.literal(1),
  })
  .strict();
const inconsistentCoverageSchema = z
  .object({
    reportedRows: rowCount,
    receivedRows: rowCount.positive(),
    repeatedRows: rowCount,
    rowDifference: rowCount.positive(),
  })
  .strict();
export const workSchema = z
  .object({
    id: z
      .string()
      .regex(
        /^(?:pvh-[1-9]\d*|(?:ji-parana|ariquemes)-(?:20\d{2}|2100)-[1-9]\d*)$/,
      ),
    sourceId: z.number().int().positive(),
    sourceYear: z.number().int().min(2000).max(2100).optional(),
    title: publicText.min(1),
    status: publicText,
    category: text,
    organization: text,
    organizationName: text,
    neighborhood: text,
    locations: z.array(publicText),
    contractedCents: cents,
    declaredValueCents: cents.optional(),
    paidCents: cents,
    toMeasureCents: cents,
    reportedExecutionPercent: z.number().finite().nullable(),
    contractNumber: text,
    contractId: z.number().int().positive().nullable(),
    contractDateFromWork: civilDate.nullable(),
    startedAt: civilDate.nullable(),
    agreementEndsAt: civilDate.nullable(),
    reportedCompletionAt: civilDate.nullable().optional(),
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
    complete: z.boolean(),
    coverage: z
      .union([partialCoverageSchema, inconsistentCoverageSchema])
      .optional(),
    total: rowCount,
    warnings: z.array(publicText),
  })
  .strict()
  .refine(
    (x) =>
      x.records.length === x.total &&
      new Set(x.records.map((r) => r.sourceId)).size === x.total,
  )
  .refine((catalog) => {
    if (catalog.complete) return catalog.coverage === undefined;
    const coverage = catalog.coverage;
    if (coverage && "rowDifference" in coverage) {
      const source =
        /^https:\/\/transparencia\.ariquemes\.ro\.gov\.br\/api\/obras\/(20\d{2}|2100)\/1$/.exec(
          catalog.sourceUrl,
        );
      return (
        source !== null &&
        coverage.reportedRows ===
          coverage.receivedRows + coverage.rowDifference &&
        coverage.receivedRows === catalog.total + coverage.repeatedRows &&
        catalog.total > 0 &&
        catalog.records.every(
          (work) =>
            work.sourceYear === Number(source[1]) &&
            work.id === `ariquemes-${source[1]}-${work.sourceId}` &&
            work.sourceUrl === catalog.sourceUrl,
        )
      );
    }
    if (
      !coverage ||
      coverage.reportedRows !== coverage.receivedRows + 1 ||
      coverage.receivedRows !== catalog.total + coverage.repeatedRows ||
      (coverage.receivedRows > 0 && catalog.total === 0)
    )
      return false;
    const source =
      /^https:\/\/transparencia\.ji-parana\.ro\.gov\.br\/api\/obras\/(20\d{2}|2100)\/2$/.exec(
        catalog.sourceUrl,
      );
    return (
      source !== null &&
      catalog.records.every(
        (work) =>
          work.sourceYear === Number(source[1]) &&
          work.id === `ji-parana-${source[1]}-${work.sourceId}` &&
          work.sourceUrl === catalog.sourceUrl,
      )
    );
  });
export type Work = z.infer<typeof workSchema>;
export type WorksCatalog = z.infer<typeof worksCatalogSchema>;
