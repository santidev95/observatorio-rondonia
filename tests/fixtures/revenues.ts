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

export function syntheticJiParanaRevenues(
  year = 2026,
  at = revenueFixtureTime,
): RevenueSnapshot {
  const sourceUrl = `https://transparencia.ji-parana.ro.gov.br/api/receitas/arrecadadas-diretamente/${year}/2`;
  return {
    schemaVersion: 1,
    municipality: "ji-parana",
    portalId: null,
    aggregation: "annual-accounts",
    coverage: "partial",
    warnings: [
      "Fixture sintética de resumo anual parcial; não representa dados municipais reais.",
    ],
    generatedAt: new Date(at).toISOString(),
    lastAttemptAt: new Date(at).toISOString(),
    syncStatus: "ok",
    syncError: null,
    years: [{ year, receipts: 1, planned: 1, lastDocumentDate: null }],
    entries: [
      {
        id: "ji-receita-" + "a".repeat(24),
        sourceId: "1112.50.0.0.00.00.00.00",
        sourceUrl,
        year,
        unitId: "2",
        unitName: "Unidade sintética de Ji-Paraná",
        account: "1112.50.0.0.00.00.00.00 - Conta sintética",
        category: "Categoria sintética",
        origin: "Origem sintética",
        fundingSource: "Fonte não informada no resumo sintético",
        kind: "budget",
        plannedCents: 0,
        plannedLines: 1,
        missingPlannedValues: 0,
        annual: { cents: -123, records: 1, missingValues: 0 },
        months: [],
        inLatestSnapshot: true,
      },
    ],
    sourceUrl,
  };
}

export function syntheticAriquemesRevenues(
  year = 2026,
  at = revenueFixtureTime,
): RevenueSnapshot {
  const data = syntheticJiParanaRevenues(year, at);
  const sourceUrl = `https://transparencia.ariquemes.ro.gov.br/api/receitas/arrecadadas-diretamente/${year}/1`;
  return {
    ...data,
    municipality: "ariquemes",
    sourceUrl,
    entries: data.entries.map((entry) => ({
      ...entry,
      id: "ari-receita-" + "a".repeat(24),
      sourceUrl,
      unitId: "1",
      unitName: "Unidade sintética de Ariquemes",
    })),
  };
}
