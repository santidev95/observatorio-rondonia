"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { WORK_RESTORE_KEY, worksReturnUrl } from "./navigation";

export function BackToWorks() {
  const [href, setHref] = useState("/porto-velho/obras/");
  useEffect(() => {
    setHref(worksReturnUrl(window.location.search));
  }, []);
  return (
    <Link
      href={href}
      prefetch={false}
      replace
      scroll={false}
      onClick={() => {
        try {
          sessionStorage.setItem(WORK_RESTORE_KEY, href);
        } catch {
          /* Optional scroll restoration. */
        }
      }}
    >
      <span aria-hidden="true">←</span> Voltar aos resultados
    </Link>
  );
}
