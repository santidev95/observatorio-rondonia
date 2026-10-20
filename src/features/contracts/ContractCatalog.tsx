"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ContractPage, ContractsQuery } from "@/core/contracts";
import {
  contractDepartment,
  contractSuppliers,
  contractPageOptions,
  defaultContractPageFilters,
  filterContractPage,
  sentenceCaseObject,
  type ContractPageFilters,
} from "./catalog-view";
import { formatContractDate, formatContractMoney } from "./format";

function Icon({
  name,
  size = 20,
}: {
  name: "search" | "chevron" | "close";
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "search" ? (
        <>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </>
      ) : name === "chevron" ? (
        <path d="m9 18 6-6-6-6" />
      ) : (
        <>
          <path d="m18 6-12 12M6 6l12 12" />
        </>
      )}
    </svg>
  );
}

function pageUrl(page: number, year: number | null): string {
  const params = new URLSearchParams({ page: String(page) });
  if (year !== null) params.set("ano", String(year));
  return "/porto-velho/contratos?" + params.toString();
}

export function ContractCatalog({
  catalog,
  query,
  currentYear,
}: {
  catalog: ContractPage;
  query: ContractsQuery;
  currentYear: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState<ContractPageFilters>(
    defaultContractPageFilters,
  );
  const update = (changes: Partial<ContractPageFilters>) =>
    setFilters((current) => ({ ...current, ...changes }));
  const options = contractPageOptions(catalog.records);
  const shown = filterContractPage(catalog.records, filters);
  const active =
    filters.q !== "" ||
    filters.org !== "" ||
    filters.status !== "" ||
    filters.sort !== "source" ||
    query.year !== null;
  const years = Array.from(
    new Set([
      ...(query.year === null ? [] : [query.year]),
      ...Array.from(
        { length: currentYear - 2000 + 1 },
        (_, index) => currentYear - index,
      ),
    ]),
  ).sort((a, b) => b - a);
  const {
    currentPage: page,
    lastPage: pages,
    total,
    perPage,
  } = catalog.pagination;
  const first = catalog.records.length ? (page - 1) * perPage + 1 : 0;
  const last = Math.min((page - 1) * perPage + catalog.records.length, total);
  const detailUrl = (id: string) =>
    "/porto-velho/contratos/" +
    id +
    "?" +
    pageUrl(page, query.year).split("?")[1];
  const navigateYear = (year: number | null) =>
    startTransition(() => router.push(pageUrl(1, year)));
  const clear = () => {
    setFilters(defaultContractPageFilters);
    if (query.year !== null) navigateYear(null);
  };

  return (
    <section
      className="contract-catalog"
      aria-label="Consulta de contratos"
      aria-busy={pending}
    >
      <div className="search-panel">
        <label className="search-field">
          <Icon name="search" />
          <span className="contracts-sr-only">
            Buscar nesta página por contrato, objeto, empresa, documento ou
            processo
          </span>
          <input
            type="search"
            placeholder="Buscar por contrato, objeto, empresa ou processo..."
            value={filters.q}
            maxLength={300}
            aria-describedby="contract-filter-scope"
            onChange={(event) => update({ q: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape") update({ q: "" });
            }}
          />
          <kbd>ESC</kbd>
        </label>
        <div className="filter-row">
          <div className="filter-selects">
            <label className="select-wrap">
              <span className="contracts-sr-only">Ano solicitado à fonte</span>
              <select
                value={query.year ?? ""}
                disabled={pending}
                onChange={(event) =>
                  navigateYear(
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                  )
                }
              >
                <option value="">Ano: Todos</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-wrap">
              <span className="contracts-sr-only">Órgão nesta página</span>
              <select
                value={filters.org}
                disabled={pending}
                aria-describedby="contract-filter-scope"
                onChange={(event) => update({ org: event.target.value })}
              >
                <option value="">Órgão: Todos</option>
                {options.orgs.map((org) => (
                  <option key={org} value={org}>
                    {org}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-wrap">
              <span className="contracts-sr-only">Situação nesta página</span>
              <select
                value={filters.status}
                disabled={pending}
                aria-describedby="contract-filter-scope"
                onChange={(event) => update({ status: event.target.value })}
              >
                <option value="">Situação: Todas</option>
                {options.statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            {active && (
              <button
                className="clear-button"
                type="button"
                disabled={pending}
                onClick={clear}
              >
                <Icon name="close" size={13} />
                Limpar filtros
              </button>
            )}
          </div>
        </div>
        <div className="results-bar">
          <span role="status" aria-live="polite">
            <span className="gold-dot" />
            Exibindo <strong>{shown.length.toLocaleString("pt-BR")}</strong>
            {shown.length !== catalog.records.length &&
              " de " + catalog.records.length}{" "}
            contratos nesta página
          </span>
          <label className="sort-select">
            Ordenar:
            <select
              value={filters.sort}
              disabled={pending}
              aria-describedby="contract-filter-scope"
              onChange={(event) =>
                update({
                  sort: event.target.value as ContractPageFilters["sort"],
                })
              }
            >
              <option value="source">Ordem da fonte</option>
              <option value="updated">Atualização da fonte</option>
              <option value="signed">Assinatura mais recente</option>
              <option value="value">Maior valor</option>
            </select>
          </label>
        </div>
        <p id="contract-filter-scope" className="filter-scope">
          Busca, órgão, situação e ordenação se aplicam somente aos registros
          desta página. O ano é solicitado à API.
        </p>
      </div>
      {pending && (
        <p className="contracts-sr-only" role="status">
          Atualizando contratos...
        </p>
      )}
      {catalog.warnings.length > 0 && (
        <div
          className="contracts-source-warnings"
          role="status"
          aria-label="Observações da consulta"
        >
          {catalog.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      {shown.length ? (
        <div className="table-wrap">
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Tabela de contratos; role horizontalmente em telas pequenas"
          >
            <table className="contracts-table">
              <caption className="contracts-sr-only">
                Contratos municipais nesta página da API que correspondem aos
                filtros locais
              </caption>
              <thead>
                <tr>
                  <th scope="col">Contrato e objeto</th>
                  <th scope="col">Empresa e órgão</th>
                  <th scope="col" className="numeric">
                    Valor informado
                  </th>
                  <th scope="col">Vigência</th>
                  <th scope="col">Situação</th>
                  <th scope="col" className="action-column">
                    <span className="contracts-sr-only">Detalhes</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((contract) => (
                  <tr key={contract.id}>
                    <th scope="row">
                      <Link
                        className="contract-number"
                        href={detailUrl(contract.id)}
                        prefetch={false}
                      >
                        {contract.number ?? "Número não informado"}
                      </Link>
                      <p className="contract-object">
                        {contract.object
                          ? sentenceCaseObject(contract.object)
                          : "Objeto não informado"}
                      </p>
                      <small className="contract-meta">
                        {contract.process
                          ? "Processo " + contract.process
                          : "Processo não informado"}
                        {" · Ano informado: "}
                        {contract.year ?? "Não informado"}
                      </small>
                    </th>
                    <td>
                      <span className="contract-supplier">
                        {contractSuppliers(contract)}
                      </span>
                      <small className="contract-meta">
                        {contractDepartment(contract)}
                      </small>
                    </td>
                    <td className="numeric">
                      <strong className="money">
                        {formatContractMoney(contract.amountCents)}
                      </strong>
                    </td>
                    <td>
                      <span className="contract-date">
                        {formatContractDate(contract.startsOn)}
                      </span>
                      <small className="contract-meta">
                        até {formatContractDate(contract.endsOn)}
                      </small>
                    </td>
                    <td>
                      <span className="contract-status">
                        {contract.status ?? "Não informada"}
                      </span>
                    </td>
                    <td className="action-column">
                      <Link
                        className="row-button"
                        href={detailUrl(contract.id)}
                        aria-label={
                          "Ver detalhes do contrato " +
                          (contract.number ?? contract.id)
                        }
                        title="Ver detalhes do contrato"
                        prefetch={false}
                      >
                        <Icon name="chevron" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="contracts-empty">
          <h2>Nenhum contrato encontrado</h2>
          <p>
            {catalog.records.length
              ? "Tente outro termo ou limpe os filtros desta página."
              : "A fonte não retornou registros para esta página e ano solicitado."}
          </p>
          {active && (
            <button className="clear-button" type="button" onClick={clear}>
              Limpar filtros
            </button>
          )}
        </div>
      )}
      <div className="pagination-footer">
        <span>
          {shown.length === catalog.records.length
            ? "Mostrando"
            : "Página da API:"}{" "}
          {first} a {last} de {total.toLocaleString("pt-BR")} contratos na API
          {shown.length !== catalog.records.length &&
            " · " +
              shown.length +
              (shown.length === 1
                ? " visível após os filtros"
                : " visíveis após os filtros")}
        </span>
        <nav
          className="pagination-buttons"
          aria-label="Paginação dos contratos"
        >
          {page > 1 ? (
            <Link
              href={pageUrl(page - 1, query.year)}
              rel="prev"
              prefetch={false}
            >
              Anterior
            </Link>
          ) : (
            <span className="is-disabled" aria-disabled="true">
              Anterior
            </span>
          )}
          <span aria-current="page">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link
              href={pageUrl(page + 1, query.year)}
              rel="next"
              prefetch={false}
            >
              Próxima
            </Link>
          ) : (
            <span className="is-disabled" aria-disabled="true">
              Próxima
            </span>
          )}
        </nav>
      </div>
    </section>
  );
}
