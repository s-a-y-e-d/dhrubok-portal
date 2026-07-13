import { notFound } from "next/navigation";
import { ExamSubjectAnalysisPrint } from "@/components/portal/ExamSubjectAnalysisPrint";
import { isLocale } from "@/lib/i18n/config";

export default async function SubjectAnalysisPage({
  params,
}: {
  params: Promise<{ locale: string; examId: string }>;
}) {
  const { locale, examId } = await params;
  if (!isLocale(locale)) notFound();
  return <ExamSubjectAnalysisPrint locale={locale} examId={examId} />;
}
