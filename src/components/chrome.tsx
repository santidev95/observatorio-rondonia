import Link from "next/link";
import Image from "next/image";
import { Scales, GitHub } from "@/features/shared/icons";

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
            src="/images/bandeira-rondonia-circular.svg"
            alt=""
            width={48}
            height={48}
            priority
          />
          <span className="brand-copy">
            <strong>
              Observatório <span>de Rondônia</span>
            </strong>
            <small>Dados públicos, interesse coletivo.</small>
          </span>
        </Link>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <nav className="footer-links" aria-label="Links do rodapé">
          <Link href="/termos-de-uso">
            <Scales size={18} />
            Termos de uso
          </Link>
          <a href={repositoryUrl}>
            <GitHub size={18} />
            Contribuir no GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
