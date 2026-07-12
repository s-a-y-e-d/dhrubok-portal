"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";
import { ReportPrintFrame } from "./ReportPrintFrame";

const pagination = { numItems: 500, cursor: null } as const;

function score(value: number | null) {
  return value === null ? "—" : (value / 100).toFixed(2);
}

interface ExamReportPrintProps {
  locale: "bn" | "en";
  examId: string;
  variant: "result-sheet" | "merit-list";
}

export function ExamReportPrint({ locale, examId, variant }: ExamReportPrintProps) {
  const id = examId as Id<"exams">;
  const header = useQuery(api.reports.exams.header, { examId: id });
  const resultSheet = useQuery(api.reports.exams.resultSheet, variant === "result-sheet" ? { examId: id, entryStatus: "published", paginationOpts: pagination } : "skip");
  const meritList = useQuery(api.reports.exams.meritList, variant === "merit-list" ? { examId: id, paginationOpts: pagination } : "skip");
  const rows = variant === "result-sheet" ? resultSheet : meritList;
  const bn = locale === "bn";
  if (header === undefined || rows === undefined) return <PortalPageState state="loading" locale={locale} />;
  const title = variant === "merit-list" ? (bn ? "কোর্সভিত্তিক মেধাতালিকা" : "Course merit list") : (bn ? "প্রকাশিত ফলাফল শিট" : "Published result sheet");
  return (
    <ReportPrintFrame locale={locale} eyebrow={`${header.examNumber} · ${header.examDate}`} title={title} subtitle={`${bn ? header.examNameBn : header.examNameEn} · ${bn ? header.courseNameBn : header.courseNameEn}`}>
      <dl className="detail-list">
        <div><dt>{bn ? "পূর্ণমান" : "Full marks"}</dt><dd>{score(header.totalFullMarksScaled)}</dd></div>
        <div><dt>{bn ? "পাস নম্বর" : "Pass marks"}</dt><dd>{score(header.passMarksScaled)}</dd></div>
        <div><dt>{bn ? "ধরণ" : "Mode"}</dt><dd>{header.mode}</dd></div>
        <div><dt>{bn ? "প্রকাশনা" : "Publication"}</dt><dd>v{header.publicationVersion}</dd></div>
      </dl>
      {!rows.isDone ? <p className="warning-panel">{bn ? "রিপোর্টটি প্রথম ৫০০টি ফল দেখাচ্ছে। পরবর্তী পৃষ্ঠা আলাদাভাবে নিন।" : "This report shows the first 500 results. Export subsequent pages separately."}</p> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th>{bn ? "মেধা" : "Merit"}</th><th>{bn ? "শিক্ষার্থী" : "Student"}</th><th>{bn ? "আইডি" : "ID"}</th><th>{bn ? "অংশগ্রহণ" : "Participation"}</th><th>{bn ? "নম্বর" : "Score"}</th><th>{bn ? "ফল" : "Outcome"}</th></tr></thead>
          <tbody>{rows.page.map((row) => <tr key={row.resultId}><td>{row.meritPosition ?? "—"}</td><td>{row.studentName}</td><td>{row.studentNumber}</td><td>{row.participation}</td><td>{score(row.totalScoreScaled)} / {score(header.totalFullMarksScaled)}</td><td>{row.passed === null ? "—" : row.passed ? (bn ? "পাস" : "Pass") : (bn ? "ফেল" : "Fail")}</td></tr>)}</tbody>
        </table>
      </div>
    </ReportPrintFrame>
  );
}

interface PublishedResultPrintProps {
  locale: "bn" | "en";
  examId: string;
  studentId?: string;
}

export function PublishedResultPrint({ locale, examId, studentId }: PublishedResultPrintProps) {
  const result = useQuery(api.reports.exams.publishedResult, { examId: examId as Id<"exams">, studentId: studentId ? studentId as Id<"students"> : undefined });
  const bn = locale === "bn";
  if (result === undefined) return <PortalPageState state="loading" locale={locale} />;
  if (result === null) return <PortalPageState state="empty" locale={locale} emptyTitle={bn ? "প্রকাশিত ফল পাওয়া যায়নি" : "Published result not found"} />;
  const { header, student, result: marks } = result;
  return (
    <ReportPrintFrame locale={locale} eyebrow={`${header.examNumber} · ${header.examDate}`} title={bn ? "ব্যক্তিগত ফলাফল" : "Individual result"} subtitle={`${bn ? header.examNameBn : header.examNameEn} · ${bn ? header.courseNameBn : header.courseNameEn}`}>
      <dl className="detail-list">
        <div><dt>{bn ? "শিক্ষার্থী" : "Student"}</dt><dd>{student.displayName}</dd></div>
        <div><dt>{bn ? "আইডি" : "Student ID"}</dt><dd>{student.studentNumber}</dd></div>
        <div><dt>{bn ? "রোল" : "Roll"}</dt><dd>{student.rollNumber ?? "—"}</dd></div>
        <div><dt>{bn ? "প্রকাশনা" : "Publication"}</dt><dd>v{marks.publicationVersion}</dd></div>
      </dl>
      <table className="receipt-lines">
        <thead><tr><th>{bn ? "বিবরণ" : "Component"}</th><th>{bn ? "নম্বর" : "Score"}</th></tr></thead>
        <tbody>
          {header.mode !== "written" ? <tr><td>MCQ</td><td>{score(marks.mcqScoreScaled)}</td></tr> : null}
          {header.mode !== "mcq" ? <tr><td>{bn ? "লিখিত" : "Written"}</td><td>{score(marks.writtenScoreScaled)}</td></tr> : null}
        </tbody>
        <tfoot><tr><th>{bn ? "মোট" : "Total"}</th><th>{score(marks.totalScoreScaled)} / {score(header.totalFullMarksScaled)}</th></tr></tfoot>
      </table>
      <dl className="detail-list">
        <div><dt>{bn ? "ফল" : "Outcome"}</dt><dd>{marks.passed ? (bn ? "পাস" : "Pass") : (bn ? "ফেল" : "Fail")}</dd></div>
        <div><dt>{bn ? "মেধাস্থান" : "Merit position"}</dt><dd>{marks.meritPosition ?? "—"}</dd></div>
        <div><dt>{bn ? "অংশগ্রহণ" : "Participation"}</dt><dd>{marks.participation}</dd></div>
        <div><dt>{bn ? "প্রকাশের সময়" : "Published"}</dt><dd>{new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(marks.publishedAt)}</dd></div>
      </dl>
      {(bn ? marks.teacherCommentBn : marks.teacherCommentEn) ? <footer className="receipt-footer"><p>{bn ? marks.teacherCommentBn : marks.teacherCommentEn}</p><small>{bn ? "শিক্ষকের মন্তব্য" : "Teacher comment"}</small></footer> : null}
    </ReportPrintFrame>
  );
}
