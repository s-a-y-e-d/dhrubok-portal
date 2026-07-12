import { notFound } from "next/navigation";
import { PortalGate, PortalShell } from "@/components/portal";
import { isLocale } from "@/lib/i18n/config";

export default async function StudentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <PortalGate expectedRole="student" locale={locale}><PortalShell role="student" locale={locale}>{children}</PortalShell></PortalGate>;
}
