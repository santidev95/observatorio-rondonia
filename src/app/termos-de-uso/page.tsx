import type { Metadata } from "next";
import Link from "next/link";
import { repositoryUrl } from "@/components/chrome";
import styles from "./terms.module.css";

export const metadata: Metadata = {
  title: "Termos de uso",
  description:
    "Condições de consulta e reutilização das informações do Observatório de Rondônia, com fontes, limites e créditos.",
};

export default function TermsPage() {
  return (
    <main id="conteudo" className={`container ${styles.page}`}>
      <Link href="/" className="back-link">
        ← Voltar ao início
      </Link>
      <header className={styles.heading}>
        <p className="eyebrow">OBSERVATÓRIO DE RONDÔNIA</p>
        <h1>Termos de uso</h1>
        <p className={styles.intro}>
          Condições para consultar, interpretar e reutilizar as informações da
          plataforma.
        </p>
        <p className={styles.updated}>
          Última atualização:{" "}
          <time dateTime="2026-10-19">19 de outubro de 2026</time>.
        </p>
      </header>

      <div className={styles.notice}>
        <p>
          O Observatório de Rondônia é uma iniciativa cívica independente, sem
          vínculo governamental ou propaganda eleitoral. As fontes oficiais, as
          datas e os limites de cada consulta fazem parte da informação
          apresentada.
        </p>
      </div>

      <section aria-labelledby="objetivo">
        <h2 id="objetivo">1. Objetivo e acesso</h2>
        <p>
          A plataforma facilita o acesso a dados públicos municipais para
          pesquisa, informação e acompanhamento da gestão pública. A consulta é
          gratuita e não exige criação de conta. O Observatório não representa
          prefeituras, órgãos de controle ou outras instituições públicas e não
          emite certidões ou conclusões oficiais.
        </p>
      </section>

      <section aria-labelledby="fontes">
        <h2 id="fontes">2. Fontes, cobertura e atualização</h2>
        <p>
          As informações são obtidas de fontes oficiais identificadas nos
          módulos. O cadastro de um município no mapa não significa que existam
          dados integrados. Consulte os estados de disponibilidade e os limites
          de cobertura apresentados em cada página.
        </p>
        <p>
          A data de consulta à fonte pode ser diferente da data de atualização
          do registro pelo órgão público. Os dados podem conter ausências,
          divergências ou atrasos da origem. Sempre confira a fonte e os
          documentos oficiais antes de tomar decisões ou publicar conclusões.
        </p>
      </section>

      <section aria-labelledby="interpretacao">
        <h2 id="interpretacao">3. Interpretação e reutilização</h2>
        <p>
          Valores contratados, pagos e percentuais publicados representam
          conceitos distintos. Um percentual sem definição confirmada não deve
          ser interpretado como avanço físico de uma obra. A ausência de
          informação não equivale a zero.
        </p>
        <p>
          Diferenças entre registros ou valores não comprovam, por si só,
          irregularidade, fraude ou responsabilidade de pessoas e instituições.
          Ao compartilhar informações, preserve o contexto, o período, a fonte
          original e as ressalvas de cobertura. Verifique as condições de
          reutilização da respectiva fonte.
        </p>
      </section>

      <section aria-labelledby="uso-responsavel">
        <h2 id="uso-responsavel">4. Uso responsável e dados pessoais</h2>
        <p>
          Utilize a plataforma de forma lícita, sem tentar contornar controles
          de acesso, comprometer sua segurança ou provocar sobrecarga
          deliberada. Não use informações fora de contexto para assediar,
          discriminar ou expor indevidamente pessoas.
        </p>
        <p>
          A reutilização de informações públicas deve observar a{" "}
          <a href="https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm">
            Lei de Acesso à Informação
          </a>{" "}
          e, quando envolver dados pessoais, a{" "}
          <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm">
            Lei Geral de Proteção de Dados Pessoais
          </a>
          . O acesso público a um dado pessoal não elimina os cuidados com sua
          finalidade, privacidade e uso de boa-fé.
        </p>
      </section>

      <section aria-labelledby="disponibilidade">
        <h2 id="disponibilidade">5. Disponibilidade e limites do serviço</h2>
        <p>
          O funcionamento depende das fontes públicas e da infraestrutura da
          plataforma. Podem ocorrer interrupções, mudanças de cobertura e
          indisponibilidade de registros ou documentos. Verifique os avisos de
          atualização e de falha exibidos nas consultas.
        </p>
        <p>
          O Observatório não garante atualização em tempo real, cobertura
          integral de todos os municípios ou manutenção de um histórico
          permanente. Estes termos não afastam direitos e responsabilidades
          previstos na legislação aplicável.
        </p>
      </section>

      <section aria-labelledby="navegacao">
        <h2 id="navegacao">6. Navegação e links externos</h2>
        <p>
          A consulta de Obras utiliza armazenamento temporário da sessão no
          navegador para facilitar o retorno à lista. Filtros e buscas podem
          constar nos endereços das páginas; confira o conteúdo do endereço
          antes de compartilhá-lo.
        </p>
        <p>
          Links para fontes oficiais, documentos e GitHub levam a serviços de
          terceiros, sujeitos às próprias condições de uso e práticas de
          privacidade.
        </p>
      </section>

      <section aria-labelledby="licenca">
        <h2 id="licenca">7. Código aberto e créditos</h2>
        <p>
          O código do projeto está disponível no{" "}
          <a href={repositoryUrl}>GitHub</a> sob a{" "}
          <a href={`${repositoryUrl}/blob/master/LICENSE`}>licença MIT</a>. Essa
          licença se refere ao software; não substitui as condições de uso dos
          dados e materiais das fontes originais.
        </p>
        <p>
          A malha municipal é proveniente do{" "}
          <a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3">
            IBGE
          </a>
          . A bandeira foi obtida da{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Bandeira_de_Rond%C3%B4nia.svg">
            Wikimedia Commons
          </a>
          , com autoria atribuída a E2m e declaração de domínio público pelo
          autor. O símbolo circular usado no cabeçalho e no favicon é uma
          adaptação desse arquivo.
        </p>
      </section>

      <section aria-labelledby="correcoes">
        <h2 id="correcoes">8. Correções, contribuições e versões</h2>
        <p>
          Problemas técnicos e sugestões podem ser registrados no{" "}
          <a href={`${repositoryUrl}/issues`}>repositório do projeto</a>.
          Informe a página afetada e a referência oficial, quando disponível. As
          discussões são públicas: não envie credenciais, documentos pessoais ou
          outras informações sensíveis.
        </p>
        <p>
          Correções de registros oficiais dependem do órgão que os publica.
          Estes termos podem ser revisados conforme a plataforma evoluir; a data
          de atualização é informada no início desta página.
        </p>
      </section>
    </main>
  );
}
