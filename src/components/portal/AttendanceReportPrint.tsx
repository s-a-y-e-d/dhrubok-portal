"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";
import { ReportPrintFrame } from "./ReportPrintFrame";

const pagination = { numItems: 500, cursor: null } as const;

interface AttendanceReportPrintProps {
  locale: "bn" | "en";
  batchId: string;
  from: string;
  to: string;
}

export function AttendanceReportPrint({ locale, batchId, from, to }: AttendanceReportPrintProps) {
  const id = batchId as Id<"batches">;
  const fromAt = Date.parse(`${from}T00:00:00+06:00`);
  const toAt = Date.parse(`${to}T00:00:00+06:00`) + 86_400_000;
  const header = useQuery(api.reports.academic.batchHeader, { batchId: id });
  const attendance = useQuery(api.reports.academic.batchAttendance, { batchId: id, fromAt, toAt, paginationOpts: pagination });
  const bn = locale === "bn";
  if (header === undefined || attendance === undefined) return <PortalPageState state="loading" locale={locale} />;
  const counts = attendance.page.reduce((totals, row) => ({ ...totals, [row.status]: totals[row.status] + 1 }), { present: 0, late: 0, absent: 0 });
  return (
    <ReportPrintFrame locale={locale} eyebrow={`${from} — ${to}`} title={bn ? "ব্যাচ উপস্থিতি রিপোর্ট" : "Batch attendance report"} subtitle={`${bn ? header.batchNameBn : header.batchNameEn} · ${bn ? header.courseNameBn : header.courseNameEn}`}>
      <div className="metric-grid"><article className="metric-card"><p>{bn ? "উপস্থিত" : "Present"}</p><strong>{counts.present}</strong></article><article className="metric-card warning"><p>{bn ? "বিলম্ব" : "Late"}</p><strong>{counts.late}</strong></article><article className="metric-card danger"><p>{bn ? "অনুপস্থিত" : "Absent"}</p><strong>{counts.absent}</strong></article></div>
      {!attendance.isDone ? <p className="warning-panel">{bn ? "প্রথম ৫০০টি রেকর্ড দেখানো হয়েছে; পরবর্তী পৃষ্ঠা আলাদাভাবে নিন।" : "Only the first 500 records are shown; export subsequent pages separately."}</p> : null}
      <div className="table-wrap"><table><thead><tr><th>{bn ? "তারিখ" : "Date"}</th><th>{bn ? "শিক্ষার্থী" : "Student"}</th><th>{bn ? "আইডি" : "ID"}</th><th>{bn ? "অবস্থা" : "Status"}</th><th>{bn ? "জমা" : "Submitted"}</th></tr></thead><tbody>{attendance.page.map((row) => <tr key={row.attendanceId}><td>{row.sessionDate}</td><td>{row.studentName}</td><td>{row.studentNumber}</td><td>{row.status}</td><td>{new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(row.submittedAt)}</td></tr>)}</tbody></table></div>
    </ReportPrintFrame>
  );
}
