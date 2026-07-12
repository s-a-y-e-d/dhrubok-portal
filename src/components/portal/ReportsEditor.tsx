"use client";

import type { FormEvent } from "react";
import { useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import { PortalPageState } from "./PortalPageState";

const pagination = { numItems: 100, cursor: null } as const;
const startOfDay = (value: string) => Date.parse(`${value}T00:00:00+06:00`);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(Date.now());
const monthStart = () => `${today().slice(0, 7)}-01`;

function downloadCsv(payload: { filename: string; contentType: string; content: string }) {
  const url = URL.createObjectURL(new Blob([payload.content], { type: payload.contentType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = payload.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function value(form: HTMLFormElement, key: string) {
  return String(new FormData(form).get(key) ?? "");
}

export function ReportsEditor({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const from = params.get("from") || monthStart();
  const to = params.get("to") || today();
  const fromAt = startOfDay(from);
  const toAt = startOfDay(to) + 86_400_000;
  const collections = useQuery(api.reports.finance.collections, { fromAt, toAt, paginationOpts: pagination });
  const dues = useQuery(api.reports.finance.dues, { paginationOpts: pagination });
  const methods = useQuery(api.reports.finance.paymentMethodBreakdown, { fromAt, toAt });
  const funnel = useQuery(api.reports.operations.admissionsFunnel, { fromAt, toAt });
  const collectionsCsv = useQuery(api.reports.exports.collectionsCsv, { fromAt, toAt, locale });
  const duesCsv = useQuery(api.reports.exports.duesCsv, { locale });
  const workspace = useQuery(api.academics.options.ownerWorkspace, {});
  const students = useQuery(api.students.owner.listStudents, { status: "active", paginationOpts: pagination });
  const exams = useQuery(api.exams.functions.listManaged, {});
  if (!collections || !dues || !methods || !funnel || !collectionsCsv || !duesCsv || !workspace || !students || !exams) return <PortalPageState state="loading" locale={locale} />;
  const total = collections.page.reduce((sum, payment) => sum + payment.amountMinor, 0);

  function openAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const batchId = value(event.currentTarget, "batchId");
    if (batchId) router.push(`/${locale}/owner/reports/attendance/${batchId}?from=${from}&to=${to}`);
  }

  function openExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const examId = value(event.currentTarget, "examId");
    const report = value(event.currentTarget, "report");
    if (examId && report) router.push(`/${locale}/owner/reports/exams/${examId}/${report}`);
  }

  function openStatement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const studentId = value(event.currentTarget, "studentId");
    if (studentId) router.push(`/${locale}/owner/reports/students/${studentId}/statement`);
  }

  function openIndividualResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const examId = value(event.currentTarget, "examId");
    const studentId = value(event.currentTarget, "studentId");
    if (examId && studentId) router.push(`/${locale}/owner/reports/exams/${examId}/students/${studentId}`);
  }

  return <>
    <header className="portal-page-header" data-print-hidden><p className="eyebrow">{bn ? "অপারেশনাল রিপোর্ট" : "Operational reports"}</p><h1>{bn ? "রিপোর্ট, CSV ও প্রিন্ট" : "Reports, CSV, and print"}</h1><p>{bn ? "ফিল্টার URL-এ থাকে, তাই ভিউ বুকমার্ক বা শেয়ার করা যায়।" : "Filters persist in the URL so views can be bookmarked or shared."}</p></header>
    <form className="report-filters" data-print-hidden onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = new URLSearchParams(params); next.set("from", String(data.get("from"))); next.set("to", String(data.get("to"))); router.replace(`${pathname}?${next}`); }}>
      <label>{bn ? "শুরু" : "From"}<input name="from" type="date" defaultValue={from} /></label><label>{bn ? "শেষ" : "To"}<input name="to" type="date" defaultValue={to} /></label><button className="button button-secondary">{bn ? "প্রয়োগ" : "Apply"}</button><button className="button button-ghost" type="button" onClick={() => window.print()}>{bn ? "সারাংশ প্রিন্ট" : "Print summary"}</button>
    </form>
    <section className="report-panels" data-print-hidden>
      <article><h2>{bn ? "উপস্থিতি রিপোর্ট" : "Attendance report"}</h2><form className="compact-form" onSubmit={openAttendance}><label>{bn ? "ব্যাচ" : "Batch"}<select name="batchId" required defaultValue=""><option value="" disabled>{bn ? "ব্যাচ বাছুন" : "Select batch"}</option>{workspace.batches.map((batch) => <option key={batch.batchId} value={batch.batchId}>{bn ? batch.nameBn : batch.nameEn}</option>)}</select></label><button className="button button-secondary">{bn ? "A4 রিপোর্ট খুলুন" : "Open A4 report"}</button></form></article>
      <article><h2>{bn ? "পরীক্ষা রিপোর্ট" : "Exam report"}</h2><form className="compact-form" onSubmit={openExam}><label>{bn ? "পরীক্ষা" : "Exam"}<select name="examId" required defaultValue=""><option value="" disabled>{bn ? "পরীক্ষা বাছুন" : "Select exam"}</option>{exams.filter((exam) => exam.status === "published").map((exam) => <option key={exam.examId} value={exam.examId}>{bn ? exam.nameBn : exam.nameEn}</option>)}</select></label><label>{bn ? "রিপোর্ট" : "Report"}<select name="report" defaultValue="result-sheet"><option value="result-sheet">{bn ? "ফলাফল শিট" : "Result sheet"}</option><option value="merit-list">{bn ? "মেধাতালিকা" : "Merit list"}</option></select></label><button className="button button-secondary">{bn ? "A4 রিপোর্ট খুলুন" : "Open A4 report"}</button></form></article>
      <article><h2>{bn ? "শিক্ষার্থী হিসাব" : "Student statement"}</h2><form className="compact-form" onSubmit={openStatement}><label>{bn ? "শিক্ষার্থী" : "Student"}<select name="studentId" required defaultValue=""><option value="" disabled>{bn ? "শিক্ষার্থী বাছুন" : "Select student"}</option>{students.page.map((student) => <option key={student.studentId} value={student.studentId}>{student.studentNumber} · {student.displayName}</option>)}</select></label><button className="button button-secondary">{bn ? "A4 বিবরণী খুলুন" : "Open A4 statement"}</button></form></article>
      <article><h2>{bn ? "ব্যক্তিগত ফলাফল" : "Individual result"}</h2><form className="compact-form" onSubmit={openIndividualResult}><label>{bn ? "পরীক্ষা" : "Exam"}<select name="examId" required defaultValue=""><option value="" disabled>{bn ? "পরীক্ষা বাছুন" : "Select exam"}</option>{exams.filter((exam) => exam.status === "published").map((exam) => <option key={exam.examId} value={exam.examId}>{bn ? exam.nameBn : exam.nameEn}</option>)}</select></label><label>{bn ? "শিক্ষার্থী" : "Student"}<select name="studentId" required defaultValue=""><option value="" disabled>{bn ? "শিক্ষার্থী বাছুন" : "Select student"}</option>{students.page.map((student) => <option key={student.studentId} value={student.studentId}>{student.studentNumber} · {student.displayName}</option>)}</select></label><button className="button button-secondary">{bn ? "ফলাফল খুলুন" : "Open result"}</button></form></article>
    </section>
    <section className="report-sheet">
      <div className="report-title"><p className="eyebrow">{from} — {to}</p><h2>{bn ? "সংগ্রহ সারাংশ" : "Collections summary"}</h2></div>
      <div className="metric-grid"><article className="metric-card"><p>{bn ? "পেমেন্ট" : "Payments"}</p><strong>{collections.page.length}</strong></article><article className="metric-card"><p>{bn ? "সংগৃহীত" : "Collected"}</p><strong>৳ {(total / 100).toFixed(2)}</strong></article><article className="metric-card"><p>{bn ? "বকেয়া শিক্ষার্থী" : "Students with dues"}</p><strong>{dues.page.length}</strong></article></div>
      <div className="section-heading" data-print-hidden><h3>{bn ? "পেমেন্ট" : "Payments"}</h3><button className="button button-secondary" onClick={() => downloadCsv(collectionsCsv)}>{bn ? "সংগ্রহ CSV" : "Collections CSV"}</button></div>
      <div className="table-wrap"><table><thead><tr><th>{bn ? "রশিদ" : "Receipt"}</th><th>{bn ? "শিক্ষার্থী" : "Student"}</th><th>{bn ? "পদ্ধতি" : "Method"}</th><th>{bn ? "পরিমাণ" : "Amount"}</th><th>{bn ? "সময়" : "Paid at"}</th></tr></thead><tbody>{collections.page.map((row) => <tr key={row.paymentId}><td>{row.receiptNumber}</td><td>{row.studentNumber}<small>{row.studentName}</small></td><td>{row.method}</td><td>৳ {(row.amountMinor / 100).toFixed(2)}</td><td>{new Date(row.paidAt).toLocaleString()}</td></tr>)}</tbody></table></div>
      <div className="section-heading report-gap" data-print-hidden><h3>{bn ? "বকেয়া" : "Dues"}</h3><button className="button button-secondary" onClick={() => downloadCsv(duesCsv)}>{bn ? "বকেয়া CSV" : "Dues CSV"}</button></div>
      <div className="table-wrap"><table><thead><tr><th>{bn ? "শিক্ষার্থী" : "Student"}</th><th>{bn ? "বকেয়া" : "Outstanding"}</th><th>{bn ? "সময়োত্তীর্ণ" : "Overdue"}</th><th>{bn ? "অগ্রিম" : "Advance"}</th></tr></thead><tbody>{dues.page.map((row) => <tr key={row.studentId}><td>{row.studentNumber}<small>{row.studentName}</small></td><td>৳ {(row.outstandingMinor / 100).toFixed(2)}</td><td>৳ {(row.overdueMinor / 100).toFixed(2)}</td><td>৳ {(row.advanceCreditMinor / 100).toFixed(2)}</td></tr>)}</tbody></table></div>
      <div className="report-panels"><article><h3>{bn ? "পেমেন্ট পদ্ধতি" : "Payment methods"}</h3><ul>{methods.rows.map((row) => <li key={row.method}><span>{row.method}</span><strong>{row.paymentCount} · ৳ {(row.collectedMinor / 100).toFixed(2)}</strong></li>)}</ul></article><article><h3>{bn ? "ভর্তি ফানেল" : "Admissions funnel"}</h3><ul>{funnel.stages.map((row) => <li key={row.status}><span>{row.status}</span><strong>{row.count}</strong></li>)}</ul></article></div>
    </section>
  </>;
}
