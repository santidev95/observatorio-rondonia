import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  ContractsDataError,
  isContractId,
  parseContractsQuery,
} from "@/core/contracts-query";
import { portoVelhoSource } from "@/connectors/porto-velho/definition";
import {
  formatContractCnpj,
  formatContractDate,
  formatContractMoney,
  formatConsultationTime,
} from "@/features/contracts/format";
import { CacheNotice } from "@/features/contracts/CacheNotice";
import { getContract } from "@/lib/contracts";
import "./detail.css";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ municipio: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const catalogUrl = "/porto-velho/contratos";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { municipio, id } = await params;
  if (municipio !== "porto-velho" || !isContractId(id)) notFound();
  return {
    title: "Contrato " + id + " · Porto Velho",
    description:
      "Registro de contrato publicado pela Prefeitura de Porto Velho.",
  };
}

function backToCatalog(search: Record<string, unknown>): string {
  try {
    const query = parseContractsQuery(search);
    const context = new URLSearchParams();
    if (search.page !== undefined) context.set("page", String(query.page));
    if (query.year !== null) context.set("ano", String(query.year));
    return catalogUrl + (context.size ? "?" + context.toString() : "");
  } catch {
    return catalogUrl;
  }
}

function UnavailableContract({ id, backUrl }: { id: string; backUrl: string }) {
  return (
    <main id="conteudo" className="container contract-detail-page">
      <Link
        href={backUrl}
        prefetch={false}
        className="back-link contract-detail-back"
      >
        ← Todos os contratos
      </Link>
      <p className="eyebrow">PORTO VELHO / CONTRATO MUNICIPAL</p>
      <h1 className="contract-detail-title">Contrato {id}</h1>
      <section className="contract-detail-unavailable" role="status">
        <h2>Consulta indisponível</h2>
        <p>
          Não foi possível consultar este contrato agora. Tente novamente em
          alguns instantes ou acesse a fonte oficial.
        </p>
        <a
          className="text-link"
          href={portoVelhoSource.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Consultar a fonte oficial ↗
        </a>
      </section>
    </main>
  );
}

export default async function ContractDetailPage({
  params,
  searchParams,
}: Props) {
  const { municipio, id } = await params;
  if (municipio !== "porto-velho" || !isContractId(id)) notFound();
  await connection();

  const backUrl = backToCatalog(await searchParams);
  let result: Awaited<ReturnType<typeof getContract>>;
  try {
    result = await getContract(id);
  } catch (error) {
    if (!(error instanceof ContractsDataError)) throw error;
    return <UnavailableContract id={id} backUrl={backUrl} />;
  }
  if (result.data === null) notFound();
  const contract = result.data;
  const facts = [
    [
      "Órgão contratante",
      contract.departmentName ?? contract.department ?? "Não informado",
    ],
    ["Processo", contract.process ?? "Não informado"],
    ["Assinatura", formatContractDate(contract.signedOn)],
    ["Início da vigência", formatContractDate(contract.startsOn)],
    ["Fim da vigência", formatContractDate(contract.endsOn)],
    ["Categoria", contract.category ?? "Não informada"],
    [
      "Aditivo informado pela fonte",
      contract.addendumReported === null
        ? "Não informado"
        : contract.addendumReported
          ? "Sim"
          : "Não",
    ],
    ["ID oficial", contract.id],
  ];

  return (
    <main id="conteudo" className="container contract-detail-page">
      <Link
        href={backUrl}
        prefetch={false}
        className="back-link contract-detail-back"
      >
        ← Todos os contratos
      </Link>
      <header className="contract-detail-heading">
        <div className="contract-detail-intro">
          <div className="contract-detail-kicker">
            <p className="eyebrow">CONTRATO MUNICIPAL · PORTO VELHO</p>
            <span>
              {contract.department ??
                contract.departmentName ??
                "Órgão não informado"}
              {" · "}
              {contract.year ?? "Ano não informado"}
            </span>
          </div>
          <h1 className="contract-detail-title">
            {contract.number ?? "Contrato " + contract.id}
          </h1>
          <p className="contract-detail-object">
            {contract.object ?? "Objeto não informado na fonte."}
          </p>
        </div>
        <a
          className="button contract-detail-official"
          href={contract.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Registro oficial <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section
        className="contract-detail-metrics"
        aria-label="Resumo do contrato"
      >
        <article className="contract-detail-metric">
          <h2>VALOR DO CONTRATO</h2>
          <strong>{formatContractMoney(contract.amountCents)}</strong>
          <p>Valor informado no registro do contrato.</p>
        </article>
        <article className="contract-detail-metric">
          <h2>EXECUTADO INFORMADO</h2>
          <strong>{formatContractMoney(contract.executedAmountCents)}</strong>
          <p>
            A definição deste campo não foi confirmada; não o tratamos como
            total pago nem como avanço físico.
          </p>
        </article>
        <article className="contract-detail-metric">
          <h2>SITUAÇÃO NA FONTE</h2>
          <strong className="contract-detail-status">
            {contract.status ?? "Não informada"}
          </strong>
          <p>Não calculada a partir da vigência.</p>
        </article>
      </section>

      <section
        className="contract-detail-section"
        aria-labelledby="contract-info"
      >
        <h2 id="contract-info">Dados do contrato</h2>
        <dl className="contract-detail-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="contract-detail-section"
        aria-labelledby="contract-suppliers"
      >
        <h2 id="contract-suppliers">Fornecedores</h2>
        {contract.suppliers.length ? (
          <ul className="contract-detail-suppliers">
            {contract.suppliers.map((supplier, index) => (
              <li key={String(index) + "-" + (supplier.cnpj ?? "sem-cnpj")}>
                <strong>{supplier.name ?? "Nome não informado"}</strong>
                <span>CNPJ: {formatContractCnpj(supplier.cnpj)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Fornecedor não informado na fonte.</p>
        )}
      </section>

      <section
        className="contract-detail-section"
        aria-labelledby="contract-documents"
      >
        <h2 id="contract-documents">Documentos e aditivos</h2>
        <p className="contract-detail-note">
          Anexos publicados pela fonte. Os valores dos documentos não são
          somados ao contrato; podem representar alterações ou informações já
          incluídas.
        </p>
        {contract.documents.length ? (
          <ul className="contract-detail-documents">
            {contract.documents.map((document, index) => (
              <li key={document.url + "-" + index}>
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {document.label} <span aria-hidden="true">↗</span>
                </a>
                {document.publicationReference && (
                  <p className="contract-detail-note">
                    Referência de publicação: {document.publicationReference}
                  </p>
                )}
                <dl className="contract-detail-document-facts">
                  <div>
                    <dt>Publicação</dt>
                    <dd>{formatContractDate(document.publishedOn)}</dd>
                  </div>
                  <div>
                    <dt>Valor informado</dt>
                    <dd>{formatContractMoney(document.amountCents)}</dd>
                  </div>
                  <div>
                    <dt>Situação na fonte</dt>
                    <dd>{document.status ?? "Não informada"}</dd>
                  </div>
                  <div>
                    <dt>Assinatura</dt>
                    <dd>{formatContractDate(document.signedOn)}</dd>
                  </div>
                  <div>
                    <dt>Início da vigência</dt>
                    <dd>{formatContractDate(document.startsOn)}</dd>
                  </div>
                  <div>
                    <dt>Fim da vigência</dt>
                    <dd>{formatContractDate(document.endsOn)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum documento com link oficial informado nesta consulta.</p>
        )}
      </section>

      {contract.procurement && (
        <section
          className="contract-detail-section"
          aria-labelledby="contract-procurement"
        >
          <h2 id="contract-procurement">Licitação vinculada</h2>
          <a
            className="contract-detail-procurement"
            href={contract.procurement.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {contract.procurement.title} <span aria-hidden="true">↗</span>
          </a>
          <p className="contract-detail-note">Vínculo informado pela fonte.</p>
        </section>
      )}

      {contract.observation && (
        <section
          className="contract-detail-section"
          aria-labelledby="contract-observation"
        >
          <h2 id="contract-observation">Observações da fonte</h2>
          <p className="contract-detail-observation">{contract.observation}</p>
        </section>
      )}

      {contract.issues.length > 0 && (
        <section
          className="contract-detail-limitations"
          aria-labelledby="contract-limitations"
        >
          <h2 id="contract-limitations">Limitações deste registro</h2>
          <ul>
            {contract.issues.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="contract-detail-provenance">
        <p>
          Atualização na fonte:{" "}
          {contract.sourceUpdatedAt === null ? (
            "Não informada"
          ) : (
            <time dateTime={contract.sourceUpdatedAt}>
              {formatContractDate(contract.sourceUpdatedAt)}
            </time>
          )}
        </p>
        <p>
          Consulta à fonte:{" "}
          <time dateTime={result.fetchedAt}>
            {formatConsultationTime(result.fetchedAt)}
          </time>
          . Horário de Rondônia.
        </p>
        <CacheNotice cache={result.cache} />
      </footer>
    </main>
  );
}
