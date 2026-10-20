const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatContractMoney(cents: number | null): string {
  return cents === null ? "Não informado" : money.format(cents / 100);
}

// Datas civis da origem não recebem conversão de fuso.
export function formatContractDate(value: string | null): string {
  if (value === null) return "Não informado";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function formatConsultationTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Porto_Velho",
  }).format(new Date(value));
}

export function formatContractCnpj(value: string | null): string {
  if (value === null || !/^[A-Z0-9]{12}[0-9]{2}$/.test(value))
    return "Não informado";
  return value.replace(
    /^([A-Z0-9]{2})([A-Z0-9]{3})([A-Z0-9]{3})([A-Z0-9]{4})([0-9]{2})$/,
    "$1.$2.$3/$4-$5",
  );
}
