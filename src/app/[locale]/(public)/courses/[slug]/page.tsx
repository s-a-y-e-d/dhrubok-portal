/* eslint-disable @next/next/no-img-element -- Public Convex media uses expiring signed URLs. */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { descriptionFrom, publicMetadata } from "../../_metadata";
import { ArrowRight, BookOpen, Calendar, Clock, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

const weekdays = {
  bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const course = await fetchQuery(api.publicSite.public.getCourse, { slug, locale });
  if (!course) return {};
  return publicMetadata({
    locale,
    path: `/courses/${encodeURIComponent(slug)}`,
    title: course.name.value,
    description: descriptionFrom(
      course.description.value || course.shortDescription.value,
      locale === "bn"
        ? "কোর্সের বিষয়, ব্যাচ ও ক্লাস রুটিন দেখুন।"
        : "View subjects, batches, and the class schedule for this course."
    ),
  });
}

export default async function CourseDetail({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const course = await fetchQuery(api.publicSite.public.getCourse, { slug, locale });
  if (!course) notFound();

  const bn = locale === "bn";
  const batchNames = new Map(course.batches.map((batch) => [batch.id, batch.name.value]));
  const openBatches = course.batches.filter((batch) => batch.admissionOpen);

  return (
    <div className="container max-w-4xl py-10 flex flex-col gap-10">
      {/* Cover Image & Header */}
      <div className="flex flex-col gap-6">
        {course.coverUrl && (
          <div className="overflow-hidden rounded-2xl border border-border shadow-lg">
            <img src={course.coverUrl} alt={course.name.value} width={960} height={540} className="h-auto w-full object-cover max-h-[420px]" />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {course.slug}
            </span>
            {openBatches.length > 0 && (
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950">
                {bn ? "ভর্তি চলছে" : "Admissions Open"}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {course.name.value}
          </h1>

          <p className="text-base text-muted-foreground leading-relaxed">
            {course.description.value || course.shortDescription.value}
          </p>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Subjects Card */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <BookOpen className="size-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-foreground">{bn ? "বিষয়সমূহ" : "Subjects"}</h2>
          </div>
          {course.subjects.length ? (
            <ul className="flex flex-col gap-2.5">
              {course.subjects.map((subject) => (
                <li key={subject.id} className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  <span>{subject.name.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{bn ? "বিষয়ের তথ্য শিগগিরই যোগ হবে।" : "Subject information will be added soon."}</p>
          )}
        </div>

        {/* Open Batches Card */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Calendar className="size-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-foreground">{bn ? "ভর্তি চালু ব্যাচ" : "Open batches"}</h2>
          </div>
          {openBatches.length ? (
            <ul className="flex flex-col gap-2.5">
              {openBatches.map((batch) => (
                <li key={batch.id} className="flex items-center justify-between rounded-lg bg-muted/60 px-3.5 py-2.5 text-sm font-semibold text-foreground">
                  <span>{batch.name.value}</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Open</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{bn ? "এই মুহূর্তে কোনো ব্যাচে ভর্তি চালু নেই।" : "No batch is currently open for admission."}</p>
          )}
        </div>
      </div>

      {/* Weekly Schedule Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Clock className="size-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-xl font-bold text-foreground">{bn ? "সাপ্তাহিক সময়সূচি" : "Weekly schedule"}</h2>
        </div>

        {course.schedules.length ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{bn ? "ব্যাচ" : "Batch"}</th>
                  <th className="px-4 py-3">{bn ? "দিন" : "Day"}</th>
                  <th className="px-4 py-3">{bn ? "সময়" : "Time"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {course.schedules
                  .sort((a, b) => a.weekday - b.weekday || a.startMinutes - b.startMinutes)
                  .map((schedule) => (
                    <tr key={schedule.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold text-foreground">{batchNames.get(schedule.batchId)}</td>
                      <td className="px-4 py-3 text-foreground">{weekdays[locale][schedule.weekday]}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {clock(schedule.startMinutes)} – {clock(schedule.endMinutes)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
            <p>{bn ? "পাবলিক সময়সূচি এখনো যোগ হয়নি।" : "No public schedule has been added yet."}</p>
          </div>
        )}
      </div>

      {/* CTA Box */}
      <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 sm:flex-row">
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <h3 className="text-xl font-bold text-foreground">
            {bn ? "এই কোর্সে ভর্তি হতে চান?" : "Want to join this course?"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {bn ? "অনলাইনে ফরম পূরণ করুন, কর্তৃপক্ষ সরাসরি আপনার সাথে যোগাযোগ করবে।" : "Complete the online application and centre authorities will review your admission."}
          </p>
        </div>

        <Link
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 font-semibold text-slate-950 shadow-md hover:bg-emerald-400 transition-colors shrink-0"
          href={`/${locale}/admission`}
        >
          <span>{bn ? "এই কোর্সে আবেদন করুন" : "Apply for this course"}</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
