"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ActionIcon, TextInput } from "@mantine/core";
import type { MapMunicipality } from "./municipal-map";
import { Search, X } from "@/features/shared/icons";
import { searchKey } from "@/features/shared/display";

export function MunicipalitySearch({
  municipalities,
}: {
  municipalities: MapMunicipality[];
}) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const term = searchKey(query.trim());
  const words = term.split(/[\s'’\-]+/).filter(Boolean);
  const results = words.length
    ? municipalities.filter((city) =>
        words.every((word) => searchKey(city.name).includes(word)),
      )
    : [];

  function clear() {
    setQuery("");
    input.current?.focus();
  }

  return (
    <div className="municipality-search">
      <TextInput
        ref={input}
        id="municipality-search"
        label="Buscar município"
        type="search"
        placeholder="Digite o nome do município"
        autoComplete="off"
        maxLength={100}
        value={query}
        aria-controls="municipality-search-results"
        aria-describedby="municipality-search-status"
        leftSection={<Search size={20} />}
        leftSectionPointerEvents="none"
        rightSectionWidth={48}
        rightSectionPointerEvents="all"
        rightSection={
          query ? (
            <ActionIcon
              type="button"
              variant="subtle"
              color="gray"
              size={44}
              aria-label="Limpar busca de município"
              onClick={clear}
            >
              <X size={18} />
            </ActionIcon>
          ) : null
        }
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") clear();
        }}
      />
      <p id="municipality-search-status" className="sr-only" role="status">
        {term
          ? `${results.length} ${results.length === 1 ? "município encontrado" : "municípios encontrados"}.`
          : ""}
      </p>
      <div
        id="municipality-search-results"
        className="municipality-search-results"
        hidden={!term}
      >
        {results.length ? (
          <ul aria-label="Municípios encontrados">
            {results.map((city) => (
              <li key={city.ibgeId}>
                <Link href={`/${city.slug}`} prefetch={false}>
                  <span>
                    <strong>{city.name}</strong>
                    <small>
                      {city.integrationStatus === "integrated"
                        ? "Consultas disponíveis"
                        : city.stage === "planned"
                          ? "Em preparação"
                          : "Integração não iniciada"}
                    </small>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum município encontrado. Tente outro nome.</p>
        )}
      </div>
    </div>
  );
}
