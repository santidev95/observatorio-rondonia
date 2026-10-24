import { test } from "node:test";
import assert from "node:assert/strict";
import { getIntegrationStatus } from "../src/core/integration-status";
import { getMunicipality, listMunicipalities } from "../src/municipalities";

test("a legenda identifica os três municípios com módulos disponíveis e mantém os demais não integrados", () => {
  assert.equal(
    getIntegrationStatus(getMunicipality("porto-velho")!),
    "integrated",
  );
  assert.equal(
    getIntegrationStatus(getMunicipality("ji-parana")!),
    "integrated",
  );
  assert.equal(
    getIntegrationStatus(getMunicipality("ariquemes")!),
    "integrated",
  );
  assert.equal(
    getIntegrationStatus(getMunicipality("cacoal")!),
    "not-integrated",
  );
  assert.equal(
    listMunicipalities().filter(
      (city) => getIntegrationStatus(city) === "integrated",
    ).length,
    3,
  );
  assert.equal(
    listMunicipalities().filter(
      (city) => getIntegrationStatus(city) === "not-integrated",
    ).length,
    49,
  );
  assert.equal(
    listMunicipalities().filter(
      (city) => getIntegrationStatus(city) === "in-progress",
    ).length,
    0,
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

test("pilotos com todos os módulos em preparação continuam em andamento", () => {
  for (const slug of ["porto-velho", "ji-parana", "ariquemes"]) {
    const city = structuredClone(getMunicipality(slug)!);
    for (const module of Object.values(city.modules)) module.status = "planned";
    assert.equal(getIntegrationStatus(city), "in-progress");
  }
});
