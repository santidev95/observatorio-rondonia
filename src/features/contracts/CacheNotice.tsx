import type { CacheMetadata } from "@/core/contracts-cache";
import { formatConsultationTime } from "./format";

export function CacheNotice({ cache }: { cache: CacheMetadata }) {
  const label =
    cache.status === "hit"
      ? "Dados reutilizados da consulta à fonte indicada acima."
      : cache.status === "miss" && cache.expiresAt
        ? "Consulta à fonte armazenada por até uma hora."
        : cache.status === "unavailable"
          ? "Consulta direta à fonte; cache temporariamente indisponível."
          : "Consulta direta à fonte.";
  return (
    <p>
      {label}
      {cache.expiresAt && (
        <>
          {" "}
          Cache válido até{" "}
          <time dateTime={cache.expiresAt}>
            {formatConsultationTime(cache.expiresAt)}
          </time>
          , horário de Rondônia.
        </>
      )}
    </p>
  );
}
