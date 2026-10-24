"use client";
import Link from "next/link";
import {
  ActionIcon,
  Button,
  NativeSelect,
  Pagination,
  Table,
  TextInput,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileSearch, Search, X } from "@/features/shared/icons";
import type { Work } from "@/core/works";
import type { DataMunicipality } from "@/core/municipal-sources";
import { currency, dateLabel, percentLabel } from "@/features/shared/display";
import { sentenceCase, workTitle } from "./presentation";
import {
  defaultFilters,
  filterWorks,
  readFilters,
  type Filters,
} from "./filters";
import {
  workStorageKeys,
  readWorkPage,
  rememberWorkPosition,
  worksUrl,
} from "./navigation";
import { Status } from "./Status";

export function WorkList({
  works,
  home = false,
  municipality = "porto-velho",
  year,
}: {
  works: Work[];
  home?: boolean;
  municipality?: DataMunicipality;
  year?: number;
}) {
  const context = { municipality, year };
  const storage = workStorageKeys(municipality);
  const annual = municipality !== "porto-velho";
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);
  const restore = useRef<{ url: string; y: number } | null>(null);
  const results = useRef<HTMLDivElement>(null);
  const filtered = useMemo(
    () => (home ? works : filterWorks(works, filters)),
    [works, filters, home],
  );
  const limit = home ? 5 : 12;
  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * limit, currentPage * limit);
  const listUrl = worksUrl(filters, currentPage, context);
  const statuses = [...new Set(works.map((work) => work.status))].sort();
  const organizations = [
    ...new Map(
      works
        .filter((work) => work.organization)
        .map((work) => [
          work.organization!,
          work.organizationName ?? work.organization!,
        ]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const neighborhoods = [
    ...new Set(
      works
        .map((work) => work.neighborhood)
        .filter((value): value is string => !!value),
    ),
  ].sort();
  const active = !!(
    filters.q ||
    filters.status ||
    filters.org ||
    filters.neighborhood ||
    filters.sort !== "updated"
  );

  useEffect(() => {
    if (home) {
      setReady(true);
      return;
    }
    const read = () => {
      setFilters(readFilters(window.location.search));
      setPage(readWorkPage(window.location.search));
      setReady(true);
    };
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(storage.position) ?? "null",
      );
      const target = sessionStorage.getItem(storage.restore);
      if (
        saved &&
        saved.url === target &&
        target === window.location.pathname + window.location.search &&
        Number.isFinite(saved.y) &&
        saved.y >= 0
      )
        restore.current = saved;
      sessionStorage.removeItem(storage.restore);
    } catch {
      /* Filters do not depend on browser storage. */
    }
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [home, municipality, year, storage.position, storage.restore]);

  useEffect(() => {
    if (!ready || !restore.current || restore.current.url !== listUrl) return;
    const y = restore.current.y;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "instant" });
        restore.current = null;
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [ready, listUrl]);

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    window.history.replaceState(null, "", worksUrl(next, 1, context));
  }
  function changePage(next: number) {
    setPage(next);
    window.history.replaceState(null, "", worksUrl(filters, next, context));
    results.current?.focus({ preventScroll: true });
    results.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  const detailHref = (work: Work) =>
    `/${municipality}/obras/${work.sourceId}/?${annual ? `ano=${year}&` : ""}from=${encodeURIComponent(listUrl)}`;

  return (
    <section
      className={`work-list ${home ? "recent-works" : "catalog-works"}`}
      id="explorar"
      aria-label="Consulta de obras"
    >
      {!home && (
        <div className="search-panel work-search">
          <TextInput
            className="work-search-input"
            id="work-search"
            type="search"
            aria-label="Buscar obra ou localização"
            leftSection={<Search size={20} aria-hidden="true" />}
            rightSectionPointerEvents="all"
            rightSection={
              filters.q ? (
                <ActionIcon
                  type="button"
                  variant="subtle"
                  aria-label="Limpar busca"
                  onClick={() => {
                    update({ q: "" });
                    document.getElementById("work-search")?.focus();
                  }}
                >
                  <X size={18} aria-hidden="true" />
                </ActionIcon>
              ) : null
            }
            value={filters.q}
            placeholder="Buscar obra ou localização"
            enterKeyHint="search"
            aria-describedby="work-search-help"
            onChange={(event) => update({ q: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape") update({ q: "" });
            }}
          />
          <p id="work-search-help" className="search-help">
            Busca nos registros carregados de obras, por nome e localização.
          </p>
          <div className="work-filter-controls">
            <NativeSelect
              className="work-filter"
              label="Situação"
              value={filters.status}
              onChange={(event) => update({ status: event.target.value })}
            >
              <option value="">Todas as situações</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </NativeSelect>
            <details className="more-filters">
              <summary>
                Mais filtros
                {filters.org || filters.neighborhood ? " · ativos" : ""}
              </summary>
              <div className="more-filters-content">
                <NativeSelect
                  className="work-filter"
                  label="Secretaria responsável"
                  value={filters.org}
                  onChange={(event) => update({ org: event.target.value })}
                >
                  <option value="">Todas as secretarias</option>
                  {organizations.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name === code
                        ? `${code} — nome não informado`
                        : `${name} (${code})`}
                    </option>
                  ))}
                </NativeSelect>
                {neighborhoods.length > 0 && (
                  <NativeSelect
                    className="work-filter"
                    label="Bairro"
                    value={filters.neighborhood}
                    onChange={(event) =>
                      update({ neighborhood: event.target.value })
                    }
                  >
                    <option value="">Todos os bairros</option>
                    {neighborhoods.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </NativeSelect>
                )}
                {!neighborhoods.length && (
                  <p className="search-help">
                    A Prefeitura não publica bairros padronizados nesta base.
                    Busque bairros e distritos pelo nome.
                  </p>
                )}
              </div>
            </details>
            {active && (
              <Button
                type="button"
                variant="subtle"
                onClick={() => update(defaultFilters)}
              >
                Limpar todos os filtros
              </Button>
            )}
          </div>
        </div>
      )}
      <div
        ref={results}
        id="resultados-obras"
        tabIndex={-1}
        className="works-results"
      >
        {!home && (
          <div className="results-bar">
            <span role="status" aria-live="polite">
              {filtered.length}{" "}
              {filtered.length === 1 ? "obra encontrada" : "obras encontradas"}
            </span>
            <NativeSelect
              className="work-sort"
              label="Ordenar"
              aria-label="Ordenação"
              value={filters.sort}
              onChange={(event) => update({ sort: event.target.value })}
            >
              <option value="updated">Atualização da Prefeitura</option>
              <option value="value">
                {annual
                  ? "Maior valor total informado"
                  : "Maior valor contratado"}
              </option>
              <option value="name">Nome da obra</option>
            </NativeSelect>
          </div>
        )}
        {shown.length ? (
          <>
            <div className="works-table-card desktop-works">
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Tabela de obras"
              >
                <Table className="works-table catalog-table">
                  <Table.Caption className="sr-only">
                    Obras da base municipal que correspondem à consulta
                  </Table.Caption>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th scope="col">Obra</Table.Th>
                      <Table.Th scope="col">Local e responsável</Table.Th>
                      <Table.Th scope="col" className="numeric">
                        {annual
                          ? "Valor total informado / pago"
                          : "Contratado / pago"}
                      </Table.Th>
                      <Table.Th scope="col">Situação</Table.Th>
                      <Table.Th scope="col">Percentual da fonte</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {shown.map((work) => (
                      <Table.Tr key={work.id}>
                        <Table.Th scope="row">
                          <Link
                            className="work-title"
                            href={detailHref(work)}
                            prefetch={false}
                            onClick={() => rememberWorkPosition(municipality)}
                          >
                            {workTitle(work.title)}
                          </Link>
                          <small className="work-updated">
                            Atualizado pela Prefeitura:{" "}
                            {dateLabel(work.sourceUpdatedAt)}
                          </small>
                        </Table.Th>
                        <Table.Td>
                          <span className="location-text">
                            {work.locations[0]
                              ? sentenceCase(work.locations[0])
                              : "Localização não informada"}
                          </span>
                          <small className="work-organization">
                            {work.organizationName ??
                              work.organization ??
                              "Responsável não informado"}
                          </small>
                        </Table.Td>
                        <Table.Td className="numeric">
                          <span className="money">
                            {currency(
                              work.contractedCents ??
                                work.declaredValueCents ??
                                null,
                            )}
                          </span>
                          <small className="paid-value">
                            Pago: {currency(work.paidCents)}
                          </small>
                        </Table.Td>
                        <Table.Td>
                          <Status value={work.status} />
                        </Table.Td>
                        <Table.Td>
                          <span>
                            {percentLabel(work.reportedExecutionPercent)}
                          </span>
                          {work.reportedExecutionPercent !== null && (
                            <span className="percent-track" aria-hidden="true">
                              <span
                                style={{
                                  width: `${Math.max(0, Math.min(100, work.reportedExecutionPercent))}%`,
                                }}
                              />
                            </span>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
              <p className="table-footnote">
                Percentual da fonte: a Prefeitura não define se é avanço físico
                ou financeiro.
              </p>
            </div>
            <ul className="mobile-works">
              {shown.map((work) => (
                <li key={work.id}>
                  <article className="work-card">
                    <Status value={work.status} />
                    <h2>{workTitle(work.title)}</h2>
                    <p>
                      {work.locations[0]
                        ? sentenceCase(work.locations[0])
                        : "Localização não informada"}
                    </p>
                    <dl className="card-values">
                      <div>
                        <dt>
                          {annual ? "Valor total informado" : "Contratado"}
                        </dt>
                        <dd>
                          {currency(
                            work.contractedCents ??
                              work.declaredValueCents ??
                              null,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Pago</dt>
                        <dd>{currency(work.paidCents)}</dd>
                      </div>
                    </dl>
                    <small className="work-updated">
                      Atualizado pela Prefeitura:{" "}
                      {dateLabel(work.sourceUpdatedAt)}
                    </small>
                    <Button
                      component={Link}
                      className="work-details-button"
                      href={detailHref(work)}
                      prefetch={false}
                      onClick={() => rememberWorkPosition(municipality)}
                      aria-label={`Ver detalhes de ${workTitle(work.title)}`}
                    >
                      Ver detalhes →
                    </Button>
                  </article>
                </li>
              ))}
            </ul>
            {!home && (
              <div className="pagination-footer">
                <span>
                  Mostrando {(currentPage - 1) * limit + 1} a{" "}
                  {Math.min(currentPage * limit, filtered.length)} de{" "}
                  {filtered.length}
                </span>
                {pages > 1 && (
                  <nav aria-label="Paginação de obras">
                    <Pagination
                      total={pages}
                      value={currentPage}
                      onChange={changePage}
                      getItemProps={(number) => ({
                        "aria-label": `Página ${number}`,
                      })}
                      getControlProps={(control) => ({
                        "aria-label": {
                          first: "Primeira página",
                          previous: "Página anterior",
                          next: "Próxima página",
                          last: "Última página",
                        }[control],
                      })}
                    />
                  </nav>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <FileSearch size={32} aria-hidden="true" />
            <h2>
              {works.length
                ? "Nenhuma obra para esta consulta"
                : "A base de obras ainda não está disponível"}
            </h2>
            <p>
              {works.length
                ? "Tente outro termo ou remova um filtro. Você pode buscar uma localização, um contrato ou uma empresa."
                : "Confira as fontes e o estado da coleta."}
            </p>
            {works.length ? (
              <div className="empty-actions">
                {filters.q && (
                  <Button onClick={() => update({ q: "" })}>
                    Limpar busca
                  </Button>
                )}
                <Button onClick={() => update(defaultFilters)}>
                  Limpar todos os filtros
                </Button>
              </div>
            ) : (
              <Button component={Link} href={"/" + municipality}>
                Consultar fontes
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
