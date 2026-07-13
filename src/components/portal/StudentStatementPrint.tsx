"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";
import { ReportPrintFrame } from "./ReportPrintFrame";

const money = (value: number, locale: "bn" | "en") =>
  new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    style: "currency",
    currency: "BDT",
  }).format(value / 100);
const date = (value: number, locale: "bn" | "en") =>
  new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Dhaka",
  }).format(value);

export function StudentStatementPrint({
  locale,
  studentId,
}: {
  locale: "bn" | "en";
  studentId: string;
}) {
  const id = studentId as Id<"students">;
  const statement = useQuery(api.reports.finance.studentStatement, {
    studentId: id,
    chargeLimit: 500,
    paymentLimit: 500,
  });
  const ledger = useQuery(api.reports.finance.studentLedger, {
    studentId: id,
    limit: 300,
  });
  const bn = locale === "bn";
  if (!statement || !ledger)
    return <PortalPageState state="loading" locale={locale} />;
  const agreement = ledger.agreements[0];
  return (
    <ReportPrintFrame
      locale={locale}
      eyebrow={statement.student.studentNumber}
      title={bn ? "শিক্ষার্থী হিসাব বিবরণী" : "Student account statement"}
      subtitle={`${statement.student.displayName} · ${bn ? "অভিভাবক" : "Guardian"}: ${statement.student.guardianName}`}
    >
      <div className="metric-grid">
        <article className="metric-card">
          <p>{bn ? "মোট চার্জ" : "Charged"}</p>
          <strong>{money(statement.summary.totalChargedMinor, locale)}</strong>
        </article>
        <article className="metric-card">
          <p>{bn ? "ছাড়" : "Concessions"}</p>
          <strong>{money(statement.summary.totalDiscountMinor, locale)}</strong>
        </article>
        <article className="metric-card">
          <p>{bn ? "পরিশোধ" : "Paid"}</p>
          <strong>{money(statement.summary.totalPaidMinor, locale)}</strong>
        </article>
        <article className="metric-card danger">
          <p>{bn ? "বকেয়া" : "Outstanding"}</p>
          <strong>{money(statement.summary.outstandingMinor, locale)}</strong>
        </article>
        <article className="metric-card">
          <p>{bn ? "অগ্রিম" : "Advance credit"}</p>
          <strong>{money(statement.summary.advanceCreditMinor, locale)}</strong>
        </article>
      </div>
      {agreement && (
        <section className="report-gap">
          <div className="section-heading">
            <h2>{bn ? "ফি চুক্তি" : "Fee agreement"}</h2>
          </div>
          <p>
            <strong>{agreement.agreementNumber}</strong> ·{" "}
            {agreement.effectiveFrom}
            {agreement.effectiveTo ? ` – ${agreement.effectiveTo}` : ""} ·{" "}
            {agreement.status}
          </p>
          <p>{agreement.reason}</p>
        </section>
      )}
      {(statement.truncated || ledger.truncated) && (
        <p className="warning-panel">
          {bn
            ? "প্রদর্শনের সীমার কারণে সাম্প্রতিক লেনদেন দেখানো হয়েছে।"
            : "Recent activity is shown because the statement reached its display limit."}
        </p>
      )}
      <div className="section-heading report-gap">
        <h2>{bn ? "চার্জ" : "Charges"}</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{bn ? "চার্জ" : "Charge"}</th>
              <th>{bn ? "বিবরণ" : "Description"}</th>
              <th>{bn ? "তারিখ" : "Due"}</th>
              <th>{bn ? "পরিমাণ" : "Amount"}</th>
              <th>{bn ? "পরিশোধ" : "Settled"}</th>
              <th>{bn ? "অবস্থা" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {statement.charges.map((row) => (
              <tr key={row.chargeNumber}>
                <td>{row.chargeNumber}</td>
                <td>{bn ? row.descriptionBn : row.descriptionEn}</td>
                <td>{row.dueDate}</td>
                <td>{money(row.netAmountMinor, locale)}</td>
                <td>{money(row.paidAmountMinor, locale)}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="section-heading report-gap">
        <h2>{bn ? "পেমেন্ট ও বরাদ্দ" : "Payments and allocations"}</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{bn ? "রসিদ" : "Receipt"}</th>
              <th>{bn ? "তারিখ" : "Date"}</th>
              <th>{bn ? "পদ্ধতি" : "Method"}</th>
              <th>{bn ? "বরাদ্দ" : "Allocations"}</th>
              <th>{bn ? "পরিমাণ" : "Amount"}</th>
              <th>{bn ? "অবস্থা" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {ledger.timeline
              .filter((row) => row.kind === "payment")
              .map((row) => (
                <tr key={row.id}>
                  <td>{row.reference}</td>
                  <td>{date(row.date, locale)}</td>
                  <td>{row.kind === "payment" ? row.method : ""}</td>
                  <td>
                    {row.kind === "payment" ? (
                      <>
                        {row.allocations.map((allocation, index) => (
                          <span key={index} style={{ display: "block" }}>
                            {bn
                              ? allocation.descriptionBn
                              : allocation.descriptionEn}
                            : {money(allocation.amountMinor, locale)}
                          </span>
                        ))}
                        {row.advanceMinor > 0 && (
                          <span>
                            {bn ? "অগ্রিম" : "Advance"}:{" "}
                            {money(row.advanceMinor, locale)}
                          </span>
                        )}
                      </>
                    ) : null}
                  </td>
                  <td>{money(row.amountMinor, locale)}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="section-heading report-gap">
        <h2>{bn ? "সমন্বয়" : "Adjustments"}</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{bn ? "নম্বর" : "Number"}</th>
              <th>{bn ? "তারিখ" : "Date"}</th>
              <th>{bn ? "ধরন" : "Type"}</th>
              <th>{bn ? "কারণ" : "Reason"}</th>
              <th>{bn ? "পরিমাণ" : "Amount"}</th>
              <th>{bn ? "অবস্থা" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {ledger.timeline
              .filter((row) => row.kind === "adjustment")
              .map((row) => (
                <tr key={row.id}>
                  <td>{row.reference}</td>
                  <td>{date(row.date, locale)}</td>
                  <td>{row.kind === "adjustment" ? row.adjustmentType : ""}</td>
                  <td>{row.kind === "adjustment" ? row.reason : ""}</td>
                  <td>{money(row.amountMinor, locale)}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </ReportPrintFrame>
  );
}
