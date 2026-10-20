import { municipalFetch } from "./transport";
import { revenueSnapshotSchema } from "../../core/revenues";
import { RevenueAccumulator } from "./revenue-accumulator";
import { allPages } from "./public-data";
export const revenuesSource = (year: number) =>
  "https://api.portovelho.ro.gov.br/api/v1/receitas?portal_id=12535&ano=" +
  year;
export async function fetchRevenues(
  year: number,
  signal: AbortSignal,
  request: typeof fetch = municipalFetch,
) {
  const at = new Date().toISOString(),
    accumulator = new RevenueAccumulator(year, at);
  const receipts = await allPages(
    revenuesSource(year),
    1000,
    200,
    signal,
    (rows) => rows.forEach((r) => accumulator.add(r, false)),
    request,
  );
  const planned = await allPages(
    "https://api.portovelho.ro.gov.br/api/v1/receitas/previstas?portal_id=12535&ano=" +
      year,
    1000,
    20,
    signal,
    (rows) => rows.forEach((r) => accumulator.add(r, true)),
    request,
  );
  return revenueSnapshotSchema.parse({
    schemaVersion: 1,
    portalId: 12535,
    generatedAt: at,
    lastAttemptAt: at,
    syncStatus: "ok",
    syncError: null,
    years: [
      {
        year,
        receipts,
        planned,
        lastDocumentDate: accumulator.lastDocumentDate,
      },
    ],
    entries: accumulator.finish(),
    sourceUrl: revenuesSource(year),
  });
}
