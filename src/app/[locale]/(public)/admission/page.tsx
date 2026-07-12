import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { AdmissionForm } from "@/components/admission-form";
import { isLocale } from "@/lib/i18n/config";
import { descriptionFrom, publicMetadata } from "../_metadata";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> { const { locale } = await params; if (!isLocale(locale)) return {}; const content = await fetchQuery(api.publicSite.public.getContentBlock, { key: "admission_intro", locale }); const bn = locale === "bn"; return publicMetadata({ locale, path: "/admission", title: content?.title.value || (bn ? "ভর্তির আবেদন" : "Admission application"), description: descriptionFrom(content?.body.value ?? "", bn ? "ধ্রুবক কোচিং সেন্টারে ভর্তির জন্য অনলাইনে আবেদন করুন।" : "Apply online for admission to Dhrubok Coaching Centre.") }); }
export default async function AdmissionPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) notFound(); const content = await fetchQuery(api.publicSite.public.getContentBlock, { key: "admission_intro", locale }); const bn = locale === "bn"; return <section className="section container narrow"><p className="eyebrow">{bn ? "অনলাইন আবেদন" : "Online application"}</p><h1>{content?.title.value || (bn ? "ভর্তির আবেদন" : "Admission application")}</h1><p className="lead-copy">{content?.body.value || (bn ? "শিক্ষার্থীর ব্যবহারযোগ্য Google ইমেইল, অভিভাবকের তথ্য এবং পছন্দের কোর্স ও ব্যাচ দিন। আবেদন অনুমোদন না হওয়া পর্যন্ত পোর্টাল অ্যাক্সেস চালু হবে না।" : "Provide the student's usable Google email, guardian details, and preferred course and batch. Portal access starts only after owner approval.")}</p><AdmissionForm locale={locale} /></section>; }
