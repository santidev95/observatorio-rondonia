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
          Consultando receitas e validando a cobertura do exercício… A primeira
          consulta pode levar até dois minutos.
        </p>
      </Group>
    </main>
  );
}
