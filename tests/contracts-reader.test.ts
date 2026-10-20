import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createContractsReader,
  createContractReader,
} from "../src/core/contracts-reader";
import {
  ContractsDataError,
  parseContractsQuery,
  isContractId,
} from "../src/core/contracts-query";
import type { ContractPage } from "../src/core/contracts";

const emptyPage: ContractPage = {
  records: [],
  warnings: [],
  pagination: { currentPage: 1, lastPage: 1, perPage: 25, total: 0 },
  sourceUrl:
    "https://api.portovelho.ro.gov.br/api/v1/contratos?modelo=Contratos&por-pagina=25&page=1",
};

test("parâmetros são normalizados e entradas ambíguas ou arbitrárias são rejeitadas", () => {
  assert.deepEqual(parseContractsQuery({}), { page: 1, year: null });
  assert.deepEqual(parseContractsQuery({ page: "02", ano: "2026" }), {
    page: 2,
    year: 2026,
  });
  assert.deepEqual(parseContractsQuery({ ano: "" }), { page: 1, year: null });
  for (const input of [
    { page: "0" },
    { page: "-1" },
    { page: "1.5" },
    { page: "10001" },
    { page: ["1", "2"] },
    { ano: ["2026"] },
    { ano: "1999" },
    { ano: "2101" },
    { ano: "2026x" },
    { url: "http://example.invalid" },
    { page: 1 },
  ])
    assert.throws(
      () => parseContractsQuery(input),
      (error) =>
        error instanceof ContractsDataError &&
        error.code === "invalid-query" &&
        error.status === 400,
    );
});

test("consultas consecutivas buscam a fonte novamente sem compartilhar dados entre requisições", async () => {
  let calls = 0;
  const read = createContractsReader({
    load: async () => {
      calls++;
      return structuredClone(emptyPage);
    },
    now: () => Date.parse("2026-10-18T12:00:00Z"),
  });
  const first = await read({ page: 1, year: null });
  const second = await read({ page: 1, year: null });
  assert.equal(calls, 2);
  assert.equal(first.fetchedAt, "2026-10-18T12:00:00.000Z");
  assert.notStrictEqual(first.data, second.data);
  assert.equal("cache" in first, false);
  assert.equal("expiresAt" in first, false);
});

test("consulta inválida é rejeitada antes de qualquer chamada à fonte", async () => {
  let calls = 0;
  const read = createContractsReader({
    load: async () => {
      calls++;
      return emptyPage;
    },
  });
  await assert.rejects(
    () => read({ page: 0, year: null }),
    (error) =>
      error instanceof ContractsDataError && error.code === "invalid-query",
  );
  assert.equal(calls, 0);
});

test("falhas da origem não expõem detalhes e não são convertidas em página vazia", async () => {
  const read = createContractsReader({
    load: async () => {
      throw new Error("segredo-sintetico");
    },
  });
  await assert.rejects(
    () => read({ page: 1, year: null }),
    (error) =>
      error instanceof ContractsDataError &&
      error.code === "source-unavailable" &&
      error.status === 502 &&
      !error.message.includes("segredo-sintetico"),
  );
});

test("timeout cancela a consulta pendente e retorna indisponibilidade", async () => {
  let requestSignal: AbortSignal | undefined;
  const read = createContractsReader({
    load: async (_query, signal) => {
      requestSignal = signal;
      return new Promise<ContractPage>(() => {});
    },
    timeoutMs: 10,
  });
  await assert.rejects(
    () => read({ page: 1, year: null }),
    (error) =>
      error instanceof ContractsDataError &&
      error.code === "source-unavailable",
  );
  assert.equal(requestSignal?.aborted, true);
});

test("identificadores de detalhe inválidos são rejeitados antes de buscar a API", async () => {
  let calls = 0;
  const read = createContractReader({
    load: async () => {
      calls++;
      return null;
    },
  });
  for (const id of ["", "0", "001", "-1", "1.5", "9007199254740992", "../1"]) {
    assert.equal(isContractId(id), false);
    await assert.rejects(
      () => read(id),
      (error) =>
        error instanceof ContractsDataError && error.code === "invalid-query",
    );
  }
  assert.equal(calls, 0);
  const result = await read("4323");
  assert.equal(result.data, null);
  assert.equal(calls, 1);
});

test("404 de detalhe permanece distinto de uma falha da API", async () => {
  const missing = createContractReader({ load: async () => null });
  assert.equal((await missing("4323")).data, null);
  const failed = createContractReader({
    load: async () => {
      throw new Error("Falha sintética");
    },
  });
  await assert.rejects(
    () => failed("4323"),
    (error) =>
      error instanceof ContractsDataError &&
      error.code === "source-unavailable",
  );
});
