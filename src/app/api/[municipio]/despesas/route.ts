import { ContractsDataError } from "@/core/contracts-query";
import { parseExpensesQuery } from "@/core/expenses";
import { isExpensesMunicipality } from "@/core/municipal-sources";
import { getExpenses } from "@/lib/expenses";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ municipio: string }> },
) {
  const { municipio } = await params;
  if (!isExpensesMunicipality(municipio)) {
    return Response.json(
      {
        error: {
          code: "not-found",
          message: "Despesas não disponíveis para este município.",
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
    const result = await getExpenses(parseExpensesQuery(input), municipio);
    return Response.json(
      { municipality: municipio, module: "despesas", ...result },
      { headers: { ...noStore, "X-Observatorio-Cache": result.cache.status } },
    );
  } catch (error) {
    if (error instanceof ContractsDataError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status, headers: noStore },
      );
    }
    return Response.json(
      {
        error: {
          code: "unavailable",
          message: "A consulta de despesas está temporariamente indisponível.",
        },
      },
      { status: 503, headers: { ...noStore, "Retry-After": "15" } },
    );
  }
}
