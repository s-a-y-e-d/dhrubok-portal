/* eslint-disable @next/next/no-img-element -- Public Convex media uses expiring signed URLs. */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { publicMetadata } from "../_metadata";
import { Search, BookOpen, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const bn = locale === "bn";
  return publicMetadata({
    locale,
    path: "/courses",
    title: bn ? "কোর্সসমূহ" : "Courses",
    description: bn
      ? "ধ্রুবক কোচিং সেন্টারের সক্রিয় পাবলিক কোর্স ও ভর্তি তথ্য দেখুন।"
      : "Explore active public courses and admission information from Dhrubok Coaching Centre.",
  });
}

export default async function CoursesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const courses = await fetchQuery(api.publicSite.public.listCourses, { locale, limit: 50 });
  const bn = locale === "bn";

  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim().toLocaleLowerCase(locale) ?? "";

  const visible = query
    ? courses.filter((course) =>
        `${course.name.value} ${course.shortDescription.value} ${course.slug}`
          .toLocaleLowerCase(locale)
          .includes(query)
      )
    : courses;

  return (
    <div className="container py-10 flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col gap-3 max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          {bn ? "একাডেমিক" : "Academic"}
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {bn ? "কোর্সসমূহ" : "Courses"}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          {bn ? "বর্তমানে চালু ও প্রকাশিত কোর্সগুলোর বিবরণ ও ভর্তি সংক্রান্ত তথ্য দেখুন।" : "Explore currently active and published courses and admission details."}
        </p>
      </div>

      {/* Search Bar */}
      <form role="search" className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder={bn ? "কোর্স বা বিষয়ের নাম লিখুন..." : "Search by course or topic..."}
            className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
        >
          {bn ? "খুঁজুন" : "Search"}
        </button>
      </form>

      {/* Course Cards Grid */}
      {visible.length ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((course) => (
            <article
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-emerald-500/50 hover:shadow-lg"
              key={course.id}
            >
              {course.coverUrl ? (
                <div className="overflow-hidden aspect-video">
                  <img
                    src={course.coverUrl}
                    alt={course.name.value}
                    width={960}
                    height={540}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center bg-muted">
                  <BookOpen className="size-10 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {course.slug}
                </span>
                <h2 className="mt-1.5 text-xl font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {course.name.value}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground leading-relaxed">
                  {course.shortDescription.value}
                </p>
                <div className="mt-auto pt-5 flex items-center justify-between border-t border-border/60">
                  <Link
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                    href={`/${locale}/courses/${course.slug}`}
                  >
                    <span>{bn ? "কোর্সের বিস্তারিত" : "Course details"}</span>
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <p>
            {query
              ? bn
                ? "এই অনুসন্ধানে কোনো কোর্স পাওয়া যায়নি।"
                : "No courses match this search query."
              : bn
              ? "কোনো প্রকাশিত কোর্স নেই।"
              : "No courses are currently published."}
          </p>
        </div>
      )}
    </div>
  );
}
