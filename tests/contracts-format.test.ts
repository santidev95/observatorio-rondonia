import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatContractCnpj,
  formatContractDate,
  formatContractMoney,
  formatConsultationTime,
} from "../src/features/contracts/format";

test("valores publicados distinguem zero, ausência e sinal", () => {
  assert.equal(formatContractMoney(null), "Não informado");
  assert.equal(formatContractMoney(0), "R$\u00a00,00");
  assert.equal(formatContractMoney(123456), "R$\u00a01.234,56");
  assert.equal(formatContractMoney(-250), "-R$\u00a02,50");
});

test("datas civis não retrocedem para o dia anterior no fuso de Rondônia", () => {
  assert.equal(formatContractDate("2026-01-01"), "01/01/2026");
  assert.equal(formatContractDate("2024-02-29"), "29/02/2024");
  assert.equal(formatContractDate(null), "Não informado");
  assert.equal(
    formatConsultationTime("2026-01-01T03:00:00.000Z"),
    "31/12/2025, 23:00",
  );
});

test("a apresentação não exibe CPF no campo de CNPJ", () => {
  assert.equal(formatContractCnpj("12345678901"), "Não informado");
  assert.equal(formatContractCnpj(null), "Não informado");
  assert.equal(formatContractCnpj("12345678000190"), "12.345.678/0001-90");
  assert.equal(formatContractCnpj("AB12CD34EF5601"), "AB.12C.D34/EF56-01");
});
