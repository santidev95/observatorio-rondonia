"use client";
import { Button } from "@mantine/core";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RevenueStatus } from "@/core/revenue-refresh";
import type { DataMunicipality } from "@/core/municipal-sources";
import { formatConsultationTime } from "@/features/contracts/format";

export function RevenueRefreshStatus({
  year,
  initial,
  municipality = "porto-velho",
}: {
  year: number;
  initial: RevenueStatus;
  municipality?: DataMunicipality;
}) {
  const router = useRouter(),
    [status, setStatus] = useState(initial),
    [pending, startTransition] = useTransition();
  const [request, setRequest] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let abort: AbortController | undefined;
    setStatus(initial);
    const poll = async () => {
      if (document.visibilityState !== "visible") {
        timer = setTimeout(poll, 30_000);
        return;
      }
      abort = new AbortController();
      let next = initial;
      try {
        const r = await fetch(
          `/api/${municipality}/receitas/status?ano=${year}`,
          {
            cache: "no-store",
            signal: AbortSignal.any([abort.signal, AbortSignal.timeout(5000)]),
          },
        );
        const body = (await r.json()) as RevenueStatus;
        if (![200, 202, 503].includes(r.status) || !body.refresh || !body.cache)
          throw new Error("Estado indisponível");
        next = body;
        if (stopped) return;
        setStatus(body);
        if (body.fetchedAt && body.fetchedAt !== initial.fetchedAt) {
          startTransition(() => router.refresh());
          return;
        }
      } catch {
        if (!stopped)
          setStatus((old) => ({
            ...old,
            refresh: {
              ...old.refresh,
              status: "unavailable",
              workerOnline: false,
            },
          }));
      }
      if (!stopped)
        timer = setTimeout(
          poll,
          next.state === "pending" || next.refresh.status === "running"
            ? 10_000
            : 60_000,
        );
    };
    timer = setTimeout(
      poll,
      request
        ? 0
        : initial.state === "pending" || initial.refresh.status === "running"
          ? 5000
          : 60_000,
    );
    return () => {
      stopped = true;
      clearTimeout(timer);
      abort?.abort();
    };
  }, [year, initial, router, request, municipality]);
  const latest = status.fetchedAt
    ? formatConsultationTime(status.fetchedAt)
    : null;
  let message: string;
  if (status.refresh.status === "unavailable")
    message = latest
      ? `Exibindo a última consulta válida, de ${latest}. Não foi possível verificar a atualização.`
      : "Não foi possível acessar a atualização deste exercício. Tente novamente em alguns instantes.";
  else if (status.refresh.status === "failed")
    message = latest
      ? `A última tentativa de atualização falhou. Exibindo a consulta válida de ${latest}.`
      : "Não foi possível concluir a primeira atualização deste exercício. Uma nova tentativa foi agendada; nenhum total está sendo exibido.";
  else if (!latest)
    message =
      status.refresh.status === "running"
        ? `Atualizando o exercício ${year}. Os dados aparecerão após a validação da carga completa.`
        : `A atualização do exercício ${year} foi solicitada e aguarda processamento.`;
  else if (status.cache.status === "stale")
    message = `Dados aguardando renovação. Exibindo a última consulta válida, de ${latest}.`;
  else message = `Dados consultados em ${latest}, horário de Rondônia.`;
  return (
    <div className="notice revenue-update" role="status" aria-live="polite">
      <div>
        <p>{message}</p>
        {latest && status.refresh.status === "running" && (
          <p>Uma nova carga está sendo validada em segundo plano.</p>
        )}
        {status.refresh.nextAttemptAt && status.refresh.status === "failed" && (
          <p>
            Nova tentativa prevista a partir de{" "}
            {formatConsultationTime(status.refresh.nextAttemptAt)}.
          </p>
        )}
        {!status.refresh.workerOnline &&
          status.refresh.status !== "unavailable" && (
            <p>
              A atualização automática está temporariamente indisponível; a
              solicitação permanece registrada.
            </p>
          )}
        {status.cache.status === "stale" && (
          <p>
            A consulta ultrapassou o prazo de renovação. Confira a data e os
            documentos na fonte oficial.
          </p>
        )}
      </div>
      <Button
        type="button"
        className="revenue-refresh-button"
        disabled={pending}
        onClick={() => setRequest((n) => n + 1)}
      >
        Verificar atualização
      </Button>
    </div>
  );
}
