import type { ContractRecord } from "../../core/contracts";
import { formatContractCnpj } from "./format";

export type ContractPageFilters = {
  q: string;
  org: string;
  status: string;
  sort: "source" | "updated" | "signed" | "value";
};

export const defaultContractPageFilters: ContractPageFilters = {
  q: "",
  org: "",
  status: "",
  sort: "source",
};

export function contractDepartment(record: ContractRecord): string {
  return record.department ?? record.departmentName ?? "Órgão não informado";
}

export function contractSuppliers(record: ContractRecord): string {
  return (
    record.suppliers
      .map((supplier) => supplier.name ?? supplier.cnpj)
      .filter(Boolean)
      .join(" · ") ||
    record.contractorName ||
    record.contractorCnpj ||
    "Empresa não informada"
  );
}

export function contractPageOptions(records: readonly ContractRecord[]) {
  return {
    orgs: [
      ...new Set(
        records.flatMap((record) => {
          const department = record.department ?? record.departmentName;
          return department ? [department] : [];
        }),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    statuses: [
      ...new Set(
        records.flatMap((record) => (record.status ? [record.status] : [])),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function searchableContract(record: ContractRecord): string {
  const documents = [
    record.contractorCnpj,
    ...record.suppliers.map((supplier) => supplier.cnpj),
  ].filter((document): document is string => document !== null);

  return searchKey(
    [
      record.number,
      record.object,
      record.process,
      record.department,
      record.departmentName,
      record.contractorName,
      ...record.suppliers.map((supplier) => supplier.name),
      ...documents,
      ...documents.map(formatContractCnpj),
    ].join(" "),
  );
}

function compareKnownDescending(
  first: number | null,
  second: number | null,
): number {
  if (first === null || second === null) {
    return first === second ? 0 : first === null ? 1 : -1;
  }
  return second - first;
}

function dateValue(value: string | null): number | null {
  return value === null ? null : Date.parse(value);
}

/** Busca e ordenação apenas sobre os registros da página recebida da API. */
export function filterContractPage(
  records: readonly ContractRecord[],
  filters: ContractPageFilters,
): ContractRecord[] {
  const words = searchKey(filters.q.trim()).split(/\s+/).filter(Boolean);
  const filtered = records.filter((record) => {
    if (filters.org && contractDepartment(record) !== filters.org) return false;
    if (filters.status && record.status !== filters.status) return false;
    if (!words.length) return true;

    const searchable = searchableContract(record);
    return words.every((word) => searchable.includes(word));
  });

  if (filters.sort === "source") return filtered;

  return filtered.sort((first, second) => {
    if (filters.sort === "value") {
      return compareKnownDescending(first.amountCents, second.amountCents);
    }
    const firstDate =
      filters.sort === "signed" ? first.signedOn : first.sourceUpdatedAt;
    const secondDate =
      filters.sort === "signed" ? second.signedOn : second.sourceUpdatedAt;
    return compareKnownDescending(dateValue(firstDate), dateValue(secondDate));
  });
}

export function sentenceCaseObject(text: string): string {
  if (text !== text.toUpperCase()) return text;
  return (text.charAt(0) + text.slice(1).toLowerCase()).replace(
    /\b(ete|cnpj|ro)\b/gi,
    (match) => match.toUpperCase(),
  );
}
