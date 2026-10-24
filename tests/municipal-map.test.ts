import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import geography from "../src/geography/rondonia-map.json";
import { getMunicipality, listMunicipalities } from "../src/municipalities";

test("mapa cobre todos os municípios do cadastro oficial, sem IDs ou slugs duplicados", () => {
  const roster = JSON.parse(
    readFileSync("public/maps/municipios-ro.json", "utf8"),
  ) as { id: number; nome: string }[];
  assert.equal(roster.length, 52);
  const shapes = geography.municipalities;
  assert.deepEqual(
    shapes.map((city) => city.id).sort(),
    roster.map((city) => String(city.id)).sort(),
  );
  assert.equal(new Set(shapes.map((city) => city.slug)).size, shapes.length);
  for (const city of shapes) {
    assert.match(city.d, /^M/);
    assert.match(city.id, /^11\d{5}$/);
    assert.equal(getMunicipality(city.slug)?.ibgeId, city.id);
    assert.equal(
      getMunicipality(city.slug)?.name,
      roster.find((item) => String(item.id) === city.id)?.nome,
    );
  }
});
test("geometria gerada conserva os caminhos da origem e sua identificação", () => {
  const svg = readFileSync("public/maps/rondonia-municipios.svg", "utf8");
  assert.equal(
    createHash("sha256").update(svg).digest("hex"),
    geography.geometrySha256,
  );
  const attributes = [...svg.matchAll(/<path\b([^>]+)>/g)];
  const paths = new Map(
    attributes.map((match) => [
      match[1].match(/\bid="([^"]+)"/)?.[1],
      match[1].match(/\bd="([^"]+)"/)?.[1],
    ]),
  );
  for (const city of geography.municipalities)
    assert.equal(paths.get(city.id), city.d);
  assert.equal(
    geography.viewBox.split(/\s+/).map(Number).every(Number.isFinite),
    true,
  );
  assert.equal(geography.transform, "scale(0.0001,-0.0001)");
});
test("Porto Velho, Ji-Paraná e Ariquemes são pilotos e os outros 49 municípios permanecem não iniciados", () => {
  assert.equal(getMunicipality("porto-velho")?.stage, "pilot");
  assert.equal(getMunicipality("ji-parana")?.stage, "pilot");
  assert.equal(getMunicipality("ariquemes")?.stage, "pilot");
  assert.deepEqual(
    listMunicipalities()
      .filter((city) => city.stage === "pilot")
      .map((city) => city.slug)
      .sort(),
    ["ariquemes", "ji-parana", "porto-velho"],
  );
  assert.equal(
    listMunicipalities().filter((city) => city.stage === "planned").length,
    0,
  );
  assert.equal(getMunicipality("cacoal")?.stage, "not-started");
  assert.equal(
    getMunicipality("alta-floresta-d-oeste")?.name,
    "Alta Floresta D'Oeste",
  );
  assert.equal(
    listMunicipalities().filter((city) => city.stage === "not-started").length,
    49,
  );
  for (const city of listMunicipalities().filter(
    (city) => city.stage === "not-started",
  ))
    for (const module of Object.values(city.modules)) {
      assert.equal(module.status, "not-started");
      assert.equal(module.connectorId, null);
    }
});
