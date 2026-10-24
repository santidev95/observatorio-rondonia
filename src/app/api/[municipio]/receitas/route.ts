import { revenueHttpResponse } from "@/core/revenue-http";
import { getRevenues } from "@/lib/revenues";
import { parseRevenueQuery, MunicipalQueryError } from "@/core/municipal-query";
import { dataMunicipality } from "@/core/municipal-sources";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function GET(
  request: Request,
  { params }: { params: Promise<{ municipio: string }> },
) {
  const city = dataMunicipality((await params).municipio);
  if (!city)
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
    const result = await getRevenues(year, city.slug);
    const response = revenueHttpResponse(result);
    const body = { municipality: city.slug, module: "receitas", ...result };
    return Response.json(body, {
      status: response.status,
      headers: response.headers,
    });
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
