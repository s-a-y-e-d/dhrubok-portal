"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { PortalPageState } from "./PortalPageState";

const money = (minor: number, locale: "bn" | "en") =>
  new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    style: "currency",
    currency: "BDT",
  }).format(minor / 100);
const date = (value: number, locale: "bn" | "en") =>
  new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Dhaka",
  }).format(value);

export function StudentFinance({ locale }: { locale: "bn" | "en" }) {
  const profile = useQuery(api.students.self.getMyProfile, {});
  const ledger = useQuery(
    api.reports.finance.studentLedger,
    profile ? { studentId: profile.studentId, limit: 200 } : "skip",
  );
  const bn = locale === "bn";
  if (!profile || !ledger)
    return <PortalPageState state="loading" locale={locale} />;
  const summary = ledger.summary;
  return (
    <div className="finance-workspace student-finance space-y-5">
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "হিসাব" : "Account"}</p>
        <h1>{bn ? "ফি স্টেটমেন্ট" : "Finance statement"}</h1>
        <p>
          {bn
            ? "চার্জ, ছাড়, পেমেন্ট, বরাদ্দ ও সমন্বয়ের সম্পূর্ণ বিবরণ।"
            : "A complete explanation of charges, concessions, payments, allocations, and adjustments."}
        </p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [bn ? "মোট চার্জ" : "Charged", summary?.totalChargedMinor ?? 0],
          [bn ? "পরিশোধ" : "Paid", summary?.totalPaidMinor ?? 0],
          [bn ? "বকেয়া" : "Outstanding", summary?.outstandingMinor ?? 0],
          [bn ? "অগ্রিম" : "Advance credit", summary?.advanceCreditMinor ?? 0],
        ].map(([label, value], index) => (
          <article key={String(label)} className="finance-stat-card">
            <p className="finance-stat-card-label">{label}</p>
            <strong
              className={`finance-stat-card-value ${
                index === 1
                  ? "finance-payment"
                  : index === 2 && Number(value) > 0
                    ? "finance-money-overdue"
                    : index === 3
                      ? "finance-credit"
                      : ""
              }`}
            >
              {money(Number(value), locale)}
            </strong>
          </article>
        ))}
      </section>
      {ledger.agreements[0] && (
        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="font-semibold">
            {bn ? "বর্তমান ফি চুক্তি" : "Current fee agreement"}
          </h2>
          <p className="mt-2 text-sm">
            {ledger.agreements[0].agreementNumber} ·{" "}
            {ledger.agreements[0].effectiveFrom}
            {ledger.agreements[0].effectiveTo
              ? ` – ${ledger.agreements[0].effectiveTo}`
              : ""}{" "}
            · {ledger.agreements[0].status}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {ledger.agreements[0].reason}
          </p>
        </section>
      )}
      {ledger.truncated && (
        <p className="warning-panel">
          {bn
            ? "সাম্প্রতিক ২০০টি লেনদেন দেখানো হয়েছে।"
            : "The latest 200 ledger events are shown."}
        </p>
      )}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {bn ? "লেনদেনের সময়রেখা" : "Finance timeline"}
          </h2>
          <Link
            className="text-link"
            href={`/${locale}/student/statement/${profile.studentId}`}
          >
            {bn ? "প্রিন্ট স্টেটমেন্ট" : "Print statement"}
          </Link>
        </div>
        {ledger.timeline.length ? (
          <div className="space-y-2">
            {ledger.timeline.map((event) => (
              <article
                key={`${event.kind}:${event.id}`}
                className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium uppercase dark:bg-neutral-900">
                      {event.kind === "charge"
                        ? bn
                          ? "চার্জ"
                          : "Charge"
                        : event.kind === "payment"
                          ? bn
                            ? "পেমেন্ট"
                            : "Payment"
                          : bn
                            ? "সমন্বয়"
                            : "Adjustment"}
                    </span>
                    <h3 className="mt-2 font-semibold">
                      {event.kind === "charge"
                        ? bn
                          ? event.descriptionBn
                          : event.descriptionEn
                        : event.kind === "adjustment"
                          ? `${event.adjustmentType.replaceAll("_", " ")} — ${event.reason}`
                          : event.reference}
                    </h3>
                    <p className="text-sm text-neutral-500">
                      {event.reference} · {date(event.date, locale)} ·{" "}
                      {event.status}
                    </p>
                  </div>
                  <strong
                    className={
                      event.kind === "payment"
                        ? "finance-money finance-payment"
                        : "finance-money"
                    }
                  >
                    {event.kind === "payment" ? "−" : "+"}
                    {money(event.amountMinor, locale)}
                  </strong>
                </div>
                {event.kind === "charge" && (
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {bn ? "ছাড়" : "Discount"}:{" "}
                    {money(event.discountMinor, locale)} ·{" "}
                    {bn ? "পরিশোধ" : "Paid"}: {money(event.paidMinor, locale)}
                  </p>
                )}
                {event.kind === "payment" && (
                  <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {event.allocations.map((allocation, index) => (
                      <p key={index}>
                        {bn
                          ? allocation.descriptionBn
                          : allocation.descriptionEn}
                        : {money(allocation.amountMinor, locale)}
                      </p>
                    ))}
                    {event.advanceMinor > 0 && (
                      <p>
                        {bn ? "অগ্রিম হিসাবে রাখা" : "Held as advance"}:{" "}
                        {money(event.advanceMinor, locale)}
                      </p>
                    )}
                    {event.refundedMinor > 0 && (
                      <p>
                        {bn ? "ফেরত" : "Refunded"}:{" "}
                        {money(event.refundedMinor, locale)}
                      </p>
                    )}
                    <Link
                      href={`/${locale}/student/receipt/${event.id}`}
                      className="text-link mt-2 inline-block font-medium"
                    >
                      {bn ? "রসিদ দেখুন" : "View receipt"}
                    </Link>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-panel">
            {bn ? "কোনো আর্থিক লেনদেন নেই।" : "No finance activity yet."}
          </p>
        )}
      </section>
    </div>
  );
}
