import { notFound } from "next/navigation";
import { UiShowcase } from "@/components/ui/ui-showcase";
import { isLocale } from "@/lib/i18n/config";

export default async function DesignSystemPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (process.env.NODE_ENV === "production" || !isLocale(locale)) notFound();
  return <UiShowcase locale={locale} />;
}
