import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonte arredondada "Fredoka" empacotada via npm (@fontsource-variable) —
// não depende de acesso ao Google Fonts durante o build (build offline-safe).
const fredoka = localFont({
  src: "../node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2",
  variable: "--font-fredoka",
  weight: "300 700",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://komilaodoces.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Doces Komilão — Distribuidora de doces e salgadinhos em Campinas", template: "%s | Doces Komilão" },
  description:
    "Doces, balas, pirulitos e salgadinhos no varejo e no atacado. Atendemos padarias, lanchonetes, bares e mercearias em Campinas e região.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: { title: "Doces Komilão", description: "Distribuidora de doces e salgadinhos em Campinas-SP", images: ["/logo.png"], locale: "pt_BR", type: "website" },
};

export const viewport: Viewport = { themeColor: "#FFBB12", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={fredoka.variable}>
      <body>{children}</body>
    </html>
  );
}
