import { notFound } from "next/navigation";
import { RoleSection } from "@/components/portal";
import { isLocale } from "@/lib/i18n/config";

export default async function StudentSection({ params }: { params: Promise<{ locale: string; section?: string[] }> }) {
  const { locale, section } = await params; if (!isLocale(locale)) notFound();
  return <RoleSection role="student" locale={locale} section={section?.[0]} />;
}
