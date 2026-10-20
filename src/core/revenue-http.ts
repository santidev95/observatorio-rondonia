import type { RevenueReadResult } from "./revenue-refresh";
export function revenueHttpResponse(
  result: RevenueReadResult,
  statusOnly = false,
) {
  const { data, ...status } = result;
  return Response.json(statusOnly ? status : result, {
    status:
      result.state === "ready" ? 200 : result.state === "pending" ? 202 : 503,
    headers: {
      "Cache-Control": "no-store",
      "X-Observatorio-Cache": result.cache.status,
      ...(result.state !== "ready" ? { "Retry-After": "10" } : {}),
    },
  });
}
