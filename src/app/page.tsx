import Link from "next/link";
import { MunicipalMap } from "@/components/municipal-map";
import { listMunicipalities } from "@/municipalities";
import { getIntegrationStatus } from "@/core/integration-status";

export default function HomePage() {
  return (
    <main id="conteudo" className="container map-home">
      <div className="map-intro">
        <h1>Escolha seu município.</h1>
      </div>
      <MunicipalMap
        municipalities={listMunicipalities().map((city) => ({
          ibgeId: city.ibgeId,
          slug: city.slug,
          name: city.name,
          stage: city.stage,
          integrationStatus: getIntegrationStatus(city),
        }))}
      />
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
