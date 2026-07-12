import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/app/[locale]/(public)/_metadata";

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();
  return {
    rules: [
      { userAgent: "*", allow: ["/bn", "/en"], disallow: ["/bn/owner", "/en/owner", "/bn/teacher", "/en/teacher", "/bn/student", "/en/student", "/api/"] },
    ],
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base.origin,
  };
}
