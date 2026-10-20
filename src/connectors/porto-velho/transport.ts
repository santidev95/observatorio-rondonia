let nextStart = 0;
// Limita o ritmo total dos três módulos dentro deste processo. Outros processos
// e clientes do mesmo IP continuam sujeitos ao limite imposto pela Prefeitura.
export const municipalFetch: typeof fetch = async (input, init) => {
  const signal = init?.signal;
  signal?.throwIfAborted();
  const start = Math.max(Date.now(), nextStart);
  nextStart = start + 1100;
  const wait = start - Date.now();
  if (wait > 0)
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        reject(new Error("Consulta cancelada"));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
      }, wait);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });
  signal?.throwIfAborted();
  return fetch(input, init);
};
