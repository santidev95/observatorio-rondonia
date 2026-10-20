import { municipalFetch } from "./transport";
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

const origin = "https://api.portovelho.ro.gov.br";
const maxPageBytes = 5 * 1024 * 1024;
const sourceNumber = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const rawContractSchema = z
  .object({
    id: sourceNumber.positive(),
    numero: z.string().nullable(),
    contrato_ano: z.number().int().min(1).max(9999).nullable(),
    modelo: z.literal("Contratos"),
    valor: z.unknown(),
    valor_executado: z.unknown(),
  })
  .passthrough();
const rawPageSchema = z.object({
  data: z.array(rawContractSchema).max(CONTRACTS_PAGE_SIZE),
  links: z.object({ next: z.string().nullable() }),
  meta: z.object({
    current_page: sourceNumber.positive(),
    last_page: sourceNumber.positive(),
    per_page: z.literal(CONTRACTS_PAGE_SIZE),
    total: sourceNumber,
    from: sourceNumber.positive().nullable(),
    to: sourceNumber.positive().nullable(),
  }),
});

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, entity: string) => {
      const point =
        entity[0].toLowerCase() === "x"
          ? Number.parseInt(entity.slice(1), 16)
          : Number.parseInt(entity, 10);
      return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

function text(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string")
    throw new Error("Campo textual incompatível na API de Porto Velho.");
  const decoded = decodeEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return decoded
    ? decoded.replace(
        /(?<!\d)\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}(?!\d)/gu,
        "[CPF não republicado]",
      )
    : null;
}

function money(value: unknown): number | null {
  if (value === null || value === "") return null;
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    if (!Object.hasOwn(value, "value"))
      throw new Error("Formato monetário incompatível na API de Porto Velho.");
    return money((value as Record<string, unknown>).value);
  }
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error(
      "Valor monetário ausente ou incompatível na API de Porto Velho.",
    );
  if (typeof value === "number" && (!Number.isFinite(value) || value < 0))
    throw new Error("Valor monetário inválido na API de Porto Velho.");
  let decimal = String(value)
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (decimal.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(decimal))
      throw new Error("Valor monetário inválido na API de Porto Velho.");
    decimal = decimal.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(decimal))
    throw new Error("Valor monetário inválido na API de Porto Velho.");
  const [whole, fraction = ""] = decimal.split(".");
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Valor monetário fora do intervalo seguro.");
  return Number(result);
}

function date(value: unknown): string | null {
  const source = text(value);
  if (source === null) return null;
  const iso = source.match(/^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/);
  const brazilian = source.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const normalized =
    iso?.[1] ??
    (brazilian ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}` : null);
  if (normalized === null)
    throw new Error("Data incompatível na API de Porto Velho.");
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  )
    throw new Error("Data inválida na API de Porto Velho.");
  return normalized;
}

function publication(
  value: unknown,
  issues: string[],
): Pick<
  ContractRecord["documents"][number],
  "publishedOn" | "publicationReference"
> {
  const source = text(value);
  if (source === null) return { publishedOn: null, publicationReference: null };
  const isolatedDate =
    /^\d{4}-\d{2}-\d{2}$/.test(source) ||
    /^\d{2}\/\d{2}\/\d{4}$/.test(source) ||
    z.iso.datetime({ offset: true }).safeParse(source).success;
  if (isolatedDate) {
    try {
      return { publishedOn: date(source), publicationReference: null };
    } catch {
      issues.push(
        "Data de publicação de um documento inválida; referência original preservada.",
      );
      return { publishedOn: null, publicationReference: source };
    }
  }
  issues.push(
    "A publicação de um documento contém referência textual; a data não foi identificada com segurança.",
  );
  return { publishedOn: null, publicationReference: source };
}

function officialDocumentUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      !(
        url.hostname === "portovelho.ro.gov.br" ||
        url.hostname.endsWith(".portovelho.ro.gov.br")
      )
    )
      return null;
    let decoded = value;
    for (let attempt = 0; attempt < 3; attempt++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    if (
      containsPersonalDocument(decoded) ||
      [...url.searchParams.keys()].some((key) => /cpf/i.test(key))
    )
      return null;
    url.protocol = "https:";
    return url.href;
  } catch {
    return null;
  }
}

type PublicSupplier = ContractRecord["suppliers"][number];

function normalizeSupplier(input: unknown): PublicSupplier | null {
  const supplier = record(input);
  if (
    supplier.documento !== undefined &&
    supplier.documento !== null &&
    typeof supplier.documento !== "string"
  )
    throw new Error(
      "Documento do fornecedor incompatível na API de Porto Velho.",
    );
  const identity =
    typeof supplier.documento === "string"
      ? decodeEntities(supplier.documento).trim()
      : "";
  const compactIdentity = identity.replace(/[.\/\-\s]/g, "");
  // "CPF 123..." não é um CNPJ alfanumérico. As letras CPF dentro
  // do formato próprio de um CNPJ não representam rótulo de pessoa.
  const cnpjShape =
    /^[A-Za-z0-9]{12}[0-9]{2}$/.test(identity) ||
    /^[A-Za-z0-9]{2}\.[A-Za-z0-9]{3}\.[A-Za-z0-9]{3}\/[A-Za-z0-9]{4}-[0-9]{2}$/.test(
      identity,
    );
  const explicitPersonal =
    !cnpjShape &&
    /(?<![A-Za-z0-9])C\.?\s*P\.?\s*F\.?(?![A-Za-z0-9])/i.test(identity);
  const cnpj =
    !explicitPersonal && cnpjShape ? compactIdentity.toUpperCase() : null;
  const personal =
    explicitPersonal ||
    (cnpj === null &&
      (/^[0-9*]{11}$/.test(compactIdentity) ||
        containsPersonalDocument(identity)));
  if (personal)
    return { name: "Pessoa física (nome não republicado)", cnpj: null };
  const name = text(supplier.razao_social) ?? text(supplier.nome);
  return name !== null || cnpj !== null ? { name, cnpj } : null;
}

function sourceTimestamp(value: unknown): string | null {
  const candidate = text(value);
  const parsed = z.iso.datetime({ offset: true }).safeParse(candidate);
  if (!parsed.success) return null;
  const timestamp = Date.parse(parsed.data);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeContract(
  raw: z.infer<typeof rawContractSchema>,
): ContractRecord {
  const issues: string[] = [];
  const primarySupplier = normalizeSupplier(raw.fornecedor);
  if (
    raw.fornecedores !== undefined &&
    raw.fornecedores !== null &&
    !Array.isArray(raw.fornecedores)
  )
    throw new Error(
      "Lista de fornecedores incompatível na API de Porto Velho.",
    );
  const supplierInputs = [
    raw.fornecedor,
    ...(Array.isArray(raw.fornecedores)
      ? raw.fornecedores.map((item) => record(item).fornecedor)
      : []),
  ];
  const suppliers = [
    ...new Map(
      supplierInputs
        .map(normalizeSupplier)
        .filter((supplier): supplier is PublicSupplier => supplier !== null)
        .map((supplier) => [
          supplier.cnpj ? `cnpj:${supplier.cnpj}` : `name:${supplier.name}`,
          supplier,
        ]),
    ).values(),
  ];
  const contractor = primarySupplier ?? suppliers[0] ?? null;
  const department = record(raw.contratante);
  if (
    raw.arquivos !== undefined &&
    raw.arquivos !== null &&
    !Array.isArray(raw.arquivos)
  )
    throw new Error("Lista de documentos incompatível na API de Porto Velho.");
  const documents: ContractRecord["documents"] = (
    Array.isArray(raw.arquivos) ? raw.arquivos : []
  ).flatMap((input) => {
    const file = record(input);
    const url = officialDocumentUrl(file.arquivo);
    if (url === null) {
      issues.push(
        "Documento com endereço ausente ou fora da origem oficial; link não exibido.",
      );
      return [];
    }
    const document = {
      label: text(file.nome) ?? "Documento do contrato",
      url,
      status: text(file.situacao),
      ...publication(file.publicacao, issues),
      signedOn: date(file.data_contrato),
      startsOn: date(file.data_vigencia_inicio),
      endsOn: date(file.data_vigencia_fim),
      amountCents: file.valor === undefined ? null : money(file.valor),
    };
    if (
      document.startsOn &&
      document.endsOn &&
      document.endsOn < document.startsOn
    )
      issues.push(
        "Um documento informa fim de vigência anterior ao início; datas preservadas.",
      );
    return [document];
  });
  const startsOn = date(raw.data_vigencia_inicio);
  const endsOn = date(raw.data_vigencia_fim);
  if (startsOn && endsOn && endsOn < startsOn)
    issues.push(
      "A fonte informa fim de vigência anterior ao início; datas preservadas.",
    );
  const amountCents = money(raw.valor);
  if (amountCents !== null && amountCents >= 100_000_000_000)
    issues.push(
      "Valor igual ou superior a R$ 1 bilhão informado na fonte; confira o documento original antes de comparações. O valor foi preservado.",
    );
  const procurement = record(raw.licitacao);
  const procurementId =
    typeof procurement.id === "number" &&
    Number.isSafeInteger(procurement.id) &&
    procurement.id > 0
      ? String(procurement.id)
      : null;
  const procurementNumber =
    typeof procurement.numero === "number" &&
    Number.isSafeInteger(procurement.numero)
      ? String(procurement.numero)
      : null;
  return {
    id: String(raw.id),
    number: text(raw.numero),
    year: raw.contrato_ano,
    object: text(raw.objeto),
    department: text(department.sigla) ?? text(department.nome),
    departmentName: text(department.nome),
    contractorName: contractor?.name ?? null,
    contractorCnpj: contractor?.cnpj ?? null,
    suppliers,
    status: text(raw.situacao),
    process: text(raw.numero_processo),
    category: text(raw.categoria),
    addendumReported: typeof raw.aditivo === "boolean" ? raw.aditivo : null,
    observation: text(raw.observacao),
    sourceUrl: `${origin}/api/v1/contratos/${raw.id}`,
    sourceUpdatedAt: sourceTimestamp(raw.updated_at),
    amountCents,
    // A fonte não define executado como pagamento; os conceitos ficam separados.
    paidAmountCents: null,
    executedAmountCents: money(raw.valor_executado),
    signedOn: date(raw.data_assinatura),
    startsOn,
    endsOn,
    documents: [
      ...new Map(
        documents.map((document) => [document.url, document]),
      ).values(),
    ],
    procurement: procurementId
      ? {
          id: procurementId,
          title:
            text(procurement.titulo) ??
            `Licitação ${procurementNumber ?? procurementId}`,
          url: `${origin}/api/v1/licitacoes/${procurementId}`,
        }
      : null,
    issues: [...new Set(issues)],
  };
}

async function readPageBody(response: Response): Promise<unknown> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxPageBytes) {
    await response.body?.cancel();
    throw new Error("Página da API de Porto Velho excede o limite de tamanho.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Resposta vazia da API de Porto Velho.");
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxPageBytes) {
        await reader.cancel();
        throw new Error(
          "Página da API de Porto Velho excede o limite de tamanho.",
        );
      }
      body += decoder.decode(part.value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Resposta JSON inválida da API de Porto Velho.");
  }
}

async function requestOfficialResource(
  url: URL,
  signal: AbortSignal,
  fetcher: typeof fetch,
): Promise<Response> {
  signal.throwIfAborted();
  try {
    return await fetcher(url.href, {
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch {
    throw new Error(
      signal.aborted
        ? "Consulta à API de Porto Velho cancelada."
        : "Falha de conexão com a API de Porto Velho.",
    );
  }
}

async function readSuccessfulBody(response: Response): Promise<unknown> {
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(
      `API de Porto Velho indisponível (HTTP ${response.status}).`,
    );
  }
  if (
    !/\bapplication\/(?:[a-z.+-]*\+)?json\b/i.test(
      response.headers.get("content-type") ?? "",
    )
  ) {
    await response.body?.cancel();
    throw new Error("Formato de resposta incompatível na API de Porto Velho.");
  }
  return readPageBody(response);
}

export async function fetchPortoVelhoContractsPage(
  query: ContractsQuery,
  signal: AbortSignal,
  fetcher: typeof fetch = municipalFetch,
): Promise<ContractPage> {
  const validatedQuery = contractsQuerySchema.safeParse(query);
  if (!validatedQuery.success)
    throw new Error("Consulta de contratos inválida.");
  signal.throwIfAborted();
  const url = new URL("/api/v1/contratos", origin);
  url.searchParams.set("modelo", "Contratos");
  url.searchParams.set("por-pagina", String(CONTRACTS_PAGE_SIZE));
  url.searchParams.set("page", String(query.page));
  if (query.year !== null) url.searchParams.set("ano", String(query.year));
  const response = await requestOfficialResource(url, signal, fetcher);
  const parsed = rawPageSchema.safeParse(await readSuccessfulBody(response));
  if (!parsed.success || parsed.data.meta.current_page !== query.page)
    throw new Error(
      "Envelope ou paginação incompatível na API de Porto Velho.",
    );
  const { data, meta } = parsed.data;
  const expectedFrom =
    meta.total === 0 ? null : (query.page - 1) * CONTRACTS_PAGE_SIZE + 1;
  const expectedTo =
    meta.total === 0
      ? null
      : Math.min(query.page * CONTRACTS_PAGE_SIZE, meta.total);
  if (meta.from !== expectedFrom || meta.to !== expectedTo)
    throw new Error(
      "Intervalo da paginação incompatível na API de Porto Velho.",
    );
  if (
    data.some(
      (row) =>
        !Object.hasOwn(row, "valor") || !Object.hasOwn(row, "valor_executado"),
    )
  )
    throw new Error("Campos monetários ausentes na API de Porto Velho.");
  const warnings: string[] = [];
  if (query.year !== null) {
    const different = data.filter(
      (row) => row.contrato_ano !== null && row.contrato_ano !== query.year,
    ).length;
    const missing = data.filter((row) => row.contrato_ano === null).length;
    if (different)
      warnings.push(
        `A fonte retornou ${different} contrato(s) com ano diferente do solicitado (${query.year}). Registros e totais publicados pela fonte foram preservados; critério do filtro não confirmado.`,
      );
    if (missing)
      warnings.push(
        `A fonte retornou ${missing} contrato(s) sem ano informado no filtro solicitado (${query.year}). O ano ausente, os registros e os totais publicados pela fonte foram preservados; critério do filtro não confirmado.`,
      );
  }
  const result = contractPageSchema.safeParse({
    warnings,
    records: data.map(normalizeContract),
    pagination: {
      currentPage: meta.current_page,
      lastPage: meta.last_page,
      perPage: meta.per_page,
      total: meta.total,
    },
    sourceUrl: url.href,
  });
  if (!result.success)
    throw new Error("Página incompleta ou incompatível na API de Porto Velho.");
  signal.throwIfAborted();
  return result.data;
}

export async function fetchPortoVelhoContract(
  id: string,
  signal: AbortSignal,
  fetcher: typeof fetch = municipalFetch,
): Promise<ContractRecord | null> {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
    throw new Error("ID de contrato inválido.");
  const url = new URL(`/api/v1/contratos/${id}`, origin);
  const response = await requestOfficialResource(url, signal, fetcher);
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  const body = await readSuccessfulBody(response);
  const envelope = z
    .object({
      data: z
        .object({
          id: sourceNumber.positive(),
          modelo: z.string(),
        })
        .passthrough(),
    })
    .safeParse(body);
  if (!envelope.success)
    throw new Error("Envelope do contrato incompatível na API de Porto Velho.");
  if (String(envelope.data.data.id) !== id)
    throw new Error("ID da resposta de contrato difere do solicitado.");
  if (envelope.data.data.modelo !== "Contratos") return null;
  const raw = rawContractSchema.safeParse(envelope.data.data);
  if (!raw.success)
    throw new Error("Contrato incompatível na API de Porto Velho.");
  if (
    !Object.hasOwn(raw.data, "valor") ||
    !Object.hasOwn(raw.data, "valor_executado")
  )
    throw new Error("Campos monetários ausentes na API de Porto Velho.");
  const normalized = contractRecordSchema.safeParse(
    normalizeContract(raw.data),
  );
  if (!normalized.success)
    throw new Error("Contrato normalizado incompatível na API de Porto Velho.");
  signal.throwIfAborted();
  return normalized.data;
}
