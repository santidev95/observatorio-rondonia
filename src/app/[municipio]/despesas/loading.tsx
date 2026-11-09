import { Group, Loader } from "@mantine/core";

export default function Loading() {
  return (
    <main
      id="conteudo"
      className="container municipality-page"
      aria-busy="true"
    >
      <Group role="status" gap="md" wrap="nowrap">
        <Loader size="sm" aria-hidden="true" />
        <p>
          Consultando despesas na fonte… A primeira leitura de um exercício pode
          levar até 30 segundos.
        </p>
      </Group>
    </main>
  );
}
