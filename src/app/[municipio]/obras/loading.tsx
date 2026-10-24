import { Group, Loader } from "@mantine/core";

export default function Loading() {
  return (
    <main
      id="conteudo"
      className="container municipality-page"
      aria-busy="true"
    >
      <Group role="status" gap="md">
        <Loader size="sm" aria-hidden="true" />
        <p>Consultando obras e contratos vinculados…</p>
      </Group>
    </main>
  );
}
