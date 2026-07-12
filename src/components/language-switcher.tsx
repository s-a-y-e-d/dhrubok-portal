import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ locale, pathname, label }: { locale: Locale; pathname: string; label: string }) {
  const target = locale === "bn" ? "en" : "bn";
  const suffix = pathname.replace(/^\/(bn|en)/, "") || "";
  return <Link className="language-link" href={`/${target}${suffix}`}>{label}</Link>;
}
