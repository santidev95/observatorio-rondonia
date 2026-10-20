"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import geography from "@/geography/rondonia-map.json";
import {
  integrationStatusLabels,
  type IntegrationStatus,
} from "@/core/integration-status";

export type MapMunicipality = {
  ibgeId: string;
  slug: string;
  name: string;
  stage: "pilot" | "planned" | "not-started";
  integrationStatus: IntegrationStatus;
};

export function MunicipalMap({
  municipalities,
}: {
  municipalities: MapMunicipality[];
}) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState("");
  const [focusedId, setFocusedId] = useState("1100205");
  const [zoom, setZoom] = useState(1);
  const paths = useRef<Record<string, SVGPathElement | null>>({});
  const canvas = useRef<HTMLDivElement>(null);
  const hovered = municipalities.find((city) => city.ibgeId === hoveredId);
  const indexed = new Map(municipalities.map((city) => [city.ibgeId, city]));

  function choose(id: string) {
    const city = indexed.get(id);
    if (city) router.push("/" + city.slug);
  }
  function resetView() {
    setZoom(1);
    canvas.current?.scrollTo({ top: 0, left: 0 });
  }
  function navigate(event: KeyboardEvent<SVGPathElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(id);
      return;
    }
    const index = municipalities.findIndex((city) => city.ibgeId === id);
    const moves: Record<string, number> = {
      ArrowRight: (index + 1) % municipalities.length,
      ArrowDown: (index + 1) % municipalities.length,
      ArrowLeft: (index - 1 + municipalities.length) % municipalities.length,
      ArrowUp: (index - 1 + municipalities.length) % municipalities.length,
      Home: 0,
      End: municipalities.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    paths.current[municipalities[next].ibgeId]?.focus();
  }

  return (
    <section
      id="municipios"
      className="municipal-explorer"
      aria-label="Escolher município"
    >
      <div className="map-stage">
        <div className="map-controls" role="group" aria-label="Zoom do mapa">
          <button
            type="button"
            aria-label="Ampliar mapa"
            disabled={zoom >= 3}
            onClick={() => setZoom((current) => Math.min(3, current + 0.5))}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Reduzir mapa"
            disabled={zoom <= 1}
            onClick={() => setZoom((current) => Math.max(1, current - 0.5))}
          >
            −
          </button>
          <button type="button" aria-label="Restaurar mapa" onClick={resetView}>
            ↺
          </button>
        </div>
        {hovered && (
          <div className="map-hover" aria-hidden="true">
            {hovered.name}
          </div>
        )}
        <div
          ref={canvas}
          className="map-canvas"
          tabIndex={0}
          aria-label="Área do mapa. Com zoom, role para explorar os limites municipais."
        >
          <svg
            className="municipal-svg"
            viewBox={geography.viewBox}
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
            role="group"
            aria-labelledby="municipal-map-title municipal-map-description"
          >
            <title id="municipal-map-title">
              Mapa dos municípios de Rondônia
            </title>
            <desc id="municipal-map-description">
              Use as setas para percorrer os municípios e Enter ou Espaço para
              abrir a página do município.
            </desc>
            <g transform={geography.transform}>
              {geography.municipalities.map((shape) => {
                const city = indexed.get(shape.id);
                if (!city) return null;
                return (
                  <path
                    key={shape.id}
                    ref={(node) => {
                      paths.current[shape.id] = node;
                    }}
                    d={shape.d}
                    id={`municipio-${shape.id}`}
                    data-municipality={city.slug}
                    data-integration-status={city.integrationStatus}
                    aria-describedby={`integration-status-${city.integrationStatus}`}
                    className={`map-region integration-status-${city.integrationStatus}${hoveredId === shape.id ? " is-hovered" : ""}`}
                    vectorEffect="non-scaling-stroke"
                    role="link"
                    tabIndex={focusedId === shape.id ? 0 : -1}
                    aria-label={`Abrir município de ${city.name}`}
                    onPointerEnter={() => setHoveredId(shape.id)}
                    onPointerLeave={() => setHoveredId("")}
                    onFocus={() => {
                      setFocusedId(shape.id);
                      setHoveredId(shape.id);
                    }}
                    onBlur={() => setHoveredId("")}
                    onClick={() => choose(shape.id)}
                    onKeyDown={(event) => navigate(event, shape.id)}
                  >
                    <title>{city.name}</title>
                  </path>
                );
              })}
            </g>
          </svg>
        </div>
      </div>
      <div className="map-caption">
        <ul className="map-legend" aria-label="Situação das integrações">
          {Object.entries(integrationStatusLabels).map(([status, label]) => (
            <li
              key={status}
              id={`integration-status-${status}`}
              className={`integration-status-${status}`}
            >
              <span className="map-legend-dot" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
        <p className="map-source">
          Mapa:{" "}
          <a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3">
            IBGE
          </a>
        </p>
      </div>
    </section>
  );
}
