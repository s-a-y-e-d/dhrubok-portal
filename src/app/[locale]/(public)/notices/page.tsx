import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { publicMetadata } from "../_metadata";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> { const { locale } = await params; if (!isLocale(locale)) return {}; const bn = locale === "bn"; return publicMetadata({ locale, path: "/notices", title: bn ? "নোটিশ" : "Notices", description: bn ? "ধ্রুবক কোচিং সেন্টারের সর্বশেষ পাবলিক নোটিশ ও হালনাগাদ পড়ুন।" : "Read the latest public notices and updates from Dhrubok Coaching Centre." }); }
export default async function NoticesPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) notFound(); const notices = await fetchQuery(api.publicSite.public.listNotices, { locale, limit: 50 }); const bn = locale === "bn"; return <section className="section container narrow"><p className="eyebrow">{bn ? "হালনাগাদ" : "Updates"}</p><h1>{bn ? "নোটিশ" : "Notices"}</h1>{notices.length ? <div className="notice-list">{notices.map((notice) => <article key={notice.id}><p className="meta-line"><time dateTime={new Date(notice.publishedAt).toISOString()}>{new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(notice.publishedAt)}</time></p><h2><Link href={`/${locale}/notices/${notice.id}`}>{notice.title.value}</Link></h2><p>{notice.body.value}</p></article>)}</div> : <p className="empty-panel">{bn ? "কোনো প্রকাশিত নোটিশ নেই।" : "There are no published notices."}</p>}</section>; }
