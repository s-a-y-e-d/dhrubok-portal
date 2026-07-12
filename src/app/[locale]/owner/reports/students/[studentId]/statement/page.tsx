import { notFound } from "next/navigation";
import { StudentStatementPrint } from "@/components/portal/StudentStatementPrint";
import { isLocale } from "@/lib/i18n/config";

export default async function OwnerStudentStatement({ params }: { params: Promise<{ locale: string; studentId: string }> }) {
  const { locale, studentId } = await params;
  if (!isLocale(locale)) notFound();
  return <StudentStatementPrint locale={locale} studentId={studentId} />;
}
