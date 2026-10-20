import type { Metadata } from "next";
import { RevenueDashboard } from "@/features/revenues/Dashboard";
import { getRevenues } from "@/lib/municipal-data";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Geist } from "next/font/google";
import { ModuleNavigation } from "@/features/shared/ModuleNavigation";
import { CacheNotice } from "@/features/contracts/CacheNotice";
import { parseRevenueQuery } from "@/core/municipal-query";
import "@/features/shared/modules.css";
const geist = Geist({ subsets: ["latin"], display: "swap" });
export const runtime = "nodejs";
import { revenueDashboardView } from "@/features/revenues/dashboard-view";
import {
  searchParamsQuery,
  type PageSearchParams,
} from "@/features/shared/catalog-query";
import { ArrowUpRight } from "@/features/shared/icons";
export const metadata: Metadata = {
  title: "Receitas e orçamento",
  description:
    "Previsão de receitas, arrecadação mensal e documentos de planejamento orçamentário de Porto Velho.",
};
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
  if ((await params).municipio !== "porto-velho") notFound();
  await connection();
  const raw = await searchParams;
  let result: Awaited<ReturnType<typeof getRevenues>> | undefined;
  let problem = "";
  try {
    const { year } = parseRevenueQuery(raw);
    result = await getRevenues(year);
  } catch {
    problem =
      "Não foi possível consultar o exercício completo. Revise os filtros ou tente novamente em alguns instantes.";
  }
  const revenueSnapshot = result?.data;
  const view = revenueSnapshot
    ? revenueDashboardView(revenueSnapshot, searchParamsQuery(raw))
    : null;
  return (
    <main
      id="conteudo"
      className={
        geist.className + " container pvh-module page-main revenue-page"
      }
    >
      <ModuleNavigation active="receitas" />
      <h1 className="page-title">Receitas e orçamento</h1>
      <p className="page-intro">
        Acompanhe quanto foi previsto e o que a fonte registrou de arrecadação.
        Explore as contas, os meses e as unidades gestoras, com acesso ao
        planejamento oficial.
      </p>
      {view ? (
        <RevenueDashboard view={view} />
      ) : (
        <div className="notice" role="status">
          {problem}{" "}
          <a href="https://transparencia.portovelho.ro.gov.br/receitas">
            Consultar fonte oficial ↗
          </a>
        </div>
      )}
      {result && (
        <details className="catalog-provenance">
          <summary>Fonte e detalhes da consulta</summary>
          <p>
            Resumo completo do exercício solicitado, consolidado após validar
            todas as páginas de documentos e previsões. A API pode mudar durante
            a leitura; não oferece revisão transacional.
          </p>
          <CacheNotice cache={result.cache} />
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
        <div className="budget-documents">
          {documents.map((d) => (
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
          A previsão anual vem de uma coleta separada de receitas previstas. O
          valor de orçamento repetido em cada documento de arrecadação não é
          somado. Anulações e outros valores negativos são preservados
          exatamente como publicados.
        </p>
        <p>
          Os resumos agrupam documentos por exercício, unidade, conta, fonte de
          recurso e tipo. Cada mês indica quantos documentos compõem seu valor.
          Contas sem arrecadação no período e campos sem valor permanecem
          indisponíveis, sem serem convertidos em zero.
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
