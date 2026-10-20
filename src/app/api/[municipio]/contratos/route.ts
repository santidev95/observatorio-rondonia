import { getMunicipality } from "@/municipalities";
import {
  ContractsDataError,
  parseContractsQuery,
} from "@/core/contracts-query";
import { getContracts } from "@/lib/contracts";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ municipio: string }> },
) {
  const { municipio } = await params;
  if (municipio !== "porto-velho" || !getMunicipality(municipio)) {
    return Response.json(
      {
        error: {
          code: "not-found",
          message: "Catálogo não disponível para este município.",
        },
      },
      { status: 404, headers: noStore },
    );
  }

  try {
    const search = new URL(request.url).searchParams;
    const input = Object.fromEntries(
      [...new Set(search.keys())].map((key) => {
        const values = search.getAll(key);
        return [key, values.length === 1 ? values[0] : values];
      }),
    );
    const result = await getContracts(parseContractsQuery(input));
    return Response.json(
      { municipality: municipio, module: "contratos", ...result },
      { headers: { ...noStore, "X-Observatorio-Cache": result.cache.status } },
    );
  } catch (error) {
    if (error instanceof ContractsDataError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        {
          status: error.status,
          headers: {
            ...noStore,
            ...(error.status === 503 ? { "Retry-After": "15" } : {}),
          },
        },
      );
    }
    return Response.json(
      {
        error: {
          code: "unavailable",
          message: "A consulta de contratos está temporariamente indisponível.",
        },
      },
      { status: 503, headers: { ...noStore, "Retry-After": "15" } },
    );
  }
}
