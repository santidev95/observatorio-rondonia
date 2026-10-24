import { Alert } from "@mantine/core";
import type { WorksCatalog } from "@/core/works";

export function CoverageNotice({ catalog }: { catalog: WorksCatalog }) {
  if (catalog.complete || !catalog.coverage) return null;
  const coverage = catalog.coverage;
  const number = (value: number) => value.toLocaleString("pt-BR");

  if ("rowDifference" in coverage)
    return (
      <Alert
        className="works-coverage-notice"
        role="status"
        aria-label="Dados inconsistentes na fonte"
      >
        <h2>Dados inconsistentes na fonte</h2>
        <p>
          A fonte declarou {number(coverage.reportedRows)} registros, mas
          retornou {number(coverage.receivedRows)} após a consulta de todas as
          páginas. A diferença entre as contagens é de{" "}
          {number(coverage.rowDifference)}{" "}
          {coverage.rowDifference === 1 ? "registro" : "registros"}.
        </p>
        {coverage.repeatedRows > 0 && (
          <p>
            Foram agrupadas {number(coverage.repeatedRows)} repetições
            equivalentes dos mesmos IDs oficiais, resultando em{" "}
            {number(catalog.total)}{" "}
            {catalog.total === 1
              ? "obra única disponível"
              : "obras únicas disponíveis"}
            .
          </p>
        )}
        <p>
          Exibimos somente as obras recebidas. A completude dos dados não está
          garantida; a divergência pode estar no contador da fonte ou nos
          registros retornados.
        </p>
        <a href={catalog.sourceUrl}>Conferir fonte oficial ↗</a>
      </Alert>
    );

  return (
    <Alert
      className="works-coverage-notice"
      role="status"
      aria-label="Cobertura parcial da consulta"
    >
      <h2>
        Consulta parcial — {number(coverage.assumedMissingRows)} registro
        ausente (assumido)
      </h2>
      <p>
        A fonte entregou {number(coverage.receivedRows)} de{" "}
        {number(coverage.reportedRows)} linhas declaradas. Foram agrupadas{" "}
        {number(coverage.repeatedRows)} repetições equivalentes, resultando em{" "}
        {number(catalog.total)}{" "}
        {catalog.total === 1
          ? "obra única disponível"
          : "obras únicas disponíveis"}
        .
      </p>
      <p>
        Consideramos que um registro não foi retornado; a fonte não identifica
        qual. A consulta abrange somente as obras recebidas.
      </p>
      <a href={catalog.sourceUrl}>Conferir fonte oficial ↗</a>
    </Alert>
  );
}
