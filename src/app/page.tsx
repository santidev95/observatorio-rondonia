import Link from "next/link";
import { LinkButton } from "@/components/link-button";
import { MunicipalMap } from "@/components/municipal-map";
import { MunicipalitySearch } from "@/components/municipality-search";
import { listMunicipalities } from "@/municipalities";
import { getIntegrationStatus } from "@/core/integration-status";

export default function HomePage() {
  const municipalities = listMunicipalities().map((city) => ({
    ibgeId: city.ibgeId,
    slug: city.slug,
    name: city.name,
    stage: city.stage,
    integrationStatus: getIntegrationStatus(city),
  }));
  return (
    <main id="conteudo" className="container map-home">
      <div className="map-intro">
        <p className="eyebrow">DADOS PÚBLICOS MUNICIPAIS</p>
        <h1>Escolha seu município.</h1>
        <p>Explore dados de Rondônia com fontes oficiais e contexto.</p>
      </div>
      <div className="municipality-toolbar">
        <MunicipalitySearch municipalities={municipalities} />
        <LinkButton
          href="/porto-velho"
          className="pilot-shortcut"
          variant="default"
          justify="space-between"
          style={{ padding: "10px 15px" }}
          rightSection={<span aria-hidden="true">→</span>}
        >
          <span>
            <small>OBRAS, CONTRATOS E RECEITAS</small>
            <strong>Consultar Porto Velho</strong>
          </span>
        </LinkButton>
      </div>
      <MunicipalMap municipalities={municipalities} />
      <noscript>
        <nav
          className="municipality-directory"
          aria-label="Municípios de Rondônia"
        >
          {listMunicipalities().map((city) => (
            <Link href={`/${city.slug}`} key={city.ibgeId}>
              {city.name}
            </Link>
          ))}
        </nav>
      </noscript>
    </main>
  );
}
