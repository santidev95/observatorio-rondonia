import { municipalitySchema, type Municipality } from "../core/municipality";
import geography from "../geography/rondonia-map.json";

const municipalities: Municipality[] = geography.municipalities.map((city) => {
  const pilot = city.slug === "porto-velho";
  const proposed = city.slug === "ji-parana";
  const note = pilot
    ? "Conector implementado para consultar a fonte oficial. Acesse o módulo para verificar a disponibilidade e a cobertura."
    : "Fonte e cobertura ainda não verificadas.";
  return municipalitySchema.parse({
    ibgeId: city.id,
    slug: city.slug,
    name: city.name,
    state: "RO",
    stage: pilot ? "pilot" : proposed ? "planned" : "not-started",
    description: pilot
      ? "O primeiro município da plataforma. Consulte Obras, Contratos e Receitas nas fontes oficiais."
      : proposed
        ? "Proposta para a segunda integração. O levantamento das fontes ainda precisa ser realizado."
        : "A integração deste município ainda não foi iniciada. As fontes e a cobertura precisam ser levantadas.",
    modules: {
      contratos: {
        status: pilot ? "available" : proposed ? "planned" : "not-started",
        connectorId: pilot ? "porto-velho-api-v1" : null,
        note: pilot
          ? "Conector implementado para consultar o catálogo oficial. Acesse o módulo para verificar a disponibilidade da fonte."
          : "Fonte e cobertura ainda não verificadas.",
      },
      obras: {
        status: pilot ? "available" : proposed ? "planned" : "not-started",
        connectorId: pilot ? "porto-velho-api-v1" : null,
        note,
      },
      receitas: {
        status: pilot ? "available" : proposed ? "planned" : "not-started",
        connectorId: pilot ? "porto-velho-api-v1" : null,
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
