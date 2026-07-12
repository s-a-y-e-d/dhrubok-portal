import { notFound } from "next/navigation";
import { AttendanceReportPrint } from "@/components/portal/AttendanceReportPrint";
import { isLocale } from "@/lib/i18n/config";

const localDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(Date.now());
const validDate = (value: string | undefined) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;

export default async function TeacherAttendanceReport({ params, searchParams }: { params: Promise<{ locale: string; batchId: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const [{ locale, batchId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const to = validDate(query.to) ?? localDate();
  const from = validDate(query.from) ?? `${to.slice(0, 7)}-01`;
  if (from > to) notFound();
  return <AttendanceReportPrint locale={locale} batchId={batchId} from={from} to={to} />;
}
