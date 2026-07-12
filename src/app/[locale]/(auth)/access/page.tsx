import { notFound } from "next/navigation";
import { AccessResolver } from "@/components/portal";
import { isLocale } from "@/lib/i18n/config";

export default async function AccessResolution({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <main id="main-content" className="auth-page"><AccessResolver locale={locale} /></main>;
}
