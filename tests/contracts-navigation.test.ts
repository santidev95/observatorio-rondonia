import { test } from "node:test";
import assert from "node:assert/strict";
import { contractsReturnUrl } from "../src/features/contracts/navigation";

test("retorno de ficha Ji sem filtros preserva o exercício do ID histórico", () => {
  assert.equal(
    contractsReturnUrl({}, "ji-parana", "2025-MDAwMS8yNQ"),
    "/ji-parana/contratos?ano=2025",
  );
  assert.equal(
    contractsReturnUrl(
      { page: "2", ano: "2026" },
      "ji-parana",
      "2025-MDAwMS8yNQ",
    ),
    "/ji-parana/contratos?page=2&ano=2026",
  );
  assert.equal(
    contractsReturnUrl(
      { ano: ["2025", "2026"] },
      "ji-parana",
      "2025-MDAwMS8yNQ",
    ),
    "/ji-parana/contratos?ano=2025",
  );
});

test("retorno de ficha PVH mantém consulta geral e não aceita destino externo", () => {
  assert.equal(
    contractsReturnUrl({}, "porto-velho", "1"),
    "/porto-velho/contratos",
  );
  assert.equal(
    contractsReturnUrl({ page: "2", ano: "2025" }, "porto-velho", "1"),
    "/porto-velho/contratos?page=2&ano=2025",
  );
  assert.equal(
    contractsReturnUrl(
      { from: "https://externo.example.invalid" },
      "porto-velho",
      "1",
    ),
    "/porto-velho/contratos",
  );
});
