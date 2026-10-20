export function redisConfig(env: Readonly<Record<string, string | undefined>>) {
  const url = env.REDIS_URL?.trim(),
    password = env.REDIS_PASSWORD;
  if (!url && !password) return null;
  if (!url || !password) throw new Error("Configuração do cache incompleta");
  let address: URL;
  try {
    address = new URL(url);
  } catch {
    throw new Error("Endereço Redis inválido");
  }
  if (
    !["redis:", "rediss:"].includes(address.protocol) ||
    address.username ||
    address.password ||
    address.search ||
    address.hash
  )
    throw new Error("Endereço Redis inválido; informe a senha separadamente");
  return { url, password };
}
