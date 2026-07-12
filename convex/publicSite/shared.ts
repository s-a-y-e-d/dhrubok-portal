import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

export const localeValidator = v.union(v.literal("bn"), v.literal("en"));
export type Locale = "bn" | "en";

export const contentBlockKeyValidator = v.union(
  v.literal("hero"),
  v.literal("about_summary"),
  v.literal("contact"),
  v.literal("achievement_intro"),
  v.literal("admission_intro"),
  v.literal("footer"),
);

export type ContentBlockKey = Doc<"siteContentBlocks">["key"];

export const localizedTextValidator = v.object({
  value: v.string(),
  requestedLocale: localeValidator,
  resolvedLocale: v.union(localeValidator, v.null()),
  didFallback: v.boolean(),
});

export function localize(bn: string | undefined, en: string | undefined, requestedLocale: Locale) {
  const requested = requestedLocale === "bn" ? bn : en;
  if (requested?.trim()) {
    return { value: requested, requestedLocale, resolvedLocale: requestedLocale, didFallback: false } as const;
  }
  const fallbackLocale = requestedLocale === "bn" ? "en" : "bn";
  const fallback = fallbackLocale === "bn" ? bn : en;
  if (fallback?.trim()) {
    return { value: fallback, requestedLocale, resolvedLocale: fallbackLocale, didFallback: true } as const;
  }
  return { value: "", requestedLocale, resolvedLocale: null, didFallback: false } as const;
}

export function requireTrimmed(value: string, label: string, maxLength: number) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  if (trimmed.length > maxLength) throw new Error(`${label} must be at most ${maxLength} characters`);
  return trimmed;
}

export function optionalTrimmed(value: string | undefined, label: string, maxLength: number) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${label} must be at most ${maxLength} characters`);
  return trimmed || undefined;
}

export function requireAtLeastOneTranslation(bn: string, en: string, label: string) {
  if (!bn.trim() && !en.trim()) throw new Error(`${label} requires at least one translation`);
}

export function boundedLimit(limit: number, maximum: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > maximum) {
    throw new Error(`Limit must be an integer between 1 and ${maximum}`);
  }
  return limit;
}

export function boundedSortOrder(sortOrder: number) {
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100_000) {
    throw new Error("Sort order must be an integer between 0 and 100000");
  }
  return sortOrder;
}

export function validatePublicImageMetadata(contentType: string | undefined, size: number) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!contentType || !allowedTypes.has(contentType.toLowerCase())) {
    throw new Error("Public website media must be a JPEG, PNG, or WebP image");
  }
  if (size > 8 * 1024 * 1024) throw new Error("Public website images must be 8 MB or smaller");
}

export function validatePublicHref(href: string) {
  if (/^\/(?!\/)/.test(href) && !href.includes("\\")) return;
  try {
    const url = new URL(href);
    if (url.protocol === "https:" && !url.username && !url.password) return;
  } catch {
    // Fall through to the stable validation error below.
  }
  throw new Error("CTA URL must be a local path or HTTPS URL");
}
