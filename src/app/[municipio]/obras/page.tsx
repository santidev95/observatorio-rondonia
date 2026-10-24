import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getWorks } from "@/lib/municipal-data";
import { dataMunicipality, municipalYear } from "@/core/municipal-sources";
import { parseWorksYear, MunicipalQueryError } from "@/core/municipal-query";
import { MunicipalSourceError } from "@/core/municipal-source-error";
import { WorkList } from "@/features/works/WorkList";
import { CoverageNotice } from "@/features/works/CoverageNotice";
import { CacheNotice } from "@/features/contracts/CacheNotice";
import { formatConsultationTime } from "@/features/contracts/format";
import { ModuleNavigation } from "@/features/shared/ModuleNavigation";
import type { PageSearchParams } from "@/features/shared/catalog-query";
import "@/features/shared/modules.css";
const geist = Geist({ subsets: ["latin"], display: "swap" });
export const runtime = "nodejs";
type Props = {
  params: Promise<{ municipio: string }>;
  searchParams: Promise<PageSearchParams>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = dataMunicipality((await params).municipio);
  if (!city) notFound();
  return { title: "Obras de " + city.name };
}
export default async function Works({ params, searchParams }: Props) {
  const city = dataMunicipality((await params).municipio);
  if (!city) notFound();
  await connection();
  const raw = await searchParams;
  let year = municipalYear();
  let result: Awaited<ReturnType<typeof getWorks>> | undefined;
  let problem = city.annual
    ? "Não foi possível validar todas as páginas da fonte. A API pode estar indisponível ou apresentar paginação inconsistente; nenhum catálogo parcial é exibido. Tente novamente mais tarde ou consulte o portal oficial."
    : "Não foi possível consultar o catálogo completo agora. Tente novamente em alguns instantes.";
  try {
    if (city.annual) year = parseWorksYear(raw);
    result = await getWorks(city.slug, year);
  } catch (error) {
    if (error instanceof MunicipalQueryError) problem = error.message;
    if (error instanceof MunicipalSourceError) problem = error.publicMessage;
  }
  return (
    <main
      id="conteudo"
      className={geist.className + " container pvh-module catalog-page"}
    >
      <ModuleNavigation active="obras" municipality={city.slug} />
      <div className="catalog-heading">
        <div>
          <h1 className="page-title">Explore as obras da cidade</h1>
          <p className="page-intro">
            Encontre uma obra e confira valores, situação e documentos
            publicados pela Prefeitura de {city.name}.
          </p>
        </div>
        {result && (
          <a
            className="button button-secondary"
            href={`/api/${city.slug}/obras${city.annual ? `?ano=${year}` : ""}`}
            download
          >
            Baixar dados — JSON
          </a>
        )}
      </div>
      {city.annual && (
        <form
          action={`/${city.slug}/obras`}
          className="search-panel revenue-filters revenue-initial-filters"
        >
          <label>
            Exercício{" "}
            <input
              type="number"
              name="ano"
              min={2000}
              max={2100}
              defaultValue={year}
              required
            />
          </label>
          <button className="button button-secondary" type="submit">
            Consultar exercício
          </button>
        </form>
      )}
      {result ? (
        <>
          <CoverageNotice catalog={result.data} />
          <details className="catalog-provenance">
            <summary>
              Fonte e atualização · consulta em{" "}
              {formatConsultationTime(result.fetchedAt)}
            </summary>
            <p>
              {result.data.total} obras únicas disponíveis ·{" "}
              {city.annual
                ? `Exercício ${year}, Prefeitura (UG ${city.company}). ${result.data.complete ? "Catálogo completo da consulta, sem garantia de cobertura de todas as obras do município." : result.data.coverage && "rowDifference" in result.data.coverage ? "Consulta parcial, com dados inconsistentes na fonte; sem garantia de cobertura completa do endpoint ou do município." : "Consulta parcial, com ausência de um registro assumida; sem garantia de cobertura completa do endpoint ou do município."}`
                : "As obras abrangem diferentes anos e não representam todas as obras da cidade."}
            </p>
            <CacheNotice cache={result.cache} />
            <p>
              <a href={result.data.sourceUrl}>Consultar fonte oficial ↗</a>
            </p>
            {!result.data.complete &&
              result.data.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
          </details>
          {result.data.complete &&
            result.data.warnings.map((w) => (
              <p key={w} className="notice" role="status">
                {w}
              </p>
            ))}
          <WorkList
            key={`${city.slug}:${year}`}
            works={result.data.records}
            municipality={city.slug}
            year={city.annual ? year : undefined}
          />
          <p className="overview-note">
            O percentual publicado tem definição não confirmada e não comprova
            avanço físico da obra. Confira o contexto na fonte oficial.
          </p>
        </>
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
