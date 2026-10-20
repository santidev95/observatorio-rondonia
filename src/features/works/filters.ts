import type { Work } from "@/core/works";
import { searchKey } from "@/features/shared/display";

export type Filters = {
  q: string;
  status: string;
  org: string;
  neighborhood: string;
  sort: string;
};
export const defaultFilters: Filters = {
  q: "",
  status: "",
  org: "",
  neighborhood: "",
  sort: "updated",
};

export function readFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const sort = params.get("sort") ?? "updated";
  return {
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    org: params.get("org") ?? "",
    neighborhood: params.get("bairro") ?? "",
    sort: ["updated", "value", "name"].includes(sort) ? sort : "updated",
  };
}

export function filterQuery(filters: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && !(key === "sort" && value === "updated"))
      params.set(key === "neighborhood" ? "bairro" : key, value);
  }
  return params.toString();
}

export function filterWorks(works: Work[], filters: Filters) {
  const query = searchKey(filters.q.trim());
  return works
    .filter(
      (work) =>
        (!query ||
          searchKey(
            [
              work.title,
              work.contractNumber,
              work.supplier,
              work.process,
              work.organization,
              work.organizationName,
              ...work.locations,
            ].join(" "),
          ).includes(query)) &&
        (!filters.status || work.status === filters.status) &&
        (!filters.org || work.organization === filters.org) &&
        (!filters.neighborhood || work.neighborhood === filters.neighborhood),
    )
    .sort((a, b) =>
      filters.sort === "value"
        ? (b.contractedCents ?? -1) - (a.contractedCents ?? -1)
        : filters.sort === "name"
          ? a.title.localeCompare(b.title, "pt-BR")
          : (b.sourceUpdatedAt ?? "").localeCompare(a.sourceUpdatedAt ?? "") ||
            b.sourceId - a.sourceId,
    );
}
