import { getRevenues } from "@/lib/revenues";
import { parseRevenueQuery } from "@/core/municipal-query";
import { revenueHttpResponse } from "@/core/revenue-http";
import { dataMunicipality } from "@/core/municipal-sources";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ municipio: string }> },
) {
  const headers = { "Cache-Control": "no-store" };
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
  const search = new URL(request.url).searchParams;
  if (
    [...search.keys()].some((k) => k !== "ano") ||
    search.getAll("ano").length > 1
  )
    return Response.json(
      { error: { code: "invalid-query", message: "Exercício inválido." } },
      { status: 400, headers },
    );
  let year: number;
  try {
    year = parseRevenueQuery(Object.fromEntries(search)).year;
  } catch {
    return Response.json(
      { error: { code: "invalid-query", message: "Exercício inválido." } },
      { status: 400, headers },
    );
  }
  return revenueHttpResponse(await getRevenues(year, city.slug), true);
}
