"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { catalogQuery } from "./catalog-query";

export function useCatalogNavigation<F extends { q: string }>(
  pathname: string,
  filters: F,
  query: string,
  filterQuery: (filters: F) => string,
) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(filters);
  const current = useRef(filters);
  const requested = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Uma resposta anterior nao deve apagar o texto que ainda esta sendo digitado.
    if (requested.current === null || requested.current === query) {
      current.current = filters;
      setDraft(filters);
      requested.current = null;
    }
  }, [filters, query]);

  useEffect(() => {
    const reset = () => {
      clearTimeout(timer.current);
      requested.current = null;
    };
    window.addEventListener("popstate", reset);
    return () => {
      reset();
      window.removeEventListener("popstate", reset);
    };
  }, []);

  const navigate = (next: F, page: number, delay: number) => {
    clearTimeout(timer.current);
    const nextQuery = catalogQuery(filterQuery(next), page);
    requested.current = nextQuery;
    const run = () =>
      startTransition(() => {
        router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, {
          scroll: false,
        });
      });
    if (delay) timer.current = setTimeout(run, delay);
    else run();
  };

  const update = (patch: Partial<F>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    setDraft(next);
    navigate(
      next,
      1,
      Object.hasOwn(patch, "q") && Object.keys(patch).length === 1 ? 250 : 0,
    );
  };

  return {
    draft,
    pending: isPending || filterQuery(draft) !== filterQuery(filters),
    update,
    changePage: (page: number) => navigate(current.current, page, 0),
  };
}
