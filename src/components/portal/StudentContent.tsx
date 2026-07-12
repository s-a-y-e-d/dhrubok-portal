"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";

function MaterialAction({ materialId, kind, externalUrl, locale }: { materialId: Id<"materials">; kind: "file" | "link" | "text"; externalUrl?: string; locale: "bn" | "en" }) {
  const downloadUrl = useQuery(api.materials.functions.getDownloadUrl, kind === "file" ? { materialId } : "skip");
  const label = locale === "bn" ? "খুলুন বা ডাউনলোড করুন" : "Open or download";
  if (kind === "link" && externalUrl) return <a className="button button-secondary" href={externalUrl} target="_blank" rel="noreferrer">{label}</a>;
  if (kind === "file" && downloadUrl) return <a className="button button-secondary" href={downloadUrl} target="_blank" rel="noreferrer">{label}</a>;
  return null;
}

export function StudentMaterials({ locale }: { locale: "bn" | "en" }) {
  const materials = useQuery(api.materials.functions.listForStudent, {});
  const bn = locale === "bn";
  if (!materials) return <PortalPageState state="loading" locale={locale} />;
  return <><header className="portal-page-header"><p className="eyebrow">{bn ? "শেখার উপকরণ" : "Learning"}</p><h1>{bn ? "ম্যাটেরিয়াল" : "Materials"}</h1></header>{materials.length ? <div className="card-grid">{materials.map((material) => <article className="content-card" key={material._id}><p className="eyebrow">{material.kind}</p><h2>{bn ? material.titleBn : material.titleEn}</h2><p>{bn ? material.descriptionBn : material.descriptionEn}</p><MaterialAction materialId={material._id} kind={material.kind} externalUrl={material.externalUrl} locale={locale} /></article>)}</div> : <PortalPageState state="empty" locale={locale} emptyTitle={bn ? "ম্যাটেরিয়াল নেই" : "No materials"} />}</>;
}

export function StudentNotices({ locale }: { locale: "bn" | "en" }) {
  const notices = useQuery(api.notices.functions.listForStudent, {});
  const markRead = useMutation(api.notices.functions.markRead);
  const bn = locale === "bn";
  if (!notices) return <PortalPageState state="loading" locale={locale} />;
  return <><header className="portal-page-header"><p className="eyebrow">{bn ? "হালনাগাদ" : "Updates"}</p><h1>{bn ? "আমার নোটিশ" : "My notices"}</h1></header>{notices.length ? <div className="notice-list">{notices.map(({ notice, readAt }) => { const canMarkRead = notice.audienceType !== "public" && readAt === null; return <article key={notice._id}><p className="meta-line">{notice.audienceType === "public" ? (bn ? "সবার জন্য" : "Public") : readAt ? (bn ? "পঠিত" : "Read") : (bn ? "নতুন" : "New")}</p><h2>{bn ? notice.titleBn : notice.titleEn}</h2><p>{bn ? notice.bodyBn : notice.bodyEn}</p>{canMarkRead && <button className="button button-secondary" onClick={() => void markRead({ noticeId: notice._id })}>{bn ? "পঠিত হিসেবে চিহ্নিত করুন" : "Mark as read"}</button>}</article>; })}</div> : <PortalPageState state="empty" locale={locale} emptyTitle={bn ? "নোটিশ নেই" : "No notices"} />}</>;
}
