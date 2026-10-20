import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { test, type TestContext } from "node:test";
import { createRedisCacheStore } from "../src/core/redis-cache-store";

// Fixture RESP2 local: nenhum teste acessa a VPS nem usa credenciais reais.
function parseCommand(buffer: Buffer): { args: string[]; used: number } | null {
  const first = buffer.indexOf("\r\n");
  if (first < 0) return null;
  const count = Number(buffer.toString("utf8", 1, first));
  let offset = first + 2;
  const args: string[] = [];
  for (let index = 0; index < count; index++) {
    const end = buffer.indexOf("\r\n", offset);
    if (end < 0) return null;
    const length = Number(buffer.toString("utf8", offset + 1, end));
    if (buffer.length < end + 2 + length + 2) return null;
    args.push(buffer.toString("utf8", end + 2, end + 2 + length));
    offset = end + 2 + length + 2;
  }
  return { args, used: offset };
}
const bulk = (value: string) =>
  "$" + Buffer.byteLength(value) + "\r\n" + value + "\r\n";

async function fixture(
  t: TestContext,
  handler: (args: string[]) => string | null,
) {
  const sockets = new Set<Socket>();
  const commands: string[][] = [];
  let connections = 0;
  const server = createServer((socket) => {
    connections++;
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    let buffer = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length) {
        const command = parseCommand(buffer);
        if (!command) return;
        buffer = buffer.subarray(command.used);
        commands.push(command.args);
        const reply = ["AUTH", "CLIENT"].includes(command.args[0])
          ? "+OK\r\n"
          : handler(command.args);
        if (reply !== null) socket.write(reply);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture indisponível");
  const store = createRedisCacheStore({
    url: "redis://127.0.0.1:" + address.port,
    password: "senha-sintetica",
    timeoutMs: 100,
  });
  t.after(async () => {
    store.close();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return { store, commands, connections: () => connections };
}

test("cliente TCP autentica, serializa JSON sem perder zero/null e envia EX 3600", async (t) => {
  const values = new Map<string, string>();
  const server = await fixture(t, (args) => {
    if (args[0] === "SET") {
      values.set(args[1], args[2]);
      return "+OK\r\n";
    }
    return values.has(args[1]) ? bulk(values.get(args[1])!) : "$-1\r\n";
  });
  const data = { valor: 0, ausente: null, objeto: "Aquisição sintética" };
  assert.equal(await server.store.get("ausente"), null);
  await server.store.set("chave-sintetica", data, 3600);
  assert.deepEqual(await server.store.get("chave-sintetica"), data);
  assert.ok(
    server.commands.some(
      (args) => args[0] === "AUTH" && args.at(-1) === "senha-sintetica",
    ),
  );
  assert.deepEqual(
    server.commands.find((args) => args[0] === "SET")?.slice(3),
    ["EX", "3600"],
  );
  assert.equal(server.connections(), 1);
});

test("cliente TCP ignora JSON malformado para permitir recarregar a fonte", async (t) => {
  const { store } = await fixture(t, () => bulk("{json inválido"));
  assert.equal(await store.get("chave-sintetica"), null);
});

test("cliente TCP limita comandos parados e abre nova conexão na próxima consulta", async (t) => {
  let gets = 0;
  const server = await fixture(t, () =>
    ++gets === 1 ? null : bulk('{"recuperado":true}'),
  );
  await assert.rejects(() => server.store.get("chave-sintetica"), {
    message: "Cache indisponível",
  });
  assert.deepEqual(await server.store.get("chave-sintetica"), {
    recuperado: true,
  });
  assert.equal(server.connections(), 2);
});

test("cliente TCP não expõe a mensagem bruta de erro do servidor", async (t) => {
  const { store } = await fixture(t, () => "-ERR segredo-sintetico\r\n");
  await assert.rejects(() => store.get("chave-sintetica"), {
    message: "Cache indisponível",
  });
});
