import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

export function PublicHeader({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const base = `/${locale}`;
  return (
    <header className="public-header">
      <nav className="public-nav container" aria-label={dictionary.nav.home}>
        <Link className="wordmark" href={base} aria-label={dictionary.brand.name}>
          <span aria-hidden="true">ধ্রু</span>
          <strong>{dictionary.brand.name}</strong>
        </Link>
        <div className="public-links">
          <Link href={`${base}/courses`}>{dictionary.nav.courses}</Link>
          <Link href={`${base}/teachers`}>{dictionary.nav.teachers}</Link>
          <Link href={`${base}/notices`}>{dictionary.nav.notices}</Link>
          <Link href={`${base}/about`}>{dictionary.nav.about}</Link>
          <Link href={`${base}/contact`}>{dictionary.nav.contact}</Link>
        </div>
        <div className="public-actions">
          <Link className="language-link" href={`/${locale === "bn" ? "en" : "bn"}`}>{dictionary.common.language}</Link>
          <Link className="text-link" href={`${base}/sign-in`}>{dictionary.nav.signIn}</Link>
          <Link className="button button-primary" href={`${base}/admission`}>{dictionary.nav.apply}</Link>
        </div>
      </nav>
    </header>
  );
}
