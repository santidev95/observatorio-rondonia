import type { Metadata, Viewport } from "next";
import { Header, Footer } from "@/components/chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Observatório de Rondônia",
    template: "%s · Observatório de Rondônia",
  },
  description:
    "Dados públicos dos municípios de Rondônia, com fontes, contexto e transparência. Uma plataforma cívica colaborativa em construção.",
  icons: { icon: "/images/bandeira-rondonia.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#131313",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
