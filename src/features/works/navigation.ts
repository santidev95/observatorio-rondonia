import { filterQuery, readFilters, type Filters } from "./filters";
import type { DataMunicipality } from "@/core/municipal-sources";

export const WORK_POSITION_KEY = "ro:porto-velho:works:position";
export const WORK_RESTORE_KEY = "ro:porto-velho:works:restore";

export function readWorkPage(search: string) {
  const page = Number(new URLSearchParams(search).get("page") ?? 1);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export type WorksContext = { municipality?: DataMunicipality; year?: number };
export function workStorageKeys(
  municipality: DataMunicipality = "porto-velho",
) {
  return {
    position: `ro:${municipality}:works:position`,
    restore: `ro:${municipality}:works:restore`,
  };
}
export function worksUrl(
  filters: Filters,
  page = 1,
  context: WorksContext = {},
) {
  const query = new URLSearchParams(filterQuery(filters));
  if (page > 1) query.set("page", String(page));
  if (context.year !== undefined) query.set("ano", String(context.year));
  return `/${context.municipality ?? "porto-velho"}/obras/${query.size ? `?${query}` : ""}`;
}

/** Only an internal works query can be used as a return destination. */
export function worksReturnUrl(search: string, context: WorksContext = {}) {
  const from = new URLSearchParams(search).get("from");
  const base = `/${context.municipality ?? "porto-velho"}/obras/`;
  if (
    !from ||
    (from !== base && !from.startsWith(base + "?")) ||
    from.includes("#")
  )
    return worksUrl(readFilters(""), 1, context);
  const query = from.slice(base.length);
  return worksUrl(readFilters(query), readWorkPage(query), context);
}

export function rememberWorkPosition(
  municipality: DataMunicipality = "porto-velho",
) {
  try {
    sessionStorage.setItem(
      workStorageKeys(municipality).position,
      JSON.stringify({
        url: window.location.pathname + window.location.search,
        y: window.scrollY,
      }),
    );
  } catch {
    /* Navigation still works when browser storage is unavailable. */
  }
}
