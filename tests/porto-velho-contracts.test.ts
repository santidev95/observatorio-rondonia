import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchPortoVelhoContractsPage,
  fetchPortoVelhoContract,
} from "../src/connectors/porto-velho/contracts";
import {
  CONTRACTS_PAGE_SIZE,
  contractPageSchema,
  contractsQuerySchema,
  type ContractsQuery,
} from "../src/core/contracts";

const query: ContractsQuery = { page: 1, year: null };
const signal = () => new AbortController().signal;

function row(id = 1, overrides: Record<string, unknown> = {}) {
  return {
    id,
    numero: `Contrato ${id}/2026`,
    contrato_ano: 2026,
    modelo: "Contratos",
    valor: { value: 1234.56, formatted: "1.234,56" },
    valor_executado: { value: 0 },
    objeto: "Aquisição de materiais",
    contratante: { sigla: "ÓRGÃO", nome: "Órgão sintético" },
    fornecedor: {
      razao_social: "Empresa sintética",
      documento: "11.222.333/0001-81",
      email: "nao-republicar@example.invalid",
      telefone: "12345678901",
    },
    data_assinatura: "2026-10-01T00:00:00.000000Z",
    data_vigencia_inicio: "01/10/2026",
    data_vigencia_fim: null,
    arquivos: [
      {
        nome: "Contrato",
        arquivo: "http://anexos.portovelho.ro.gov.br/teste.pdf",
      },
    ],
    ...overrides,
  };
}

function envelope(rows = [row()], total = rows.length, page = 1) {
  return {
    data: rows,
    meta: {
      current_page: page,
      last_page: Math.max(1, Math.ceil(total / CONTRACTS_PAGE_SIZE)),
      per_page: CONTRACTS_PAGE_SIZE,
      total,
      from: total === 0 ? null : (page - 1) * CONTRACTS_PAGE_SIZE + 1,
      to: total === 0 ? null : Math.min(page * CONTRACTS_PAGE_SIZE, total),
    },
    links: {
      next:
        total > page * CONTRACTS_PAGE_SIZE
          ? `http://api.portovelho.ro.gov.br/api/v1/contratos?page=${page + 1}`
          : null,
    },
  };
}

function fixture(body: unknown, status = 200): typeof fetch {
  return async () => Response.json(body, { status });
}

test("Porto Velho: usa URL própria por página/ano sem seguir links retornados", async () => {
  const requested: { input: string; init: RequestInit | undefined }[] = [];
  const body = envelope([row(26)], 26, 2);
  body.links.next = "https://externo.example.invalid/?cpf=12345678901";
  const fetcher: typeof fetch = async (input, init) => {
    requested.push({ input: String(input), init });
    return Response.json(body);
  };
  const requestSignal = signal();
  const result = await fetchPortoVelhoContractsPage(
    { page: 2, year: 2026 },
    requestSignal,
    fetcher,
  );
  assert.equal(requested.length, 1);
  const url = new URL(requested[0].input);
  assert.equal(url.origin, "https://api.portovelho.ro.gov.br");
  assert.equal(url.pathname, "/api/v1/contratos");
  assert.equal(url.searchParams.get("modelo"), "Contratos");
  assert.equal(url.searchParams.get("por-pagina"), "25");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("ano"), "2026");
  assert.equal(requested[0].init?.cache, "no-store");
  assert.equal(requested[0].init?.redirect, "error");
  assert.equal(requested[0].init?.signal, requestSignal);
  assert.equal(result.sourceUrl, url.href);
  assert.deepEqual(result.pagination, {
    currentPage: 2,
    lastPage: 2,
    perPage: 25,
    total: 26,
  });
  assert.ok(!JSON.stringify(result).includes("externo.example"));
});

test("Porto Velho: normaliza dinheiro em centavos e mantém executado separado de pago", async () => {
  const result = await fetchPortoVelhoContractsPage(
    query,
    signal(),
    fixture(
      envelope([
        row(1),
        row(2, { valor: null, valor_executado: null }),
        row(3, { valor: "0", valor_executado: "10,25" }),
        row(4, { valor: "R$ 1.234,56", valor_executado: { value: "20.99" } }),
      ]),
    ),
  );
  assert.deepEqual(
    result.records.map((item) => [
      item.amountCents,
      item.executedAmountCents,
      item.paidAmountCents,
    ]),
    [
      [123456, 0, null],
      [null, null, null],
      [0, 1025, null],
      [123456, 2099, null],
    ],
  );
  assert.equal(result.records[0].contractorCnpj, "11222333000181");
  assert.equal(result.records[0].signedOn, "2026-10-01");
  assert.equal(result.records[0].startsOn, "2026-10-01");
  assert.equal(result.records[0].endsOn, null);
  assert.equal(
    result.records[0].documents[0].url,
    "https://anexos.portovelho.ro.gov.br/teste.pdf",
  );
  assert.ok(!JSON.stringify(result).includes("nao-republicar"));
  assert.ok(!JSON.stringify(result).includes("telefone"));
});

test("Porto Velho: remove CPF, identidade pessoal, contatos e links pessoais do DTO", async () => {
  const result = await fetchPortoVelhoContractsPage(
    query,
    signal(),
    fixture(
      envelope([
        row(1, {
          numero: "Contrato 123.456.789-01",
          objeto: "<p>Referência &#49;&#50;&#51;.456.789-01 e 12345678901</p>",
          contratante: { sigla: "CPF: 123.456.789-01" },
          fornecedor: {
            nome: "Pessoa sintética identificável",
            documento: "123.456.789-01",
          },
          arquivos: [
            {
              nome: "Anexo CPF 12345678901",
              arquivo: "https://anexos.portovelho.ro.gov.br/publico.pdf",
            },
            {
              nome: "Pessoal",
              arquivo: "https://anexos.portovelho.ro.gov.br/123.456.789-01.pdf",
            },
            {
              nome: "CPF codificado",
              arquivo:
                "https://anexos.portovelho.ro.gov.br/?doc=123%2E456%2E789-01",
            },
            {
              nome: "Consulta pessoal",
              arquivo: "https://anexos.portovelho.ro.gov.br/?cpf=oculto",
            },
            { nome: "Externo", arquivo: "https://externo.invalid/anexo.pdf" },
            {
              nome: "Host parecido",
              arquivo: "https://portovelho.ro.gov.br.externo.invalid/anexo.pdf",
            },
            {
              nome: "Credencial",
              arquivo:
                "https://user:pass@anexos.portovelho.ro.gov.br/anexo.pdf",
            },
            { nome: "Script", arquivo: "javascript:alert(1)" },
          ],
        }),
      ]),
    ),
  );
  const contract = result.records[0];
  const serialized = JSON.stringify(result);
  assert.equal(contract.contractorName, "Pessoa física (nome não republicado)");
  assert.equal(contract.contractorCnpj, null);
  assert.equal(contract.documents.length, 1);
  assert.match(contract.documents[0].label, /CPF não republicado/);
  assert.ok(!serialized.includes("123.456.789-01"));
  assert.ok(!serialized.includes("12345678901"));
  assert.ok(!serialized.includes("identificável"));
  assert.ok(!serialized.includes("123%2E456"));
  assert.ok(!serialized.includes("documento"));
});

test("Porto Velho: página vazia válida não inventa registros e ano ausente permanece null", async () => {
  const empty = await fetchPortoVelhoContractsPage(
    query,
    signal(),
    fixture(envelope([], 0)),
  );
  assert.deepEqual(empty.records, []);
  assert.equal(empty.pagination.lastPage, 1);
  const result = await fetchPortoVelhoContractsPage(
    query,
    signal(),
    fixture(
      envelope([
        row(1, {
          contrato_ano: null,
          numero: null,
          fornecedor: null,
          contratante: null,
        }),
      ]),
    ),
  );
  assert.equal(result.records[0].year, null);
  assert.equal(result.records[0].number, null);
  assert.equal(result.records[0].department, null);
  assert.equal(result.records[0].contractorName, null);
});

test("Porto Velho: rejeita cobertura incompleta, metadados conflitantes, IDs duplicados e modelo errado", async () => {
  const cases = [
    { ...envelope(), meta: { ...envelope().meta, current_page: 2 } },
    { ...envelope(), meta: { ...envelope().meta, per_page: 100 } },
    { ...envelope(), meta: { ...envelope().meta, last_page: 3 } },
    { ...envelope(), meta: { ...envelope().meta, from: null } },
    { ...envelope(), meta: { ...envelope().meta, to: 25 } },
    envelope([row()], 26),
    envelope([row()], 0),
    envelope([row(1), row(1)]),
    envelope([row(1, { modelo: "Convênios" })]),
    envelope([row(1, { id: Number.MAX_SAFE_INTEGER + 1 })]),
    { ...envelope(), links: {} },
    { ...envelope(), data: undefined },
  ];
  for (const body of cases)
    await assert.rejects(
      fetchPortoVelhoContractsPage(query, signal(), fixture(body)),
    );
});

test("Porto Velho: dinheiro malformado, ausente ou fora do intervalo seguro causa falha explícita", async () => {
  for (const value of [
    undefined,
    { amount: 10 },
    { value: undefined },
    "texto monetário inválido 12345678901",
    "1.234",
    "10,999",
    0.30000000000000004,
    -1,
    { value: Number.MAX_SAFE_INTEGER },
    "90071992547409.92",
    [],
    true,
  ]) {
    await assert.rejects(
      fetchPortoVelhoContractsPage(
        query,
        signal(),
        fixture(envelope([row(1, { valor: value })])),
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes("12345678901"));
        return true;
      },
    );
  }
});

test("Porto Velho: HTTP, JSON, tipo inesperado e datas inválidas não retornam página publicável", async () => {
  await assert.rejects(
    fetchPortoVelhoContractsPage(
      query,
      signal(),
      fixture({ error: "segredo não reproduzido" }, 429),
    ),
    /HTTP 429/,
  );
  await assert.rejects(
    fetchPortoVelhoContractsPage(
      query,
      signal(),
      async () =>
        new Response("<html>", { headers: { "content-type": "text/html" } }),
    ),
    /Formato de resposta/,
  );
  await assert.rejects(
    fetchPortoVelhoContractsPage(
      query,
      signal(),
      async () =>
        new Response("{", { headers: { "content-type": "application/json" } }),
    ),
    /JSON inválida/,
  );
  await assert.rejects(
    fetchPortoVelhoContractsPage(
      query,
      signal(),
      fixture(envelope([row(1, { data_assinatura: "2026-02-30" })])),
    ),
    /Data inválida/,
  );
});

test("Porto Velho: consulta inválida ou cancelada impede acesso à API", async () => {
  let called = 0;
  const fetcher: typeof fetch = async () => {
    called++;
    return Response.json(envelope());
  };
  for (const invalid of [
    { page: 0, year: null },
    { page: 1.5, year: null },
    { page: 10001, year: null },
    { page: 1, year: 1999 },
    { page: 1, year: 2101 },
    { page: 1, year: null, extra: "inválido" },
  ])
    await assert.rejects(
      fetchPortoVelhoContractsPage(invalid, signal(), fetcher),
    );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchPortoVelhoContractsPage(query, controller.signal, fetcher),
  );
  assert.equal(called, 0);
  assert.equal(
    contractsQuerySchema.safeParse({ page: 1, year: 2026 }).success,
    true,
  );
});

test("Porto Velho: schema rejeita DTO com campos brutos, CPF ou paginação truncada", async () => {
  const page = await fetchPortoVelhoContractsPage(
    query,
    signal(),
    fixture(envelope()),
  );
  assert.equal(contractPageSchema.safeParse(page).success, true);
  assert.equal(
    contractPageSchema.safeParse({ ...page, raw: row() }).success,
    false,
  );
  assert.equal(
    contractPageSchema.safeParse({
      ...page,
      records: [{ ...page.records[0], object: "CPF 123.456.789-01" }],
    }).success,
    false,
  );
  assert.equal(
    contractPageSchema.safeParse({
      ...page,
      records: [
        {
          ...page.records[0],
          documents: [
            {
              label: "Documento",
              url: "https://anexos.portovelho.ro.gov.br/?cpf=12345678901",
            },
          ],
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    contractPageSchema.safeParse({ ...page, records: [] }).success,
    false,
  );
});

test("Porto Velho: preserva formato de CNPJ alfanumérico sem confundir seus dígitos com CPF", async () => {
  const result = await fetchPortoVelhoContractsPage(
    query,
    signal(),
    fixture(
      envelope([
        row(1, {
          fornecedor: {
            nome: "Empresa sintética",
            documento: "12345678901A12",
          },
        }),
      ]),
    ),
  );
  assert.equal(result.records[0].contractorCnpj, "12345678901A12");
  assert.equal(result.records[0].contractorName, "Empresa sintética");
});

test("Porto Velho: cancela resposta com tamanho excessivo antes de publicar dados", async () => {
  await assert.rejects(
    fetchPortoVelhoContractsPage(
      query,
      signal(),
      async () =>
        new Response("{}", {
          headers: {
            "content-type": "application/json",
            "content-length": String(6 * 1024 * 1024),
          },
        }),
    ),
    /limite de tamanho/,
  );
});

test("Porto Velho: rótulos de CPF são pessoais antes de compactar o documento", async () => {
  for (const documento of [
    "CPF 123.456.789-01",
    "CPF:123.456.789-01",
    "cpf 12345678901",
    "CPF - 123.456.789-01",
    "Documento CPF nº 123.456.789-01",
    "CPF 123.***.***-**",
    "CPF:***.456.789-**",
    "123.***.***-**",
    "C.P.F.: 123.456.789-01",
    "C.P.F. 123.***.***-**",
  ]) {
    const result = await fetchPortoVelhoContractsPage(
      query,
      signal(),
      fixture(
        envelope([
          row(1, {
            fornecedor: {
              nome: "Nome pessoal sintético",
              razao_social: "Outra identificação pessoal",
              documento,
            },
          }),
        ]),
      ),
    );
    assert.equal(result.records[0].contractorCnpj, null);
    assert.equal(
      result.records[0].contractorName,
      "Pessoa física (nome não republicado)",
    );
    assert.ok(!JSON.stringify(result).includes("Nome pessoal sintético"));
    assert.ok(!JSON.stringify(result).includes("Outra identificação pessoal"));
    assert.ok(!JSON.stringify(result).includes("12345678901"));
    assert.ok(!JSON.stringify(result).includes("123.456.789-01"));
  }
});

test("Porto Velho: letras CPF dentro do formato de CNPJ não representam rótulo de pessoa", async () => {
  for (const [documento, canonical] of [
    ["12345678901A12", "12345678901A12"],
    ["CPF12345678901", "CPF12345678901"],
    ["12.CPF.345/0001-88", "12CPF345000188"],
    ["CP.F12.345/6789-01", "CPF12345678901"],
  ]) {
    const result = await fetchPortoVelhoContractsPage(
      query,
      signal(),
      fixture(
        envelope([
          row(1, {
            fornecedor: { nome: "Empresa sintética", documento },
          }),
        ]),
      ),
    );
    assert.equal(result.records[0].contractorCnpj, canonical);
    assert.equal(result.records[0].contractorName, "Empresa sintética");
  }
});

test("Porto Velho: preserva fatos, múltiplos fornecedores e metadados dos documentos", async () => {
  const mainSupplier = {
    nome: "Empresa principal",
    documento: "11.222.333/0001-81",
  };
  const result = await fetchPortoVelhoContractsPage(
    query,
    signal(),
    fixture(
      envelope([
        row(1, {
          situacao: "Ativo",
          numero_processo: "Processo sintético",
          categoria: "Geral",
          aditivo: true,
          observacao: "Observação publicada",
          updated_at: "2026-10-15T15:16:28.000000Z",
          fornecedor: mainSupplier,
          fornecedores: [
            { fornecedor: mainSupplier },
            {
              fornecedor: {
                nome: "Outra empresa",
                documento: "12.CPF.345/0001-88",
              },
            },
            {
              fornecedor: {
                nome: "Pessoa identificável",
                documento: "CPF 123.456.789-01",
              },
            },
          ],
          licitacao: { id: 34, titulo: "Licitação sintética", numero: 8 },
          arquivos: [
            {
              nome: "Termo aditivo",
              arquivo: "https://anexos.portovelho.ro.gov.br/aditivo.pdf",
              situacao: "Publicado",
              publicacao: "2026-10-15",
              data_contrato: "2026-10-12",
              data_vigencia_inicio: "2026-10-16",
              data_vigencia_fim: "2027-10-15",
              valor: { value: 100.15 },
            },
          ],
        }),
      ]),
    ),
  );
  const contract = result.records[0];
  assert.equal(contract.departmentName, "Órgão sintético");
  assert.equal(contract.status, "Ativo");
  assert.equal(contract.process, "Processo sintético");
  assert.equal(contract.category, "Geral");
  assert.equal(contract.addendumReported, true);
  assert.equal(contract.observation, "Observação publicada");
  assert.equal(
    contract.sourceUrl,
    "https://api.portovelho.ro.gov.br/api/v1/contratos/1",
  );
  assert.equal(contract.sourceUpdatedAt, "2026-10-15T15:16:28.000Z");
  assert.deepEqual(contract.suppliers, [
    { name: "Empresa principal", cnpj: "11222333000181" },
    { name: "Outra empresa", cnpj: "12CPF345000188" },
    { name: "Pessoa física (nome não republicado)", cnpj: null },
  ]);
  assert.deepEqual(contract.procurement, {
    id: "34",
    title: "Licitação sintética",
    url: "https://api.portovelho.ro.gov.br/api/v1/licitacoes/34",
  });
  assert.deepEqual(contract.documents[0], {
    label: "Termo aditivo",
    url: "https://anexos.portovelho.ro.gov.br/aditivo.pdf",
    status: "Publicado",
    publishedOn: "2026-10-15",
    publicationReference: null,
    signedOn: "2026-10-12",
    startsOn: "2026-10-16",
    endsOn: "2027-10-15",
    amountCents: 10015,
  });
  assert.ok(!JSON.stringify(result).includes("Pessoa identificável"));
  assert.ok(!JSON.stringify(result).includes("123.456.789-01"));
});

test("Porto Velho: preserva valores elevados e datas invertidas com limites explícitos", async () => {
  const result = await fetchPortoVelhoContractsPage(
    query,
    signal(),
    fixture(
      envelope([
        row(1, {
          valor: { value: 1_000_000_000 },
          data_vigencia_inicio: "2026-10-15",
          data_vigencia_fim: "2026-10-01",
          updated_at: "data inválida",
          arquivos: [
            {
              nome: "Documento com vigência invertida",
              arquivo: "https://anexos.portovelho.ro.gov.br/a.pdf",
              data_vigencia_inicio: "2026-10-15",
              data_vigencia_fim: "2026-10-01",
            },
            {
              nome: "Documento não oficial",
              arquivo: "https://externo.invalid/a.pdf",
            },
          ],
        }),
      ]),
    ),
  );
  const contract = result.records[0];
  assert.equal(contract.amountCents, 100_000_000_000);
  assert.equal(contract.startsOn, "2026-10-15");
  assert.equal(contract.endsOn, "2026-10-01");
  assert.equal(contract.sourceUpdatedAt, null);
  assert.ok(contract.issues.some((issue) => issue.includes("R$ 1 bilhão")));
  assert.ok(
    contract.issues.some((issue) => issue.includes("fim de vigência anterior")),
  );
  assert.ok(
    contract.issues.some((issue) => issue.includes("Documento com endereço")),
  );
  assert.ok(
    contract.issues.every((issue) => !issue.includes("irregularidade")),
  );
  assert.equal(contract.documents[0].amountCents, null);
});

test("Porto Velho: consulta detalhe pelo ID oficial com o mesmo DTO minimizado", async () => {
  let calls = 0;
  const requestSignal = signal();
  const result = await fetchPortoVelhoContract(
    "12",
    requestSignal,
    async (input, init) => {
      calls++;
      assert.equal(
        String(input),
        "https://api.portovelho.ro.gov.br/api/v1/contratos/12",
      );
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.signal, requestSignal);
      return Response.json({
        data: row(12, {
          licitacao: { id: 3, numero: 4 },
          fornecedor: {
            nome: "Pessoa pessoal",
            documento: "CPF 123.456.789-01",
          },
        }),
      });
    },
  );
  assert.equal(calls, 1);
  assert.equal(result?.id, "12");
  assert.equal(
    result?.sourceUrl,
    "https://api.portovelho.ro.gov.br/api/v1/contratos/12",
  );
  assert.equal(result?.procurement?.title, "Licitação 4");
  assert.equal(result?.contractorName, "Pessoa física (nome não republicado)");
  assert.equal(result?.suppliers[0].cnpj, null);
  assert.ok(!JSON.stringify(result).includes("Pessoa pessoal"));
});

test("Porto Velho: detalhe retorna null somente em 404 ou modelo fora do escopo", async () => {
  assert.equal(
    await fetchPortoVelhoContract(
      "1",
      signal(),
      fixture({ message: "Não exibir" }, 404),
    ),
    null,
  );
  assert.equal(
    await fetchPortoVelhoContract(
      "1",
      signal(),
      fixture({ data: row(1, { modelo: "Convênios" }) }),
    ),
    null,
  );
  await assert.rejects(
    fetchPortoVelhoContract(
      "1",
      signal(),
      fixture({ message: "Texto de upstream não publicável" }, 502),
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /HTTP 502/);
      assert.ok(!error.message.includes("Texto de upstream"));
      return true;
    },
  );
  await assert.rejects(
    fetchPortoVelhoContract("1", signal(), fixture({ data: row(2) })),
    /ID da resposta/,
  );
  await assert.rejects(
    fetchPortoVelhoContract("1", signal(), fixture({ data: {} })),
    /Envelope/,
  );
  await assert.rejects(
    fetchPortoVelhoContract("1", signal(), fixture(null)),
    /Envelope/,
  );
});

test("Porto Velho: ID inválido ou detalhe cancelado não consulta upstream", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return Response.json({ data: row() });
  };
  for (const id of [
    "",
    "0",
    "01",
    "-1",
    "1.5",
    "../1",
    "1?cpf=12345678901",
    "9007199254740992",
  ])
    await assert.rejects(
      fetchPortoVelhoContract(id, signal(), fetcher),
      /ID de contrato inválido/,
    );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchPortoVelhoContract("1", controller.signal, fetcher),
  );
  assert.equal(calls, 0);
});

test("Porto Velho: detalhe aplica limite de corpo, JSON e dinheiro seguro", async () => {
  await assert.rejects(
    fetchPortoVelhoContract(
      "1",
      signal(),
      async () =>
        new Response("{}", {
          headers: {
            "content-type": "application/json",
            "content-length": String(6 * 1024 * 1024),
          },
        }),
    ),
    /limite de tamanho/,
  );
  await assert.rejects(
    fetchPortoVelhoContract(
      "1",
      signal(),
      async () =>
        new Response("{", {
          headers: { "content-type": "application/json" },
        }),
    ),
    /JSON inválida/,
  );
  await assert.rejects(
    fetchPortoVelhoContract(
      "1",
      signal(),
      fixture({ data: row(1, { valor: "90071992547409.92" }) }),
    ),
    /intervalo seguro/,
  );
});

test("Porto Velho: documento pessoal com tipo inesperado bloqueia a publicação do fornecedor", async () => {
  await assert.rejects(
    fetchPortoVelhoContract(
      "1",
      signal(),
      fixture({
        data: row(1, {
          fornecedor: {
            nome: "Nome pessoal que não pode escapar por drift",
            documento: 12345678901,
          },
        }),
      }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Documento do fornecedor incompatível/);
      assert.ok(!error.message.includes("12345678901"));
      assert.ok(!error.message.includes("Nome pessoal"));
      return true;
    },
  );
});

test("Porto Velho: publicação textual de diário não bloqueia página nem inventa data", async () => {
  const references = [
    "Diário Oficial do Município, edição 99, página 123",
    "DOM nº 77, de 15/10/2026, página 10",
    "Publicado na edição 1250, página 111",
    "Diário Oficial, CPF 123.456.789-01, edição 88",
  ];
  const result = await fetchPortoVelhoContractsPage(
    query,
    signal(),
    fixture(
      envelope([
        row(1, {
          arquivos: references.map((publicacao, index) => ({
            nome: "Publicação sintética",
            arquivo: `https://anexos.portovelho.ro.gov.br/publicacao-${index}.pdf`,
            publicacao,
          })),
        }),
      ]),
    ),
  );
  assert.equal(result.records.length, 1);
  for (const document of result.records[0].documents) {
    assert.equal(document.publishedOn, null);
    assert.ok(document.publicationReference !== null);
  }
  assert.equal(
    result.records[0].documents[0].publicationReference,
    references[0],
  );
  assert.equal(
    result.records[0].documents[1].publicationReference,
    references[1],
  );
  assert.match(
    result.records[0].documents[3].publicationReference ?? "",
    /CPF não republicado/,
  );
  assert.ok(!JSON.stringify(result).includes("123.456.789-01"));
  assert.ok(
    result.records[0].issues.some((issue) =>
      issue.includes("referência textual"),
    ),
  );
});

test("Porto Velho: publicação com data ISO ou brasileira isolada continua normalizada", async () => {
  const result = await fetchPortoVelhoContract(
    "1",
    signal(),
    fixture({
      data: row(1, {
        arquivos: [
          "2026-10-15",
          "15/10/2026",
          "2026-10-15T15:16:28.000000Z",
        ].map((publicacao, index) => ({
          nome: "Publicação sintética",
          arquivo: `https://anexos.portovelho.ro.gov.br/data-${index}.pdf`,
          publicacao,
        })),
      }),
    }),
  );
  assert.ok(result);
  assert.ok(
    result.documents.every((document) => document.publishedOn === "2026-10-15"),
  );
  assert.ok(
    result.documents.every(
      (document) => document.publicationReference === null,
    ),
  );
  assert.deepEqual(result.issues, []);
});

test("Porto Velho: publicação ausente não gera alerta e data impossível preserva referência", async () => {
  const empty = await fetchPortoVelhoContract(
    "1",
    signal(),
    fixture({
      data: row(1, {
        arquivos: [null, undefined, "", " "].map((publicacao, index) => ({
          nome: "Publicação sintética",
          arquivo: `https://anexos.portovelho.ro.gov.br/ausente-${index}.pdf`,
          publicacao,
        })),
      }),
    }),
  );
  assert.ok(empty);
  assert.ok(
    empty.documents.every(
      (document) =>
        document.publishedOn === null && document.publicationReference === null,
    ),
  );
  assert.deepEqual(empty.issues, []);
  const invalid = await fetchPortoVelhoContract(
    "1",
    signal(),
    fixture({
      data: row(1, {
        arquivos: [
          {
            nome: "Publicação sintética",
            arquivo: "https://anexos.portovelho.ro.gov.br/data-invalida.pdf",
            publicacao: "2026-02-30",
          },
        ],
      }),
    }),
  );
  assert.equal(invalid?.documents[0].publishedOn, null);
  assert.equal(invalid?.documents[0].publicationReference, "2026-02-30");
  assert.ok(
    invalid?.issues.some(
      (issue) =>
        issue.includes("Data de publicação") && issue.includes("inválida"),
    ),
  );
});

test("Porto Velho: referência de publicação não relaxa tipo, datas contratuais ou dinheiro", async () => {
  await assert.rejects(
    fetchPortoVelhoContract(
      "1",
      signal(),
      fixture({
        data: row(1, {
          arquivos: [
            {
              nome: "Sintético",
              arquivo: "https://anexos.portovelho.ro.gov.br/a.pdf",
              publicacao: { data: "2026-10-15" },
            },
          ],
        }),
      }),
    ),
    /Campo textual incompatível/,
  );
  await assert.rejects(
    fetchPortoVelhoContract(
      "1",
      signal(),
      fixture({
        data: row(1, {
          data_assinatura: "Diário Oficial, edição 99",
        }),
      }),
    ),
    /Data incompatível/,
  );
  await assert.rejects(
    fetchPortoVelhoContract(
      "1",
      signal(),
      fixture({
        data: row(1, {
          arquivos: [
            {
              nome: "Sintético",
              arquivo: "https://anexos.portovelho.ro.gov.br/a.pdf",
              publicacao: "Diário Oficial, edição 99",
              valor: { amount: 1 },
            },
          ],
        }),
      }),
    ),
    /Formato monetário incompatível/,
  );
});

test("Porto Velho: ano diferente do solicitado preserva registros e totais com aviso de lote", async () => {
  const result = await fetchPortoVelhoContractsPage(
    { page: 1, year: 2026 },
    signal(),
    fixture(envelope([row(1, { contrato_ano: 2025 }), row(2)])),
  );
  assert.equal(result.records.length, 2);
  assert.equal(result.pagination.total, 2);
  assert.equal(result.records[0].year, 2025);
  assert.equal(result.records[1].year, 2026);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /1 contrato\(s\).*diferente.*2026/);
  assert.match(result.warnings[0], /critério do filtro não confirmado/);
  assert.ok(result.records.every((record) => record.issues.length === 0));
});

test("Porto Velho: ano ausente no filtro permanece null com aviso e consulta sem ano não avisa", async () => {
  const source = envelope([
    row(1, { contrato_ano: null }),
    row(2, { contrato_ano: 2025 }),
  ]);
  const filtered = await fetchPortoVelhoContractsPage(
    { page: 1, year: 2026 },
    signal(),
    fixture(source),
  );
  assert.equal(filtered.records[0].year, null);
  assert.equal(filtered.records[1].year, 2025);
  assert.equal(filtered.records.length, 2);
  assert.equal(filtered.pagination.total, 2);
  assert.equal(filtered.warnings.length, 2);
  assert.ok(
    filtered.warnings.some((warning) => warning.includes("sem ano informado")),
  );
  assert.ok(filtered.records.every((record) => record.issues.length === 0));
  const unfiltered = await fetchPortoVelhoContractsPage(
    query,
    signal(),
    fixture(source),
  );
  assert.deepEqual(unfiltered.warnings, []);
  assert.deepEqual(
    unfiltered.records.map((record) => record.year),
    [null, 2025],
  );
});
