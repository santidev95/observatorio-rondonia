import Link from "next/link";
import Image from "next/image";

export const repositoryUrl =
  "https://github.com/santidev95/observatorio-rondonia";

export function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link
          href="/"
          className="brand"
          aria-label="Observatório de Rondônia — início"
        >
          <Image
            src="/images/bandeira-rondonia.svg"
            alt=""
            width={50}
            height={35}
            priority
          />
          <span className="brand-copy">
            <strong>
              Observatório <span>de Rondônia</span>
            </strong>
            <small>Dados públicos, interesse coletivo.</small>
          </span>
        </Link>
        <nav aria-label="Navegação principal">
          <a href={repositoryUrl} className="contribute-link">
            Contribuir <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <strong>Observatório de Rondônia</strong>
          <p>
            Iniciativa cívica independente, sem vínculo governamental ou
            propaganda eleitoral.
          </p>
        </div>
        <div className="footer-links">
          <a href={repositoryUrl}>Código aberto ↗</a>
          <a href="https://commons.wikimedia.org/wiki/File:Bandeira_de_Rond%C3%B4nia.svg">
            Crédito da bandeira ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
