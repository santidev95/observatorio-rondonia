import { createClient } from "redis";
import type { ContractsCacheStore } from "./contracts-cache";

export type RedisScriptStore = ContractsCacheStore & {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
  close(): void;
};

type Config = { url: string; password: string; timeoutMs?: number };

function configuredClient(config: Config) {
  const timeoutMs = config.timeoutMs ?? 1500;
  return createClient({
    url: config.url,
    password: config.password,
    RESP: 2,
    socket: { connectTimeout: timeoutMs, reconnectStrategy: false },
    commandOptions: { timeout: timeoutMs },
    disableOfflineQueue: true,
  });
}
type Client = ReturnType<typeof configuredClient>;

/** Cliente TCP compartilhado; não mantém respostas ou fila offline em memória. */
export function createRedisCacheStore(config: Config): RedisScriptStore {
  const timeoutMs = config.timeoutMs ?? 1500;
  let client: Client | undefined;
  let connecting: Promise<Client> | undefined;

  function discard(current: Client) {
    try {
      current.destroy();
    } catch {
      /* Cliente já encerrado. */
    }
    if (client === current) client = undefined;
  }

  async function connection(): Promise<Client> {
    if (client?.isReady) return client;
    if (connecting) return connecting;
    if (client) discard(client);
    const current = configuredClient(config);
    // Erros são convertidos em estado público de cache indisponível pelo leitor.
    // Não registrar objetos do cliente, URL autenticada ou mensagem bruta.
    current.on("error", () => {});
    client = current;
    const pending = current
      .connect()
      .then(() => current)
      .catch(() => {
        discard(current);
        throw new Error("Cache indisponível");
      })
      .finally(() => {
        connecting = undefined;
      });
    connecting = pending;
    return pending;
  }

  async function execute<T>(
    operation: (current: Client) => Promise<T>,
  ): Promise<T> {
    let active: Client | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const ready = connection();
          active = client;
          const current = await ready;
          active = current;
          return operation(current);
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            if (active) discard(active);
            reject(new Error("Cache indisponível"));
          }, timeoutMs);
        }),
      ]);
    } catch {
      if (active) discard(active);
      throw new Error("Cache indisponível");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  return {
    async eval(script, keys, args) {
      return execute((current) =>
        current.eval(script, { keys, arguments: args }),
      );
    },
    async get(key) {
      const value = await execute((current) => current.get(key));
      if (value === null) return null;
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return null;
      }
    },
    async set(key, value, ttlSeconds) {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new Error("Valor de cache inválido");
      await execute((current) =>
        current.set(key, serialized, { EX: ttlSeconds }),
      );
    },
    close() {
      if (client) discard(client);
    },
  };
}
