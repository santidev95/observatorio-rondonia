let nextStart = 0;
let reserve: (() => Promise<number | null>) | undefined;
export function configureMunicipalRateLimit(
  reservation: () => Promise<number | null>,
) {
  reserve = reservation;
}
async function wait(ms: number, signal?: AbortSignal | null) {
  signal?.throwIfAborted();
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new Error("Consulta cancelada"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}
// Site e worker compartilham uma reserva por 1,1 segundo no Redis. O site
// conserva o limitador local para Contratos/Obras se o cache estiver fora do ar.
export const municipalFetch: typeof fetch = async (input, init) => {
  const signal = init?.signal;
  signal?.throwIfAborted();
  const reservation = reserve ? await reserve() : null;
  if (reservation !== null) {
    if (reservation < 0) throw new Error("Limite de consultas atingido");
    await wait(reservation, signal);
  } else {
    const start = Math.max(Date.now(), nextStart);
    nextStart = start + 1100;
    await wait(start - Date.now(), signal);
  }
  signal?.throwIfAborted();
  return fetch(input, init);
};
