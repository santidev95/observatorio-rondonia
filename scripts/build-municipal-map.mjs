// Gera dados locais do SVG e da lista oficiais do IBGE, sem fazer requisições.
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const svg = await readFile(
  path.join(root, "public/maps/rondonia-municipios.svg"),
  "utf8",
);
const roster = JSON.parse(
  await readFile(path.join(root, "public/maps/municipios-ro.json"), "utf8"),
);
const viewBox = svg.match(/\bviewBox="([^"]+)"/)?.[1];
const transform = svg.match(/<g\b[^>]*\btransform="([^"]+)"/)?.[1];
if (!viewBox || !transform) throw new Error("SVG do IBGE sem coordenadas.");
const paths = [...svg.matchAll(/<path\b([^>]+)>/g)].map((match) => ({
  id: match[1].match(/\bid="(\d+)"/)?.[1],
  d: match[1].match(/\bd="([^"]+)"/)?.[1],
}));
if (
  paths.length !== roster.length ||
  new Set(paths.map((p) => p.id)).size !== roster.length
)
  throw new Error("Cobertura da malha não corresponde ao cadastro oficial.");
const slug = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const municipalities = roster.map((city) => {
  const id = String(city.id);
  const shape = paths.find((item) => item.id === id);
  if (!/^11\d{5}$/.test(id) || !shape?.d || !/^[Mm]/.test(shape.d))
    throw new Error("Município sem geometria oficial: " + id);
  return { id, name: city.nome, slug: slug(city.nome), d: shape.d };
});
if (
  new Set(municipalities.map((city) => city.slug)).size !==
  municipalities.length
)
  throw new Error("Slugs municipais duplicados.");
const output = {
  source: "IBGE — API de Malhas Geográficas v3 e API de Localidades",
  geometryUrl:
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/11?formato=image/svg+xml&qualidade=intermediaria&intrarregiao=municipio",
  rosterUrl:
    "https://servicodados.ibge.gov.br/api/v1/localidades/estados/11/municipios?orderBy=nome",
  retrievedOn: "2026-10-18",
  geometrySha256: createHash("sha256").update(svg).digest("hex"),
  viewBox,
  transform,
  municipalities,
};
await mkdir(path.join(root, "src/geography"), { recursive: true });
await writeFile(
  path.join(root, "src/geography/rondonia-map.json"),
  JSON.stringify(output) + "\n",
);
console.log("Mapa gerado: " + municipalities.length + " municípios.");
