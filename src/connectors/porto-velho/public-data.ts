import { municipalFetch } from "./transport";
import { containsPersonalDocument } from "../../core/contracts";
export function text(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") throw new Error("Texto inválido");
  return (
    v
      .replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(?:x[0-9a-f]+|[0-9]+);/gi, (m) => {
        const p = m.slice(2, -1);
        const n = p[0] === "x" ? parseInt(p.slice(1), 16) : parseInt(p, 10);
        return n <= 0x10ffff ? String.fromCodePoint(n) : "";
      })
      .replace(
        /(?<!\d)\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}(?!\d)/g,
        "[CPF não republicado]",
      )
      .replace(/\s+/g, " ")
      .trim() || null
  );
}
export function record(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
}
export function items(x: unknown): Record<string, unknown>[] {
  if (x === null || x === undefined) return [];
  if (!Array.isArray(x)) throw new Error("Lista inválida");
  return x.map(record);
}
export function moneyToCents(input: unknown): number | null {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input === "object") {
    const o = record(input);
    return moneyToCents(o.formatted ?? o.value);
  }
  if (typeof input !== "string" && typeof input !== "number")
    throw new Error("Valor inválido");
  let s = String(input)
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (s.includes(",")) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(s))
      throw new Error("Valor inválido");
    s = s.replaceAll(".", "").replace(",", ".");
  }
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(s)) throw new Error("Valor inválido");
  const sign = s.startsWith("-") ? -1n : 1n;
  const [a, b = ""] = s.replace(/^-/, "").split(".");
  const n = sign * (BigInt(a) * 100n + BigInt(b.padEnd(2, "0")));
  if (
    n > BigInt(Number.MAX_SAFE_INTEGER) ||
    n < -BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw new Error("Valor fora do intervalo");
  return Number(n);
}
export function parseDate(v: unknown): string | null {
  const s = text(v);
  if (!s) return null;
  let d = s.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d))
    d = d.slice(6) + "-" + d.slice(3, 5) + "-" + d.slice(0, 2);
  const t = new Date(d + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
    !Number.isFinite(t.getTime()) ||
    t.toISOString().slice(0, 10) !== d
  )
    throw new Error("Data inválida");
  return d;
}
export function officialUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    let decoded = v;
    for (let i = 0; i < 3; i++) decoded = decodeURIComponent(decoded);
    if (
      !["https:", "http:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.port ||
      !(
        u.hostname === "portovelho.ro.gov.br" ||
        u.hostname.endsWith(".portovelho.ro.gov.br")
      ) ||
      containsPersonalDocument(decoded) ||
      [...u.searchParams.keys()].some((k) => /cpf/i.test(k))
    )
      return null;
    u.protocol = "https:";
    return u.href;
  } catch {
    return null;
  }
}
export async function fetchJson(
  url: string,
  signal: AbortSignal,
  request: typeof fetch = municipalFetch,
): Promise<unknown> {
  let r: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    r = await request(url, {
      signal,
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json" },
    });
    if (![429, 500, 502, 503, 504].includes(r.status) || attempt === 2) break;
    await r.body?.cancel();
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new Error("Consulta cancelada"));
      };
      const timer = setTimeout(
        () => {
          signal.removeEventListener("abort", abort);
          resolve();
        },
        500 * (attempt + 1),
      );
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
  }
  if (!r?.ok || !r.body) throw new Error("Fonte indisponível");
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 12 * 1024 * 1024) throw new Error("Resposta excede limite");
      chunks.push(value);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
type Page = {
  data: Record<string, unknown>[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};
export async function allPages(
  base: string,
  size: number,
  maxPages: number,
  signal: AbortSignal,
  consume: (rows: Record<string, unknown>[]) => void,
  request: typeof fetch = municipalFetch,
) {
  const load = async (page: number): Promise<Page> => {
    const url = new URL(base);
    url.searchParams.set("page", String(page));
    url.searchParams.set("por-pagina", String(size));
    const p = record(await fetchJson(url.href, signal, request));
    const m = record(p.meta);
    if (
      !Array.isArray(p.data) ||
      m.current_page !== page ||
      m.per_page !== size ||
      !Number.isSafeInteger(m.total) ||
      Number(m.total) < 0 ||
      m.last_page !== Math.max(1, Math.ceil(Number(m.total) / size)) ||
      page > Number(m.last_page) ||
      p.data.length !==
        Math.min(size, Math.max(0, Number(m.total) - (page - 1) * size))
    )
      throw new Error("Paginação inconsistente");
    return { data: p.data.map(record), meta: m as Page["meta"] };
  };
  const first = await load(1);
  if (first.meta.last_page > maxPages)
    throw new Error("Cobertura acima do limite");
  consume(first.data);
  for (let start = 2; start <= first.meta.last_page; start += 2) {
    const pages = await Promise.all(
      Array.from(
        { length: Math.min(2, first.meta.last_page - start + 1) },
        (_, i) => load(start + i),
      ),
    );
    for (const page of pages) {
      if (
        page.meta.total !== first.meta.total ||
        page.meta.last_page !== first.meta.last_page
      )
        throw new Error("Cobertura mudou durante a consulta");
      consume(page.data);
    }
  }
  return first.meta.total;
}

// Códigos contábeis oficiais podem ter 11 dígitos. Somente o prefixo de
// classificação é preservado; o rótulo continua sujeito à minimização.
export function accountingText(v: unknown): string | null {
  if (typeof v !== "string") return text(v);
  const match = v.match(/^(\d{1,20}\s*-\s*)([\s\S]*)$/);
  return match ? match[1] + (text(match[2]) ?? "Não informado") : text(v);
}
