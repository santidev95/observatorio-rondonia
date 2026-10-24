import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMunicipality, listMunicipalities } from "@/municipalities";
import { moduleIds, moduleLabels } from "@/core/municipality";
import { repositoryUrl } from "@/components/chrome";
import { FileSearch, Works, Revenues } from "@/features/shared/icons";

const modulePresentation = {
  contratos: {
    icon: FileSearch,
    description:
      "Pesquise contratos, fornecedores, valores e documentos oficiais.",
  },
  obras: {
    icon: Works,
    description:
      "Encontre obras, consulte valores e confira a situação publicada.",
  },
  receitas: {
    icon: Revenues,
    description: "Explore receitas e a previsão orçamentária por exercício.",
  },
};

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
  const integrated = Object.values(city.modules).some(
    (module) => module.status === "available",
  );
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
      <p className="page-description">
        {integrated
          ? `Obras, contratos e receitas de ${city.name}, com acesso às fontes oficiais e limites de cobertura por módulo.`
          : city.description}
      </p>
      {!integrated && (
        <div className="project-notice">
          <span className="notice-label">DADOS AINDA INDISPONÍVEIS</span>
          <p>
            {city.stage === "not-started"
              ? "A integração deste município ainda não foi iniciada."
              : "A integração deste município está em preparação."}{" "}
            Nenhum total, contrato ou indicador está sendo publicado nesta
            página.
          </p>
        </div>
      )}
      <section className="section" aria-labelledby="modulos-titulo">
        <div className="section-heading">
          <h2 id="modulos-titulo">Módulos e cobertura</h2>
          {integrated && (
            <p>Escolha uma consulta para explorar os dados da Prefeitura.</p>
          )}
        </div>
        <div className="module-grid">
          {moduleIds.map((id) => {
            const Icon = modulePresentation[id].icon;
            const available =
              integrated && city.modules[id].status === "available";
            return (
              <article className="module-card" key={id}>
                <div className="module-card-top">
                  <span className="module-icon">
                    <Icon size={24} />
                  </span>
                  <span className={`badge${available ? " badge-gold" : ""}`}>
                    {city.modules[id].status === "available"
                      ? "Disponível"
                      : city.modules[id].status === "not-started"
                        ? "Não iniciada"
                        : "Em preparação"}
                  </span>
                </div>
                <h3>{moduleLabels[id]}</h3>
                <p>
                  {available
                    ? modulePresentation[id].description
                    : city.modules[id].note}
                </p>
                {available && (
                  <Link
                    href={"/" + city.slug + "/" + id}
                    prefetch={false}
                    className="module-action"
                  >
                    Consultar {moduleLabels[id]}{" "}
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
              </article>
            );
          })}
        </div>
        {integrated && (
          <p className="module-coverage-note">
            A disponibilidade depende das fontes oficiais. Cada consulta informa
            sua cobertura e data de atualização.
          </p>
        )}
      </section>
      <section className="contribution-panel">
        <h2>
          {integrated
            ? "Ajude a melhorar o Observatório."
            : "Ajude a construir esta integração."}
        </h2>
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
