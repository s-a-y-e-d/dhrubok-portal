import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function PublicFooter({ dictionary, title, body }: { dictionary: Dictionary; title?: string; body?: string }) {
  return (
    <footer className="public-footer border-t border-border bg-slate-50/50 py-12 dark:bg-slate-900/50">
      <div className="container flex flex-col gap-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand Info */}
          <div className="flex flex-col gap-3 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-emerald-500 font-bold text-slate-950 shadow-sm" aria-hidden="true">
                ধ্রু
              </span>
              <strong className="text-xl font-bold tracking-tight text-foreground">
                {title || dictionary.brand.name}
              </strong>
            </div>
            <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
              {body || dictionary.brand.tagline}
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {dictionary.nav.home}
            </h4>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link className="text-foreground/80 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" href="./courses">
                {dictionary.nav.courses}
              </Link>
              <Link className="text-foreground/80 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" href="./teachers">
                {dictionary.nav.teachers}
              </Link>
              <Link className="text-foreground/80 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" href="./about">
                {dictionary.nav.about}
              </Link>
              <Link className="text-foreground/80 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" href="./contact">
                {dictionary.nav.contact}
              </Link>
            </div>
          </div>

          {/* Student & Guardian Access */}
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {dictionary.brand.name} Portal
            </h4>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link className="text-foreground/80 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" href="./admission">
                {dictionary.nav.apply}
              </Link>
              <Link className="text-foreground/80 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" href="./sign-in">
                {dictionary.nav.signIn}
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} {dictionary.brand.name}. All rights reserved.</p>
          <p className="text-balance text-center sm:text-right">
            Dhrubok Coaching Management Platform • Bilingual Student Services
          </p>
        </div>
      </div>
    </footer>
  );
}
