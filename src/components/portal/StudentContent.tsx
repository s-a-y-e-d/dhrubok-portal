"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { PortalPageState } from "./PortalPageState";

export function StudentNotices({ locale }: { locale: "bn" | "en" }) {
  const notices = useQuery(api.notices.functions.listForStudent, {});
  const markRead = useMutation(api.notices.functions.markRead);
  const bn = locale === "bn";
  if (!notices) return <PortalPageState state="loading" locale={locale} />;
  return <><header className="portal-page-header"><p className="eyebrow">{bn ? "হালনাগাদ" : "Updates"}</p><h1>{bn ? "আমার নোটিশ" : "My notices"}</h1></header>{notices.length ? <div className="notice-list">{notices.map(({ notice, readAt }) => { const canMarkRead = notice.audienceType !== "public" && readAt === null; return <article key={notice._id}><p className="meta-line">{notice.audienceType === "public" ? (bn ? "সবার জন্য" : "Public") : readAt ? (bn ? "পঠিত" : "Read") : (bn ? "নতুন" : "New")}</p><h2>{bn ? notice.titleBn : notice.titleEn}</h2><p>{bn ? notice.bodyBn : notice.bodyEn}</p>{canMarkRead && <button className="button button-secondary" onClick={() => void markRead({ noticeId: notice._id })}>{bn ? "পঠিত হিসেবে চিহ্নিত করুন" : "Mark as read"}</button>}</article>; })}</div> : <PortalPageState state="empty" locale={locale} emptyTitle={bn ? "নোটিশ নেই" : "No notices"} />}</>;
}
