import type { RevenueSnapshot } from "@/core/revenues";
import { dataMunicipality } from "@/core/municipal-sources";
import { catalogPage, catalogQuery } from "../shared/catalog-query";
import {
  filterRevenueEntries,
  monthNames,
  periodValue,
  readRevenueFilters,
  revenueFilterQuery,
  revenueTotals,
  monthlyRevenueTotals,
} from "./filters";

export function revenueDashboardView(
  snapshot: RevenueSnapshot,
  query: string,
  latestYear = new Date().getUTCFullYear(),
) {
  const city = dataMunicipality(snapshot.municipality ?? "porto-velho")!;
  const filters = readRevenueFilters(query, latestYear);
  const aggregation = snapshot.aggregation ?? "documents";
  if (aggregation === "annual-accounts") {
    filters.month = "";
    filters.kind = "budget";
  }
  const entries = filterRevenueEntries(snapshot.entries, filters);
  const received = new Map(
    entries.map((entry) => [entry.id, periodValue(entry, filters.month)]),
  );
  const sorted = [...entries].sort((a, b) => {
    if (filters.sort === "account") return a.account.localeCompare(b.account);
    const av =
      filters.sort === "planned" ? a.plannedCents : received.get(a.id)!.cents;
    const bv =
      filters.sort === "planned" ? b.plannedCents : received.get(b.id)!.cents;
    return av === null
      ? bv === null
        ? a.id.localeCompare(b.id)
        : 1
      : bv === null
        ? -1
        : bv - av || a.id.localeCompare(b.id);
  });
  const { page, pages, start, end } = catalogPage(query, entries.length);
  const yearEntries = snapshot.entries.filter(
    (e) => e.inLatestSnapshot && String(e.year) === filters.year,
  );
  return {
    latestYear,
    municipality: snapshot.municipality ?? "porto-velho",
    municipalityName: city.name,
    company: city.company,
    aggregation,
    coverage: snapshot.coverage ?? "complete-source",
    warnings: snapshot.warnings ?? [],
    sourceUrl: snapshot.sourceUrl,
    filters,
    query: catalogQuery(revenueFilterQuery(filters, latestYear), page),
    generatedAt: snapshot.generatedAt,
    years: [latestYear, latestYear - 1].map((year) => ({
      year,
      lastDocumentDate:
        snapshot.years.find((y) => y.year === year)?.lastDocumentDate ?? null,
    })),
    count: entries.length,
    page,
    pages,
    totals: revenueTotals(entries, filters.month),
    monthly: (aggregation === "annual-accounts"
      ? []
      : monthlyRevenueTotals(entries)
    ).map((totals, i) => ({
      name: monthNames[i],
      month: i + 1,
      ...totals,
    })),
    units: [
      ...new Map(yearEntries.map((e) => [e.unitId, e.unitName])).entries(),
    ].sort((a, b) => a[1].localeCompare(b[1])),
    categories: [
      ...new Set(
        yearEntries
          .filter((e) => e.kind === filters.kind)
          .map((e) => e.category),
      ),
    ].sort(),
    rows: sorted.slice(start, end).map((e) => ({
      id: e.id,
      sourceId: e.sourceId,
      sourceUrl: e.sourceUrl,
      account: e.account,
      fundingSource: e.fundingSource,
      category: e.category,
      origin: e.origin,
      unitName: e.unitName,
      kind: e.kind,
      plannedCents: e.plannedCents,
      plannedLines: e.plannedLines,
      missingPlannedValues: e.missingPlannedValues,
      received: received.get(e.id)!,
    })),
  };
}

export type RevenueDashboardView = ReturnType<typeof revenueDashboardView>;
