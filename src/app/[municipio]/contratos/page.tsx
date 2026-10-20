import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  ContractsDataError,
  parseContractsQuery,
} from "@/core/contracts-query";
import { portoVelhoSource } from "@/connectors/porto-velho/definition";
import { CacheNotice } from "@/features/contracts/CacheNotice";
import { ContractCatalog } from "@/features/contracts/ContractCatalog";
import { formatConsultationTime } from "@/features/contracts/format";
import { getContracts } from "@/lib/contracts";
import "./catalog.css";

export const runtime = "nodejs";
const geist = Geist({ subsets: ["latin"], display: "swap" });

type Props = {
  params: Promise<{ municipio: string }>;
  searchParams: Promise<{ page?: string | string[]; ano?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if ((await params).municipio !== "porto-velho") notFound();
  return {
    title: "Contratos de Porto Velho",
    description:
      "Consulte contratos publicados pela Prefeitura de Porto Velho, com fonte oficial e data da consulta.",
  };
}

export default async function ContractsPage({ params, searchParams }: Props) {
  if ((await params).municipio !== "porto-velho") notFound();
  await connection();
  let query: ReturnType<typeof parseContractsQuery> | undefined;
  let result: Awaited<ReturnType<typeof getContracts>> | undefined;
  let invalidQuery = false;
  let problem: string | undefined;
  try {
    query = parseContractsQuery(await searchParams);
    result = await getContracts(query);
  } catch (error) {
    invalidQuery =
      error instanceof ContractsDataError && error.code === "invalid-query";
    problem = invalidQuery
      ? "O filtro ou a página informada não é válido. Use um ano entre 2000 e 2100 e uma página inteira a partir de 1."
      : "Não foi possível consultar os contratos agora. Tente novamente em alguns instantes ou acesse a fonte oficial.";
  }
  const catalog = result?.data;
  const sourceUrl = catalog?.sourceUrl ?? portoVelhoSource.url;
  const downloadParams = new URLSearchParams({
    page: String(query?.page ?? 1),
  });
  if (query?.year !== undefined && query.year !== null)
    downloadParams.set("ano", String(query.year));

  return (
    <main
      id="conteudo"
      className={
        geist.className + " container contracts-page contracts-catalog"
      }
    >
      <header className="catalog-heading">
        <div>
          <div className="page-kicker">
            <span>CONTRATOS MUNICIPAIS · PORTO VELHO/RO</span>
            {result && (
              <small>
                Consulta à fonte em{" "}
                <time dateTime={result.fetchedAt}>
                  {formatConsultationTime(result.fetchedAt)}
                </time>
              </small>
            )}
          </div>
          <h1 className="page-title">Explore os contratos da cidade</h1>
          <p className="page-intro">
            Consulte empresas, objetos, valores e documentos dos contratos
            publicados pela Prefeitura de Porto Velho.
          </p>
        </div>
        {catalog && (
          <a
            className="total-summary"
            href={"/api/porto-velho/contratos?" + downloadParams.toString()}
            download={"contratos-porto-velho-pagina-" + query?.page + ".json"}
            aria-label="Baixar esta página de contratos em JSON"
            title="Baixar somente esta página em JSON"
          >
            <span>
              <small>CONTRATOS NA FONTE</small>
              <strong>
                {catalog.pagination.total.toLocaleString("pt-BR")}
              </strong>
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </a>
        )}
      </header>
      {problem && (
        <section className="contracts-unavailable" role="status">
          <h2>{invalidQuery ? "Revise o filtro" : "Consulta indisponível"}</h2>
          <p>{problem}</p>
          {invalidQuery ? (
            <Link href="/porto-velho/contratos" prefetch={false}>
              Limpar filtro e voltar à primeira página →
            </Link>
          ) : (
            <a href={sourceUrl}>Consultar a fonte oficial ↗</a>
          )}
        </section>
      )}
      {catalog && query && (
        <ContractCatalog
          key={query.page + ":" + query.year}
          catalog={catalog}
          query={query}
          currentYear={new Date().getUTCFullYear()}
        />
      )}
      {result && catalog && (
        <>
          <p className="overview-note">
            Incluímos o modelo “Contratos” da API, com até{" "}
            {catalog.pagination.perPage} registros por página. O total é
            informado pela fonte e pode mudar entre consultas. O JSON contém
            somente a página solicitada. Não apresentamos soma global de
            valores. Situação e vigência são reproduzidas da fonte.
          </p>
          <details className="contracts-source">
            <summary>Fonte e detalhes da consulta</summary>
            <div>
              <p>
                Consulta à fonte em{" "}
                <time dateTime={result.fetchedAt}>
                  {formatConsultationTime(result.fetchedAt)}
                </time>
                , horário de Rondônia.{" "}
                <a href={sourceUrl}>Ver consulta na fonte oficial ↗</a>
              </p>
              <CacheNotice cache={result.cache} />
              <p>
                Página {catalog.pagination.currentPage} de{" "}
                {catalog.pagination.lastPage} ·{" "}
                {query?.year !== undefined && query.year !== null
                  ? "ano solicitado à fonte: " + query.year
                  : "sem ano solicitado à fonte"}
                . O critério de ano da API pode divergir do ano informado em
                cada registro.
              </p>
            </div>
          </details>
        </>
      )}
      <Link href="/porto-velho" className="catalog-back" prefetch={false}>
        ← Porto Velho
      </Link>
    </main>
  );
}
