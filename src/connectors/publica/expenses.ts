import { z } from "zod";
import { ContractsDataError } from "../../core/contracts-query";
import {
  EXPENSES_PAGE_SIZE,
  expensePageSchema,
  expensesQuerySchema,
  type ExpensePage,
  type ExpensesQuery,
} from "../../core/expenses";
import {
  publicaSource,
  type PublicaMunicipality,
} from "../../core/municipal-sources";
import { supplier } from "./contracts";
import {
  publicaDate,
  publicaMoney,
  publicaText,
  publicaTransport,
} from "./transport";

// A primeira leitura de um exercício chegou a 13,8 s na fonte; depois cai para cerca de 2,5 s.
const SOURCE_TIMEOUT_MS = 25_000;
const money = z.union([z.string(), z.number(), z.null()]);
const nullableString = z.string().nullable();
const rawCommon = {
  EMPRESA_NOME: nullableString,
  PKEMP: z.number().int().nonnegative(),
  NEMPG: z.number().int().nonnegative(),
  TPEM: nullableString,
  PROC: nullableString,
  INSMF: nullableString,
  NOME: nullableString,
  ORGAO: nullableString,
  FUNCAO: nullableString,
  PROGRAMA: nullableString,
  PROJATIV: nullableString,
  CATEC: nullableString,
  FONTECODIGO: nullableString,
};
const rawCommitmentSchema = z.object({
  ...rawCommon,
  EMPRESA: z.number().int().positive(),
  DTEMPENHO: nullableString,
  ANO_EMPENHO: z.number().int().nullable(),
  EMPENHADO: money,
  ANULADO: money,
  LIQUIDADO: money,
  PAGO: money,
  RETIDO: money,
});
const rawPaymentSchema = z.object({
  ...rawCommon,
  EXERCICIO: z.union([z.string().regex(/^\d{4}$/), z.number().int()]),
  NUMSUB: z.number().int().nonnegative(),
  ORDPGSEQ: z.number().int().nonnegative(),
  VAPAG: money,
  DTLIQUIDACAO: nullableString,
  DTVENCIMENTO: nullableString,
  DTPAG: nullableString,
});

// Sem CNPJ válido não há como distinguir pessoa física: o nome não é republicado.
function creditor(document: string | null, rawName: string | null) {
  const result = supplier(document, rawName);
  return result.cnpj === null && !result.name?.startsWith("Pessoa física")
    ? { name: "Credor sem CNPJ (nome não republicado)", cnpj: null }
    : result;
}

function commonFields(raw: z.infer<z.ZodObject<typeof rawCommon>>) {
  const person = creditor(raw.INSMF, raw.NOME);
  return {
    commitmentNumber: raw.NEMPG,
    commitmentType: publicaText(raw.TPEM),
    process: publicaText(raw.PROC),
    creditorName: person.name,
    creditorCnpj: person.cnpj,
    managingEntity: publicaText(raw.EMPRESA_NOME),
    department: publicaText(raw.ORGAO),
    budgetFunction: publicaText(raw.FUNCAO),
    program: publicaText(raw.PROGRAMA),
    action: publicaText(raw.PROJATIV),
    economicCategory: publicaText(raw.CATEC),
    fundingSource: publicaText(raw.FONTECODIGO),
  };
}

export function createPublicaExpenses(municipality: PublicaMunicipality) {
  const source = publicaSource(municipality);
  const transport = publicaTransport(municipality);

  function commitment(input: unknown, year: number) {
    const parsed = rawCommitmentSchema.safeParse(input);
    if (!parsed.success)
      throw new Error("Empenho incompatível na API municipal.");
    const raw = parsed.data;
    if (raw.EMPRESA !== source.company)
      throw new Error("Unidade gestora do empenho difere da consultada.");
    return {
      ...commonFields(raw),
      id: `${year}-${raw.PKEMP}`,
      sourceYear: year,
      commitmentYear: raw.ANO_EMPENHO,
      committedOn: publicaDate(raw.DTEMPENHO),
      committedCents: publicaMoney(raw.EMPENHADO, true),
      canceledCents: publicaMoney(raw.ANULADO, true),
      liquidatedCents: publicaMoney(raw.LIQUIDADO, true),
      paidCents: publicaMoney(raw.PAGO, true),
      retainedCents: publicaMoney(raw.RETIDO, true),
    };
  }

  function payment(input: unknown, year: number) {
    const parsed = rawPaymentSchema.safeParse(input);
    if (!parsed.success)
      throw new Error("Pagamento incompatível na API municipal.");
    const raw = parsed.data;
    return {
      ...commonFields(raw),
      id: `${year}-${raw.PKEMP}-${raw.NUMSUB}-${raw.ORDPGSEQ}`,
      sourceYear: year,
      commitmentYear: Number(raw.EXERCICIO),
      settledOn: publicaDate(raw.DTLIQUIDACAO),
      dueOn: publicaDate(raw.DTVENCIMENTO),
      paidOn: publicaDate(raw.DTPAG),
      paidCents: publicaMoney(raw.VAPAG, true),
    };
  }

  async function fetchPage(
    query: ExpensesQuery,
    signal: AbortSignal,
    fetcher: typeof fetch = transport.fetch,
  ): Promise<ExpensePage> {
    if (!expensesQuerySchema.safeParse(query).success)
      throw new Error("Consulta de despesas inválida.");
    const { page, view, year } = query;
    const url = transport.url(
      `/api/despesas/${view}/${year}/${source.company}`,
    );
    url.searchParams.set("page", String(page));
    const body = await transport.fetchJson(
      url,
      signal,
      fetcher,
      SOURCE_TIMEOUT_MS,
    );
    // A fonte aninha a paginação ao lado de totais do exercício inteiro.
    const dictionary = z.record(z.string(), z.unknown());
    const section = dictionary.safeParse(
      (body as Record<string, unknown> | null)?.[view],
    );
    const totalsBlock = dictionary.safeParse(section.data?.totais);
    if (!section.success || !totalsBlock.success)
      throw new Error("Envelope de despesas incompatível na API municipal.");
    const totais = totalsBlock.data;
    const parsed = transport.parsePage(section.data[view], url, page);
    if (parsed.perPage !== EXPENSES_PAGE_SIZE)
      throw new Error("Tamanho da página oficial municipal mudou.");
    if (page > parsed.lastPage)
      throw new ContractsDataError("page-out-of-range");
    const common = {
      year,
      warnings: [],
      pagination: {
        currentPage: parsed.currentPage,
        lastPage: parsed.lastPage,
        perPage: parsed.perPage,
        total: parsed.total,
      },
      sourceUrl: parsed.sourceUrl,
    };
    const result = expensePageSchema.safeParse(
      view === "empenhos"
        ? {
            ...common,
            view,
            records: parsed.data.map((row) => commitment(row, year)),
            totals: {
              committedCents: publicaMoney(totais.TOTAL_EMPENHADO, true),
              liquidatedCents: publicaMoney(totais.TOTAL_LIQUIDADO, true),
              paidCents: publicaMoney(totais.TOTAL_PAGO, true),
              canceledCents: publicaMoney(totais.TOTAL_ANULADO, true),
            },
          }
        : {
            ...common,
            view,
            records: parsed.data.map((row) => payment(row, year)),
            totals: { paidCents: publicaMoney(totais.TOTAL_PAGO, true) },
          },
    );
    if (!result.success)
      throw new Error("Despesas normalizadas incompatíveis na API municipal.");
    return result.data;
  }

  return { fetchPage };
}
