import assert from "node:assert/strict";
import { test } from "node:test";
import type { ContractRecord } from "../src/core/contracts";
import {
  contractDepartment,
  contractPageOptions,
  contractSuppliers,
  defaultContractPageFilters,
  filterContractPage,
  sentenceCaseObject,
  type ContractPageFilters,
} from "../src/features/contracts/catalog-view";

function contract(
  id: string,
  overrides: Partial<ContractRecord> = {},
): ContractRecord {
  return {
    id,
    number: null,
    year: null,
    object: null,
    department: null,
    departmentName: null,
    contractorName: null,
    contractorCnpj: null,
    suppliers: [],
    status: null,
    process: null,
    category: null,
    addendumReported: null,
    observation: null,
    sourceUrl: "https://api.portovelho.ro.gov.br/api/v1/contratos/" + id,
    sourceUpdatedAt: null,
    amountCents: null,
    paidAmountCents: null,
    executedAmountCents: null,
    signedOn: null,
    startsOn: null,
    endsOn: null,
    documents: [],
    procurement: null,
    issues: [],
    ...overrides,
  };
}

function filtered(
  records: readonly ContractRecord[],
  overrides: Partial<ContractPageFilters>,
) {
  return filterContractPage(records, {
    ...defaultContractPageFilters,
    ...overrides,
  });
}

test("catálogo local preserva ordem da fonte, registros e valores ausentes ou zero", () => {
  const records = Object.freeze([
    Object.freeze(contract("3", { amountCents: null })),
    Object.freeze(contract("1", { amountCents: 0 })),
    Object.freeze(contract("2", { amountCents: 300 })),
  ]);
  const result = filterContractPage(records, defaultContractPageFilters);

  assert.deepEqual(
    result.map((record) => record.id),
    ["3", "1", "2"],
  );
  assert.deepEqual(
    result.map((record) => record.amountCents),
    [null, 0, 300],
  );
  assert.notEqual(result, records);
  assert.equal(result[0], records[0]);
});

test("catálogo local pesquisa palavras sem diferenciar acentos ou caixa", () => {
  const records = [
    contract("1", {
      number: "Contrato 71/2026",
      object: "Aquisição de móveis",
      process: "PROC-2026-A",
      department: "SEMUSA",
      departmentName: "Secretaria Municipal de Saúde",
      contractorName: "Empresa principal sintética",
      suppliers: [
        { name: "Fornecedor de cadeiras sintético", cnpj: "11222333000181" },
        { name: "Companhia de educação sintética", cnpj: "AB12CD34EF5601" },
      ],
    }),
    contract("2", { object: "Aquisição de equipamentos" }),
  ];

  for (const q of [
    "AQUISICAO moveis",
    "71/2026",
    "proc-2026-a",
    "semusa",
    "municipal saude",
    "principal",
    "cadeiras",
    "EDUCACAO",
    "11222333000181",
    "11.222.333/0001-81",
    "AB.12C.D34/EF56-01",
  ]) {
    assert.deepEqual(
      filtered(records, { q }).map((record) => record.id),
      ["1"],
      q,
    );
  }
  assert.equal(filtered(records, { q: "móveis inexistente" }).length, 0);
  assert.equal(filtered(records, { q: "   " }).length, 2);
});

test("catálogo local restringe filtros e opções aos registros da página recebida", () => {
  const page = [
    contract("1", { department: "SEMUSA", status: "Vigente" }),
    contract("2", { department: "SEMUSA", status: "Encerrado" }),
    contract("3", { department: "SEMED", status: "Vigente" }),
  ];
  const otherPage = [
    contract("4", { department: "Outra secretaria", status: "Suspenso" }),
  ];

  assert.deepEqual(
    filtered(page, { org: "SEMUSA", status: "Vigente" }).map(
      (record) => record.id,
    ),
    ["1"],
  );
  assert.equal(filtered(page, { org: "semusa" }).length, 0);
  assert.equal(filtered(page, { status: "vigente" }).length, 0);
  assert.equal(filtered(page, { q: "Outra secretaria" }).length, 0);
  assert.deepEqual(contractPageOptions(page), {
    orgs: ["SEMED", "SEMUSA"],
    statuses: ["Encerrado", "Vigente"],
  });
  assert.deepEqual(contractPageOptions(otherPage), {
    orgs: ["Outra secretaria"],
    statuses: ["Suspenso"],
  });
});

test("rótulos e opções preservam órgão oficial e fornecedores disponíveis", () => {
  const complete = contract("1", {
    department: "ÓRGÃO",
    departmentName: "Nome completo sintético",
    contractorName: "Nome principal sintético",
    suppliers: [
      { name: "Empresa sintética", cnpj: null },
      { name: null, cnpj: "11222333000181" },
    ],
    status: "Publicado",
  });
  const onlyName = contract("2", { departmentName: "Secretaria sintética" });
  const missing = contract("3");

  assert.equal(contractDepartment(complete), "ÓRGÃO");
  assert.equal(contractDepartment(onlyName), "Secretaria sintética");
  assert.equal(contractDepartment(missing), "Órgão não informado");
  assert.equal(
    contractSuppliers(complete),
    "Empresa sintética · 11222333000181",
  );
  assert.equal(contractSuppliers(missing), "Empresa não informada");
  assert.equal(
    contractSuppliers(contract("4", { contractorName: "Empresa principal" })),
    "Empresa principal",
  );
  assert.equal(
    contractSuppliers(contract("5", { contractorCnpj: "11222333000181" })),
    "11222333000181",
  );
  assert.deepEqual(
    contractPageOptions([complete, complete, onlyName, missing]),
    {
      orgs: ["ÓRGÃO", "Secretaria sintética"],
      statuses: ["Publicado"],
    },
  );
  assert.deepEqual(
    filtered([onlyName], { org: "Secretaria sintética" }).map(
      (record) => record.id,
    ),
    ["2"],
  );
});

test("ordenação por valor mantém zero antes de ausentes e empates na ordem da fonte", () => {
  const records = [
    contract("1", { amountCents: null }),
    contract("2", { amountCents: 0 }),
    contract("3", { amountCents: 500 }),
    contract("4", { amountCents: 500 }),
    contract("5", { amountCents: null }),
  ];

  assert.deepEqual(
    filtered(records, { sort: "value" }).map((record) => record.id),
    ["3", "4", "2", "1", "5"],
  );
  assert.deepEqual(
    records.map((record) => record.id),
    ["1", "2", "3", "4", "5"],
  );
  assert.deepEqual(
    filtered(records, { sort: "source" }).map((record) => record.id),
    ["1", "2", "3", "4", "5"],
  );
});

test("ordenação de datas usa instantes de atualização, datas civis e ausentes ao final", () => {
  const records = [
    contract("1"),
    contract("2", {
      sourceUpdatedAt: "2026-01-02T01:00:00+02:00",
      signedOn: "2026-01-03",
    }),
    contract("3", {
      sourceUpdatedAt: "2026-01-02T00:00:00Z",
      signedOn: "2026-01-01",
    }),
    contract("4", {
      sourceUpdatedAt: "2026-01-02T00:00:00Z",
      signedOn: "2026-01-03",
    }),
    contract("5"),
  ];
  assert.deepEqual(
    filtered(records, { sort: "updated" }).map((record) => record.id),
    ["3", "4", "2", "1", "5"],
  );
  assert.deepEqual(
    filtered(records, { sort: "signed" }).map((record) => record.id),
    ["2", "4", "3", "1", "5"],
  );
});

test("objeto em caixa alta segue a apresentação PVH sem alterar conteúdo misto", () => {
  assert.equal(
    sentenceCaseObject("AQUISIÇÃO PARA ETE EM RO COM CNPJ PUBLICADO"),
    "Aquisição para ETE em RO com CNPJ publicado",
  );
  assert.equal(
    sentenceCaseObject("Aquisição para ETE em RO e Unidade ABC"),
    "Aquisição para ETE em RO e Unidade ABC",
  );
  assert.equal(sentenceCaseObject(""), "");
});
