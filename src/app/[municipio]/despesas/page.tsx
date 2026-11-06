import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ContractsDataError } from "@/core/contracts-query";
import { parseExpensesQuery } from "@/core/expenses";
import {
  dataMunicipality,
  expensesFirstYear,
  isExpensesMunicipality,
  municipalYear,
} from "@/core/municipal-sources";
import { CacheNotice } from "@/features/contracts/CacheNotice";
import { formatConsultationTime } from "@/features/contracts/format";
import { ExpenseCatalog } from "@/features/expenses/ExpenseCatalog";
import { ModuleNavigation } from "@/features/shared/ModuleNavigation";
import { getExpenses } from "@/lib/expenses";
import "../contratos/catalog.css";
import "./expenses.css";

export const runtime = "nodejs";
const geist = Geist({ subsets: ["latin"], display: "swap" });

type Props = {
  params: Promise<{ municipio: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function expensesCity(slug: string) {
  const city = dataMunicipality(slug);
  return city && isExpensesMunicipality(city.slug)
    ? { ...city, slug: city.slug }
    : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = expensesCity((await params).municipio);
  if (!city) notFound();
  return {
    title: "Despesas de " + city.name,
    description: `Consulte empenhos e pagamentos publicados pela Prefeitura de ${city.name}, com fonte oficial e data da consulta.`,
  };
}

export default async function ExpensesPage({ params, searchParams }: Props) {
  const city = expensesCity((await params).municipio);
  if (!city) notFound();
  await connection();
  let result: Awaited<ReturnType<typeof getExpenses>> | undefined;
  let invalidQuery = false;
  try {
    result = await getExpenses(
      parseExpensesQuery(await searchParams),
      city.slug,
    );
  } catch (error) {
    invalidQuery =
      error instanceof ContractsDataError && error.code === "invalid-query";
  }
  const catalog = result?.data;
  const download =
    catalog &&
    new URLSearchParams({
      visao: catalog.view,
      ano: String(catalog.year),
      page: String(catalog.pagination.currentPage),
    });

  return (
    <main
      id="conteudo"
      className={
        geist.className + " container contracts-page contracts-catalog"
      }
    >
      <ModuleNavigation active="despesas" municipality={city.slug} />
      <header className="catalog-heading">
        <div>
          <div className="page-kicker">
            <span>
              DESPESAS MUNICIPAIS · {city.name.toLocaleUpperCase("pt-BR")}/RO
            </span>
            {result && (
              <small>
                Consulta à fonte em{" "}
                <time dateTime={result.fetchedAt}>
                  {formatConsultationTime(result.fetchedAt)}
                </time>
              </small>
            )}
          </div>
          <h1 className="page-title">Veja como o dinheiro é gasto</h1>
          <p className="page-intro">
            Consulte empenhos e pagamentos publicados pela Prefeitura de{" "}
            {city.name}.
          </p>
        </div>
        {catalog && (
          <a
            className="total-summary"
            href={`/api/${city.slug}/despesas?${download}`}
            download={`despesas-${city.slug}-${catalog.view}-${catalog.year}-pagina-${catalog.pagination.currentPage}.json`}
            aria-label={`Baixar esta página de ${catalog.view} em JSON`}
            title="Baixar somente esta página em JSON"
          >
            <span>
              <small>REGISTROS NA FONTE</small>
              <strong>
                {catalog.pagination.total.toLocaleString("pt-BR")}
              </strong>
            </span>
          </a>
        )}
      </header>
      {!result && (
        <section className="contracts-unavailable" role="status">
          <h2>{invalidQuery ? "Revise o filtro" : "Consulta indisponível"}</h2>
          <p>
            {invalidQuery
              ? "O exercício ou a página informada não é válido."
              : "Não foi possível consultar as despesas agora. Tente novamente em alguns instantes ou acesse a fonte oficial."}
          </p>
          {invalidQuery ? (
            <Link href={`/${city.slug}/despesas`} prefetch={false}>
              Voltar à primeira página →
            </Link>
          ) : (
            <a href={city.documentation}>Consultar a fonte oficial ↗</a>
          )}
        </section>
      )}
      {catalog && (
        <ExpenseCatalog
          key={`${catalog.view}:${catalog.year}:${catalog.pagination.currentPage}`}
          catalog={catalog}
          currentYear={municipalYear()}
          firstYear={expensesFirstYear[city.slug]}
          municipality={city.slug}
        />
      )}
      {result && catalog && (
        <>
          <p className="overview-note">
            Consultamos as despesas da Prefeitura (UG {city.company}), uma
            página por vez, com {catalog.pagination.perPage} registros, na ordem
            da fonte. Por isso não há busca no catálogo inteiro. Credores sem
            CNPJ aparecem sem nome e sem documento. O tipo de empenho é o código
            publicado pela fonte.
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
                <a href={city.documentation}>Ver documentação da fonte ↗</a>
              </p>
              <CacheNotice cache={result.cache} />
              <p>
                Os totais da fonte não foram conferidos linha a linha pelo
                Observatório. Registros e totais podem mudar entre consultas.
              </p>
            </div>
          </details>
        </>
      )}
      <Link href={"/" + city.slug} className="catalog-back" prefetch={false}>
        ← {city.name}
      </Link>
    </main>
  );
}
