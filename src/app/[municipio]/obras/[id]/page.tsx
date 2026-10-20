import { BackToWorks } from "@/features/works/BackToWorks";
import { notFound } from "next/navigation";
import { Geist } from "next/font/google";
import Link from "next/link";
import { getWorks } from "@/lib/municipal-data";
import { currency, dateLabel, percentLabel } from "@/features/shared/display";
import { ModuleNavigation } from "@/features/shared/ModuleNavigation";
import { CacheNotice } from "@/features/contracts/CacheNotice";
import "@/features/shared/modules.css";
const geist = Geist({ subsets: ["latin"], display: "swap" });
export const runtime = "nodejs";
export const metadata = { title: "Detalhes da obra de Porto Velho" };
export default async function WorkDetail({
  params,
}: {
  params: Promise<{ municipio: string; id: string }>;
}) {
  const { municipio, id } = await params;
  if (municipio !== "porto-velho" || !/^[1-9]\d*$/.test(id)) notFound();
  let result: Awaited<ReturnType<typeof getWorks>> | undefined;
  try {
    result = await getWorks();
  } catch {}
  const work = result?.data.records.find((w) => String(w.sourceId) === id);
  if (result && !work) notFound();
  return (
    <main id="conteudo" className={geist.className + " container pvh-module"}>
      <ModuleNavigation active="obras" />
      <BackToWorks />
      {work && result ? (
        <>
          <h1 style={{ marginTop: 24 }}>{work.title}</h1>
          <p className="page-intro">
            {work.status} ·{" "}
            {work.locations.join(" · ") || "Localização não informada"}
          </p>
          <dl className="detail-grid">
            {[
              ["Contratado", currency(work.contractedCents)],
              ["Pago", currency(work.paidCents)],
              ["A medir", currency(work.toMeasureCents)],
              [
                "Percentual da fonte",
                percentLabel(work.reportedExecutionPercent),
              ],
              ["Início informado", dateLabel(work.startedAt)],
              [
                "Responsável",
                work.organizationName ?? work.organization ?? "Não informado",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="notice">
            Contratado, pago e a medir são valores financeiros distintos. O
            percentual da fonte não comprova avanço físico. Atualização da
            Prefeitura: {dateLabel(work.sourceUpdatedAt)}.
          </p>
          <section className="revenue-panel">
            <h2>Contrato e informações da obra</h2>
            <p>
              {work.process
                ? "Processo: " + work.process
                : "Processo não informado"}
            </p>
            <p>{work.supplier ?? "Fornecedor não informado"}</p>
            {work.contractId && (
              <Link
                href={"/porto-velho/contratos/" + work.contractId}
                prefetch={false}
              >
                Consultar contrato vinculado:{" "}
                {work.contractNumber ?? work.contractId} →
              </Link>
            )}
            {work.observation && <p>{work.observation}</p>}
          </section>
          <section className="revenue-panel">
            <h2>Medições publicadas</h2>
            {work.measurements.length ? (
              <ul className="document-list">
                {work.measurements.map((m, i) => (
                  <li key={i}>
                    {m.title} · {currency(m.amountCents)} · Pagamento:{" "}
                    {dateLabel(m.paidAt)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhuma medição publicada nesta ficha.</p>
            )}
          </section>
          <section className="revenue-panel">
            <h2>Documentos oficiais</h2>
            {work.documents.length ? (
              <ul className="document-list">
                {work.documents.map((d, i) => (
                  <li key={i}>
                    <a href={d.url} target="_blank" rel="noopener noreferrer">
                      {d.title} ↗
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhum documento com link oficial disponível.</p>
            )}
          </section>
          <a href={work.sourceUrl}>Consultar ficha na API oficial ↗</a>
          <CacheNotice cache={result.cache} />
        </>
      ) : (
        <section className="notice error" role="status">
          Não foi possível consultar a fonte agora. Tente novamente em alguns
          instantes.
        </section>
      )}
    </main>
  );
}
