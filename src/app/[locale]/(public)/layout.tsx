import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import type { Metadata } from "next";
import { publicMetadata } from "./_metadata";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { websiteCmsEnabled } from "@/lib/features";

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
  const defaultNavigation = locale === "bn" ? [
    { key: "home", label: "à¦¹à§‹à¦®", visible: true }, { key: "courses", label: "à¦•à§‹à¦°à§à¦¸", visible: true }, { key: "teachers", label: "à¦¶à¦¿à¦•à§à¦·à¦•", visible: true },
    { key: "about", label: "à¦†à¦®à¦¾à¦¦à§‡à¦° à¦¸à¦®à§à¦ªà¦°à§à¦•à§‡", visible: true }, { key: "contact", label: "à¦¯à§‹à¦—à¦¾à¦¯à§‹à¦—", visible: true },
    { key: "admission", label: "à¦­à¦°à§à¦¤à¦¿", visible: true }, { key: "sign_in", label: "à¦¸à¦¾à¦‡à¦¨ à¦‡à¦¨", visible: true },
  ] : [
    { key: "home", label: "Home", visible: true }, { key: "courses", label: "Courses", visible: true }, { key: "teachers", label: "Teachers", visible: true },
    { key: "about", label: "About", visible: true }, { key: "contact", label: "Contact", visible: true },
    { key: "admission", label: "Admission", visible: true }, { key: "sign_in", label: "Sign in", visible: true },
  ];
  const [dictionary, footer, siteLayout] = await Promise.all([
    getDictionary(locale),
    fetchQuery(api.publicSite.public.getContentBlock, { key: "footer", locale }),
    websiteCmsEnabled ? fetchQuery(api.publicSite.public.getSiteLayout, { locale }).catch(() => ({ homeSections: [], navigation: defaultNavigation })) : Promise.resolve({ homeSections: [], navigation: defaultNavigation }),
  ]);
  return <><PublicHeader locale={locale} dictionary={dictionary} navigation={siteLayout.navigation} /><main id="main-content">{children}</main><PublicFooter dictionary={dictionary} title={footer?.title.value} body={footer?.body.value} navigation={siteLayout.navigation} /></>;
}
