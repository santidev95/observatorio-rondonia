import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getWorks } from "@/lib/municipal-data";
import { WorkList } from "@/features/works/WorkList";
import { CacheNotice } from "@/features/contracts/CacheNotice";
import { formatConsultationTime } from "@/features/contracts/format";
import { ModuleNavigation } from "@/features/shared/ModuleNavigation";
import "@/features/shared/modules.css";
const geist = Geist({ subsets: ["latin"], display: "swap" });
export const runtime = "nodejs";
export const metadata: Metadata = { title: "Obras de Porto Velho" };
export default async function Works({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  if ((await params).municipio !== "porto-velho") notFound();
  await connection();
  let result: Awaited<ReturnType<typeof getWorks>> | undefined;
  try {
    result = await getWorks();
  } catch {}
  return (
    <main
      id="conteudo"
      className={geist.className + " container pvh-module catalog-page"}
    >
      <ModuleNavigation active="obras" />
      <div className="catalog-heading">
        <div>
          <h1 className="page-title">Explore as obras da cidade</h1>
          <p className="page-intro">
            Encontre uma obra e confira valores, situação e documentos
            publicados pela Prefeitura.
          </p>
        </div>
        {result && (
          <a
            className="button button-secondary"
            href="/api/porto-velho/obras"
            download
          >
            Baixar dados — JSON
          </a>
        )}
      </div>
      {result ? (
        <>
          <details className="catalog-provenance">
            <summary>
              Fonte e atualização · consulta em{" "}
              {formatConsultationTime(result.fetchedAt)}
            </summary>
            <p>
              {result.data.total} registros da API · As obras abrangem
              diferentes anos e não representam todas as obras da cidade.
            </p>
            <CacheNotice cache={result.cache} />
            <p>
              <a href={result.data.sourceUrl}>Consultar fonte oficial ↗</a>
            </p>
          </details>
          {result.data.warnings.map((w) => (
            <p key={w} className="notice" role="status">
              {w}
            </p>
          ))}
          <WorkList works={result.data.records} />
          <p className="overview-note">
            O percentual da fonte tem definição não confirmada: não comprova
            avanço físico da obra. Confira o contexto e os documentos no
            detalhe.
          </p>
        </>
      ) : (
        <section className="notice error" role="status">
          <h2>Consulta indisponível</h2>
          <p>
            Não foi possível consultar o catálogo completo agora. Tente
            novamente ou{" "}
            <a href="https://api.portovelho.ro.gov.br/api/v1/obras">
              acesse a fonte oficial ↗
            </a>
            .
          </p>
        </section>
      )}
    </main>
  );
}
