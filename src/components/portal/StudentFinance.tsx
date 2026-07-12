"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { PortalPageState } from "./PortalPageState";

const page = { numItems: 100, cursor: null } as const;
const money = (minor: number, locale: "bn" | "en") => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", { style: "currency", currency: "BDT" }).format(minor / 100);

export function StudentFinance({ locale }: { locale: "bn" | "en" }) {
  const profile = useQuery(api.students.self.getMyProfile, {});
  const charges = useQuery(api.finance.functions.listCharges, profile ? { studentId: profile.studentId, paginationOpts: page } : "skip");
  const payments = useQuery(api.finance.functions.listPayments, profile ? { studentId: profile.studentId, paginationOpts: page } : "skip");
  const bn = locale === "bn";
  if (!profile || !charges || !payments) return <PortalPageState state="loading" locale={locale} />;
  return <><header className="portal-page-header"><p className="eyebrow">{bn ? "হিসাব" : "Account"}</p><h1>{bn ? "ফি, পেমেন্ট ও রশিদ" : "Fees, payments, and receipts"}</h1></header>
    <section className="section"><h2>{bn ? "চার্জ ও বকেয়া" : "Charges and dues"}</h2>{charges.page.length ? <div className="table-wrap"><table><thead><tr><th>{bn ? "চার্জ" : "Charge"}</th><th>{bn ? "তারিখ" : "Due"}</th><th>{bn ? "মোট" : "Amount"}</th><th>{bn ? "পরিশোধ" : "Paid"}</th><th>{bn ? "অবস্থা" : "Status"}</th></tr></thead><tbody>{charges.page.map((charge) => <tr key={charge.chargeId}><td>{charge.description}<small>{charge.chargeNumber}</small></td><td>{charge.dueDate}</td><td>{money(charge.netAmountMinor, locale)}</td><td>{money(charge.paidAmountMinor, locale)}</td><td>{charge.status}</td></tr>)}</tbody></table></div> : <p className="empty-panel">{bn ? "কোনো ফি চার্জ নেই।" : "No fee charges."}</p>}</section>
    <section className="section"><h2>{bn ? "পেমেন্ট ও রশিদ" : "Payments and receipts"}</h2>{payments.page.length ? <div className="table-wrap"><table><thead><tr><th>{bn ? "রশিদ" : "Receipt"}</th><th>{bn ? "তারিখ" : "Date"}</th><th>{bn ? "পরিমাণ" : "Amount"}</th><th>{bn ? "পদ্ধতি" : "Method"}</th><th>{bn ? "অবস্থা" : "Status"}</th></tr></thead><tbody>{payments.page.map((payment) => <tr key={payment.paymentId}><td><Link href={`/${locale}/student/receipt/${payment.paymentId}`}>{payment.receiptNumber}</Link></td><td>{new Date(payment.paidAt).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-BD")}</td><td>{money(payment.amountMinor, locale)}</td><td>{payment.method}</td><td>{payment.status}</td></tr>)}</tbody></table></div> : <p className="empty-panel">{bn ? "কোনো পেমেন্ট নেই।" : "No payments."}</p>}</section>
  </>;
}
