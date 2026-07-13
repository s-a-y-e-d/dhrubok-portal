import { StudentStatementPrint } from "@/components/portal/StudentStatementPrint";

export default async function StudentStatementPage({
  params,
}: PageProps<"/[locale]/student/statement/[studentId]">) {
  const { locale: rawLocale, studentId } = await params;
  const locale = rawLocale === "en" ? "en" : "bn";
  return <StudentStatementPrint locale={locale} studentId={studentId} />;
}
