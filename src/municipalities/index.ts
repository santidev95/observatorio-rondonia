import { municipalitySchema, type Municipality } from "../core/municipality";
import geography from "../geography/rondonia-map.json";

const municipalities: Municipality[] = geography.municipalities.map((city) => {
  const portoVelho = city.slug === "porto-velho";
  const jiParana = city.slug === "ji-parana";
  const ariquemes = city.slug === "ariquemes";
  const pilot = portoVelho || jiParana || ariquemes;
  const connectorId = portoVelho
    ? "porto-velho-api-v1"
    : jiParana
      ? "ji-parana-publica-v1-ug2"
      : ariquemes
        ? "ariquemes-publica-v1-ug1"
        : null;
  const note = pilot
    ? "Conector implementado para consultar a fonte oficial. Acesse o módulo para verificar a disponibilidade e a cobertura."
    : "Fonte e cobertura ainda não verificadas.";
  return municipalitySchema.parse({
    ibgeId: city.id,
    slug: city.slug,
    name: city.name,
    state: "RO",
    stage: pilot ? "pilot" : "not-started",
    description: pilot
      ? `Consulte Obras, Contratos e Receitas de ${city.name}, com fontes oficiais e limites de cobertura por módulo.`
      : "A integração deste município ainda não foi iniciada. As fontes e a cobertura precisam ser levantadas.",
    modules: {
      contratos: {
        status: pilot ? "available" : "not-started",
        connectorId,
        note: pilot
          ? "Conector implementado para consultar o catálogo oficial. Acesse o módulo para verificar a disponibilidade da fonte."
          : "Fonte e cobertura ainda não verificadas.",
      },
      obras: {
        status: pilot ? "available" : "not-started",
        connectorId,
        note,
      },
      receitas: {
        status: pilot ? "available" : "not-started",
        connectorId,
        note,
      },
    },
  });
});
export function listMunicipalities(): readonly Municipality[] {
  return municipalities;
}
export function getMunicipality(slug: string): Municipality | undefined {
  return municipalities.find((municipality) => municipality.slug === slug);
}
