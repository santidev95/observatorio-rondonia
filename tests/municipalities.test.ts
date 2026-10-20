import { test } from "node:test";
import assert from "node:assert/strict";
import { getMunicipality, listMunicipalities } from "../src/municipalities";
import { municipalitySchema, moduleIds } from "../src/core/municipality";
import { snapshotKey } from "../src/core/connector";
import { portoVelhoSource } from "../src/connectors/porto-velho/definition";

test("municípios têm slugs únicos e não anunciam dados ainda não integrados", () => {
  const cities = listMunicipalities();
  assert.equal(new Set(cities.map((city) => city.slug)).size, cities.length);
  for (const city of cities) {
    assert.equal(city.state, "RO");
    for (const module of moduleIds) {
      if (city.slug === "porto-velho")
        assert.equal(city.modules[module].status, "available");
      else assert.notEqual(city.modules[module].status, "available");
    }
  }
});
test("slug desconhecido não seleciona outro município por fallback", () => {
  assert.equal(getMunicipality("inexistente"), undefined);
  assert.equal(getMunicipality("__proto__"), undefined);
  assert.equal(getMunicipality("porto-velho")?.name, "Porto Velho");
});
test("chaves de snapshot isolam município, módulo e versão", () => {
  assert.notEqual(
    snapshotKey("porto-velho", "contratos"),
    snapshotKey("ji-parana", "contratos"),
  );
  assert.notEqual(
    snapshotKey("porto-velho", "contratos"),
    snapshotKey("porto-velho", "obras"),
  );
  assert.throws(() => snapshotKey("porto-velho:obras", "contratos"));
});
test("capacidade disponível exige conector identificado", () => {
  const city = structuredClone(getMunicipality("porto-velho")!);
  city.modules.contratos = {
    status: "available",
    connectorId: null,
    note: "Sintético",
  };
  assert.equal(municipalitySchema.safeParse(city).success, false);
});
test("conector de consulta publicado do piloto corresponde ao cadastro", () => {
  assert.equal(
    portoVelhoSource.id,
    getMunicipality("porto-velho")?.modules.contratos.connectorId,
  );
  assert.equal(portoVelhoSource.implementation, "implemented");
  assert.equal(
    new URL(portoVelhoSource.url).hostname,
    "api.portovelho.ro.gov.br",
  );
});
