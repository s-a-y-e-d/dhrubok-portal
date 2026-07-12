/* eslint-disable @next/next/no-img-element -- Public Convex media uses expiring signed URLs. */
import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { publicMetadata } from "../_metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params; if (!isLocale(locale)) return {}; const bn = locale === "bn";
  return publicMetadata({ locale, path: "/courses", title: bn ? "কোর্সসমূহ" : "Courses", description: bn ? "ধ্রুবক কোচিং সেন্টারের সক্রিয় পাবলিক কোর্স ও ভর্তি তথ্য দেখুন।" : "Explore active public courses and admission information from Dhrubok Coaching Centre." });
}

export default async function CoursesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[] }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const courses = await fetchQuery(api.publicSite.public.listCourses, { locale, limit: 50 }); const bn = locale === "bn";
  const rawQuery = (await searchParams).q; const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim().toLocaleLowerCase(locale) ?? "";
  const visible = query ? courses.filter((course) => `${course.name.value} ${course.shortDescription.value} ${course.slug}`.toLocaleLowerCase(locale).includes(query)) : courses;
  return <section className="section container"><p className="eyebrow">{bn ? "একাডেমিক" : "Academic"}</p><h1>{bn ? "কোর্সসমূহ" : "Courses"}</h1><p className="lead-copy">{bn ? "বর্তমানে চালু ও প্রকাশিত কোর্সগুলো দেখুন।" : "Explore currently active and published courses."}</p><form role="search" className="operation-form"><label>{bn ? "কোর্স খুঁজুন" : "Search courses"}<input name="q" type="search" defaultValue={query} placeholder={bn ? "নাম বা বিষয় লিখুন" : "Search by name or topic"} /></label><button className="button button-secondary">{bn ? "খুঁজুন" : "Search"}</button></form>{visible.length ? <div className="card-grid">{visible.map((course) => <article className="content-card" key={course.id}>{course.coverUrl && <img src={course.coverUrl} alt="" width={960} height={540} style={{ width: "100%", height: "auto" }} />}<h2>{course.name.value}</h2><p>{course.shortDescription.value}</p><Link href={`/${locale}/courses/${course.slug}`}>{bn ? "কোর্সের বিস্তারিত" : "Course details"}</Link></article>)}</div> : <p className="empty-panel">{query ? (bn ? "এই অনুসন্ধানে কোনো কোর্স পাওয়া যায়নি।" : "No courses match this search.") : (bn ? "কোনো প্রকাশিত কোর্স নেই।" : "No courses are published.")}</p>}</section>;
}
