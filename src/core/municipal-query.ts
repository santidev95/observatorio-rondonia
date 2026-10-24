import { municipalYear } from "./municipal-sources";
export class MunicipalQueryError extends Error {
  constructor() {
    super("Filtros inválidos. Revise os parâmetros da consulta.");
  }
}
export function parseWorksYear(
  input: Record<string, string | string[] | undefined>,
  currentYear = municipalYear(),
) {
  const value = input.ano;
  if (value === undefined) return currentYear;
  if (typeof value !== "string" || !/^(?:20\d{2}|2100)$/.test(value))
    throw new MunicipalQueryError();
  return Number(value);
}
export function parseRevenueQuery(
  input: Record<string, string | string[] | undefined>,
  currentYear = municipalYear(),
) {
  const allowed = [
    "ano",
    "unidade",
    "tipo",
    "categoria",
    "q",
    "mes",
    "ordem",
    "page",
  ];
  for (const [key, value] of Object.entries(input))
    if (
      !allowed.includes(key) ||
      Array.isArray(value) ||
      (typeof value === "string" && value.length > (key === "q" ? 200 : 300))
    )
      throw new MunicipalQueryError();
  const year = input.ano === undefined ? currentYear : Number(input.ano);
  if (
    !Number.isInteger(year) ||
    ![currentYear, currentYear - 1].includes(year) ||
    (input.ano !== undefined && !/^20\d{2}$/.test(input.ano as string))
  )
    throw new MunicipalQueryError();
  if (
    (input.mes !== undefined &&
      !/^(?:[1-9]|1[0-2])$/.test(input.mes as string)) ||
    (input.tipo !== undefined &&
      !["budget", "extra", "unknown"].includes(input.tipo as string)) ||
    (input.ordem !== undefined &&
      !["realized", "planned", "account"].includes(input.ordem as string)) ||
    (input.page !== undefined && !/^[1-9]\d{0,5}$/.test(input.page as string))
  )
    throw new MunicipalQueryError();
  return { year };
}
