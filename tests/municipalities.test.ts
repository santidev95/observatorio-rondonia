import { test } from "node:test";
import assert from "node:assert/strict";
import { getMunicipality, listMunicipalities } from "../src/municipalities";
import { municipalitySchema, moduleIds } from "../src/core/municipality";
import { snapshotKey } from "../src/core/connector";
import { portoVelhoSource } from "../src/connectors/porto-velho/definition";
import {
  jiParanaSource,
  jiParanaWorksSource,
  jiParanaRevenuesSource,
} from "../src/connectors/ji-parana/definition";
import {
  ariquemesSource,
  ariquemesWorksSource,
  ariquemesRevenuesSource,
} from "../src/connectors/ariquemes/definition";
import { dataMunicipality } from "../src/core/municipal-sources";

test("municípios têm slugs únicos e não anunciam dados ainda não integrados", () => {
  const cities = listMunicipalities();
  assert.equal(cities.length, 52);
  assert.equal(new Set(cities.map((city) => city.slug)).size, cities.length);
  for (const city of cities) {
    assert.equal(city.state, "RO");
    const available: Record<string, string> = {
      "porto-velho": portoVelhoSource.id,
      "ji-parana": jiParanaSource.id,
      ariquemes: ariquemesSource.id,
    };
    const pilot = city.slug in available;
    assert.equal(city.stage, pilot ? "pilot" : "not-started");
    for (const module of moduleIds) {
      if (pilot) {
        assert.equal(city.modules[module].status, "available");
        assert.equal(city.modules[module].connectorId, available[city.slug]);
      } else {
        assert.equal(city.modules[module].status, "not-started");
        assert.equal(city.modules[module].connectorId, null);
      }
    }
  }
});
test("slug desconhecido não seleciona outro município por fallback", () => {
  assert.equal(getMunicipality("inexistente"), undefined);
  assert.equal(getMunicipality("__proto__"), undefined);
  assert.equal(getMunicipality("porto-velho")?.name, "Porto Velho");
  assert.equal(getMunicipality("ji-parana")?.name, "Ji-Paraná");
  assert.equal(getMunicipality("ariquemes")?.name, "Ariquemes");
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
  assert.equal(
    new Set(
      ["porto-velho", "ji-parana", "ariquemes"].flatMap((city) =>
        moduleIds.map((module) => snapshotKey(city, module)),
      ),
    ).size,
    9,
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
test("conector de consulta de Porto Velho corresponde ao cadastro", () => {
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

test("conectores implementados de Ji-Paraná correspondem às capacidades do cadastro", () => {
  const city = getMunicipality("ji-parana")!;
  for (const source of [
    jiParanaSource,
    jiParanaWorksSource,
    jiParanaRevenuesSource,
  ]) {
    assert.equal(source.id, jiParanaSource.id);
    assert.equal(source.id, city.modules[source.module].connectorId);
    assert.equal(source.municipality, city.slug);
    assert.equal(source.implementation, "implemented");
    assert.match(source.name, /Ji-Paraná \(UG 2\)/);
    assert.equal(
      new URL(source.url).hostname,
      "transparencia.ji-parana.ro.gov.br",
    );
  }
});

test("conectores implementados de Ariquemes correspondem à Prefeitura UG 1 do cadastro", () => {
  const city = getMunicipality("ariquemes")!;
  for (const source of [
    ariquemesSource,
    ariquemesWorksSource,
    ariquemesRevenuesSource,
  ]) {
    assert.equal(source.id, ariquemesSource.id);
    assert.equal(source.id, city.modules[source.module].connectorId);
    assert.equal(source.municipality, city.slug);
    assert.equal(source.implementation, "implemented");
    assert.match(source.name, /Ariquemes \(UG 1\)/);
    assert.equal(
      new URL(source.url).hostname,
      "transparencia.ariquemes.ro.gov.br",
    );
  }
});

test("fontes municipais mantêm nome e links da própria prefeitura, sem fallback cruzado", () => {
  const ji = dataMunicipality("ji-parana")!;
  const pvh = dataMunicipality("porto-velho")!;
  const ari = dataMunicipality("ariquemes")!;
  assert.equal(ji.name, "Ji-Paraná");
  assert.equal(ji.slug, "ji-parana");
  assert.equal(ji.annual, true);
  assert.equal(pvh.name, "Porto Velho");
  assert.equal(pvh.slug, "porto-velho");
  assert.equal(ari.name, "Ariquemes");
  assert.equal(ari.slug, "ariquemes");
  assert.equal(ari.annual, true);
  for (const module of ["contracts", "works", "revenues"] as const) {
    assert.equal(
      new URL(ji[module]).hostname,
      "transparencia.ji-parana.ro.gov.br",
    );
    assert.ok(!new URL(pvh[module]).hostname.includes("ji-parana"));
    assert.equal(
      new URL(ari[module]).hostname,
      "transparencia.ariquemes.ro.gov.br",
    );
  }
  assert.equal(dataMunicipality("cacoal"), undefined);
  assert.equal(dataMunicipality("inexistente"), undefined);
});
