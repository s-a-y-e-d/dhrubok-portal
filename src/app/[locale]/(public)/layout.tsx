import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import type { Metadata } from "next";
import { publicMetadata } from "./_metadata";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const bn = locale === "bn";
  const title = bn ? "ধ্রুবক কোচিং সেন্টার" : "Dhrubok Coaching Centre";
  return {
    ...publicMetadata({ locale, title, description: bn ? "দ্বিভাষিক কোচিং ও শিক্ষার্থী পোর্টাল।" : "A bilingual coaching centre and student portal." }),
    title: { default: title, template: "%s | Dhrubok" },
  };
}

export default async function PublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dictionary, footer] = await Promise.all([
    getDictionary(locale),
    fetchQuery(api.publicSite.public.getContentBlock, { key: "footer", locale }),
  ]);
  return <><PublicHeader locale={locale} dictionary={dictionary} /><main id="main-content">{children}</main><PublicFooter dictionary={dictionary} title={footer?.title.value} body={footer?.body.value} /></>;
}
