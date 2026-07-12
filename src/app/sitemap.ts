import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { getBaseUrl } from "@/app/[locale]/(public)/_metadata";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseUrl();
  const staticPaths = ["", "/courses", "/teachers", "/notices", "/about", "/contact", "/admission"];
  let courseSlugs: string[] = [];
  let notices: Array<{ id: string; publishedAt: number }> = [];
  try {
    const entries = await fetchQuery(api.publicSite.public.listSitemapEntries, {});
    courseSlugs = entries.courseSlugs;
    notices = entries.notices;
  } catch {
    // Static public routes remain discoverable while Convex is temporarily unavailable.
  }
  const entry = (locale: "bn" | "en", path: string, options: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap[number] => ({
    url: new URL(`/${locale}${path}`, base).toString(),
    alternates: { languages: {
      bn: new URL(`/bn${path}`, base).toString(), en: new URL(`/en${path}`, base).toString(),
      "x-default": new URL(`/bn${path}`, base).toString(),
    } },
    ...options,
  });
  return [
    ...(["bn", "en"] as const).flatMap((locale) => staticPaths.map((path) => entry(locale, path, { changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : 0.7 }))),
    ...(["bn", "en"] as const).flatMap((locale) => courseSlugs.map((slug) => entry(locale, `/courses/${encodeURIComponent(slug)}`, { changeFrequency: "weekly", priority: 0.8 }))),
    ...(["bn", "en"] as const).flatMap((locale) => notices.map((notice) => entry(locale, `/notices/${notice.id}`, { lastModified: new Date(notice.publishedAt), changeFrequency: "monthly", priority: 0.6 }))),
  ];
}
