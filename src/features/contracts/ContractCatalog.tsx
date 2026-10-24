"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Kbd,
  NativeSelect,
  Paper,
  Table,
  TextInput,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ContractPage, ContractsQuery } from "@/core/contracts";
import type { DataMunicipality } from "@/core/municipal-sources";
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

function pageUrl(
  page: number,
  year: number | null,
  municipality: DataMunicipality,
): string {
  const params = new URLSearchParams({ page: String(page) });
  if (year !== null) params.set("ano", String(year));
  return "/" + municipality + "/contratos?" + params.toString();
}

export function ContractCatalog({
  catalog,
  query,
  currentYear,
  municipality = "porto-velho",
}: {
  catalog: ContractPage;
  query: ContractsQuery;
  currentYear: number;
  municipality?: DataMunicipality;
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
    "/" +
    municipality +
    "/contratos/" +
    id +
    "?" +
    pageUrl(page, query.year, municipality).split("?")[1];
  const navigateYear = (year: number | null) =>
    startTransition(() => router.push(pageUrl(1, year, municipality)));
  const clear = () => {
    setFilters(defaultContractPageFilters);
    if (query.year !== null)
      navigateYear(municipality !== "porto-velho" ? currentYear : null);
  };

  return (
    <section
      className="contract-catalog"
      aria-label="Consulta de contratos"
      aria-busy={pending}
    >
      <Paper className="search-panel" withBorder radius="md">
        <h2 className="filters-heading">Filtros da consulta</h2>
        <TextInput
          id="contract-page-search"
          className="contract-search"
          classNames={{ label: "contracts-sr-only" }}
          label="Buscar nesta página por contrato, objeto, empresa, documento ou processo"
          type="search"
          size="md"
          leftSection={<Icon name="search" />}
          rightSection={<Kbd size="xs">ESC</Kbd>}
          rightSectionWidth={56}
          placeholder="Buscar por contrato, objeto, empresa ou processo..."
          value={filters.q}
          maxLength={300}
          aria-describedby="contract-filter-scope"
          onChange={(event) => update({ q: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Escape") update({ q: "" });
          }}
        />
        <div className="filter-row">
          <div className="filter-selects">
            <NativeSelect
              id="contract-year"
              className="select-wrap"
              label={
                <>
                  Ano
                  <span className="contracts-sr-only"> solicitado à fonte</span>
                </>
              }
              data-active={
                query.year !== null &&
                (municipality === "porto-velho" || query.year !== currentYear)
              }
              value={query.year ?? ""}
              disabled={pending}
              onChange={(event) =>
                navigateYear(
                  event.target.value === "" ? null : Number(event.target.value),
                )
              }
            >
              {municipality === "porto-velho" && (
                <option value="">Todos os anos</option>
              )}
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              id="contract-department"
              className="select-wrap"
              label={
                <>
                  Órgão<span className="contracts-sr-only"> nesta página</span>
                </>
              }
              data-active={filters.org !== ""}
              value={filters.org}
              disabled={pending}
              aria-describedby="contract-filter-scope"
              onChange={(event) => update({ org: event.target.value })}
            >
              <option value="">Todos os órgãos</option>
              {options.orgs.map((org) => (
                <option key={org} value={org}>
                  {org}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              id="contract-status"
              className="select-wrap"
              label={
                <>
                  Situação
                  <span className="contracts-sr-only"> nesta página</span>
                </>
              }
              data-active={filters.status !== ""}
              value={filters.status}
              disabled={pending}
              aria-describedby="contract-filter-scope"
              onChange={(event) => update({ status: event.target.value })}
            >
              <option value="">Todas as situações</option>
              {options.statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </NativeSelect>
            {active && (
              <Button
                type="button"
                disabled={pending}
                leftSection={<Icon name="close" size={14} />}
                onClick={clear}
              >
                Limpar filtros
              </Button>
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
          <NativeSelect
            id="contract-sort"
            className="sort-select"
            label="Ordenar por"
            data-active={filters.sort !== "source"}
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
          </NativeSelect>
        </div>
        <p id="contract-filter-scope" className="filter-scope">
          Busca, órgão, situação e ordenação se aplicam somente aos registros
          desta página. O ano é solicitado à API.
        </p>
      </Paper>
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
            <Table className="contracts-table">
              <Table.Caption className="contracts-sr-only">
                Contratos municipais nesta página da API que correspondem aos
                filtros locais
              </Table.Caption>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th scope="col">Contrato e objeto</Table.Th>
                  <Table.Th scope="col">Empresa e órgão</Table.Th>
                  <Table.Th scope="col" className="numeric">
                    Valor informado
                  </Table.Th>
                  <Table.Th scope="col">Vigência</Table.Th>
                  <Table.Th scope="col">Situação</Table.Th>
                  <Table.Th scope="col" className="action-column">
                    <span className="contracts-sr-only">Detalhes</span>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shown.map((contract) => (
                  <Table.Tr key={contract.id}>
                    <Table.Th scope="row">
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
                    </Table.Th>
                    <Table.Td>
                      <span className="contract-supplier">
                        {contractSuppliers(contract)}
                      </span>
                      <small className="contract-meta">
                        {contractDepartment(contract)}
                      </small>
                    </Table.Td>
                    <Table.Td className="numeric">
                      <strong className="money">
                        {formatContractMoney(contract.amountCents)}
                      </strong>
                    </Table.Td>
                    <Table.Td>
                      <span className="contract-date">
                        {formatContractDate(contract.startsOn)}
                      </span>
                      <small className="contract-meta">
                        até {formatContractDate(contract.endsOn)}
                      </small>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        className="contract-status"
                        color="gray"
                        variant="light"
                        radius="sm"
                      >
                        {contract.status ?? "Não informada"}
                      </Badge>
                    </Table.Td>
                    <Table.Td className="action-column">
                      <ActionIcon
                        component={Link}
                        className="contract-row-action"
                        variant="light"
                        size={44}
                        href={detailUrl(contract.id)}
                        aria-label={
                          "Ver detalhes do contrato " +
                          (contract.number ?? contract.id)
                        }
                        title="Ver detalhes do contrato"
                        prefetch={false}
                      >
                        <Icon name="chevron" />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
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
            <Button type="button" onClick={clear}>
              Limpar filtros
            </Button>
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
            <Button
              component={Link}
              href={pageUrl(page - 1, query.year, municipality)}
              rel="prev"
              prefetch={false}
            >
              Anterior
            </Button>
          ) : (
            <Button type="button" disabled>
              Anterior
            </Button>
          )}
          <span aria-current="page">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Button
              component={Link}
              href={pageUrl(page + 1, query.year, municipality)}
              rel="next"
              prefetch={false}
            >
              Próxima
            </Button>
          ) : (
            <Button type="button" disabled>
              Próxima
            </Button>
          )}
        </nav>
      </div>
    </section>
  );
}
