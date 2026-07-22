"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight, Trophy } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalPageState } from "./PortalPageState";

function percentage(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

export function OwnerStudentResults({ locale, studentId }: { locale: "bn" | "en"; studentId: string }) {
  const bn = locale === "bn";
  const result = useQuery(api.reports.exams.ownerStudentResults, { studentId: studentId as Id<"students"> });
  if (result === undefined) return <PortalPageState state="loading" locale={locale} />;
  if (result === null) return <PortalPageState state="error" locale={locale} errorMessage={bn ? "শিক্ষার্থী পাওয়া যায়নি।" : "Student not found."} />;
  const t = (bangla: string, english: string) => bn ? bangla : english;
  const stats = [
    [t("প্রকাশিত পরীক্ষা", "Published exams"), String(result.summary.totalPublishedExams)],
    [t("পাস", "Passed"), String(result.summary.passCount)],
    [t("ফেল", "Failed"), String(result.summary.failCount)],
    [t("গড় শতাংশ", "Average percentage"), percentage(result.summary.averagePercentage)],
    [t("সর্বোচ্চ শতাংশ", "Highest percentage"), percentage(result.summary.highestPercentage)],
    [t("পাসের হার", "Overall pass rate"), percentage(result.summary.passRate)],
  ];

  return <div className="reports-workspace">
    <header className="portal-page-header">
      <p className="eyebrow">{t("শিক্ষার্থীর ফলাফল", "Student results")}</p>
      <h1>{result.student.displayName}</h1>
      <p className="font-mono text-sm">{result.student.studentNumber}</p>
    </header>
    {!result.results.length ? <PortalPageState state="empty" locale={locale} emptyTitle={t("এখনও কোনো ফল প্রকাশিত হয়নি", "No results published yet")} /> : <>
      <section className="reports-summary-grid" aria-label={t("ফলাফলের সারসংক্ষেপ", "Results summary")}>
        {stats.map(([label, value]) => <Card key={label}><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="font-mono text-2xl">{value}</CardTitle></CardHeader></Card>)}
      </section>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy />{t("প্রকাশিত ফলাফল", "Published results")}</CardTitle><CardDescription>{t("সম্পূর্ণ ফলাফল দেখতে একটি পরীক্ষা খুলুন।", "Open an exam to view its complete result.")}</CardDescription></CardHeader>
        <CardContent className="p-0"><div className="table-wrap"><table><thead><tr><th>{t("পরীক্ষা", "Exam")}</th><th>{t("তারিখ", "Date")}</th><th>{t("নম্বর", "Score")}</th><th>{t("শতাংশ", "Percentage")}</th><th>{t("ফল", "Outcome")}</th><th><span className="sr-only">{t("খুলুন", "Open")}</span></th></tr></thead><tbody>{result.results.map((row) => <tr key={row.examId}><td><strong>{bn ? row.examNameBn : row.examNameEn}</strong><div className="font-mono text-xs text-[var(--ink-mute)]">{row.examNumber}</div></td><td>{row.examDate}</td><td className="font-mono">{(row.totalScoreScaled / 100).toFixed(2)} / {(row.totalFullMarksScaled / 100).toFixed(2)}</td><td className="font-mono">{percentage(row.percentage)}</td><td><Badge variant={row.passed ? "success" : "danger"}>{row.passed ? t("পাস", "Pass") : t("ফেল", "Fail")}</Badge></td><td><Link className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[var(--ink)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href={`/${locale}/owner/reports/exams/${row.examId}/students/${result.student.studentId}`}>{t("ফলাফল দেখুন", "View result")}<ArrowRight className="size-4" /></Link></td></tr>)}</tbody></table></div></CardContent>
      </Card>
    </>}
  </div>;
}
