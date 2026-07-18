import { notFound } from "next/navigation";
import { ReceiptPrint } from "@/components/portal/ReceiptPrint";
import { isLocale } from "@/lib/i18n/config";

export default async function FinanceReceiptPage({ params }: { params: Promise<{ locale: string; collectionId: string }> }) {
  const { locale, collectionId } = await params;
  if (!isLocale(locale)) notFound();
  return <ReceiptPrint locale={locale} collectionId={collectionId} />;
}
