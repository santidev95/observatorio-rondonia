import { test } from "node:test";
import assert from "node:assert/strict";
import { getIntegrationStatus } from "../src/core/integration-status";
import { getMunicipality, listMunicipalities } from "../src/municipalities";

test("a legenda distingue o piloto em preparação de propostas ainda não iniciadas", () => {
  assert.equal(
    getIntegrationStatus(getMunicipality("porto-velho")!),
    "in-progress",
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
    listMunicipalities().some(
      (city) => getIntegrationStatus(city) === "integrated",
    ),
    false,
  );
});

test("ao menos um catálogo disponível identifica integração, mesmo em município piloto", () => {
  const city = structuredClone(getMunicipality("porto-velho")!);
  city.modules.contratos = {
    status: "available",
    connectorId: "conector-sintetico",
    note: "Catálogo sintético disponível apenas neste teste.",
  };
  assert.equal(getIntegrationStatus(city), "integrated");
});
