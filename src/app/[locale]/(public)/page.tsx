/* eslint-disable @next/next/no-img-element -- Public Convex media uses expiring signed URLs. */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { descriptionFrom, publicMetadata } from "./_metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const hero = await fetchQuery(api.publicSite.public.getContentBlock, { key: "hero", locale });
  const bn = locale === "bn";
  const title = hero?.title.value || (bn ? "পরিকল্পিত শেখা, পরিষ্কার অগ্রগতি" : "Structured learning, clear progress");
  const description = descriptionFrom(hero?.body.value ?? "", bn ? "ধ্রুবক কোচিং সেন্টারের কোর্স, ভর্তি, নোটিশ ও শিক্ষার্থী পোর্টাল।" : "Courses, admission, notices, and student services from Dhrubok Coaching Centre.");
  return publicMetadata({ locale, title, description });
}

function PublicImage({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} width={960} height={540} style={{ width: "100%", height: "auto" }} />;
}

export default async function PublicHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [hero, achievement, courses, batches, teachers, notices, gallery, contact, settings] = await Promise.all([
    fetchQuery(api.publicSite.public.getContentBlock, { key: "hero", locale }),
    fetchQuery(api.publicSite.public.getContentBlock, { key: "achievement_intro", locale }),
    fetchQuery(api.publicSite.public.listCourses, { locale, limit: 6 }),
    fetchQuery(api.publicSite.public.listOpenBatches, { locale, limit: 6 }),
    fetchQuery(api.publicSite.public.listTeachers, { locale, limit: 4 }),
    fetchQuery(api.publicSite.public.listNotices, { locale, limit: 4 }),
    fetchQuery(api.publicSite.public.listGallery, { locale, limit: 6 }),
    fetchQuery(api.publicSite.public.getContentBlock, { key: "contact", locale }),
    fetchQuery(api.settings.getPublic, {}),
  ]);
  const bn = locale === "bn";
  const heroHref = hero?.primaryCtaHref || `/${locale}/admission`;
  const heroLabel = hero?.primaryCtaLabel.value || (bn ? "ভর্তির আবেদন" : "Apply for admission");
  const address = settings ? (bn ? settings.addressBn : settings.addressEn) : "";
  return <>
    <section className="hero container">
      <div>
        <p className="eyebrow">{bn ? "ধ্রুবক কোচিং সেন্টার" : "Dhrubok Coaching Centre"}</p>
        <h1>{hero?.title.value || (bn ? "পরিকল্পিত শেখা, পরিষ্কার অগ্রগতি" : "Structured learning, clear progress")}</h1>
        <p className="hero-copy">{hero?.body.value || (bn ? "শিক্ষার্থী ও অভিভাবকের জন্য কোর্স, রুটিন, ফলাফল ও ফি—সব তথ্য এক জায়গায়।" : "Courses, routines, results, and fees in one dependable place for students and guardians.")}</p>
        <div className="hero-actions"><Link className="button button-primary" href={heroHref}>{heroLabel}</Link><Link className="button button-secondary" href={`/${locale}/courses`}>{bn ? "কোর্স দেখুন" : "View courses"}</Link></div>
      </div>
      {hero?.mediaUrl && <PublicImage src={hero.mediaUrl} alt={hero.title.value} />}
    </section>
    <section className="section container" aria-labelledby="courses-title">
      <div className="section-heading"><div><p className="eyebrow">{bn ? "একাডেমিক" : "Academic"}</p><h2 id="courses-title">{bn ? "চলমান কোর্স" : "Active courses"}</h2></div><Link href={`/${locale}/courses`}>{bn ? "সব কোর্স" : "All courses"}</Link></div>
      {courses.length ? <div className="card-grid">{courses.map((course) => <article className="content-card" key={course.id}>{course.coverUrl && <PublicImage src={course.coverUrl} alt="" />}<p className="eyebrow">{course.slug}</p><h3>{course.name.value}</h3><p>{course.shortDescription.value}</p><Link href={`/${locale}/courses/${course.slug}`}>{bn ? "বিস্তারিত" : "Details"}</Link></article>)}</div> : <p className="empty-panel">{bn ? "প্রকাশিত কোর্স শিগগিরই এখানে দেখা যাবে।" : "Published courses will appear here soon."}</p>}
    </section>
    <section className="section container" aria-labelledby="batches-title"><div className="section-heading"><div><p className="eyebrow">{bn ? "ভর্তি চলছে" : "Admissions open"}</p><h2 id="batches-title">{bn ? "খোলা ব্যাচ" : "Open batches"}</h2></div></div>{batches.length ? <div className="card-grid compact">{batches.map((batch) => <article className="content-card" key={batch.id}><p className="eyebrow">{batch.courseName.value}</p><h3>{batch.name.value}</h3><Link href={`/${locale}/courses/${batch.courseSlug}`}>{bn ? "কোর্স ও ব্যাচ দেখুন" : "View course and batch"}</Link></article>)}</div> : <p className="empty-panel">{bn ? "এই মুহূর্তে কোনো পাবলিক ব্যাচে ভর্তি খোলা নেই।" : "No public batch is currently open for admission."}</p>}</section>
    {achievement && <section className="section section-tint"><div className="container narrow"><p className="eyebrow">{bn ? "আমাদের অর্জন" : "Our achievements"}</p><h2>{achievement.title.value}</h2><p className="lead-copy">{achievement.body.value}</p></div></section>}
    <section className="section container"><div className="section-heading"><h2>{bn ? "শিক্ষকবৃন্দ" : "Our teachers"}</h2><Link href={`/${locale}/teachers`}>{bn ? "সব শিক্ষক" : "All teachers"}</Link></div>{teachers.length ? <div className="card-grid compact">{teachers.map((teacher) => <article className="content-card" key={teacher.id}>{teacher.photoUrl && <PublicImage src={teacher.photoUrl} alt="" />}<h3>{teacher.name.value || teacher.displayName}</h3><p>{teacher.qualifications.value}</p><p>{teacher.bio.value}</p></article>)}</div> : <p className="empty-panel">{bn ? "প্রকাশিত শিক্ষক প্রোফাইল এখনো নেই।" : "No teacher profiles are published yet."}</p>}</section>
    {gallery.length > 0 && <section className="section container" aria-labelledby="gallery-title"><div className="section-heading"><h2 id="gallery-title">{bn ? "ধ্রুবকের মুহূর্ত" : "Life at Dhrubok"}</h2></div><div className="card-grid">{gallery.map((item) => <figure className="content-card" key={item.id}>{item.imageUrl && <PublicImage src={item.imageUrl} alt={item.alt.value} />}<figcaption>{item.title.value}</figcaption></figure>)}</div></section>}
    <section className="section container"><div className="section-heading"><h2>{bn ? "সাম্প্রতিক নোটিশ" : "Recent notices"}</h2><Link href={`/${locale}/notices`}>{bn ? "সব নোটিশ" : "All notices"}</Link></div>{notices.length ? <div className="notice-list">{notices.map((notice) => <article key={notice.id}><h3><Link href={`/${locale}/notices/${notice.id}`}>{notice.title.value}</Link></h3><p>{notice.body.value}</p></article>)}</div> : <p className="empty-panel">{bn ? "কোনো প্রকাশিত নোটিশ নেই।" : "There are no published notices."}</p>}</section>
    {(contact || settings) && <section className="section section-tint"><div className="container narrow"><p className="eyebrow">{bn ? "যোগাযোগ" : "Contact"}</p><h2>{contact?.title.value || (bn ? "আমাদের সাথে কথা বলুন" : "Talk to us")}</h2>{contact?.body.value && <p className="lead-copy">{contact.body.value}</p>}<div className="hero-actions">{settings?.phone && <a className="button button-primary" href={`tel:+${settings.phone}`}>{bn ? "ফোন করুন" : "Call us"}</a>}<Link className="button button-secondary" href={`/${locale}/contact`}>{bn ? "ঠিকানা ও মানচিত্র" : "Address and map"}</Link></div>{address && <p>{address}</p>}</div></section>}
  </>;
}
