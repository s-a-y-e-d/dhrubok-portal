import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import { notFound } from "next/navigation";
import { ConvexClientProvider } from "@/app/ConvexClientProvider";
import { Toaster } from "@/components/ui/sonner";
import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import "@/app/globals.css";
import { getBaseUrl } from "@/app/[locale]/(public)/_metadata";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const notoBengali = Noto_Sans_Bengali({ variable: "--font-noto-bengali", subsets: ["bengali"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: getBaseUrl(),
  title: { default: "Dhrubok Portal", template: "%s | Dhrubok" },
  description: "Bilingual coaching centre website and portal",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);

  return (
    <html lang={locale ?? defaultLocale} className={`${inter.variable} ${notoBengali.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">{dictionary.common.skip}</a>
        <ClerkProvider signInUrl={`/${locale}/sign-in`}>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
        <Toaster closeButton position="bottom-right" />
      </body>
    </html>
  );
}
