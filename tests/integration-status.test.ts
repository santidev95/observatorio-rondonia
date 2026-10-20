import { test } from "node:test";
import assert from "node:assert/strict";
import { getIntegrationStatus } from "../src/core/integration-status";
import { getMunicipality, listMunicipalities } from "../src/municipalities";

test("a legenda identifica somente o piloto publicado como integrado", () => {
  assert.equal(
    getIntegrationStatus(getMunicipality("porto-velho")!),
    "integrated",
  );
  assert.equal(
    getIntegrationStatus(getMunicipality("ji-parana")!),
    "not-integrated",
  );
  assert.equal(
    getIntegrationStatus(getMunicipality("cacoal")!),
    "not-integrated",
  );
  assert.equal(
    listMunicipalities().filter(
      (city) => getIntegrationStatus(city) === "integrated",
    ).length,
    1,
  );
});

test("ao menos um catálogo disponível identifica integração, mesmo em município piloto", () => {
  const city = structuredClone(getMunicipality("porto-velho")!);
  for (const module of Object.values(city.modules)) module.status = "planned";
  city.modules.contratos = {
    status: "available",
    connectorId: "conector-sintetico",
    note: "Catálogo sintético disponível apenas neste teste.",
  };
  assert.equal(getIntegrationStatus(city), "integrated");
});

test("município piloto sem catálogo publicado continua em andamento", () => {
  const city = structuredClone(getMunicipality("porto-velho")!);
  for (const module of Object.values(city.modules)) module.status = "planned";
  assert.equal(getIntegrationStatus(city), "in-progress");
});
