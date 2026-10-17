import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geist } from "next/font/google";
import "../globals.css";
import { LOCALES } from "@/i18n/generated";
import { isLocale, localeInfo, translate } from "@/i18n/core";
import { I18nProvider } from "@/i18n/provider";
import { AppShell } from "@/components/shell";

const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist", display: "swap" });

export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: { default: "Isoline", template: "%s · Isoline" },
    description: translate(lang, "meta.description"),
  };
}

export const viewport: Viewport = { viewportFit: "cover", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const info = localeInfo(lang);
  return (
    <html lang={lang} dir={info.dir} className={geist.variable}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-[var(--paper)] focus:p-2">
          {translate(lang, "shell.skip")}
        </a>
        <I18nProvider locale={lang}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
