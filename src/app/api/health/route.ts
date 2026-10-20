import { connection } from "next/server";

export const runtime = "nodejs";

/** Saúde do processo. Não consulta a prefeitura nem depende do cache. */
export async function GET() {
  await connection();
  return Response.json(
    { status: "ok", revision: process.env.APP_REVISION ?? "development" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
