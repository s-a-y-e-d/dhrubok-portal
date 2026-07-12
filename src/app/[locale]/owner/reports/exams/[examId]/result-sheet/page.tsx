import { notFound } from "next/navigation";
import { ExamReportPrint } from "@/components/portal/ExamReportPrint";
import { isLocale } from "@/lib/i18n/config";

export default async function OwnerResultSheet({ params }: { params: Promise<{ locale: string; examId: string }> }) {
  const { locale, examId } = await params;
  if (!isLocale(locale)) notFound();
  return <ExamReportPrint locale={locale} examId={examId} variant="result-sheet" />;
}
