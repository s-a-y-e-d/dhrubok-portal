"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";
import { ReportPrintFrame } from "./ReportPrintFrame";

function money(value: number, locale: "bn" | "en") {
  return new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", { style: "currency", currency: "BDT" }).format(value / 100);
}

export function StudentStatementPrint({ locale, studentId }: { locale: "bn" | "en"; studentId: string }) {
  const statement = useQuery(api.reports.finance.studentStatement, { studentId: studentId as Id<"students">, chargeLimit: 500, paymentLimit: 500 });
  const bn = locale === "bn";
  if (statement === undefined) return <PortalPageState state="loading" locale={locale} />;
  return (
    <ReportPrintFrame locale={locale} eyebrow={statement.student.studentNumber} title={bn ? "শিক্ষার্থী হিসাব বিবরণী" : "Student account statement"} subtitle={`${statement.student.displayName} · ${bn ? "অভিভাবক" : "Guardian"}: ${statement.student.guardianName}`}>
      <div className="metric-grid"><article className="metric-card"><p>{bn ? "মোট চার্জ" : "Charged"}</p><strong>{money(statement.summary.totalChargedMinor, locale)}</strong></article><article className="metric-card"><p>{bn ? "পরিশোধ" : "Paid"}</p><strong>{money(statement.summary.totalPaidMinor, locale)}</strong></article><article className="metric-card danger"><p>{bn ? "বকেয়া" : "Outstanding"}</p><strong>{money(statement.summary.outstandingMinor, locale)}</strong></article></div>
      {statement.truncated ? <p className="warning-panel">{bn ? "সর্বশেষ ৫০০টি চার্জ ও ৫০০টি পেমেন্ট দেখানো হয়েছে।" : "The latest 500 charges and 500 payments are shown."}</p> : null}
      <div className="section-heading"><h2>{bn ? "চার্জ" : "Charges"}</h2></div>
      <div className="table-wrap"><table><thead><tr><th>{bn ? "চার্জ" : "Charge"}</th><th>{bn ? "বিবরণ" : "Description"}</th><th>{bn ? "নির্ধারিত" : "Due"}</th><th>{bn ? "মোট" : "Amount"}</th><th>{bn ? "পরিশোধ" : "Paid"}</th><th>{bn ? "অবস্থা" : "Status"}</th></tr></thead><tbody>{statement.charges.map((row) => <tr key={row.chargeNumber}><td>{row.chargeNumber}</td><td>{bn ? row.descriptionBn : row.descriptionEn}</td><td>{row.dueDate}</td><td>{money(row.netAmountMinor, locale)}</td><td>{money(row.paidAmountMinor, locale)}</td><td>{row.status}</td></tr>)}</tbody></table></div>
      <div className="section-heading report-gap"><h2>{bn ? "পেমেন্ট" : "Payments"}</h2></div>
      <div className="table-wrap"><table><thead><tr><th>{bn ? "রশিদ" : "Receipt"}</th><th>{bn ? "তারিখ" : "Date"}</th><th>{bn ? "পদ্ধতি" : "Method"}</th><th>{bn ? "পরিমাণ" : "Amount"}</th><th>{bn ? "অবস্থা" : "Status"}</th></tr></thead><tbody>{statement.payments.map((row) => <tr key={row.receiptNumber}><td>{row.receiptNumber}</td><td>{new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(row.paidAt)}</td><td>{row.method}</td><td>{money(row.amountMinor, locale)}</td><td>{row.status}</td></tr>)}</tbody></table></div>
    </ReportPrintFrame>
  );
}
