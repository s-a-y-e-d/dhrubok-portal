"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { PortalPageState } from "./PortalPageState";

const page = { numItems: 100, cursor: null } as const;
const money = (minor: number, locale: "bn" | "en") => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", { style: "currency", currency: "BDT" }).format(minor / 100);

export function MessageHistory({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const [status, setStatus] = useState<"failed" | "queued" | "delivered" | undefined>();
  const messages = useQuery(api.messaging.functions.list, { paginationOpts: page, status });
  const balance = useQuery(api.messaging.templateFunctions.latestBalance, {});
  const retry = useMutation(api.messaging.functions.retry);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!messages || balance === undefined) return <PortalPageState state="loading" locale={locale} />;
  return <><header className="portal-page-header"><p className="eyebrow">SMS.BD</p><h1>{bn ? "বার্তা ডেলিভারি" : "Message delivery"}</h1>{balance && <p>{bn ? "ব্যালেন্স" : "Balance"}: {money(balance.balanceMinor ?? 0, locale)} · {balance.providerStatus}{balance.isLow ? ` · ${bn ? "কম ব্যালেন্স" : "Low balance"}` : ""}</p>}</header>
    {message && <p className="form-message" role="status">{message}</p>}
    <div className="status-filter"><button aria-pressed={status === undefined} onClick={() => setStatus(undefined)}>{bn ? "সব" : "All"}</button><button aria-pressed={status === "failed"} onClick={() => setStatus("failed")}>{bn ? "ব্যর্থ" : "Failed"}</button><button aria-pressed={status === "queued"} onClick={() => setStatus("queued")}>{bn ? "কিউ" : "Queued"}</button><button aria-pressed={status === "delivered"} onClick={() => setStatus("delivered")}>{bn ? "ডেলিভার্ড" : "Delivered"}</button></div>
    {messages.page.length ? <div className="table-wrap"><table><thead><tr><th>{bn ? "ইভেন্ট" : "Event"}</th><th>{bn ? "প্রাপক" : "Recipient"}</th><th>{bn ? "অবস্থা" : "Status"}</th><th>{bn ? "চেষ্টা/সেগমেন্ট" : "Attempts/segments"}</th><th>{bn ? "প্রোভাইডার" : "Provider"}</th><th>{bn ? "অ্যাকশন" : "Action"}</th></tr></thead><tbody>{messages.page.map((row) => <tr key={row.messageId}><td>{row.eventType}<small>{new Date(row.createdAt).toLocaleString(locale === "bn" ? "bn-BD" : "en-BD")}</small></td><td>{row.recipient}</td><td><span className={`status-pill ${row.status}`}>{row.status}</span></td><td>{row.attemptCount} / {row.segmentEstimate}</td><td>{row.providerStatus ?? "—"}</td><td>{row.status === "failed" && <button className="button button-secondary" disabled={retrying === row.messageId} onClick={() => { setRetrying(row.messageId); setMessage(null); retry({ messageId: row.messageId }).then(() => setMessage(bn ? "পুনরায় পাঠানো কিউ হয়েছে।" : "Retry queued.")).catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : "Retry failed")).finally(() => setRetrying(null)); }}>{bn ? "পুনরায় চেষ্টা" : "Retry"}</button>}</td></tr>)}</tbody></table></div> : <PortalPageState state="empty" locale={locale} emptyTitle={bn ? "কোনো SMS ইভেন্ট নেই" : "No SMS events"} />}
  </>;
}
