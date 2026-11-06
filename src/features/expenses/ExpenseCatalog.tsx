"use client";

import { Button, Loader, NativeSelect, Table } from "@mantine/core";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type {
  CommitmentRecord,
  ExpensePage,
  ExpenseView,
  PaymentRecord,
} from "@/core/expenses";
import type { ExpensesMunicipality } from "@/core/municipal-sources";
import {
  formatContractCnpj,
  formatContractDate,
  formatContractMoney,
} from "@/features/contracts/format";

function pageUrl(
  municipality: ExpensesMunicipality,
  view: ExpenseView,
  year: number,
  page = 1,
): string {
  const params = new URLSearchParams({ visao: view, ano: String(year) });
  if (page > 1) params.set("page", String(page));
  return `/${municipality}/despesas?${params}`;
}

// A troca de aba ou página só muda a query string: o loading.tsx não aparece nela.
function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span className="expense-link-pending" role="status">
      {pending && (
        <>
          <Loader size={12} aria-hidden="true" />
          <span className="contracts-sr-only">Consultando a fonte…</span>
        </>
      )}
    </span>
  );
}

function Creditor({ record }: { record: CommitmentRecord | PaymentRecord }) {
  return (
    <Table.Td>
      <span className="contract-supplier">
        {record.creditorName ?? "Credor não informado"}
      </span>
      <small className="contract-meta">
        {record.creditorCnpj
          ? "CNPJ " + formatContractCnpj(record.creditorCnpj) + " · "
          : ""}
        {record.department ?? "Órgão não informado"}
      </small>
    </Table.Td>
  );
}

function Commitment({
  record,
  heading,
}: {
  record: CommitmentRecord | PaymentRecord;
  heading: string;
}) {
  return (
    <Table.Th scope="row">
      <span className="contract-number">{heading}</span>
      <p className="contract-object">{record.action ?? "Ação não informada"}</p>
      <small className="contract-meta">
        {record.process ? "Processo " + record.process : "Sem processo"}
        {" · Tipo na fonte: "}
        {record.commitmentType ?? "não informado"}
      </small>
    </Table.Th>
  );
}

function Money({ cents }: { cents: number | null }) {
  return (
    <Table.Td className="numeric">
      <strong className="money">{formatContractMoney(cents)}</strong>
    </Table.Td>
  );
}

export function ExpenseCatalog({
  catalog,
  currentYear,
  firstYear,
  municipality,
}: {
  catalog: ExpensePage;
  currentYear: number;
  firstYear: number;
  municipality: ExpensesMunicipality;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { view, year } = catalog;
  const {
    currentPage: page,
    lastPage: pages,
    total,
    perPage,
  } = catalog.pagination;
  const first = catalog.records.length ? (page - 1) * perPage + 1 : 0;
  const last = Math.min((page - 1) * perPage + catalog.records.length, total);
  const noun = view === "empenhos" ? "empenhos" : "pagamentos";
  const years = Array.from(
    new Set([
      year,
      ...Array.from(
        { length: currentYear - firstYear + 1 },
        (_, index) => currentYear - index,
      ),
    ]),
  ).sort((a, b) => b - a);
  const totals =
    catalog.view === "empenhos"
      ? [
          ["Empenhado", catalog.totals.committedCents],
          ["Anulado", catalog.totals.canceledCents],
          ["Liquidado", catalog.totals.liquidatedCents],
          ["Pago", catalog.totals.paidCents],
        ]
      : [["Pago", catalog.totals.paidCents]];

  return (
    <section className="contract-catalog" aria-label={`Lista de ${noun}`}>
      <div className="expense-controls">
        <nav className="expense-views" aria-label="Tipo de despesa">
          {(["empenhos", "pagamentos"] as const).map((id) => (
            <Button
              key={id}
              component={Link}
              href={pageUrl(municipality, id, year)}
              variant={id === view ? "light" : "subtle"}
              color={id === view ? "brand" : "gray"}
              aria-current={id === view ? "page" : undefined}
              prefetch={false}
            >
              {id === "empenhos" ? "Empenhos" : "Pagamentos"}
              <LinkPending />
            </Button>
          ))}
        </nav>
        <NativeSelect
          id="expense-year"
          className="select-wrap"
          label="Exercício"
          value={year}
          disabled={pending}
          aria-busy={pending}
          rightSection={
            pending ? <Loader size="xs" aria-hidden="true" /> : undefined
          }
          onChange={(event) => {
            const next = Number(event.target.value);
            startTransition(() =>
              router.push(pageUrl(municipality, view, next)),
            );
          }}
        >
          {years.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      </div>

      <section className="expense-totals" aria-label="Totais da fonte">
        <dl>
          {totals.map(([label, cents]) => (
            <div key={label as string}>
              <dt>{label}</dt>
              <dd>{formatContractMoney(cents as number | null)}</dd>
            </div>
          ))}
        </dl>
        <p>
          Totais de {year} informados pela fonte, sem soma feita pelo
          Observatório.{" "}
          {view === "empenhos" &&
            "Empenhar, liquidar e pagar são etapas da mesma despesa: esses valores não devem ser somados entre si."}
        </p>
      </section>

      {catalog.records.length ? (
        <div className="table-wrap">
          <div
            className="table-scroll"
            role="region"
            aria-label={`Tabela de ${noun}`}
            tabIndex={0}
          >
            <Table className="contracts-table">
              <Table.Caption className="contracts-sr-only">
                {noun} de {year}, página {page}
              </Table.Caption>
              <Table.Thead>
                {catalog.view === "empenhos" ? (
                  <Table.Tr>
                    <Table.Th scope="col">Empenho</Table.Th>
                    <Table.Th scope="col">Credor e órgão</Table.Th>
                    <Table.Th scope="col" className="numeric">
                      Empenhado
                    </Table.Th>
                    <Table.Th scope="col" className="numeric">
                      Liquidado
                    </Table.Th>
                    <Table.Th scope="col" className="numeric">
                      Pago
                    </Table.Th>
                  </Table.Tr>
                ) : (
                  <Table.Tr>
                    <Table.Th scope="col">Empenho</Table.Th>
                    <Table.Th scope="col">Credor e órgão</Table.Th>
                    <Table.Th scope="col" className="numeric">
                      Pago
                    </Table.Th>
                    <Table.Th scope="col">Pagamento</Table.Th>
                    <Table.Th scope="col">Liquidação</Table.Th>
                  </Table.Tr>
                )}
              </Table.Thead>
              <Table.Tbody>
                {catalog.view === "empenhos"
                  ? catalog.records.map((record) => (
                      <Table.Tr key={record.id}>
                        <Commitment
                          record={record}
                          heading={`Nº ${record.commitmentNumber} · ${formatContractDate(record.committedOn)}`}
                        />
                        <Creditor record={record} />
                        <Money cents={record.committedCents} />
                        <Money cents={record.liquidatedCents} />
                        <Money cents={record.paidCents} />
                      </Table.Tr>
                    ))
                  : catalog.records.map((record) => (
                      <Table.Tr key={record.id}>
                        <Commitment
                          record={record}
                          heading={`Empenho nº ${record.commitmentNumber}`}
                        />
                        <Creditor record={record} />
                        <Money cents={record.paidCents} />
                        <Table.Td>
                          <span className="contract-date">
                            {formatContractDate(record.paidOn)}
                          </span>
                        </Table.Td>
                        <Table.Td>
                          <span className="contract-date">
                            {formatContractDate(record.settledOn)}
                          </span>
                          <small className="contract-meta">
                            Vencimento {formatContractDate(record.dueOn)}
                          </small>
                        </Table.Td>
                      </Table.Tr>
                    ))}
              </Table.Tbody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="contracts-empty">
          <h2>Nenhum registro encontrado</h2>
          <p>A fonte não retornou {noun} para este exercício.</p>
        </div>
      )}

      <div className="pagination-footer">
        <span>
          Mostrando {first.toLocaleString("pt-BR")} a{" "}
          {last.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}{" "}
          {noun} na fonte
        </span>
        <nav className="pagination-buttons" aria-label={`Paginação de ${noun}`}>
          {page > 1 ? (
            <Button
              component={Link}
              href={pageUrl(municipality, view, year, page - 1)}
              rel="prev"
              prefetch={false}
            >
              Anterior
              <LinkPending />
            </Button>
          ) : (
            <Button type="button" disabled>
              Anterior
            </Button>
          )}
          <span aria-current="page">
            Página {page.toLocaleString("pt-BR")} de{" "}
            {pages.toLocaleString("pt-BR")}
          </span>
          {page < pages ? (
            <Button
              component={Link}
              href={pageUrl(municipality, view, year, page + 1)}
              rel="next"
              prefetch={false}
            >
              Próxima
              <LinkPending />
            </Button>
          ) : (
            <Button type="button" disabled>
              Próxima
            </Button>
          )}
        </nav>
      </div>
    </section>
  );
}
