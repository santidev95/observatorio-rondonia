import { LinkButton } from "@/components/link-button";
export default function NotFound() {
  return (
    <main id="conteudo" className="container empty-page">
      <p className="eyebrow">PÁGINA NÃO ENCONTRADA</p>
      <h1>Este caminho ainda não faz parte do observatório.</h1>
      <p>
        Consulte os municípios cadastrados e o planejamento das integrações.
      </p>
      <LinkButton variant="filled" href="/">
        Voltar ao início
      </LinkButton>
    </main>
  );
}
