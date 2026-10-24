import { z } from "zod";
import { MunicipalSourceError } from "../../core/municipal-source-error";
import {
  publicaSource,
  type PublicaMunicipality,
} from "../../core/municipal-sources";
export type PublicaPage = {
  data: unknown[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  missingRows: number;
  sourceUrl: string;
};
function createPublicaTransport(municipality: PublicaMunicipality) {
  const source = publicaSource(municipality);
  const maxResponseBytes = 5 * 1024 * 1024;
  let nextStart = 0;
  let reserve: (() => Promise<number | null>) | undefined;

  function currentYear(now = new Date()): number {
    return Number(
      new Intl.DateTimeFormat("en", {
        timeZone: "America/Porto_Velho",
        year: "numeric",
      }).format(now),
    );
  }

  function configureRateLimit(reservation: () => Promise<number | null>) {
    reserve = reservation;
  }

  async function wait(ms: number, signal?: AbortSignal | null) {
    signal?.throwIfAborted();
    if (ms <= 0) return;
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        reject(new Error(`Consulta à API de ${source.name} cancelada.`));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
      }, ms);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });
  }

  const publicaFetch: typeof fetch = async (input, init) => {
    init?.signal?.throwIfAborted();
    const reserved = reserve ? await reserve() : null;
    if (reserved !== null) {
      if (reserved < 0 || !Number.isFinite(reserved))
        throw new Error(
          `Limite de consultas à API de ${source.name} atingido.`,
        );
      await wait(reserved, init?.signal);
    } else {
      const start = Math.max(Date.now(), nextStart);
      if (start - Date.now() > 11000)
        throw new Error(
          `Limite de consultas à API de ${source.name} atingido.`,
        );
      nextStart = start + 1100;
      await wait(start - Date.now(), init?.signal);
    }
    init?.signal?.throwIfAborted();
    return fetch(input, init);
  };

  function publicaUrl(path: string | URL): URL {
    const url = new URL(String(path), source.apiOrigin);
    if (
      url.origin !== source.apiOrigin ||
      url.username ||
      url.password ||
      url.hash ||
      !url.pathname.startsWith("/api/") ||
      /%2f|%5c/i.test(url.pathname)
    )
      throw new Error(`Endereço da API de ${source.name} inválido.`);
    return url;
  }

  async function fetchPublicaJson(
    path: string | URL,
    signal: AbortSignal,
    fetcher: typeof fetch = publicaFetch,
  ): Promise<unknown> {
    signal.throwIfAborted();
    const url = publicaUrl(path);
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, 12000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    let response: Response | undefined;
    try {
      response = await fetcher(url.href, {
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
        headers: { Accept: "application/json" },
      });
      if (
        response.status !== 200 ||
        !/\bapplication\/(?:[a-z.+-]*\+)?json\b/i.test(
          response.headers.get("content-type") ?? "",
        ) ||
        Number(response.headers.get("content-length")) > maxResponseBytes ||
        !response.body
      )
        throw new Error(`Resposta incompatível da API de ${source.name}.`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      let bytes = 0;
      try {
        for (;;) {
          controller.signal.throwIfAborted();
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > maxResponseBytes)
            throw new Error(
              `Resposta da API de ${source.name} excede o limite.`,
            );
          text += decoder.decode(part.value, { stream: true });
        }
        text += decoder.decode();
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
      } finally {
        reader.releaseLock();
      }
      controller.signal.throwIfAborted();
      return JSON.parse(text);
    } catch {
      await response?.body?.cancel().catch(() => {});
      throw new Error(
        signal.aborted
          ? `Consulta à API de ${source.name} cancelada.`
          : `A API de ${source.name} não respondeu com dados válidos.`,
      );
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  }

  const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
  const pageSchema = z.object({
    data: z.array(z.unknown()).max(1000),
    current_page: integer.positive(),
    last_page: integer.positive(),
    per_page: integer.positive().max(1000),
    total: integer,
    from: integer.positive().nullable(),
    to: integer.positive().nullable(),
  });

  async function readPublicaPage(
    path: string | URL,
    page: number,
    signal: AbortSignal,
    fetcher: typeof fetch = publicaFetch,
    envelope?: string,
    allowMissingLastRecord = false,
    allowShortPages = false,
  ): Promise<PublicaPage> {
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw new Error(`Página de ${source.name} inválida.`);
    const url = publicaUrl(path);
    url.searchParams.set("page", String(page));
    const body = await fetchPublicaJson(url, signal, fetcher);
    const candidate =
      envelope &&
      typeof body === "object" &&
      body !== null &&
      !Array.isArray(body)
        ? (body as Record<string, unknown>)[envelope]
        : envelope
          ? null
          : body;
    const parsed = pageSchema.safeParse(candidate);
    if (!parsed.success)
      throw new Error(
        `Envelope de paginação incompatível na API de ${source.name}.`,
      );
    const p = parsed.data;
    const count = Math.min(
      p.per_page,
      Math.max(0, p.total - (page - 1) * p.per_page),
    );
    const received = p.data.length;
    if (
      p.current_page !== page ||
      p.last_page !== Math.max(1, Math.ceil(p.total / p.per_page)) ||
      p.from !== (received ? (page - 1) * p.per_page + 1 : null) ||
      p.to !== (received ? (page - 1) * p.per_page + received : null)
    )
      throw new Error(
        `Paginação incompleta ou inconsistente em ${source.name}.`,
      );
    const missingLastRecord =
      allowMissingLastRecord && page === p.last_page && received === count - 1;
    const shortWorksPage =
      allowShortPages &&
      municipality === "ariquemes" &&
      envelope === undefined &&
      /^\/api\/obras\/(20\d{2}|2100)\/1$/.test(url.pathname) &&
      received < count;
    if (received !== count && !missingLastRecord && !shortWorksPage)
      throw new MunicipalSourceError({
        kind: "pagination",
        page,
        total: p.total,
        expected: count,
        received,
      });
    return {
      data: p.data,
      currentPage: p.current_page,
      lastPage: p.last_page,
      perPage: p.per_page,
      total: p.total,
      missingRows: count - received,
      sourceUrl: url.href,
    };
  }

  async function collectPublicaPages(
    path: string | URL,
    signal: AbortSignal,
    fetcher: typeof fetch = publicaFetch,
    limits: {
      maxRecords?: number;
      maxPages?: number;
      envelope?: string;
      allowMissingLastRecord?: boolean;
      allowShortPages?: boolean;
    } = {},
  ): Promise<{
    records: unknown[];
    sourceUrl: string;
    total: number;
    missingRows: number;
  }> {
    const first = await readPublicaPage(
      path,
      1,
      signal,
      fetcher,
      limits.envelope,
      limits.allowMissingLastRecord,
      limits.allowShortPages,
    );
    if (
      first.total > (limits.maxRecords ?? 100000) ||
      first.lastPage > (limits.maxPages ?? 1000)
    )
      throw new Error(`Catálogo de ${source.name} acima do limite de coleta.`);
    const records = [...first.data];
    let missingRows = first.missingRows;
    for (let index = 2; index <= first.lastPage; index++) {
      const page = await readPublicaPage(
        path,
        index,
        signal,
        fetcher,
        limits.envelope,
        limits.allowMissingLastRecord,
        limits.allowShortPages,
      );
      if (
        page.total !== first.total ||
        page.perPage !== first.perPage ||
        page.lastPage !== first.lastPage
      )
        throw new Error(`Cobertura de ${source.name} mudou durante a coleta.`);
      records.push(...page.data);
      missingRows += page.missingRows;
    }
    signal.throwIfAborted();
    if (records.length !== first.total - missingRows)
      throw new Error(`Cobertura de ${source.name} mudou durante a coleta.`);
    return {
      records,
      sourceUrl: first.sourceUrl,
      total: first.total,
      missingRows,
    };
  }

  return {
    fetch: publicaFetch,
    url: publicaUrl,
    fetchJson: fetchPublicaJson,
    readPage: readPublicaPage,
    collectPages: collectPublicaPages,
    configureRateLimit,
    currentYear,
  };
}
const transports = {
  "ji-parana": createPublicaTransport("ji-parana"),
  ariquemes: createPublicaTransport("ariquemes"),
};
export function publicaTransport(municipality: PublicaMunicipality) {
  publicaSource(municipality);
  return transports[municipality];
}
function decodedText(value: string): string {
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

export function publicaText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string")
    throw new Error("Texto incompatível na API municipal.");
  return (
    decodedText(value)
      .replace(/<[^>]*>/g, " ")
      .replace(
        /(?<!\d)\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}(?!\d)/gu,
        "[CPF não republicado]",
      )
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

// A conversão usa aritmética inteira; não arredonda valores de precisão desconhecida.
export function publicaMoney(value: unknown, signed = false): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error("Valor incompatível na API municipal.");
  let decimal = String(value)
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (decimal.includes(",")) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(decimal))
      throw new Error("Valor monetário inválido na API municipal.");
    decimal = decimal.replace(/\./g, "").replace(",", ".");
  }
  if (
    !/^-?\d+(?:\.\d+)?$/.test(decimal) ||
    (!signed && decimal.startsWith("-"))
  )
    throw new Error("Valor monetário inválido na API municipal.");
  const sign = decimal.startsWith("-") ? -1n : 1n;
  const [whole, fraction = ""] = decimal.replace(/^-/, "").split(".");
  if (!/^0*$/.test(fraction.slice(2)))
    throw new Error(
      "Valor monetário possui fração de centavo na API municipal.",
    );
  const cents =
    sign * (BigInt(whole) * 100n + BigInt(fraction.slice(0, 2).padEnd(2, "0")));
  if (
    cents > BigInt(Number.MAX_SAFE_INTEGER) ||
    cents < -BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw new Error("Valor monetário fora do intervalo seguro.");
  return Number(cents);
}

export function publicaDate(value: unknown): string | null {
  const source = publicaText(value);
  if (source === null) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(source);
  const date = br ? `${br[3]}-${br[2]}-${br[1]}` : source;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new Error("Data incompatível na API municipal.");
  return date;
}
