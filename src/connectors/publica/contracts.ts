import { Buffer } from "node:buffer";
import { z } from "zod";
import {
  CONTRACTS_PAGE_SIZE,
  containsPersonalDocument,
  contractPageSchema,
  contractRecordSchema,
  contractsQuerySchema,
  type ContractPage,
  type ContractRecord,
  type ContractsQuery,
} from "../../core/contracts";
import {
  publicaTransport,
  publicaText,
  publicaMoney,
  publicaDate,
} from "./transport";
import {
  publicaSource,
  municipalYear,
  type PublicaMunicipality,
} from "../../core/municipal-sources";

const rawContractSchema = z.object({
  CODIGO: z.string().min(1).max(64),
  EMPRESA: z.number().int().positive(),
  EMPRESA_NOME: z.string().nullable(),
  CONTRATONUM: z.string().nullable(),
  ANO: z.number().int().min(2000).max(2100),
  OBJETO: z.string().nullable(),
  OBJETO_COMPLETO: z.string().nullable(),
  VIGENI: z.string().nullable(),
  VIGENF: z.string().nullable(),
  ULTVIGENF: z.string().nullable(),
  VALCON: z.union([z.string(), z.number(), z.null()]),
  PROCLIC: z.string().nullable(),
  NPROLI: z.string().nullable(),
  NOMEFORNECEDOR: z.string().nullable(),
  INSMF: z.string().nullable(),
  DTANULA: z.string().nullable(),
});

function contractId(year: number, sourceId: string): string {
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    !sourceId ||
    Buffer.byteLength(sourceId, "utf8") > 64 ||
    /[\u0000-\u001f\u007f]/.test(sourceId) ||
    containsPersonalDocument(sourceId)
  )
    throw new Error("Identificador do contrato municipal inválido.");
  return `${year}-${Buffer.from(sourceId, "utf8").toString("base64url")}`;
}

function parseContractId(
  id: string,
): { year: number; sourceId: string } | null {
  const match = /^(20\d{2}|2100)-([A-Za-z0-9_-]{2,86})$/.exec(id);
  if (!match) return null;
  const sourceId = Buffer.from(match[2], "base64url").toString("utf8");
  try {
    return contractId(Number(match[1]), sourceId) === id
      ? { year: Number(match[1]), sourceId }
      : null;
  } catch {
    return null;
  }
}

function supplier(document: string | null, rawName: string | null) {
  const identity = (document ?? "").trim();
  const compact = identity.replace(/[.\/\-\s]/g, "");
  const cnpjShape =
    /^[A-Za-z0-9]{12}\d{2}$/.test(identity) ||
    /^[A-Za-z0-9]{2}\.[A-Za-z0-9]{3}\.[A-Za-z0-9]{3}\/[A-Za-z0-9]{4}-\d{2}$/.test(
      identity,
    );
  const explicitPersonal =
    !cnpjShape &&
    /(?<![A-Za-z0-9])C\.?\s*P\.?\s*F\.?(?![A-Za-z0-9])/i.test(identity);
  const personal =
    explicitPersonal ||
    (!cnpjShape &&
      (/^[\d*]{11}$/.test(compact) || containsPersonalDocument(identity)));
  if (personal)
    return { name: "Pessoa física (nome não republicado)", cnpj: null };
  return {
    name: publicaText(rawName),
    cnpj: cnpjShape ? compact.toUpperCase() : null,
  };
}

export function createPublicaContracts(municipality: PublicaMunicipality) {
  const source = publicaSource(municipality);
  const transport = publicaTransport(municipality);

  function normalizeContract(input: unknown, year: number): ContractRecord {
    const parsed = rawContractSchema.safeParse(input);
    if (!parsed.success)
      throw new Error("Contrato incompatível na API municipal.");
    const raw = parsed.data;
    if (raw.EMPRESA !== source.company)
      throw new Error(
        "Unidade gestora do contrato difere da Prefeitura consultada.",
      );
    const contractor = supplier(raw.INSMF, raw.NOMEFORNECEDOR);
    const startsOn = publicaDate(raw.VIGENI);
    const originalEnd = publicaDate(raw.VIGENF);
    const latestEnd = publicaDate(raw.ULTVIGENF);
    const canceledOn = publicaDate(raw.DTANULA);
    const endsOn = latestEnd ?? originalEnd;
    const issues = [
      "A API não informa pagamentos, execução financeira, data de assinatura ou documentos do contrato; esses campos permanecem ausentes.",
    ];
    if (raw.ANO !== year)
      issues.push(
        `O ano do contrato informado na fonte (${raw.ANO}) difere do exercício consultado (${year}); ambos foram preservados sem confirmar o critério da fonte.`,
      );
    if (latestEnd && originalEnd && latestEnd !== originalEnd)
      issues.push(
        `A fonte informa vigência original até ${originalEnd} e última vigência até ${latestEnd}; exibida a última vigência informada.`,
      );
    if (startsOn && endsOn && endsOn < startsOn)
      issues.push(
        "A fonte informa fim de vigência anterior ao início; datas preservadas.",
      );
    if (canceledOn)
      issues.push(`Data de anulação informada na fonte: ${canceledOn}.`);
    const sourceUrl = `${source.apiOrigin}/api/contratos/${year}/${source.company}`;
    const result = contractRecordSchema.safeParse({
      id: contractId(year, raw.CODIGO),
      sourceId: raw.CODIGO,
      sourceYear: year,
      number: publicaText(raw.CONTRATONUM),
      year: raw.ANO,
      object: publicaText(raw.OBJETO_COMPLETO) ?? publicaText(raw.OBJETO),
      department: publicaText(raw.EMPRESA_NOME),
      departmentName: publicaText(raw.EMPRESA_NOME),
      contractorName: contractor.name,
      contractorCnpj: contractor.cnpj,
      suppliers:
        contractor.name !== null || contractor.cnpj !== null
          ? [contractor]
          : [],
      status: canceledOn ? "Anulado" : null,
      process: publicaText(raw.NPROLI) ?? publicaText(raw.PROCLIC),
      category: null,
      addendumReported: null,
      observation: null,
      sourceUrl,
      sourceUpdatedAt: null,
      amountCents: publicaMoney(raw.VALCON),
      paidAmountCents: null,
      executedAmountCents: null,
      signedOn: null,
      startsOn,
      endsOn,
      documents: [],
      procurement: null,
      issues,
    });
    if (!result.success)
      throw new Error("Contrato normalizado incompatível na API municipal.");
    return result.data;
  }

  async function fetchPage(
    query: ContractsQuery,
    signal: AbortSignal,
    fetcher: typeof fetch = transport.fetch,
  ): Promise<ContractPage> {
    if (!contractsQuerySchema.safeParse(query).success)
      throw new Error("Consulta de contratos inválida.");
    const year = query.year ?? municipalYear();
    const path = `/api/contratos/${year}/${source.company}`;
    const first = await transport.readPage(path, 1, signal, fetcher);
    if (first.perPage !== 10)
      throw new Error("Tamanho da página oficial municipal mudou.");
    const lastPage = Math.max(1, Math.ceil(first.total / CONTRACTS_PAGE_SIZE));
    if (query.page > lastPage)
      throw new Error("Página fora do catálogo de contratos municipal.");
    const start = (query.page - 1) * CONTRACTS_PAGE_SIZE;
    const end = Math.min(start + CONTRACTS_PAGE_SIZE, first.total);
    const firstSourcePage = Math.floor(start / first.perPage) + 1;
    const lastSourcePage = Math.max(
      firstSourcePage,
      Math.ceil(end / first.perPage),
    );
    const rows: ContractRecord[] = [];
    const allSeenIds = new Set<string>();
    const validateRows = (inputs: unknown[]) =>
      inputs.map((input) => normalizeContract(input, year));
    const initialRecords = validateRows(first.data);
    for (const item of initialRecords) {
      if (allSeenIds.has(item.id))
        throw new Error("Códigos de contrato duplicados na API municipal.");
      allSeenIds.add(item.id);
    }
    for (let index = firstSourcePage; index <= lastSourcePage; index++) {
      const page =
        index === 1
          ? first
          : await transport.readPage(path, index, signal, fetcher);
      if (
        page.total !== first.total ||
        page.lastPage !== first.lastPage ||
        page.perPage !== first.perPage
      )
        throw new Error(
          "Cobertura de contratos mudou durante a consulta na API municipal.",
        );
      const normalized = index === 1 ? initialRecords : validateRows(page.data);
      if (index !== 1) {
        for (const item of normalized) {
          if (allSeenIds.has(item.id))
            throw new Error("Códigos de contrato duplicados na API municipal.");
          allSeenIds.add(item.id);
        }
      }
      rows.push(...normalized);
    }
    const warnings = [
      `Consulta limitada à Prefeitura de ${source.name} (UG ${source.company}); Câmara e demais unidades não estão incluídas.`,
      "A API oficial publica 10 registros por página; o Observatório reorganiza as páginas consultadas em grupos de 25. Não há garantia de consistência entre consultas em horários diferentes.",
    ];
    const records = rows.slice(
      start % first.perPage,
      (start % first.perPage) + CONTRACTS_PAGE_SIZE,
    );
    const differentYear = records.filter(
      (record) => record.year !== year,
    ).length;
    if (differentYear)
      warnings.push(
        `A fonte retornou ${differentYear} contrato(s) com ano diferente do exercício solicitado (${year}). Registros, anos e totais oficiais foram preservados; o critério do exercício não foi confirmado.`,
      );
    if (query.year === null)
      warnings.push(`A API exige exercício; esta consulta usa ${year}.`);
    signal.throwIfAborted();
    const result = contractPageSchema.safeParse({
      warnings,
      records,
      pagination: {
        currentPage: query.page,
        lastPage,
        perPage: CONTRACTS_PAGE_SIZE,
        total: first.total,
      },
      sourceUrl: `${source.apiOrigin}${path}?page=${firstSourcePage}`,
    });
    if (!result.success)
      throw new Error("Página de contratos municipal incompleta.");
    return result.data;
  }

  async function fetchContract(
    id: string,
    signal: AbortSignal,
    fetcher: typeof fetch = transport.fetch,
  ): Promise<ContractRecord | null> {
    const identity = parseContractId(id);
    if (!identity) throw new Error("ID de contrato municipal inválido.");
    // A fonte não expõe detalhe por código. A ficha depende da busca completa,
    // com o ano no identificador, nunca de uma posição mutável na paginação.
    const catalog = await transport.collectPages(
      `/api/contratos/${identity.year}/${source.company}?perPage=100`,
      signal,
      fetcher,
      { maxPages: 500, maxRecords: 5000 },
    );
    const records = catalog.records.map((row) =>
      normalizeContract(row, identity.year),
    );
    if (new Set(records.map((record) => record.id)).size !== records.length)
      throw new Error("Códigos de contrato duplicados na API municipal.");
    const result = records.find((record) => record.id === id) ?? null;
    signal.throwIfAborted();
    return result;
  }

  return { fetchPage, fetchContract, contractId, parseContractId };
}
