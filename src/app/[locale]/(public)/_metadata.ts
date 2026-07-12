import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/config";

const fallbackBaseUrl = "http://localhost:3000";

export function getBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || fallbackBaseUrl;
  try { return new URL(configured); } catch { return new URL(fallbackBaseUrl); }
}

export function descriptionFrom(value: string, fallback: string) {
  const description = value.replace(/\s+/g, " ").trim();
  if (!description) return fallback;
  return description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
}

export function publicMetadata({ locale, path = "", title, description, type = "website" }: {
  locale: Locale;
  path?: string;
  title: string;
  description: string;
  type?: "website" | "article";
}): Metadata {
  const normalizedPath = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  const localizedPath = `/${locale}${normalizedPath}`;
  const bnPath = `/bn${normalizedPath}`;
  const enPath = `/en${normalizedPath}`;
  return {
    metadataBase: getBaseUrl(),
    title,
    description,
    alternates: { canonical: localizedPath, languages: { bn: bnPath, en: enPath, "x-default": bnPath } },
    openGraph: {
      type, url: localizedPath, siteName: "Dhrubok Coaching Centre", title, description,
      locale: locale === "bn" ? "bn_BD" : "en_US",
      alternateLocale: [locale === "bn" ? "en_US" : "bn_BD"],
      images: [{ url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: "Dhrubok Coaching Centre" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`/${locale}/opengraph-image`] },
  };
}
