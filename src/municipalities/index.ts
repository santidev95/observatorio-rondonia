import { municipalitySchema, type Municipality } from "../core/municipality";
import geography from "../geography/rondonia-map.json";

const municipalities: Municipality[] = geography.municipalities.map((city) => {
  const pilot = city.slug === "porto-velho";
  const proposed = city.slug === "ji-parana";
  const note = pilot
    ? "Integração prevista após a validação do piloto de Contratos."
    : "Fonte e cobertura ainda não verificadas.";
  return municipalitySchema.parse({
    ibgeId: city.id,
    slug: city.slug,
    name: city.name,
    state: "RO",
    stage: pilot ? "pilot" : proposed ? "planned" : "not-started",
    description: pilot
      ? "O primeiro município da plataforma. A integração começa pelo catálogo de contratos."
      : proposed
        ? "Proposta para a segunda integração. O levantamento das fontes ainda precisa ser realizado."
        : "A integração deste município ainda não foi iniciada. As fontes e a cobertura precisam ser levantadas.",
    modules: {
      contratos: {
        status: pilot || proposed ? "planned" : "not-started",
        connectorId: pilot ? "porto-velho-api-v1" : null,
        note: pilot
          ? "Conector implementado para consultar o catálogo oficial. Acesse o módulo para verificar a disponibilidade da fonte."
          : "Fonte e cobertura ainda não verificadas.",
      },
      obras: {
        status: pilot || proposed ? "planned" : "not-started",
        connectorId: null,
        note,
      },
      receitas: {
        status: pilot || proposed ? "planned" : "not-started",
        connectorId: null,
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
