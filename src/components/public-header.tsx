"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Menu, X, Globe, ArrowRight } from "lucide-react";

export function PublicHeader({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const base = `/${locale}`;

  const navLinks = [
    { href: `${base}/courses`, label: dictionary.nav.courses },
    { href: `${base}/teachers`, label: dictionary.nav.teachers },
    { href: `${base}/about`, label: dictionary.nav.about },
    { href: `${base}/contact`, label: dictionary.nav.contact },
  ];

  const targetLocale = locale === "bn" ? "en" : "bn";
  const altLocalePath = pathname ? pathname.replace(`/${locale}`, `/${targetLocale}`) : `/${targetLocale}`;

  return (
    <header className="public-header sticky top-0 z-50 border-b border-[var(--border)] bg-white/95 backdrop-blur-md">
      <nav className="public-nav container flex h-18 items-center justify-between gap-6" aria-label={dictionary.nav.home}>
        {/* Wordmark */}
        <Link className="wordmark" href={base} aria-label={dictionary.brand.name}>
          <span aria-hidden="true">ধ্রু</span>
          <strong>{dictionary.brand.name}</strong>
        </Link>

        {/* Desktop Links */}
        <div className="public-links hidden items-center gap-6 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-[var(--ink)] ${
                  isActive ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-mute)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop Actions */}
        <div className="public-actions hidden items-center gap-3 md:flex">
          <Link
            className="language-link text-xs font-semibold uppercase tracking-wider text-[var(--ink-mute)] hover:text-[var(--ink)] flex items-center gap-1.5 px-2 py-1 rounded"
            href={altLocalePath}
            title={locale === "bn" ? "Switch to English" : "বাংলায় দেখুন"}
          >
            <Globe className="size-3.5" />
            <span>{dictionary.common.language}</span>
          </Link>

          <Link className="text-link text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)] px-2 py-1" href={`${base}/sign-in`}>
            {dictionary.nav.signIn}
          </Link>

          <Link className="button button-primary text-sm gap-1.5" href={`${base}/admission`}>
            <span>{dictionary.nav.apply}</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <Link className="language-link text-xs font-semibold uppercase text-[var(--ink-mute)] flex items-center gap-1 px-2 py-1" href={altLocalePath}>
            <Globe className="size-3.5" />
            <span>{dictionary.common.language}</span>
          </Link>

          <button
            type="button"
            className="button button-secondary p-2 min-h-10 min-w-10"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-[var(--border)] bg-white p-6 md:hidden shadow-lg animate-in slide-in-from-top-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-md px-3 py-2.5 text-base font-medium transition-colors ${
                      isActive ? "bg-[var(--brand-muted)] font-semibold text-[var(--ink)]" : "text-[var(--ink)] hover:bg-[var(--canvas-subtle)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="h-px bg-[var(--border)] my-1" />

            <div className="flex flex-col gap-2.5">
              <Link
                className="button button-primary w-full justify-center gap-2 text-base h-11"
                href={`${base}/admission`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>{dictionary.nav.apply}</span>
                <ArrowRight className="size-4" />
              </Link>

              <Link
                className="button button-secondary w-full justify-center text-base h-11"
                href={`${base}/sign-in`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {dictionary.nav.signIn}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
