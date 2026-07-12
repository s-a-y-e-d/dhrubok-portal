import { notFound } from "next/navigation";
import { PortalGate, PortalShell } from "@/components/portal";
import { isLocale } from "@/lib/i18n/config";

export default async function TeacherLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <PortalGate expectedRole="teacher" locale={locale}><PortalShell role="teacher" locale={locale}>{children}</PortalShell></PortalGate>;
}
