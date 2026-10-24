import {
  workSchema,
  worksCatalogSchema,
  type Work,
  type WorksCatalog,
} from "../../core/works";
import { MunicipalSourceError } from "../../core/municipal-source-error";
import {
  municipalYear,
  publicaSource,
  type PublicaMunicipality,
} from "../../core/municipal-sources";
import {
  publicaDate,
  publicaMoney,
  publicaText,
  publicaTransport,
} from "./transport";

function exercise(year: number): number {
  if (!Number.isSafeInteger(year) || year < 2000 || year > 2100)
    throw new Error("Exercício de obras inválido.");
  return year;
}

function percentage(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !/^-?\d+(?:[.,]\d+)?$/.test(String(value))
  )
    throw new Error("Percentual de obras inválido.");
  const result = Number(String(value).replace(",", "."));
  if (!Number.isFinite(result))
    throw new Error("Percentual de obras inválido.");
  return result;
}

function code(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error("Código de obra inválido.");
    return publicaText(String(value));
  }
  return publicaText(value);
}

export function createPublicaWorks(municipality: PublicaMunicipality) {
  const source = publicaSource(municipality);
  const transport = publicaTransport(municipality);
  const sourcePath = (year: number) =>
    `/api/obras/${exercise(year)}/${source.company}`;

  /** Only public fields of the selected municipal catalog are normalized. */
  function normalizeWork(input: unknown, year: number): Work {
    exercise(year);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error(`Registro de obra de ${source.name} inválido.`);
    const raw = input as Record<string, unknown>;
    if (
      !Number.isSafeInteger(raw.SEQUENCIAL) ||
      Number(raw.SEQUENCIAL) <= 0 ||
      raw.EXERCICIO !== year ||
      raw.EMPRESA !== source.company
    )
      throw new Error(
        `Identidade da obra de ${source.name} incompatível com a consulta.`,
      );

    const title = publicaText(raw.DESCRICAO);
    if (!title)
      throw new Error(`Descrição da obra de ${source.name} não informada.`);
    const issues: string[] = [
      "O valor total publicado não é identificado pela API como valor contratado, pago ou a medir.",
      "A API oferece o catálogo por exercício; o link da fonte não é uma ficha individual.",
    ];
    const reportedCompletionAt = publicaDate(raw.DATACONCLUSAO);
    if (reportedCompletionAt)
      issues.push(
        "Data de conclusão informada; não confirma conclusão efetiva.",
      );
    const reportedYear = code(raw.ANO);
    if (reportedYear && reportedYear !== String(year))
      issues.push(
        "O ano informado no registro difere do exercício consultado; o registro oficial foi preservado.",
      );
    const observations = [
      ["Número da obra informado", code(raw.NUMERO)],
      ["Ano informado no registro", reportedYear],
      ["Data informada no cadastro", publicaDate(raw.DATA)],
      ["Tipo informado", publicaText(raw.TIPO)],
      ["Estimativa informada", publicaText(raw.ESTIMATIVA)],
    ]
      .filter((item) => item[1] !== null)
      .map(([label, value]) => `${label}: ${value}`);
    const location = publicaText(raw.LOCALIZACAO);

    return workSchema.parse({
      id: `${source.slug}-${year}-${raw.SEQUENCIAL}`,
      sourceId: raw.SEQUENCIAL,
      sourceYear: year,
      title,
      status:
        publicaText(raw.SITUACAO) ?? publicaText(raw.STATUS) ?? "Não informada",
      category: publicaText(raw.CATEGORIA),
      organization: null,
      organizationName: publicaText(raw.EMPRESA_NOME),
      neighborhood: null,
      locations: location ? [location] : [],
      contractedCents: null,
      declaredValueCents: publicaMoney(raw.VALOR),
      paidCents: null,
      toMeasureCents: null,
      reportedExecutionPercent: percentage(raw.PERCENTUALEXECUTADO),
      contractNumber: null,
      contractId: null,
      contractDateFromWork: null,
      startedAt: publicaDate(raw.DATAINI),
      agreementEndsAt: null,
      reportedCompletionAt,
      executionRaw: null,
      agreement: null,
      procurement: null,
      process: null,
      // NOMEFOR does not identify a person's type; do not infer a legal entity.
      supplier: raw.NOMEFOR ? "Fornecedor não republicado" : null,
      observation: observations.join("; ") || null,
      measurements: [],
      documents: [],
      sourceUrl: source.apiOrigin + sourcePath(year),
      sourceUpdatedAt: null,
      issues,
    });
  }

  async function fetchWorks(
    signal: AbortSignal,
    year = municipalYear(),
    fetcher: typeof fetch = transport.fetch,
  ): Promise<WorksCatalog> {
    signal.throwIfAborted();
    const collectionUrl = transport.url(sourcePath(year));
    collectionUrl.searchParams.set("perPage", "200");
    const result = await transport.collectPages(
      collectionUrl,
      signal,
      fetcher,
      {
        maxRecords: 2000,
        maxPages: 200,
        allowMissingLastRecord: municipality === "ji-parana",
        allowShortPages: municipality === "ariquemes",
      },
    );
    const receivedRecords = result.records.map((record) => {
      signal.throwIfAborted();
      return normalizeWork(record, year);
    });
    const partialJi = municipality === "ji-parana" && result.missingRows === 1;
    const partialAri = municipality === "ariquemes" && result.missingRows > 0;
    const partial = partialJi || partialAri;
    if (partialAri && receivedRecords.length === 0)
      throw new Error(
        "A fonte de Ariquemes não entregou registros para a consulta declarada.",
      );
    const uniqueRecords = new Map<number, Work>();
    for (const work of receivedRecords) {
      signal.throwIfAborted();
      const existing = uniqueRecords.get(work.sourceId);
      if (
        existing &&
        (!partial || JSON.stringify(existing) !== JSON.stringify(work))
      )
        throw new MunicipalSourceError({
          kind: "duplicate-identifiers",
          received: receivedRecords.length,
          unique: new Set(receivedRecords.map((record) => record.sourceId))
            .size,
        });
      if (!existing) uniqueRecords.set(work.sourceId, work);
    }
    const records = [...uniqueRecords.values()];
    return worksCatalogSchema.parse({
      records,
      total: records.length,
      complete: !partial,
      ...(partial && {
        coverage: partialAri
          ? {
              reportedRows: result.total,
              receivedRows: receivedRecords.length,
              repeatedRows: receivedRecords.length - records.length,
              rowDifference: result.missingRows,
            }
          : {
              reportedRows: result.total,
              receivedRows: receivedRecords.length,
              repeatedRows: receivedRecords.length - records.length,
              assumedMissingRows: 1,
            },
      }),
      sourceUrl: source.apiOrigin + sourcePath(year),
      warnings: [
        `${partial ? "Consulta parcial" : "Catálogo completo"} da Prefeitura de ${source.name} (UG ${source.company}) no exercício ${year}; não abrange outros exercícios.`,
        ...(partialAri
          ? [
              "Dados inconsistentes: o total declarado pela fonte difere da quantidade de registros entregue. Não é possível determinar se o contador está incorreto ou se registros foram omitidos.",
            ]
          : []),
        "A fonte não publica neste endpoint pagamentos, medições, documentos, contrato vinculado nem data de atualização dos registros.",
        "O percentual executado é republicado como informado pela fonte, sem cálculo ou verificação de execução física pelo Observatório.",
        "Nomes de fornecedores sem identificação do tipo de pessoa não são republicados.",
      ],
    });
  }

  return { normalizeWork, fetchWorks };
}
