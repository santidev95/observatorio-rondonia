import { filterQuery, readFilters, type Filters } from "./filters";

export const WORK_POSITION_KEY = "ro:porto-velho:works:position";
export const WORK_RESTORE_KEY = "ro:porto-velho:works:restore";

export function readWorkPage(search: string) {
  const page = Number(new URLSearchParams(search).get("page") ?? 1);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function worksUrl(filters: Filters, page = 1) {
  const query = new URLSearchParams(filterQuery(filters));
  if (page > 1) query.set("page", String(page));
  return `/porto-velho/obras/${query.size ? `?${query}` : ""}`;
}

/** Only an internal works query can be used as a return destination. */
export function worksReturnUrl(search: string) {
  const from = new URLSearchParams(search).get("from");
  if (!from || !/^\/porto-velho\/obras\/(?:\?[^#]*)?$/.test(from))
    return "/porto-velho/obras/";
  const query = from.slice("/porto-velho/obras/".length);
  return worksUrl(readFilters(query), readWorkPage(query));
}

export function rememberWorkPosition() {
  try {
    sessionStorage.setItem(
      WORK_POSITION_KEY,
      JSON.stringify({
        url: window.location.pathname + window.location.search,
        y: window.scrollY,
      }),
    );
  } catch {
    /* Navigation still works when browser storage is unavailable. */
  }
}
