import type { RevenueSnapshot } from "../../src/core/revenues";
export const revenueFixtureTime = Date.parse("2026-10-19T12:00:00.000Z");
export function syntheticRevenues(
  year = 2026,
  at = revenueFixtureTime,
): RevenueSnapshot {
  return {
    schemaVersion: 1,
    portalId: 12535,
    generatedAt: new Date(at).toISOString(),
    lastAttemptAt: new Date(at).toISOString(),
    syncStatus: "ok",
    syncError: null,
    years: [
      { year, receipts: 2, planned: 1, lastDocumentDate: `${year}-01-31` },
    ],
    entries: [
      {
        id: "pvh-receita-" + "a".repeat(24),
        year,
        unitId: "fixture",
        unitName: "Unidade sintética",
        account: "111 - Conta sintética",
        category: "Categoria sintética",
        origin: "Origem sintética",
        fundingSource: "Fonte sintética",
        kind: "budget",
        plannedCents: 0,
        plannedLines: 1,
        missingPlannedValues: 0,
        months: [{ month: 1, cents: -123, documents: 2, missingValues: 0 }],
        inLatestSnapshot: true,
      },
    ],
    sourceUrl:
      "https://api.portovelho.ro.gov.br/api/v1/receitas?portal_id=12535&ano=" +
      year,
  };
}
