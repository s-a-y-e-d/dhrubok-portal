import { notFound } from "next/navigation";
import { OwnerStudentResults } from "@/components/portal/OwnerStudentResults";
import { isLocale } from "@/lib/i18n/config";

export default async function OwnerStudentResultsPage({ params }: { params: Promise<{ locale: string; studentId: string }> }) {
  const { locale, studentId } = await params;
  if (!isLocale(locale)) notFound();
  return <OwnerStudentResults locale={locale} studentId={studentId} />;
}
