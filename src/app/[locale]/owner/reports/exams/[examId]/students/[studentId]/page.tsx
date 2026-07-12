import { notFound } from "next/navigation";
import { PublishedResultPrint } from "@/components/portal/ExamReportPrint";
import { isLocale } from "@/lib/i18n/config";

export default async function OwnerStudentResult({ params }: { params: Promise<{ locale: string; examId: string; studentId: string }> }) {
  const { locale, examId, studentId } = await params;
  if (!isLocale(locale)) notFound();
  return <PublishedResultPrint locale={locale} examId={examId} studentId={studentId} />;
}
