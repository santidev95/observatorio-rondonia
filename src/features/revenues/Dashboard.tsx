"use client";
import {
  Alert,
  Button,
  NativeSelect,
  Pagination,
  Table,
  TextInput,
} from "@mantine/core";
import { Search, X, ArrowUpRight, Download } from "@/features/shared/icons";
import { currency, dateLabel, percentLabel } from "@/features/shared/display";
import type { RevenueDashboardView } from "./dashboard-view";
import { useCatalogNavigation } from "@/features/shared/use-catalog-navigation";
import {
  monthNames,
  revenueDefaults,
  revenueFilterQuery,
  shortLabel,
} from "./filters";

export function RevenueDashboard({ view }: { view: RevenueDashboardView }) {
  const annual = view.aggregation === "annual-accounts";
  const municipality = view.municipality;
  const {
    latestYear,
    filters,
    totals,
    units,
    categories,
    monthly,
    page,
    pages,
    count,
  } = view;
  const { draft, pending, update, changePage } = useCatalogNavigation(
    `/${municipality}/receitas/`,
    filters,
    view.query,
    (next) => revenueFilterQuery(next, latestYear),
  );
  const yearStats = view.years.find((y) => String(y.year) === filters.year);
  const max = Math.max(
    1,
    ...monthly.map((m) => Math.abs(m.realizedCents ?? 0)),
  );
  const sourceHref = view.sourceUrl;
  return (
    <>
      <section
        className="search-panel revenue-filters"
        aria-label="Filtros de receitas"
        aria-busy={pending}
      >
        <TextInput
          aria-label="Buscar receita, conta ou fonte de recurso"
          leftSection={<Search size={20} aria-hidden="true" />}
          type="search"
          placeholder="Buscar receita, conta ou fonte de recurso..."
          value={draft.q}
          maxLength={200}
          onChange={(e) => update({ q: e.target.value })}
        />
        <div className="revenue-selects">
          <NativeSelect
            label="Exercício"
            value={filters.year}
            disabled={pending}
            onChange={(e) =>
              update({ year: e.target.value, unit: "", category: "" })
            }
          >
            {view.years.map((y) => (
              <option key={y.year} value={y.year}>
                {y.year}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            label="Unidade gestora"
            value={filters.unit}
            disabled={pending}
            onChange={(e) => update({ unit: e.target.value })}
          >
            <option value="">Todas as unidades</option>
            {units.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            label="Tipo de receita"
            value={filters.kind}
            disabled={pending}
            onChange={(e) => update({ kind: e.target.value, category: "" })}
          >
            <option value="budget">Orçamentária</option>
            {!annual && (
              <>
                <option value="extra">Extraorçamentária</option>
                <option value="unknown">Tipo não informado</option>
              </>
            )}
          </NativeSelect>
          <NativeSelect
            label="Categoria"
            value={filters.category}
            disabled={pending}
            onChange={(e) => update({ category: e.target.value })}
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {shortLabel(c)}
              </option>
            ))}
          </NativeSelect>
          {!annual && (
            <NativeSelect
              label="Período da arrecadação"
              value={filters.month}
              disabled={pending}
              onChange={(e) => update({ month: e.target.value })}
            >
              <option value="">Todos os meses publicados</option>
              {monthNames.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
        <div className="revenue-filter-footer">
          <span>
            {annual
              ? `Prefeitura de ${view.municipalityName} (UG ${view.company}) · Receitas diretas e transferências estaduais e federais`
              : "Portal da Prefeitura e suas unidades · IPAM e Câmara fora deste recorte"}
          </span>
          {revenueFilterQuery(filters, latestYear) && (
            <Button
              leftSection={<X size={14} aria-hidden="true" />}
              onClick={() => update(revenueDefaults(latestYear))}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </section>
      {pending && (
        <p className="sr-only" role="status">
          Atualizando receitas...
        </p>
      )}
      <div className="revenue-coverage">
        <span>
          Exercício <strong>{filters.year}</strong> ·{" "}
          {annual ? (
            "Rubricas anuais · cobertura parcial"
          ) : (
            <>
              Documentos da fonte até{" "}
              <strong>{dateLabel(yearStats?.lastDocumentDate ?? null)}</strong>
            </>
          )}
        </span>
        <span>Consulta em {dateLabel(view.generatedAt)}</span>
      </div>
      {view.warnings.map((warning) => (
        <Alert key={warning} className="revenue-notice" role="status">
          {warning}
        </Alert>
      ))}
      {annual ? (
        <section className="revenue-metrics" aria-label="Cobertura do recorte">
          <article>
            <span>Rubricas no recorte</span>
            <strong>{count.toLocaleString("pt-BR")}</strong>
            <small>
              Valores anuais por linha; sem soma ou percentual global.
            </small>
          </article>
        </section>
      ) : (
        <section
          className="revenue-metrics"
          aria-label="Resumo do recorte selecionado"
          aria-live="polite"
        >
          <article>
            <span>Previsão anual da receita</span>
            <strong>
              {filters.kind === "budget"
                ? currency(totals.plannedCents, true)
                : "Não se aplica"}
            </strong>
            <small>{filters.year} · Independente do mês escolhido</small>
          </article>
          <article>
            <span>
              {filters.kind === "budget"
                ? "Arrecadação registrada"
                : "Entradas registradas"}
            </span>
            <strong>{currency(totals.realizedCents, true)}</strong>
            <small>
              {filters.month
                ? monthNames[Number(filters.month) - 1]
                : "Todos os meses publicados"}{" "}
              · Com valores negativos da fonte
            </small>
          </article>
          <article>
            <span>Sobre a previsão anual</span>
            <strong>{percentLabel(totals.percent)}</strong>
            <small>
              {totals.percent === null
                ? "Comparação indisponível neste recorte"
                : "Não representa execução de despesas"}
            </small>
          </article>
          <article>
            <span>Documentos no período</span>
            <strong>{totals.documents.toLocaleString("pt-BR")}</strong>
            <small>
              {count.toLocaleString("pt-BR")} contas e fontes no recorte
            </small>
          </article>
        </section>
      )}
      {(totals.missing > 0 || totals.missingPlanned > 0) && (
        <Alert className="revenue-notice" role="status">
          Há {totals.missing} {annual ? "rubricas" : "documentos"} e{" "}
          {totals.missingPlanned} previsões sem valor válido.{" "}
          {annual
            ? "Os campos ausentes permanecem indisponíveis, sem serem convertidos em zero."
            : "As somas têm cobertura parcial; o percentual não é calculado."}
        </Alert>
      )}
      {filters.kind !== "budget" && (
        <Alert className="revenue-notice" role="status">
          Entradas extraorçamentárias e tipos não informados são apresentados
          separadamente da receita orçamentária. Não são comparados à previsão
          anual.
        </Alert>
      )}
      {!annual && (
        <section
          className="revenue-panel"
          aria-labelledby="revenue-monthly-heading"
        >
          <div className="revenue-section-heading">
            <div>
              <h2 id="revenue-monthly-heading">Evolução mensal</h2>
              <p>
                Valores registrados no exercício e no recorte selecionado. Mês
                sem documento permanece indisponível.
              </p>
            </div>
          </div>
          <div className="revenue-month-chart">
            {monthly.map((m) => (
              <div
                key={m.month}
                className={`revenue-month ${filters.month === String(m.month) ? "selected" : ""}`}
              >
                <div className="revenue-bar-space" aria-hidden="true">
                  <span
                    className={(m.realizedCents ?? 0) < 0 ? "negative" : ""}
                    style={{
                      height: `${(Math.abs(m.realizedCents ?? 0) / max) * 100}%`,
                    }}
                  />
                </div>
                <strong>{m.name.slice(0, 3)}</strong>
                <small>
                  {m.realizedCents === null
                    ? "Sem registros"
                    : currency(m.realizedCents, true)}
                </small>
                <span className="sr-only">
                  {m.documents} documentos
                  {m.missing > 0 ? `; ${m.missing} valores ausentes` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      <section
        className="revenue-panel"
        aria-labelledby="revenue-accounts-heading"
      >
        <div className="revenue-section-heading">
          <div>
            <h2 id="revenue-accounts-heading">Receitas por conta e fonte</h2>
            <p>
              {annual
                ? "Valores anuais publicados por rubrica. As linhas não são somadas para estimar o total municipal."
                : "A previsão é anual. A arrecadação acompanha o período escolhido."}
            </p>
          </div>
          <NativeSelect
            className="revenue-sort"
            label="Ordenar por"
            value={filters.sort}
            disabled={pending}
            onChange={(e) => update({ sort: e.target.value })}
          >
            <option value="realized">Maior valor registrado</option>
            <option value="planned">Maior previsão anual</option>
            <option value="account">Conta, de A a Z</option>
          </NativeSelect>
        </div>
        {!count ? (
          <Alert className="revenue-notice" role="status">
            Nenhuma receita encontrada para estes filtros.
          </Alert>
        ) : (
          <div
            className="revenue-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Tabela de receitas com rolagem horizontal"
          >
            <Table className="revenue-table">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th scope="col">Conta e fonte de recurso</Table.Th>
                  <Table.Th scope="col">Unidade gestora</Table.Th>
                  <Table.Th scope="col">Previsão anual</Table.Th>
                  <Table.Th scope="col">
                    {annual
                      ? "Arrecadado informado no ano"
                      : "Registrado no período"}
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {view.rows.map((e) => {
                  const received = e.received;
                  return (
                    <Table.Tr key={e.id}>
                      <Table.Th scope="row">
                        <strong>{e.account}</strong>
                        <small>{e.fundingSource}</small>
                        <details>
                          <summary>Classificação e cobertura</summary>
                          <p>
                            {e.category}
                            <br />
                            {e.origin}
                            <br />
                            {e.plannedLines} linhas de previsão ·{" "}
                            {received.documents}{" "}
                            {annual ? "rubricas anuais" : "documentos"} ·{" "}
                            {received.missing + e.missingPlannedValues} valores
                            ausentes
                          </p>
                          {e.sourceUrl && (
                            <a
                              href={e.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Código {e.sourceId} · consultar grupo na fonte ↗
                            </a>
                          )}
                        </details>
                      </Table.Th>
                      <Table.Td>{e.unitName}</Table.Td>
                      <Table.Td className="revenue-money">
                        {e.kind === "budget"
                          ? currency(e.plannedCents)
                          : "Não se aplica"}
                      </Table.Td>
                      <Table.Td className="revenue-money">
                        {currency(received.cents)}
                        {!received.documents && (
                          <small>Sem documentos no período</small>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
        )}
        <div className="revenue-pagination">
          <span aria-live="polite">
            {count.toLocaleString("pt-BR")} contas e fontes · Página {page} de{" "}
            {pages}
          </span>
          <nav aria-label="Paginação de receitas">
            <Pagination
              total={pages}
              value={page}
              disabled={pending}
              onChange={changePage}
              getItemProps={(number) => ({ "aria-label": `Página ${number}` })}
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
        </div>
      </section>
      <div className="revenue-source-links">
        <Button
          component="a"
          href={sourceHref}
          target="_blank"
          rel="noopener noreferrer"
          rightSection={<ArrowUpRight size={15} aria-hidden="true" />}
        >
          Consultar dados na API
        </Button>
        <Button
          component="a"
          href={`/api/${municipality}/receitas?ano=${filters.year}`}
          download
          rightSection={<Download size={15} aria-hidden="true" />}
        >
          Baixar os resumos em JSON
        </Button>
      </div>
    </>
  );
}
