export type PageSearchParams = Record<string, string | string[] | undefined>;

export function searchParamsQuery(params: PageSearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) query.set(key, first);
  }
  return query.toString();
}

export function catalogPage(query: string, count: number, size = 12) {
  const requested = Number(new URLSearchParams(query).get("page") ?? 1);
  const pages = Math.max(1, Math.ceil(count / size));
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, pages)
      : 1;
  return { page, pages, start: (page - 1) * size, end: page * size };
}

export function catalogQuery(filters: string, page = 1) {
  const query = new URLSearchParams(filters);
  if (page > 1) query.set("page", String(page));
  return query.toString();
}
