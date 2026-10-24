import { searchKey } from "@/features/shared/display";
import type { RevenueEntry } from "@/core/revenues";

const sum = (a: number, b: number) => {
  const n = a + b;
  if (!Number.isSafeInteger(n)) throw new Error("Soma excede precisão segura");
  return n;
};

export interface RevenueFilters {
  year: string;
  unit: string;
  kind: string;
  category: string;
  q: string;
  month: string;
  sort: string;
}
export const revenueDefaults = (year: number): RevenueFilters => ({
  year: String(year),
  unit: "",
  kind: "budget",
  category: "",
  q: "",
  month: "",
  sort: "realized",
});
export function readRevenueFilters(
  query: string,
  year: number,
): RevenueFilters {
  const p = new URLSearchParams(query);
  const defaults = revenueDefaults(year);
  return {
    year: /^20\d{2}$/.test(p.get("ano") ?? "") ? p.get("ano")! : defaults.year,
    unit: p.get("unidade") ?? "",
    kind: ["budget", "extra", "unknown"].includes(p.get("tipo") ?? "")
      ? p.get("tipo")!
      : "budget",
    category: p.get("categoria") ?? "",
    q: (p.get("q") ?? "").slice(0, 200),
    month: /^(?:[1-9]|1[0-2])$/.test(p.get("mes") ?? "") ? p.get("mes")! : "",
    sort: ["planned", "account"].includes(p.get("ordem") ?? "")
      ? p.get("ordem")!
      : "realized",
  };
}
export function revenueFilterQuery(f: RevenueFilters, year: number) {
  const p = new URLSearchParams();
  for (const [key, value, normal] of [
    ["ano", f.year, String(year)],
    ["unidade", f.unit, ""],
    ["tipo", f.kind, "budget"],
    ["categoria", f.category, ""],
    ["q", f.q, ""],
    ["mes", f.month, ""],
    ["ordem", f.sort, "realized"],
  ])
    if (value !== normal) p.set(key, value);
  return p.toString();
}
export function filterRevenueEntries(
  entries: RevenueEntry[],
  f: RevenueFilters,
) {
  const q = searchKey(f.q.trim());
  return entries.filter(
    (e) =>
      e.inLatestSnapshot &&
      String(e.year) === f.year &&
      e.kind === f.kind &&
      (!f.unit || e.unitId === f.unit) &&
      (!f.category || e.category === f.category) &&
      (!q ||
        searchKey(
          [e.account, e.unitName, e.category, e.origin, e.fundingSource].join(
            " ",
          ),
        ).includes(q)),
  );
}
export function periodValue(entry: RevenueEntry, month = "") {
  const total = { cents: null as number | null, documents: 0, missing: 0 };
  if (entry.annual) {
    return month
      ? total
      : {
          cents: entry.annual.cents,
          documents: entry.annual.records,
          missing: entry.annual.missingValues,
        };
  }
  for (const record of entry.months) {
    if (month && String(record.month) !== month) continue;
    if (record.cents !== null)
      total.cents = sum(total.cents ?? 0, record.cents);
    total.documents += record.documents;
    total.missing += record.missingValues;
  }
  return total;
}
export function monthlyRevenueTotals(entries: RevenueEntry[]) {
  let plannedCents: number | null = null;
  let missingPlanned = 0;
  let budget = true;
  const months = Array.from({ length: 12 }, () => ({
    realizedCents: null as number | null,
    documents: 0,
    missing: 0,
  }));
  // Percorre os documentos uma vez, em vez de filtrar toda a base por mes.
  for (const entry of entries) {
    if (entry.annual) continue;
    if (entry.plannedCents !== null)
      plannedCents = sum(plannedCents ?? 0, entry.plannedCents);
    missingPlanned += entry.missingPlannedValues;
    budget &&= entry.kind === "budget";
    for (const record of entry.months) {
      const month = months[record.month - 1];
      if (record.cents !== null)
        month.realizedCents = sum(month.realizedCents ?? 0, record.cents);
      month.documents += record.documents;
      month.missing += record.missingValues;
    }
  }
  return months.map((month) => ({
    plannedCents,
    ...month,
    missingPlanned,
    percent:
      plannedCents !== null &&
      plannedCents > 0 &&
      month.realizedCents !== null &&
      !month.missing &&
      !missingPlanned &&
      budget
        ? (month.realizedCents / plannedCents) * 100
        : null,
  }));
}
export function revenueTotals(entries: RevenueEntry[], month = "") {
  const planned = entries.filter((e) => e.plannedCents !== null);
  const received = entries.map((e) => periodValue(e, month));
  const known = received.filter((e) => e.cents !== null);
  // Resumos anuais da API não comprovam cobertura aditiva de toda a receita.
  const additive = !entries.some((e) => e.annual);
  const plannedCents =
    additive && planned.length
      ? planned.reduce((n, e) => sum(n, e.plannedCents!), 0)
      : null;
  const realizedCents =
    additive && known.length
      ? known.reduce((n, e) => sum(n, e.cents!), 0)
      : null;
  const missing = received.reduce((n, e) => n + e.missing, 0);
  const missingPlanned = entries.reduce(
    (n, e) => n + e.missingPlannedValues,
    0,
  );
  return {
    plannedCents,
    realizedCents,
    missing,
    missingPlanned,
    documents: received.reduce((n, e) => n + e.documents, 0),
    percent:
      plannedCents !== null &&
      plannedCents > 0 &&
      realizedCents !== null &&
      !missing &&
      !missingPlanned &&
      entries.every((e) => e.kind === "budget")
        ? (realizedCents / plannedCents) * 100
        : null,
  };
}
export const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
export const shortLabel = (value: string) => value.replace(/^\d+\s*-\s*/, "");
