type MunicipalSourceIssue =
  | {
      kind: "pagination";
      page: number;
      total: number;
      expected: number;
      received: number;
    }
  | { kind: "duplicate-identifiers"; received: number; unique: number };

/** Only validated counts cross the boundary; source rows and errors stay private. */
export class MunicipalSourceError extends Error {
  readonly code = "source-inconsistent";
  readonly issue: Readonly<MunicipalSourceIssue>;

  constructor(issue: MunicipalSourceIssue) {
    super(
      issue.kind === "pagination"
        ? "Paginação incompleta ou inconsistente na fonte oficial."
        : "Identificadores repetidos na fonte oficial.",
    );
    this.name = "MunicipalSourceError";
    this.issue = Object.freeze({ ...issue });
  }

  get publicMessage(): string {
    const issue = this.issue;
    const explanation =
      issue.kind === "pagination"
        ? `A fonte oficial informou ${issue.total} registros no total, mas a página ${issue.page} retornou ${issue.received} dos ${issue.expected} registros esperados.`
        : `A fonte oficial retornou ${issue.received} registros com ${issue.unique} identificadores distintos. Não foi possível identificar cada obra de forma única.`;
    return `${explanation} Nenhum catálogo parcial é exibido. Consulte o portal oficial ou tente novamente mais tarde.`;
  }
}
