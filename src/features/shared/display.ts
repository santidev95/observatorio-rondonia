export const currency = (cents: number | null, compact = false) =>
  cents === null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        ...(compact
          ? { notation: "compact", maximumFractionDigits: 1 }
          : { minimumFractionDigits: 2 }),
      }).format(cents / 100);
export function dateLabel(value: string | null) {
  if (!value) return "Não informada";
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Porto_Velho",
      }).format(date)
    : "Não informada";
}
export const percentLabel = (v: number | null) =>
  v === null
    ? "Não informado"
    : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v)}%`;
export const searchKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
