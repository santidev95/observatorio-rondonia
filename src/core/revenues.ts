import { z } from "zod";
import {
  publicText,
  civilDate,
  municipalUrl,
  publicAccountingText,
} from "./public-values";
import { publicaSource } from "./municipal-sources";
const count = z.number().int().nonnegative().max(200000);
const cents = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
export const revenueMunicipalities = [
  "porto-velho",
  "ji-parana",
  "ariquemes",
] as const;
export type RevenueMunicipality = (typeof revenueMunicipalities)[number];
export const revenueSourceUrl = (
  municipality: RevenueMunicipality,
  year: number,
) => {
  if (municipality === "porto-velho")
    return `https://api.portovelho.ro.gov.br/api/v1/receitas?portal_id=12535&ano=${year}`;
  const source = publicaSource(municipality);
  return `${source.apiOrigin}/api/receitas/arrecadadas-diretamente/${year}/${source.company}`;
};
export const revenueEntrySchema = z
  .object({
    id: z.string().regex(/^(?:pvh|ji|ari)-receita-[a-f0-9]{24}$/),
    sourceId: z
      .string()
      .regex(/^[0-9.]{1,100}$/)
      .optional(),
    sourceUrl: municipalUrl.optional(),
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
    annual: z
      .object({ cents, records: count.min(1), missingValues: count })
      .strict()
      .refine((a) => a.missingValues <= a.records)
      .optional(),
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
      e.missingPlannedValues <= e.plannedLines &&
      (!e.annual || e.months.length === 0),
  );
export const revenueSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    portalId: z.union([z.literal(12535), z.null()]),
    municipality: z.enum(revenueMunicipalities).optional(),
    aggregation: z.enum(["documents", "annual-accounts"]).optional(),
    coverage: z.enum(["complete-source", "partial"]).optional(),
    warnings: z.array(publicText).max(10).optional(),
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
  .refine((s) => {
    const source =
      s.municipality === "ji-parana" || s.municipality === "ariquemes"
        ? publicaSource(s.municipality)
        : null;
    return (
      s.entries.every((e) => e.year === s.years[0].year) &&
      new Set(s.entries.map((e) => e.id)).size === s.entries.length &&
      s.entries.reduce((n, e) => n + e.plannedLines, 0) ===
        s.years[0].planned &&
      s.entries.reduce(
        (n, e) =>
          n +
          (e.annual?.records ?? e.months.reduce((a, m) => a + m.documents, 0)),
        0,
      ) === s.years[0].receipts &&
      (s.portalId === 12535
        ? (s.municipality === undefined || s.municipality === "porto-velho") &&
          s.aggregation !== "annual-accounts" &&
          s.entries.every(
            (e) => e.id.startsWith("pvh-receita-") && !e.annual,
          ) &&
          s.sourceUrl === revenueSourceUrl("porto-velho", s.years[0].year)
        : source !== null &&
          s.aggregation === "annual-accounts" &&
          s.coverage === "partial" &&
          new Set(s.entries.map((e) => e.sourceId)).size === s.entries.length &&
          s.entries.every(
            (e) =>
              e.id.startsWith(
                source.slug === "ji-parana" ? "ji-receita-" : "ari-receita-",
              ) &&
              e.annual?.records === 1 &&
              e.plannedLines === 1 &&
              !!e.sourceId &&
              /^[0-9]+(?:\.[0-9]+){7}$/.test(e.sourceId) &&
              e.unitId === String(source.company) &&
              [
                "arrecadadas-diretamente",
                "transferencias/estaduais",
                "transferencias/federais",
              ].some(
                (path) =>
                  e.sourceUrl ===
                  `${source.apiOrigin}/api/receitas/${path}/${s.years[0].year}/${source.company}`,
              ),
          ) &&
          s.sourceUrl === revenueSourceUrl(source.slug, s.years[0].year))
    );
  });
export type RevenueEntry = z.infer<typeof revenueEntrySchema>;
export type RevenueSnapshot = z.infer<typeof revenueSnapshotSchema>;
