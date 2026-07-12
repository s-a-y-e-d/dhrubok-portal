import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { descriptionFrom, publicMetadata } from "../../_metadata";

export const dynamic = "force-dynamic";
async function getNotice(locale: "bn" | "en", noticeId: string) { try { return await fetchQuery(api.publicSite.public.getNotice, { locale, noticeId: noticeId as Id<"notices"> }); } catch { return null; } }
export async function generateMetadata({ params }: { params: Promise<{ locale: string; noticeId: string }> }): Promise<Metadata> { const { locale, noticeId } = await params; if (!isLocale(locale)) return {}; const notice = await getNotice(locale, noticeId); if (!notice) return {}; return publicMetadata({ locale, path: `/notices/${noticeId}`, title: notice.title.value, description: descriptionFrom(notice.body.value, locale === "bn" ? "ধ্রুবক কোচিং সেন্টারের পাবলিক নোটিশ।" : "A public notice from Dhrubok Coaching Centre."), type: "article" }); }
export default async function NoticeDetail({ params }: { params: Promise<{ locale: string; noticeId: string }> }) { const { locale, noticeId } = await params; if (!isLocale(locale)) notFound(); const notice = await getNotice(locale, noticeId); if (!notice) notFound(); const bn = locale === "bn"; return <article className="section container narrow"><p className="eyebrow"><time dateTime={new Date(notice.publishedAt).toISOString()}>{new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", { dateStyle: "long", timeZone: "Asia/Dhaka" }).format(notice.publishedAt)}</time></p><h1>{notice.title.value}</h1><div className="prose-copy">{notice.body.value}</div></article>; }
