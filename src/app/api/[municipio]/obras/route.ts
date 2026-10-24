import { getWorks } from "@/lib/municipal-data";
import { parseWorksYear, MunicipalQueryError } from "@/core/municipal-query";
import { dataMunicipality, municipalYear } from "@/core/municipal-sources";
import { MunicipalSourceError } from "@/core/municipal-source-error";
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
    if (
      city.annual
        ? [...search.keys()].some((k) => k !== "ano") ||
          search.getAll("ano").length > 1
        : search.size > 0
    )
      throw new MunicipalQueryError();
    const year = parseWorksYear(Object.fromEntries(search), municipalYear());
    const result = await getWorks(city.slug, year);
    return Response.json(
      { municipality: city.slug, module: "obras", ...result },
      { headers: { ...headers, "X-Observatorio-Cache": result.cache.status } },
    );
  } catch (e) {
    return Response.json(
      {
        error: {
          code:
            e instanceof MunicipalQueryError
              ? "invalid-query"
              : e instanceof MunicipalSourceError
                ? e.code
                : "source-unavailable",
          message:
            e instanceof MunicipalQueryError
              ? e.message
              : e instanceof MunicipalSourceError
                ? e.publicMessage
                : "Não foi possível validar o catálogo completo na fonte oficial. Nenhum catálogo parcial é retornado.",
        },
      },
      { status: e instanceof MunicipalQueryError ? 400 : 502, headers },
    );
  }
}
