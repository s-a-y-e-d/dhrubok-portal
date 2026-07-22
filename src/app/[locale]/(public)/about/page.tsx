/* eslint-disable @next/next/no-img-element -- Public Convex media uses expiring signed URLs. */

import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { descriptionFrom, publicMetadata } from "../_metadata";
import { Award, BookOpen, ShieldCheck, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await fetchQuery(api.publicSite.public.getContentBlock, { key: "about_summary", locale });
  const bn = locale === "bn";
  return publicMetadata({
    locale,
    path: "/about",
    title: content?.title.value || (bn ? "আমাদের সম্পর্কে" : "About us"),
    description: descriptionFrom(
      content?.body.value ?? "",
      bn ? "ধ্রুবক কোচিং সেন্টার সম্পর্কে জানুন।" : "Learn about Dhrubok Coaching Centre."
    ),
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const content = await fetchQuery(api.publicSite.public.getContentBlock, { key: "about_summary", locale });
  const bn = locale === "bn";

  return (
    <div className="container max-w-4xl py-10 flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          {bn ? "ধ্রুবক সম্পর্কে" : "About Dhrubok"}
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {content?.title.value || (bn ? "আমাদের সম্পর্কে" : "About us")}
        </h1>
      </div>

      {content?.mediaUrl && (
        <div className="overflow-hidden rounded-2xl border border-border shadow-lg">
          <img src={content.mediaUrl} alt="" width={960} height={540} className="h-auto w-full object-cover max-h-[420px]" />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 md:p-8">
        <div className="prose prose-slate dark:prose-invert max-w-none text-base text-foreground leading-relaxed whitespace-pre-line">
          {content?.body.value || (bn ? "এই অংশের তথ্য শিগগিরই প্রকাশ করা হবে।" : "This section will be published soon.")}
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <BookOpen className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-foreground">{bn ? "পরিকল্পিত কারিকুলাম" : "Structured Curriculum"}</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {bn ? "সিলেবাসভিত্তিক ধারাবাহিক পড়াশোনা ও নিয়মিত মূল্যায়নের ব্যবস্থা।" : "Syllabus-aligned structured study plans and regular assessments."}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Users className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-foreground">{bn ? "অভিজ্ঞ শিক্ষকমণ্ডলী" : "Experienced Faculty"}</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {bn ? "দক্ষ ও অভিজ্ঞ শিক্ষকদের প্রত্যক্ষ তত্ত্বাবধানে শিক্ষাদান।" : "Guidance under highly qualified and experienced teachers."}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-foreground">{bn ? "অভিভাবক আপডেট" : "Guardian Updates"}</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {bn ? "উপস্থিতি, ফি ও পরীক্ষার ফলাফলের নিয়মিত এসএমএস বার্তা।" : "Instant SMS notifications for attendance, fees, and exam results."}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Award className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-foreground">{bn ? "স্বচ্ছ মূল্যায়ন" : "Transparent Evaluation"}</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {bn ? "অফলাইন এক্সাম ট্র্যাকিং ও মেরিট পজিশনসহ রিপোর্ট কার্ড।" : "Offline exam tracking and merit-position based report cards."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
