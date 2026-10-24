import { BackToWorks } from "@/features/works/BackToWorks";
import { CoverageNotice } from "@/features/works/CoverageNotice";
import { notFound } from "next/navigation";
import { Geist } from "next/font/google";
import Link from "next/link";
import { getWorks } from "@/lib/municipal-data";
import { dataMunicipality, municipalYear } from "@/core/municipal-sources";
import { parseWorksYear } from "@/core/municipal-query";
import { MunicipalSourceError } from "@/core/municipal-source-error";
import { currency, dateLabel, percentLabel } from "@/features/shared/display";
import { ModuleNavigation } from "@/features/shared/ModuleNavigation";
import { CacheNotice } from "@/features/contracts/CacheNotice";
import "@/features/shared/modules.css";
const geist = Geist({ subsets: ["latin"], display: "swap" });
export const runtime = "nodejs";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const city = dataMunicipality((await params).municipio);
  if (!city) notFound();
  return { title: "Detalhes da obra · " + city.name };
}
export default async function WorkDetail({
  params,
  searchParams,
}: {
  params: Promise<{ municipio: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { municipio, id } = await params;
  const city = dataMunicipality(municipio);
  if (!city || !/^[1-9]\d{0,15}$/.test(id) || !Number.isSafeInteger(Number(id)))
    notFound();
  let year = municipalYear();
  if (city.annual) {
    try {
      year = parseWorksYear(await searchParams);
    } catch {
      notFound();
    }
  }
  let result: Awaited<ReturnType<typeof getWorks>> | undefined;
  let problem =
    "Não foi possível consultar a fonte agora. Tente novamente em alguns instantes.";
  try {
    result = await getWorks(city.slug, year);
  } catch (error) {
    if (error instanceof MunicipalSourceError) problem = error.publicMessage;
  }
  const work = result?.data.records.find((w) => String(w.sourceId) === id);
  if (result?.data.complete && !work) notFound();
  return (
    <main id="conteudo" className={geist.className + " container pvh-module"}>
      <ModuleNavigation active="obras" municipality={city.slug} />
      <BackToWorks
        municipality={city.slug}
        year={city.annual ? year : undefined}
      />
      {work && result ? (
        <>
          <h1 style={{ marginTop: 24 }}>{work.title}</h1>
          <CoverageNotice catalog={result.data} />
          <p className="page-intro">
            {work.status} ·{" "}
            {work.locations.join(" · ") || "Localização não informada"}
          </p>
          <dl className="detail-grid">
            {[
              [
                city.annual ? "Valor total informado" : "Contratado",
                currency(
                  work.contractedCents ?? work.declaredValueCents ?? null,
                ),
              ],
              ["Pago", currency(work.paidCents)],
              ["A medir", currency(work.toMeasureCents)],
              [
                "Percentual da fonte",
                percentLabel(work.reportedExecutionPercent),
              ],
              ["Início informado", dateLabel(work.startedAt)],
              ...(city.annual
                ? [
                    ["Exercício", String(work.sourceYear)],
                    ["ID oficial", String(work.sourceId)],
                    [
                      "Data de conclusão informada",
                      dateLabel(work.reportedCompletionAt ?? null),
                    ],
                  ]
                : []),
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
                href={"/" + city.slug + "/contratos/" + work.contractId}
                prefetch={false}
              >
                Consultar contrato vinculado:{" "}
                {work.contractNumber ?? work.contractId} →
              </Link>
            )}
            {work.observation && <p>{work.observation}</p>}
            {work.issues.length > 0 && (
              <ul>
                {work.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
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
          <a href={work.sourceUrl}>Consultar dados na fonte oficial ↗</a>
          <CacheNotice cache={result.cache} />
        </>
      ) : result && !result.data.complete ? (
        <section className="revenue-panel">
          <h1>Obra ausente no recorte parcial</h1>
          <CoverageNotice catalog={result.data} />
          <p>
            O identificador solicitado não foi recebido nesta consulta parcial.
            Isso não permite concluir que a obra não existe na fonte.
          </p>
          <p>
            <Link
              href={`/${city.slug}/obras${city.annual ? `?ano=${year}` : ""}`}
              prefetch={false}
            >
              Voltar às obras disponíveis
            </Link>{" "}
            · <a href={result.data.sourceUrl}>Consultar fonte oficial ↗</a>
          </p>
        </section>
      ) : (
        <section className="notice error" role="status">
          <h2>Consulta indisponível</h2>
          <p>
            {problem} <a href={city.works}>Acessar fonte oficial ↗</a>
          </p>
        </section>
      )}
    </main>
  );
}
