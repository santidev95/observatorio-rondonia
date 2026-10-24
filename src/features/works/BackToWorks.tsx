"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  workStorageKeys,
  worksReturnUrl,
  worksUrl,
  type WorksContext,
} from "./navigation";
import { defaultFilters } from "./filters";

export function BackToWorks({
  municipality = "porto-velho",
  year,
}: WorksContext) {
  const [href, setHref] = useState(
    worksUrl(defaultFilters, 1, { municipality, year }),
  );
  useEffect(() => {
    setHref(worksReturnUrl(window.location.search, { municipality, year }));
  }, [municipality, year]);
  return (
    <Link
      href={href}
      prefetch={false}
      replace
      scroll={false}
      onClick={() => {
        try {
          sessionStorage.setItem(workStorageKeys(municipality).restore, href);
        } catch {
          /* Optional scroll restoration. */
        }
      }}
    >
      <span aria-hidden="true">←</span> Voltar aos resultados
    </Link>
  );
}
