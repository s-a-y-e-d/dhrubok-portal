import { notFound } from "next/navigation";
import { RoleSection } from "@/components/portal";
import { isLocale } from "@/lib/i18n/config";
import { websiteCmsEnabled } from "@/lib/features";

export default async function OwnerSection({ params }: { params: Promise<{ locale: string; section?: string[] }> }) {
  const { locale, section } = await params; if (!isLocale(locale) || (!websiteCmsEnabled && section?.[0] === "website")) notFound();
  return <RoleSection role="owner" locale={locale} section={section} />;
}
