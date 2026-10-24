import "server-only";
import { connection } from "next/server";
import { worksCatalogSchema } from "../core/works";
import { createCachedWorksReader } from "../core/municipal-cache";
import { readSource } from "../core/contracts-reader";
import { getContractsCache } from "./redis";
import { fetchWorks } from "../connectors/porto-velho/works";
import { getContract } from "./contracts";
import { createPublicaWorks } from "../connectors/publica/works";
import {
  municipalYear,
  publicaSource,
  type DataMunicipality,
} from "../core/municipal-sources";
const readWorks = createCachedWorksReader({
  cache: getContractsCache,
  read: () =>
    readSource(
      async (signal) => {
        const catalog = await fetchWorks(signal);
        let failed = 0;
        const ids = [
          ...new Set(
            catalog.records.flatMap((w) =>
              w.contractId === null ? [] : [w.contractId],
            ),
          ),
        ];
        // Apenas vínculos documentados pelo ID oficial. O cache de Contratos é reutilizado.
        for (let i = 0; i < ids.length; i += 4) {
          if (signal.aborted) throw new Error("Consulta cancelada");
          await Promise.all(
            ids.slice(i, i + 4).map(async (id) => {
              try {
                const { data } = await getContract(String(id));
                if (signal.aborted) throw new Error("Consulta cancelada");
                if (!data) {
                  failed++;
                  return;
                }
                for (const work of catalog.records.filter(
                  (w) => w.contractId === id,
                )) {
                  work.organization = data.department;
                  work.organizationName = data.departmentName;
                  work.documents.push(
                    ...data.documents.map((d) => ({
                      title: d.label,
                      url: d.url,
                      kind: "contrato" as const,
                    })),
                  );
                }
              } catch {
                failed++;
              }
            }),
          );
        }
        if (failed)
          catalog.warnings.push(
            "Não foi possível consultar " +
              failed +
              " contratos vinculados. Responsáveis e documentos desses contratos permanecem indisponíveis.",
          );
        return worksCatalogSchema.parse(catalog);
      },
      { timeoutMs: 90_000 },
    ),
});
const publicaReaders = new Map<
  string,
  ReturnType<typeof createCachedWorksReader>
>();
export async function getWorks(
  municipality: DataMunicipality = "porto-velho",
  year = municipalYear(),
) {
  await connection();
  if (municipality !== "porto-velho") {
    if (!Number.isInteger(year) || year < 2000 || year > 2100)
      throw new Error("Exercício inválido");
    const key = `${municipality}:${year}`;
    let reader = publicaReaders.get(key);
    if (!reader) {
      const source = publicaSource(municipality);
      const connector = createPublicaWorks(municipality);
      reader = createCachedWorksReader({
        cache: getContractsCache,
        cacheKey: `observatorio:RO:${municipality}:obras:v1:year:${year}:catalog`,
        sourceUrl: `${source.apiOrigin}/api/obras/${year}/${source.company}`,
        read: () =>
          readSource((signal) => connector.fetchWorks(signal, year), {
            timeoutMs: 90_000,
          }),
      });
      publicaReaders.set(key, reader);
    }
    return reader();
  }
  return readWorks();
}
