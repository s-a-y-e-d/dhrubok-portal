/* eslint-disable @next/next/no-img-element -- Public Convex media uses expiring signed URLs. */

import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { publicMetadata } from "../_metadata";
import { GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const bn = locale === "bn";
  return publicMetadata({
    locale,
    path: "/teachers",
    title: bn ? "শিক্ষকবৃন্দ" : "Our teachers",
    description: bn
      ? "ধ্রুবক কোচিং সেন্টারের প্রকাশিত শিক্ষক পরিচিতি, যোগ্যতা ও অভিজ্ঞতা দেখুন।"
      : "Meet the published faculty of Dhrubok Coaching Centre and learn about their qualifications.",
  });
}

export default async function TeachersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const teachers = await fetchQuery(api.publicSite.public.listTeachers, { locale, limit: 50 });
  const bn = locale === "bn";

  return (
    <div className="container py-10 flex flex-col gap-10">
      <div className="flex flex-col gap-3 max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          {bn ? "শিক্ষক পরিচিতি" : "Faculty"}
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {bn ? "আমাদের শিক্ষকবৃন্দ" : "Our teachers"}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          {bn
            ? "অভিজ্ঞ ও নিবেদিতপ্রাণ শিক্ষক মণ্ডলীর তত্ত্বাবধানে শিক্ষার্থীদের ধারাবাহিক অগ্রগতি নিশ্চিত করা হয়।"
            : "Learn with experienced and dedicated faculty committed to guiding every student towards excellence."}
        </p>
      </div>

      {teachers.length ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((teacher) => (
            <article
              className="flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center transition-all hover:border-emerald-500/40 hover:shadow-md"
              key={teacher.id}
            >
              {teacher.photoUrl ? (
                <img
                  src={teacher.photoUrl}
                  alt={teacher.name.value || teacher.displayName}
                  width={640}
                  height={640}
                  className="size-28 rounded-full object-cover ring-4 ring-emerald-500/20 shadow-md"
                />
              ) : (
                <div className="flex size-28 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 font-bold text-3xl ring-4 ring-emerald-500/20 shadow-md">
                  {(teacher.name.value || teacher.displayName).charAt(0)}
                </div>
              )}

              <h2 className="mt-4 text-xl font-bold text-foreground">
                {teacher.name.value || teacher.displayName}
              </h2>

              {teacher.qualifications?.value && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <GraduationCap className="size-3.5" />
                  <span>{teacher.qualifications.value}</span>
                </div>
              )}

              {teacher.bio?.value && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {teacher.bio.value}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <p>{bn ? "কোনো শিক্ষক প্রোফাইল প্রকাশিত হয়নি।" : "No teacher profiles are currently published."}</p>
        </div>
      )}
    </div>
  );
}
