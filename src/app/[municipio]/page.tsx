import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMunicipality, listMunicipalities } from "@/municipalities";
import { moduleIds, moduleLabels } from "@/core/municipality";
import { repositoryUrl } from "@/components/chrome";

type Props = { params: Promise<{ municipio: string }> };
export function generateStaticParams() {
  return listMunicipalities().map((city) => ({ municipio: city.slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = getMunicipality((await params).municipio);
  if (!city) notFound();
  return { title: city.name, description: city.description };
}
export default async function MunicipalityPage({ params }: Props) {
  const city = getMunicipality((await params).municipio);
  if (!city) notFound();
  const portoVelho = city.slug === "porto-velho";
  return (
    <main id="conteudo" className="container municipality-page">
      <Link href="/#municipios" className="back-link">
        ← Todos os municípios
      </Link>
      <p className="eyebrow">
        RONDÔNIA /{" "}
        {city.stage === "pilot"
          ? "MUNICÍPIO PILOTO"
          : city.stage === "planned"
            ? "INTEGRAÇÃO PROPOSTA"
            : "INTEGRAÇÃO NÃO INICIADA"}
      </p>
      <h1>{city.name}</h1>
      <p className="page-description">{city.description}</p>
      <div className="project-notice">
        <span className="notice-label">
          {portoVelho
            ? "CONSULTA DE DADOS PÚBLICOS"
            : "DADOS AINDA INDISPONÍVEIS"}
        </span>
        <p>
          {portoVelho ? (
            "Consulte Obras, Contratos e Receitas para verificar os dados e a disponibilidade atual das fontes oficiais."
          ) : (
            <>
              {city.stage === "not-started"
                ? "A integração deste município ainda não foi iniciada."
                : "A integração deste município está em preparação."}{" "}
              Nenhum total, contrato ou indicador está sendo publicado nesta
              página.
            </>
          )}
        </p>
      </div>
      <section className="section" aria-labelledby="modulos-titulo">
        <div className="section-heading">
          <h2 id="modulos-titulo">Módulos e cobertura</h2>
        </div>
        <div className="module-grid">
          {moduleIds.map((id) => (
            <article className="module-card" key={id}>
              <span className="badge">
                {portoVelho
                  ? "Em implantação"
                  : city.modules[id].status === "not-started"
                    ? "Não iniciada"
                    : "Em preparação"}
              </span>
              <h3>{moduleLabels[id]}</h3>
              <p>{city.modules[id].note}</p>
              {portoVelho && (
                <Link
                  href={"/porto-velho/" + id}
                  prefetch={false}
                  className="text-link contracts-module-link"
                >
                  Consultar {moduleLabels[id]} →
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="contribution-panel">
        <h2>Ajude a construir esta integração.</h2>
        <p>
          Você pode indicar fontes oficiais, documentar a API e contribuir com
          código e testes.
        </p>
        <a
          className="button"
          href={repositoryUrl + "/blob/master/CONTRIBUTING.md"}
        >
          Como contribuir <span aria-hidden="true">↗</span>
        </a>
      </section>
    </main>
  );
}
