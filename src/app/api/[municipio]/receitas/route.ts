import { getRevenues } from "@/lib/municipal-data";
import { parseRevenueQuery, MunicipalQueryError } from "@/core/municipal-query";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function GET(
  request: Request,
  { params }: { params: Promise<{ municipio: string }> },
) {
  if ((await params).municipio !== "porto-velho")
    return Response.json(
      {
        error: {
          code: "not-found",
          message: "Módulo indisponível para este município.",
        },
      },
      { status: 404, headers },
    );
  try {
    const search = new URL(request.url).searchParams;
    const input = Object.fromEntries(
      [...new Set(search.keys())].map((k) => [
        k,
        search.getAll(k).length > 1 ? search.getAll(k) : search.get(k)!,
      ]),
    );
    if ([...search.keys()].some((k) => k !== "ano"))
      throw new MunicipalQueryError();
    const { year } = parseRevenueQuery(input);
    const result = await getRevenues(year);
    return Response.json(
      { municipality: "porto-velho", module: "receitas", ...result },
      { headers: { ...headers, "X-Observatorio-Cache": result.cache.status } },
    );
  } catch (e) {
    return Response.json(
      {
        error: {
          code:
            e instanceof MunicipalQueryError
              ? "invalid-query"
              : "source-unavailable",
          message:
            e instanceof MunicipalQueryError
              ? e.message
              : "Não foi possível consultar o catálogo completo na fonte oficial.",
        },
      },
      { status: e instanceof MunicipalQueryError ? 400 : 502, headers },
    );
  }
}
