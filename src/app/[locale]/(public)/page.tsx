/* eslint-disable @next/next/no-img-element -- Public Convex media uses expiring signed URLs. */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { descriptionFrom, publicMetadata } from "./_metadata";
import {
  ArrowRight,
  BookOpen,
  Users,
  GraduationCap,
  PhoneCall,
  MapPin,
  CheckCircle2,
  Calendar,
} from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const hero = await fetchQuery(api.publicSite.public.getContentBlock, { key: "hero", locale });
  const bn = locale === "bn";
  const title = hero?.title.value || (bn ? "পরিকল্পিত শেখা, পরিষ্কার অগ্রগতি" : "Structured learning, clear progress");
  const description = descriptionFrom(
    hero?.body.value ?? "",
    bn ? "ধ্রুবক কোচিং সেন্টারের কোর্স, ভর্তি ও শিক্ষার্থী পোর্টাল।" : "Courses, admission, and student services from Dhrubok Coaching Centre."
  );
  return publicMetadata({ locale, title, description });
}

function PublicImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} width={960} height={540} className={className ?? "h-auto w-full object-cover"} />;
}

export default async function PublicHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [hero, achievement, courses, batches, teachers, gallery, contact, settings] = await Promise.all([
    fetchQuery(api.publicSite.public.getContentBlock, { key: "hero", locale }),
    fetchQuery(api.publicSite.public.getContentBlock, { key: "achievement_intro", locale }),
    fetchQuery(api.publicSite.public.listCourses, { locale, limit: 6 }),
    fetchQuery(api.publicSite.public.listOpenBatches, { locale, limit: 6 }),
    fetchQuery(api.publicSite.public.listTeachers, { locale, limit: 4 }),
    fetchQuery(api.publicSite.public.listGallery, { locale, limit: 6 }),
    fetchQuery(api.publicSite.public.getContentBlock, { key: "contact", locale }),
    fetchQuery(api.settings.getPublic, {}),
  ]);

  const bn = locale === "bn";
  const heroHref = hero?.primaryCtaHref || `/${locale}/admission`;
  const heroLabel = hero?.primaryCtaLabel.value || (bn ? "ভর্তির আবেদন" : "Apply for admission");
  const address = settings ? (bn ? settings.addressBn : settings.addressEn) : "";

  return (
    <div className="flex flex-col gap-16 py-10">
      {/* Hero Section */}
      <section className="container">
        <div className={`grid grid-cols-1 items-center gap-10 ${hero?.mediaUrl ? "lg:grid-cols-12" : "max-w-3xl"}`}>
          <div className={`flex flex-col items-start gap-5 ${hero?.mediaUrl ? "lg:col-span-7" : ""}`}>
            <p className="eyebrow">{bn ? "ধ্রুবক কোচিং সেন্টার" : "Dhrubok Coaching Centre"}</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl lg:text-5xl leading-[1.15]">
              {hero?.title.value || (bn ? "পরিকল্পিত শেখা, পরিষ্কার অগ্রগতি" : "Structured learning, clear progress")}
            </h1>
            <p className="hero-copy text-base text-[var(--ink-secondary)] leading-relaxed">
              {hero?.body.value ||
                (bn
                  ? "শিক্ষার্থী ও অভিভাবকের জন্য কোর্স, রুটিন, ফলাফল ও ফি—সব তথ্য এক জায়গায়।"
                  : "Courses, routines, results, and fees in one dependable place for students and guardians.")}
            </p>
            <div className="hero-actions flex flex-wrap items-center gap-3 pt-2">
              <Link className="button button-primary" href={heroHref}>
                <span>{heroLabel}</span>
                <ArrowRight className="size-4" />
              </Link>
              <Link className="button button-secondary" href={`/${locale}/courses`}>
                <span>{bn ? "কোর্স দেখুন" : "View courses"}</span>
              </Link>
            </div>
          </div>

          {hero?.mediaUrl && (
            <div className="lg:col-span-5 overflow-hidden rounded-xl border border-[var(--border)] shadow-sm">
              <PublicImage src={hero.mediaUrl} alt={hero.title.value} className="h-auto w-full object-cover max-h-[360px]" />
            </div>
          )}
        </div>

        {/* Stats Bar */}
        <div className="mt-12 grid grid-cols-2 gap-4 rounded-xl border border-[var(--border)] bg-[var(--canvas-soft)] p-6 md:grid-cols-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--ink)] font-bold">
              <BookOpen className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-[var(--ink)]">{courses.length > 0 ? `${courses.length}+` : "6+"}</span>
              <span className="text-xs text-[var(--ink-mute)] font-medium">{bn ? "চলমান কোর্স" : "Active Courses"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--ink)] font-bold">
              <Users className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-[var(--ink)]">{teachers.length > 0 ? `${teachers.length}` : "4+"}</span>
              <span className="text-xs text-[var(--ink-mute)] font-medium">{bn ? "অভিজ্ঞ শিক্ষক" : "Expert Teachers"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--ink)] font-bold">
              <GraduationCap className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-[var(--ink)]">{batches.length > 0 ? `${batches.length}` : "Open"}</span>
              <span className="text-xs text-[var(--ink-mute)] font-medium">{bn ? "খোলা ব্যাচ" : "Open Batches"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--ink)] font-bold">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-[var(--ink)]">SMS</span>
              <span className="text-xs text-[var(--ink-mute)] font-medium">{bn ? "অভিভাবক নোটিফিকেশন" : "Guardian SMS Alerts"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Active Courses Section */}
      <section className="container" aria-labelledby="courses-title">
        <div className="section-heading flex items-end justify-between border-b border-[var(--border)] pb-4 mb-8">
          <div>
            <p className="eyebrow">{bn ? "একাডেমিক" : "Academic"}</p>
            <h2 id="courses-title" className="text-2xl font-bold text-[var(--ink)] md:text-3xl">
              {bn ? "চলমান কোর্সসমূহ" : "Active courses"}
            </h2>
          </div>
          <Link className="text-link text-sm font-semibold text-[var(--brand-deep)] hover:underline inline-flex items-center gap-1" href={`/${locale}/courses`}>
            <span>{bn ? "সব কোর্স" : "All courses"}</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {courses.length ? (
          <div className="card-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <article
                className="content-card flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--canvas)] transition-all hover:border-[var(--brand)] hover:shadow-md"
                key={course.id}
              >
                {course.coverUrl && (
                  <div className="overflow-hidden aspect-video border-b border-[var(--border)]">
                    <PublicImage src={course.coverUrl} alt={course.name.value} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <p className="eyebrow">{course.slug}</p>
                  <h3 className="mt-1 text-lg font-bold text-[var(--ink)]">{course.name.value}</h3>
                  <p className="mt-2 text-sm text-[var(--ink-mute)] line-clamp-2 leading-relaxed">{course.shortDescription.value}</p>
                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-[var(--border-muted)]">
                    <Link className="text-link text-sm font-semibold text-[var(--brand-deep)] hover:underline inline-flex items-center gap-1" href={`/${locale}/courses/${course.slug}`}>
                      <span>{bn ? "বিস্তারিত" : "Details"}</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-panel text-center text-sm text-[var(--ink-mute)] py-8 border border-dashed border-[var(--border)] rounded-xl">
            {bn ? "প্রকাশিত কোর্স শিগগিরই এখানে দেখা যাবে।" : "Published courses will appear here soon."}
          </p>
        )}
      </section>

      {/* Open Batches Section */}
      <section className="container" aria-labelledby="batches-title">
        <div className="section-heading border-b border-[var(--border)] pb-4 mb-8">
          <div>
            <p className="eyebrow">{bn ? "ভর্তি চলছে" : "Admissions open"}</p>
            <h2 id="batches-title" className="text-2xl font-bold text-[var(--ink)] md:text-3xl">
              {bn ? "খোলা ব্যাচসমূহ" : "Open batches"}
            </h2>
          </div>
        </div>

        {batches.length ? (
          <div className="card-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {batches.map((batch) => (
              <article
                className="content-card flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--canvas)] p-5 hover:border-[var(--brand)] transition-colors"
                key={batch.id}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink)]">
                      {batch.courseName.value}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[var(--ink-mute)]">
                      <Calendar className="size-3" />
                      <span>Open</span>
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[var(--ink)] mt-1">{batch.name.value}</h3>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border-muted)] flex items-center justify-between">
                  <Link className="text-link text-xs font-semibold text-[var(--ink-secondary)] hover:text-[var(--ink)]" href={`/${locale}/courses/${batch.courseSlug}`}>
                    {bn ? "কোর্স ও ব্যাচ দেখুন" : "View course and batch"}
                  </Link>

                  <Link className="button button-primary text-xs py-1 px-3" href={`/${locale}/admission`}>
                    {bn ? "আবেদন করুন" : "Apply"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-panel text-center text-sm text-[var(--ink-mute)] py-8 border border-dashed border-[var(--border)] rounded-xl">
            {bn ? "এই মুহূর্তে কোনো পাবলিক ব্যাচে ভর্তি খোলা নেই।" : "No public batch is currently open for admission."}
          </p>
        )}
      </section>

      {/* Achievements Section */}
      {achievement && (
        <section className="container">
          <div className="rounded-xl border border-[var(--brand-soft)] bg-[var(--brand-muted)] p-8 md:p-10 text-center max-w-4xl mx-auto flex flex-col items-center gap-3">
            <p className="eyebrow">{bn ? "আমাদের অর্জন" : "Our achievements"}</p>
            <h2 className="text-2xl font-bold text-[var(--ink)] md:text-3xl">{achievement.title.value}</h2>
            <p className="lead-copy text-sm text-[var(--ink-secondary)] max-w-2xl leading-relaxed">{achievement.body.value}</p>
          </div>
        </section>
      )}

      {/* Teachers Directory */}
      <section className="container">
        <div className="section-heading flex items-end justify-between border-b border-[var(--border)] pb-4 mb-8">
          <div>
            <p className="eyebrow">{bn ? "শিক্ষকমণ্ডলী" : "Faculty"}</p>
            <h2 className="text-2xl font-bold text-[var(--ink)] md:text-3xl">{bn ? "আমাদের শিক্ষকবৃন্দ" : "Our teachers"}</h2>
          </div>
          <Link className="text-link text-sm font-semibold text-[var(--brand-deep)] hover:underline inline-flex items-center gap-1" href={`/${locale}/teachers`}>
            <span>{bn ? "সব শিক্ষক" : "All teachers"}</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {teachers.length ? (
          <div className="card-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {teachers.map((teacher) => (
              <article className="content-card flex flex-col items-center rounded-xl border border-[var(--border)] bg-[var(--canvas)] p-6 text-center" key={teacher.id}>
                {teacher.photoUrl ? (
                  <img src={teacher.photoUrl} alt="" className="size-20 rounded-full object-cover border-2 border-[var(--brand)] shadow-sm" />
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--ink)] font-bold text-xl border-2 border-[var(--brand)]">
                    {(teacher.name.value || teacher.displayName).charAt(0)}
                  </div>
                )}
                <h3 className="mt-3 text-base font-bold text-[var(--ink)]">{teacher.name.value || teacher.displayName}</h3>
                <p className="text-xs font-medium text-[var(--brand-deep)] mt-1">{teacher.qualifications.value}</p>
                <p className="mt-2 text-xs text-[var(--ink-mute)] line-clamp-2 leading-relaxed">{teacher.bio.value}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-panel text-center text-sm text-[var(--ink-mute)] py-8 border border-dashed border-[var(--border)] rounded-xl">
            {bn ? "প্রকাশিত শিক্ষক প্রোফাইল এখনো নেই।" : "No teacher profiles are published yet."}
          </p>
        )}
      </section>

      {/* Life at Dhrubok / Gallery */}
      {gallery.length > 0 && (
        <section className="container" aria-labelledby="gallery-title">
          <div className="section-heading border-b border-[var(--border)] pb-4 mb-8">
            <h2 id="gallery-title" className="text-2xl font-bold text-[var(--ink)] md:text-3xl">
              {bn ? "ধ্রুবকের মুহূর্ত" : "Life at Dhrubok"}
            </h2>
          </div>
          <div className="card-grid grid grid-cols-2 gap-4 md:grid-cols-3">
            {gallery.map((item) => (
              <figure className="content-card overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--canvas-soft)] aspect-video relative" key={item.id}>
                {item.imageUrl && <PublicImage src={item.imageUrl} alt={item.alt.value} className="h-full w-full object-cover" />}
                <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 p-3 text-xs font-medium text-white">
                  {item.title.value}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Contact Section */}
      {(contact || settings) && (
        <section className="container">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--canvas-soft)] p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2 max-w-xl">
                <p className="eyebrow">{bn ? "যোগাযোগ" : "Contact"}</p>
                <h2 className="text-2xl font-bold text-[var(--ink)] sm:text-3xl">
                  {contact?.title.value || (bn ? "আমাদের সাথে কথা বলুন" : "Talk to us")}
                </h2>
                {contact?.body.value && <p className="text-sm text-[var(--ink-secondary)]">{contact.body.value}</p>}
                {address && (
                  <p className="flex items-center gap-2 text-xs font-medium text-[var(--ink)] mt-2">
                    <MapPin className="size-4 text-[var(--brand-deep)] shrink-0" />
                    <span>{address}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {settings?.phone && (
                  <a className="button button-primary gap-2" href={`tel:+${settings.phone}`}>
                    <PhoneCall className="size-4" />
                    <span>{bn ? "ফোন করুন" : "Call us"}</span>
                  </a>
                )}
                <Link className="button button-secondary" href={`/${locale}/contact`}>
                  <span>{bn ? "ঠিকানা ও মানচিত্র" : "Address and map"}</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
