import type { Metadata } from "next";
import { RevenueDashboard } from "@/features/revenues/Dashboard";
import { getRevenues } from "@/lib/revenues";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Geist } from "next/font/google";
import { ModuleNavigation } from "@/features/shared/ModuleNavigation";
import { RevenueRefreshStatus } from "@/features/revenues/RefreshStatus";
import { parseRevenueQuery } from "@/core/municipal-query";
import { dataMunicipality, municipalYear } from "@/core/municipal-sources";
import "@/features/shared/modules.css";
const geist = Geist({ subsets: ["latin"], display: "swap" });
export const runtime = "nodejs";
import { revenueDashboardView } from "@/features/revenues/dashboard-view";
import {
  searchParamsQuery,
  type PageSearchParams,
} from "@/features/shared/catalog-query";
import { ArrowUpRight } from "@/features/shared/icons";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string }>;
}): Promise<Metadata> {
  const city = dataMunicipality((await params).municipio);
  if (!city) notFound();
  return {
    title: "Receitas de " + city.name,
    description:
      "Consulte as receitas publicadas pela Prefeitura de " +
      city.name +
      ", com fonte e limites de cobertura.",
  };
}
const documents = [
  {
    name: "LOA",
    title: "Lei Orçamentária Anual",
    text: "Estimativas de receita e despesas fixadas para cada exercício. Consulte a lei e os anexos oficiais.",
    href: "https://transparencia.portovelho.ro.gov.br/arquivos?pasta=173",
  },
  {
    name: "LDO",
    title: "Lei de Diretrizes Orçamentárias",
    text: "Diretrizes e prioridades que orientam a elaboração do orçamento anual.",
    href: "https://transparencia.portovelho.ro.gov.br/arquivos?pasta=171",
  },
  {
    name: "PPA",
    title: "Plano Plurianual",
    text: "Programas e metas do planejamento de quatro anos. A pasta inclui leis e alterações publicadas.",
    href: "https://transparencia.portovelho.ro.gov.br/arquivos?pasta=168",
  },
];
export default async function RevenuePage({
  searchParams,
  params,
}: {
  params: Promise<{ municipio: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const city = dataMunicipality((await params).municipio);
  if (!city) notFound();
  await connection();
  const raw = await searchParams;
  let result: Awaited<ReturnType<typeof getRevenues>> | undefined;
  let problem = "";
  let year = municipalYear();
  try {
    year = parseRevenueQuery(raw).year;
    result = await getRevenues(year, city.slug);
  } catch {
    problem =
      "Não foi possível consultar o exercício completo. Revise os filtros ou tente novamente em alguns instantes.";
  }
  const revenueSnapshot = result?.data;
  const view = revenueSnapshot
    ? revenueDashboardView(
        revenueSnapshot,
        searchParamsQuery(raw),
        municipalYear(),
      )
    : null;
  return (
    <main
      id="conteudo"
      className={
        geist.className + " container pvh-module page-main revenue-page"
      }
    >
      <ModuleNavigation active="receitas" municipality={city.slug} />
      <h1 className="page-title">Receitas e orçamento</h1>
      <p className="page-intro">
        {city.annual
          ? `Consulte os valores anuais publicados por rubrica pela Prefeitura de ${city.name} (UG ${city.company}). O recorte é parcial: receitas diretas e transferências estaduais e federais, sem total municipal inferido.`
          : "Acompanhe quanto foi previsto e o que a fonte registrou de arrecadação. Explore as contas, os meses e as unidades gestoras, com acesso ao planejamento oficial."}
      </p>
      {result && (
        <RevenueRefreshStatus
          year={year}
          municipality={city.slug}
          initial={{
            state: result.state,
            fetchedAt: result.fetchedAt,
            cache: result.cache,
            refresh: result.refresh,
          }}
        />
      )}
      {!view && result && (
        <form
          action={"/" + city.slug + "/receitas"}
          className="search-panel revenue-filters revenue-initial-filters"
        >
          <label>
            Exercício
            <input
              type="number"
              name="ano"
              min={municipalYear() - 1}
              max={municipalYear()}
              defaultValue={year}
              required
            />
          </label>
          <button type="submit" className="button button-secondary">
            Consultar exercício
          </button>
          <a href={city.revenues}>Consultar fonte oficial ↗</a>
        </form>
      )}
      {view ? (
        <RevenueDashboard view={view} />
      ) : problem ? (
        <div className="notice" role="status">
          {problem} <a href={city.revenues}>Consultar fonte oficial ↗</a>
        </div>
      ) : null}
      {result?.data && (
        <details className="catalog-provenance">
          <summary>Fonte e detalhes da consulta</summary>
          <p>
            {city.annual
              ? "As três listas anuais são publicadas somente após validar todas as páginas de cada grupo. A cobertura continua parcial: não há comprovação de que esgotem as receitas do município ou de que todas as rubricas sejam aditivas."
              : "Resumo completo do exercício solicitado, consolidado após validar todas as páginas de documentos e previsões. A API pode mudar durante a leitura; não oferece revisão transacional."}
          </p>
          <p>
            Atualização em segundo plano. Exercício corrente: renovação a cada
            hora. Outros exercícios: renovação após um dia, quando consultados.
            A última versão válida é retida por até sete dias, com aviso após o
            prazo de renovação.
          </p>
        </details>
      )}
      <section
        className="revenue-panel"
        aria-labelledby="budget-documents-heading"
      >
        <h2 id="budget-documents-heading">Planejamento e orçamento</h2>
        <p className="overview-note">
          Os documentos abrangem o orçamento municipal. O recorte de receitas
          acima considera apenas o portal da Prefeitura; valores de despesas não
          são inferidos a partir da arrecadação.
        </p>
        {city.annual && (
          <p>
            <a
              href={city.apiOrigin + "/novo"}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar planejamento e leis no portal oficial ↗
            </a>
          </p>
        )}
        <div className="budget-documents">
          {(city.annual ? [] : documents).map((d) => (
            <a
              key={d.name}
              href={d.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                {d.name}
                <ArrowUpRight size={18} />
              </span>
              <h3>{d.title}</h3>
              <p>{d.text}</p>
              <small>Abrir documentos oficiais</small>
            </a>
          ))}
        </div>
      </section>
      <section
        className="revenue-panel revenue-method"
        aria-labelledby="revenue-method-heading"
      >
        <h2 id="revenue-method-heading">Como ler estes dados</h2>
        <p>
          {city.annual
            ? "A previsão e o arrecadado são os campos ORCADO e ARRECADADO publicados para cada rubrica do exercício. Não somamos rubricas nem calculamos percentual global, pois a aditividade e a cobertura municipal não foram confirmadas. Valores negativos e zero são preservados."
            : "A previsão anual vem de uma coleta separada de receitas previstas. O valor de orçamento repetido em cada documento de arrecadação não é somado. Anulações e outros valores negativos são preservados exatamente como publicados."}
        </p>
        <p>
          {city.annual
            ? "A fonte consultada não oferece uma série mensal comparável para os três grupos. Cada linha representa uma rubrica anual, com seu código e origem. Campos ausentes permanecem indisponíveis; não são convertidos em zero."
            : "Os resumos agrupam documentos por exercício, unidade, conta, fonte de recurso e tipo. Cada mês indica quantos documentos compõem seu valor. Contas sem arrecadação no período e campos sem valor permanecem indisponíveis, sem serem convertidos em zero."}
        </p>
        <p>
          Os dados da API podem estar defasados; a data do último documento não
          garante atualização completa até aquele dia. Este módulo não
          representa saldo em caixa, execução de despesas ou orçamento
          consolidado de todos os órgãos do município.
        </p>
      </section>
    </main>
  );
}
