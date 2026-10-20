import { municipalFetch } from "./transport";
import { workSchema, worksCatalogSchema, type Work } from "../../core/works";
import {
  record,
  items,
  text,
  moneyToCents,
  parseDate,
  officialUrl,
  allPages,
} from "./public-data";
const origin = "https://api.portovelho.ro.gov.br/api/v1/obras";
export function normalizeWork(raw: Record<string, unknown>): Work {
  if (!Number.isSafeInteger(raw.id) || Number(raw.id) <= 0)
    throw new Error("ID inválido");
  const contract = record(raw.contrato),
    supplier = record(raw.fornecedor);
  const percent = text(raw.porcentagem_executado);
  if (percent !== null && !/^-?\d+(?:[.,]\d+)?$/.test(percent))
    throw new Error("Percentual inválido");
  const documents: Work["documents"] = [];
  for (const d of items(raw.anexos)) {
    const url = officialUrl(d.original_url);
    if (url)
      documents.push({
        title: text(d.name) ?? "Documento da obra",
        url,
        kind: "obra",
      });
  }
  for (const m of items(raw.medicoes))
    for (const d of items(m.anexos)) {
      const url = officialUrl(d.original_url);
      if (url)
        documents.push({
          title: text(d.name) ?? "Documento de medição",
          url,
          kind: "medicao",
        });
    }
  const personal =
    !/^(?:[A-Za-z0-9]{14}|[A-Za-z0-9]{2}\.[A-Za-z0-9]{3}\.[A-Za-z0-9]{3}\/[A-Za-z0-9]{4}-\d{2})$/.test(
      String(supplier.documento ?? ""),
    );
  const timestamp =
    typeof raw.updated_at === "string" &&
    Number.isFinite(Date.parse(raw.updated_at))
      ? new Date(raw.updated_at).toISOString()
      : null;
  return workSchema.parse({
    id: "pvh-" + raw.id,
    sourceId: raw.id,
    title: text(raw.nome),
    status: text(raw.situacao) ?? "Não informada",
    category: text(raw.tipo),
    organization: null,
    organizationName: null,
    neighborhood: null,
    locations: items(raw.localizacoes)
      .map((l) => text(l.nome))
      .filter(Boolean),
    contractedCents: moneyToCents(raw.valor_contratado),
    paidCents: moneyToCents(raw.valor_pago),
    toMeasureCents: moneyToCents(raw.valor_a_medir),
    reportedExecutionPercent:
      percent === null ? null : Number(percent.replace(",", ".")),
    contractNumber: text(contract.numero),
    contractId:
      contract.id === undefined || contract.id === null ? null : contract.id,
    contractDateFromWork: parseDate(raw.data_contrato),
    startedAt: parseDate(raw.data_inicio),
    agreementEndsAt: parseDate(raw.data_vigencia_convenio),
    executionRaw: text(raw.execucao),
    agreement: text(raw.numero_convenio),
    procurement: text(raw.modelo_contratacao),
    process: text(record(raw.licitacao).processo),
    supplier: personal
      ? "Fornecedor não republicado"
      : (text(supplier.razao_social) ?? text(supplier.nome)),
    observation: text(raw.observacao),
    measurements: items(raw.medicoes).map((m) => ({
      title: text(m.nome) ?? "Medição",
      amountCents: moneyToCents(m.valor_medicao),
      paidAt: parseDate(m.data_pagamento),
    })),
    documents,
    sourceUrl: origin + "/" + raw.id,
    sourceUpdatedAt: timestamp,
    issues: [],
  });
}
export async function fetchWorks(
  signal: AbortSignal,
  request: typeof fetch = municipalFetch,
) {
  const records: Work[] = [];
  const total = await allPages(
    origin,
    100,
    20,
    signal,
    (rows) => {
      for (const r of rows) records.push(normalizeWork(r));
    },
    request,
  );
  return worksCatalogSchema.parse({
    records,
    total,
    complete: true,
    sourceUrl: origin + "?por-pagina=100",
    warnings: [],
  });
}
