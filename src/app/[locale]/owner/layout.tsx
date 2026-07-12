import { notFound } from "next/navigation";
import { PortalGate, PortalShell } from "@/components/portal";
import { isLocale } from "@/lib/i18n/config";

export default async function OwnerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <PortalGate expectedRole="owner" locale={locale}><PortalShell role="owner" locale={locale}>{children}</PortalShell></PortalGate>;
}
