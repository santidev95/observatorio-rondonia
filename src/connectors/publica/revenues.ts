import { createHash } from "node:crypto";
import {
  revenueEntrySchema,
  revenueSnapshotSchema,
  revenueSourceUrl,
  type RevenueEntry,
} from "../../core/revenues";
import { assertRevenueYear } from "../../core/revenue-refresh";
import {
  publicaSource,
  type PublicaMunicipality,
} from "../../core/municipal-sources";
import { publicaMoney, publicaText, publicaTransport } from "./transport";

const groups = [
  {
    path: "arrecadadas-diretamente",
    envelope: "arrecadacoes",
    label: "Receitas arrecadadas diretamente",
  },
  {
    path: "transferencias/estaduais",
    envelope: "transferencias",
    label: "Transferências estaduais",
  },
  {
    path: "transferencias/federais",
    envelope: "transferencias",
    label: "Transferências federais",
  },
] as const;

// A plataforma publica rubricas anuais, sem comprovar aditividade entre grupos.
export function createPublicaRevenues(municipality: PublicaMunicipality) {
  const source = publicaSource(municipality);
  const transport = publicaTransport(municipality);
  const prefix = municipality === "ji-parana" ? "ji" : "ari";
  return async function fetchPublicaRevenues(
    year: number,
    signal: AbortSignal,
    request: typeof fetch = transport.fetch,
  ) {
    assertRevenueYear(year);
    signal.throwIfAborted();
    const at = new Date().toISOString();
    const entries: RevenueEntry[] = [];
    const codes = new Set<string>();
    for (const group of groups) {
      const path = `/api/receitas/${group.path}/${year}/${source.company}`;
      const { records } = await transport.collectPages(path, signal, request, {
        envelope: group.envelope,
        maxRecords: 10000,
        maxPages: 1000,
      });
      for (const value of records) {
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new Error(
            `Rubrica de receita incompatível na API de ${source.name}.`,
          );
        const row = value as Record<string, unknown>;
        const code = typeof row.CODRE === "string" ? row.CODRE.trim() : "";
        if (!/^[0-9]+(?:\.[0-9]+){7}$/.test(code) || codes.has(code))
          throw new Error(
            `Código de receita ausente ou repetido; coleta de ${source.name} rejeitada.`,
          );
        if (
          (row.EMPRESA !== undefined &&
            Number(row.EMPRESA) !== source.company) ||
          (row.EXERCICIO !== undefined && Number(row.EXERCICIO) !== year) ||
          (row.ANO !== undefined && Number(row.ANO) !== year)
        )
          throw new Error(
            `Receita fora da unidade gestora ou exercício de ${source.name} solicitado.`,
          );
        const name = publicaText(row.NOMRE);
        if (!name)
          throw new Error(`Rubrica sem descrição na API de ${source.name}.`);
        const planned = publicaMoney(row.ORCADO, true);
        const annual = publicaMoney(row.ARRECADADO, true);
        codes.add(code);
        entries.push(
          revenueEntrySchema.parse({
            id: `${prefix}-receita-${createHash("sha256").update(`${year}|${source.company}|${code}`).digest("hex").slice(0, 24)}`,
            sourceId: code,
            sourceUrl: source.apiOrigin + path,
            year,
            unitId: String(source.company),
            unitName:
              publicaText(row.EMPRESA_NOME) ??
              `Prefeitura Municipal de ${source.name}`,
            account: name.startsWith(code) ? name : `${code} - ${name}`,
            category: publicaText(row.NIVEL_2) ?? group.label,
            origin: publicaText(row.NIVEL_3) ?? group.label,
            fundingSource: "Fonte de recurso não informada neste resumo",
            kind: "budget",
            plannedCents: planned,
            plannedLines: 1,
            missingPlannedValues: planned === null ? 1 : 0,
            annual: {
              cents: annual,
              records: 1,
              missingValues: annual === null ? 1 : 0,
            },
            months: [],
            inLatestSnapshot: true,
          }),
        );
      }
    }
    signal.throwIfAborted();
    return revenueSnapshotSchema.parse({
      schemaVersion: 1,
      municipality,
      portalId: null,
      aggregation: "annual-accounts",
      coverage: "partial",
      warnings: [
        `Cobertura parcial: receitas arrecadadas diretamente e transferências estaduais e federais da unidade gestora ${source.company} (Prefeitura). Outros grupos e unidades não estão incluídos.`,
        "A fonte publica valores anuais por rubrica. Não há série mensal nesta integração; as linhas não são documentos individuais. A data do último documento não é informada.",
        "Os valores por rubrica são preservados como publicados. Não calculamos soma global nem percentual da previsão: a cobertura e a aditividade entre os grupos não estão comprovadas.",
      ],
      generatedAt: at,
      lastAttemptAt: at,
      syncStatus: "ok",
      syncError: null,
      years: [
        {
          year,
          receipts: entries.length,
          planned: entries.length,
          lastDocumentDate: null,
        },
      ],
      entries: entries.sort((a, b) => a.id.localeCompare(b.id)),
      sourceUrl: revenueSourceUrl(municipality, year),
    });
  };
}
