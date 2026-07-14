/* eslint-disable @next/next/no-img-element -- Public Convex media uses expiring signed URLs. */
import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { descriptionFrom, publicMetadata } from "../../_metadata";

export const dynamic = "force-dynamic";
const weekdays = { bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"], en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] };
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params; if (!isLocale(locale)) return {};
  const course = await fetchQuery(api.publicSite.public.getCourse, { slug, locale }); if (!course) return {};
  return publicMetadata({ locale, path: `/courses/${encodeURIComponent(slug)}`, title: course.name.value, description: descriptionFrom(course.description.value || course.shortDescription.value, locale === "bn" ? "কোর্সের বিষয়, ব্যাচ ও ক্লাস রুটিন দেখুন।" : "View subjects, batches, and the class schedule for this course.") });
}

export default async function CourseDetail({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params; if (!isLocale(locale)) notFound();
  const course = await fetchQuery(api.publicSite.public.getCourse, { slug, locale }); if (!course) notFound(); const bn = locale === "bn";
  const batchNames = new Map(course.batches.map((batch) => [batch.id, batch.name.value]));
  return <section className="section container narrow">{course.coverUrl && <img src={course.coverUrl} alt="" width={960} height={540} style={{ width: "100%", height: "auto" }} />}<p className="eyebrow">{course.slug}</p><h1>{course.name.value}</h1><p className="lead-copy">{course.description.value || course.shortDescription.value}</p><div className="detail-grid"><div><h2>{bn ? "বিষয়সমূহ" : "Subjects"}</h2>{course.subjects.length ? <ul className="clean-list">{course.subjects.map((subject) => <li key={subject.id}>{subject.name.value}</li>)}</ul> : <p>{bn ? "বিষয়ের তথ্য শিগগিরই যোগ হবে।" : "Subject information will be added soon."}</p>}</div><div><h2>{bn ? "ভর্তি চালু ব্যাচ" : "Open batches"}</h2>{course.batches.filter((batch) => batch.admissionOpen).length ? <ul className="clean-list">{course.batches.filter((batch) => batch.admissionOpen).map((batch) => <li key={batch.id}><strong>{batch.name.value}</strong></li>)}</ul> : <p>{bn ? "এই মুহূর্তে কোনো ব্যাচে ভর্তি চালু নেই।" : "No batch is currently open for admission."}</p>}</div></div><div><h2>{bn ? "সাপ্তাহিক সময়সূচি" : "Weekly schedule"}</h2>{course.schedules.length ? <div className="table-wrap"><table><thead><tr><th>{bn ? "ব্যাচ" : "Batch"}</th><th>{bn ? "দিন" : "Day"}</th><th>{bn ? "সময়" : "Time"}</th></tr></thead><tbody>{course.schedules.sort((a, b) => a.weekday - b.weekday || a.startMinutes - b.startMinutes).map((schedule) => <tr key={schedule.id}><td>{batchNames.get(schedule.batchId)}</td><td>{weekdays[locale][schedule.weekday]}</td><td>{clock(schedule.startMinutes)}–{clock(schedule.endMinutes)}</td></tr>)}</tbody></table></div> : <p className="empty-panel">{bn ? "পাবলিক সময়সূচি এখনো যোগ হয়নি।" : "No public schedule has been added yet."}</p>}</div><Link className="button button-primary" href={`/${locale}/admission?course=${course.id}`}>{bn ? "এই কোর্সে আবেদন করুন" : "Apply for this course"}</Link></section>;
}
