import type { Work } from "@/core/works";

export function sentenceCase(value: string) {
  if (value !== value.toUpperCase()) return value;
  return (value.charAt(0) + value.slice(1).toLowerCase()).replace(
    /\b(ete|cnpj|ro)\b/gi,
    (match) => match.toUpperCase(),
  );
}

/** Shorten administrative prefixes only; the full official object stays available. */
export function workTitle(value: string) {
  const short = value
    .trim()
    .replace(/^contratação de empresa especializada (?:em|para)\s+/i, "")
    .replace(/^(?:obras e )?serviços de engenharia para\s+/i, "")
    .replace(/^obras e serviços de\s+/i, "")
    .replace(/^serviços de\s+/i, "")
    .replace(/^realização de\s+/i, "")
    .replace(/\s*[–—]\s*(?:r\.|rua\b|av\.)[\s\S]+$/i, "")
    .replace(/\s*\((?:r\.|rua\b|av\.)[^)]*\)/gi, "")
    .replace(/\s+em porto velho\/ro\b/gi, "")
    .trim();
  return sentenceCase(short || value);
}

export function groupWorkDocuments(documents: Work["documents"]) {
  const groups = [
    { title: "Contrato e contratação", documents: [] as Work["documents"] },
    { title: "Aditivos", documents: [] as Work["documents"] },
    { title: "Medições", documents: [] as Work["documents"] },
    { title: "Outros documentos", documents: [] as Work["documents"] },
  ];
  for (const document of documents) {
    const index = /aditivo/i.test(document.title)
      ? 1
      : document.kind === "medicao"
        ? 2
        : document.kind === "contrato" ||
            /contrato|proposta/i.test(document.title)
          ? 0
          : 3;
    groups[index].documents.push(document);
  }
  return groups.filter((group) => group.documents.length);
}

export function oldWorkCount(works: Work[], collectedAt: string | null) {
  if (!collectedAt) return 0;
  return works.filter(
    (work) =>
      work.sourceUpdatedAt &&
      Date.parse(collectedAt) - Date.parse(work.sourceUpdatedAt) >
        180 * 86400000,
  ).length;
}
