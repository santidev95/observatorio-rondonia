import "@mantine/core/styles.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import { Header, Footer } from "@/components/chrome";
import { PortalProvider } from "@/components/portal-provider";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: {
    default: "Observatório de Rondônia",
    template: "%s · Observatório de Rondônia",
  },
  description:
    "Dados públicos dos municípios de Rondônia, com fontes, contexto e transparência. Uma plataforma cívica colaborativa em construção.",
  icons: {
    icon: {
      url: "/images/bandeira-rondonia-circular.svg",
      type: "image/svg+xml",
      sizes: "any",
    },
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      {...mantineHtmlProps}
      data-mantine-color-scheme="dark"
      className={geist.variable}
    >
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body className={geist.className}>
        <PortalProvider>
          <a className="skip-link" href="#conteudo">
            Pular para o conteúdo
          </a>
          <Header />
          {children}
          <Footer />
        </PortalProvider>
      </body>
    </html>
  );
}
