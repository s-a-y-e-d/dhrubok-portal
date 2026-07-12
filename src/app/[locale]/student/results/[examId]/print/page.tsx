import { notFound } from "next/navigation";
import { PublishedResultPrint } from "@/components/portal/ExamReportPrint";
import { isLocale } from "@/lib/i18n/config";

export default async function StudentResultPrint({ params }: { params: Promise<{ locale: string; examId: string }> }) {
  const { locale, examId } = await params;
  if (!isLocale(locale)) notFound();
  return <PublishedResultPrint locale={locale} examId={examId} />;
}
