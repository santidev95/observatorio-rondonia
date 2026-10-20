export default function Loading() {
  return (
    <main
      id="conteudo"
      className="container municipality-page"
      aria-busy="true"
    >
      <p role="status">
        Consultando receitas e validando a cobertura do exercício… A primeira
        consulta pode levar até dois minutos.
      </p>
    </main>
  );
}
