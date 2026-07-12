/* eslint-disable @next/next/no-img-element -- Public Convex media uses expiring signed URLs. */
import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { descriptionFrom, publicMetadata } from "../_metadata";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> { const { locale } = await params; if (!isLocale(locale)) return {}; const content = await fetchQuery(api.publicSite.public.getContentBlock, { key: "about_summary", locale }); const bn = locale === "bn"; return publicMetadata({ locale, path: "/about", title: content?.title.value || (bn ? "আমাদের সম্পর্কে" : "About us"), description: descriptionFrom(content?.body.value ?? "", bn ? "ধ্রুবক কোচিং সেন্টার সম্পর্কে জানুন।" : "Learn about Dhrubok Coaching Centre.") }); }
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) notFound(); const content = await fetchQuery(api.publicSite.public.getContentBlock, { key: "about_summary", locale }); const bn = locale === "bn"; return <section className="section container narrow"><p className="eyebrow">{bn ? "ধ্রুবক সম্পর্কে" : "About Dhrubok"}</p>{content?.mediaUrl && <img src={content.mediaUrl} alt="" width={960} height={540} style={{ width: "100%", height: "auto" }} />}<h1>{content?.title.value || (bn ? "আমাদের সম্পর্কে" : "About us")}</h1><div className="prose-copy">{content?.body.value || (bn ? "এই অংশের তথ্য শিগগিরই প্রকাশ করা হবে।" : "This section will be published soon.")}</div></section>; }
