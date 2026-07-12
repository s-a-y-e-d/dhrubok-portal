/* eslint-disable @next/next/no-img-element -- Public Convex media uses expiring signed URLs. */
import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { publicMetadata } from "../_metadata";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> { const { locale } = await params; if (!isLocale(locale)) return {}; const bn = locale === "bn"; return publicMetadata({ locale, path: "/teachers", title: bn ? "শিক্ষকবৃন্দ" : "Our teachers", description: bn ? "ধ্রুবক কোচিং সেন্টারের প্রকাশিত শিক্ষক পরিচিতি, যোগ্যতা ও অভিজ্ঞতা দেখুন।" : "Meet the published faculty of Dhrubok Coaching Centre and learn about their qualifications." }); }
export default async function TeachersPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) notFound(); const teachers = await fetchQuery(api.publicSite.public.listTeachers, { locale, limit: 50 }); const bn = locale === "bn"; return <section className="section container"><p className="eyebrow">{bn ? "শিক্ষক পরিচিতি" : "Faculty"}</p><h1>{bn ? "শিক্ষকবৃন্দ" : "Our teachers"}</h1>{teachers.length ? <div className="card-grid">{teachers.map((teacher) => <article className="content-card" key={teacher.id}>{teacher.photoUrl && <img src={teacher.photoUrl} alt="" width={640} height={640} style={{ width: "100%", height: "auto" }} />}<h2>{teacher.name.value || teacher.displayName}</h2><p className="meta-line">{teacher.qualifications.value}</p><p>{teacher.bio.value}</p></article>)}</div> : <p className="empty-panel">{bn ? "কোনো শিক্ষক প্রোফাইল প্রকাশিত হয়নি।" : "No teacher profiles are published."}</p>}</section>; }
