"use client";
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
    "/porto-velho/receitas/",
    filters,
    view.query,
    (next) => revenueFilterQuery(next, latestYear),
  );
  const yearStats = view.years.find((y) => String(y.year) === filters.year);
  const max = Math.max(
    1,
    ...monthly.map((m) => Math.abs(m.realizedCents ?? 0)),
  );
  const sourceHref = `https://api.portovelho.ro.gov.br/api/v1/receitas?portal_id=12535&ano=${filters.year}`;
  return (
    <>
      <section
        className="search-panel revenue-filters"
        aria-label="Filtros de receitas"
        aria-busy={pending}
      >
        <label className="search-field">
          <Search size={20} aria-hidden="true" />
          <span className="sr-only">
            Buscar receita, conta ou fonte de recurso
          </span>
          <input
            type="search"
            placeholder="Buscar receita, conta ou fonte de recurso..."
            value={draft.q}
            maxLength={200}
            onChange={(e) => update({ q: e.target.value })}
          />
        </label>
        <div className="revenue-selects">
          <label>
            Exercício
            <select
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
            </select>
          </label>
          <label>
            Unidade gestora
            <select
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
            </select>
          </label>
          <label>
            Tipo de receita
            <select
              value={filters.kind}
              disabled={pending}
              onChange={(e) => update({ kind: e.target.value, category: "" })}
            >
              <option value="budget">Orçamentária</option>
              <option value="extra">Extraorçamentária</option>
              <option value="unknown">Tipo não informado</option>
            </select>
          </label>
          <label>
            Categoria
            <select
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
            </select>
          </label>
          <label>
            Período da arrecadação
            <select
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
            </select>
          </label>
        </div>
        <div className="revenue-filter-footer">
          <span>
            Portal da Prefeitura e suas unidades · IPAM e Câmara fora deste
            recorte
          </span>
          {revenueFilterQuery(filters, latestYear) && (
            <button
              className="button button-secondary"
              onClick={() => update(revenueDefaults(latestYear))}
            >
              <X size={14} aria-hidden="true" />
              Limpar filtros
            </button>
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
          Exercício <strong>{filters.year}</strong> · Documentos da fonte até{" "}
          <strong>{dateLabel(yearStats?.lastDocumentDate ?? null)}</strong>
        </span>
        <span>Consulta em {dateLabel(view.generatedAt)}</span>
      </div>
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
      {(totals.missing > 0 || totals.missingPlanned > 0) && (
        <div className="notice" role="status">
          Há {totals.missing} documentos e {totals.missingPlanned} previsões sem
          valor válido. As somas têm cobertura parcial; o percentual não é
          calculado.
        </div>
      )}
      {filters.kind !== "budget" && (
        <div className="notice">
          Entradas extraorçamentárias e tipos não informados são apresentados
          separadamente da receita orçamentária. Não são comparados à previsão
          anual.
        </div>
      )}
      <section
        className="revenue-panel"
        aria-labelledby="revenue-monthly-heading"
      >
        <div className="revenue-section-heading">
          <div>
            <h2 id="revenue-monthly-heading">Evolução mensal</h2>
            <p>
              Valores registrados no exercício e no recorte selecionado. Mês sem
              documento permanece indisponível.
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
      <section
        className="revenue-panel"
        aria-labelledby="revenue-accounts-heading"
      >
        <div className="revenue-section-heading">
          <div>
            <h2 id="revenue-accounts-heading">Receitas por conta e fonte</h2>
            <p>
              A previsão é anual. A arrecadação acompanha o período escolhido.
            </p>
          </div>
          <label className="revenue-sort">
            Ordenar por
            <select
              value={filters.sort}
              disabled={pending}
              onChange={(e) => update({ sort: e.target.value })}
            >
              <option value="realized">Maior valor registrado</option>
              <option value="planned">Maior previsão anual</option>
              <option value="account">Conta, de A a Z</option>
            </select>
          </label>
        </div>
        {!count ? (
          <p className="notice" role="status">
            Nenhuma receita encontrada para estes filtros.
          </p>
        ) : (
          <div
            className="revenue-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Tabela de receitas com rolagem horizontal"
          >
            <table className="revenue-table">
              <thead>
                <tr>
                  <th scope="col">Conta e fonte de recurso</th>
                  <th scope="col">Unidade gestora</th>
                  <th scope="col">Previsão anual</th>
                  <th scope="col">Registrado no período</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((e) => {
                  const received = e.received;
                  return (
                    <tr key={e.id}>
                      <th scope="row">
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
                            {received.documents} documentos ·{" "}
                            {received.missing + e.missingPlannedValues} valores
                            ausentes
                          </p>
                        </details>
                      </th>
                      <td>{e.unitName}</td>
                      <td className="revenue-money">
                        {e.kind === "budget"
                          ? currency(e.plannedCents)
                          : "Não se aplica"}
                      </td>
                      <td className="revenue-money">
                        {currency(received.cents)}
                        {!received.documents && (
                          <small>Sem documentos no período</small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="revenue-pagination">
          <span aria-live="polite">
            {count.toLocaleString("pt-BR")} contas e fontes · Página {page} de{" "}
            {pages}
          </span>
          <div>
            <button
              className="button button-secondary"
              disabled={pending || page === 1}
              onClick={() => changePage(page - 1)}
            >
              Anterior
            </button>
            <button
              className="button button-secondary"
              disabled={pending || page === pages}
              onClick={() => changePage(page + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      </section>
      <div className="revenue-source-links">
        <a href={sourceHref} target="_blank" rel="noopener noreferrer">
          Consultar documentos na API <ArrowUpRight size={15} />
        </a>
        <a href={`/api/porto-velho/receitas?ano=${filters.year}`} download>
          Baixar os resumos em JSON <Download size={15} />
        </a>
      </div>
    </>
  );
}
