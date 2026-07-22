"use client";

import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { PortalPageState } from "./PortalPageState";

interface ReportPrintFrameProps {
  locale: "bn" | "en";
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ReportPrintFrame({ locale, eyebrow, title, subtitle, children }: ReportPrintFrameProps) {
  const bn = locale === "bn";
  const router = useRouter();
  const settings = useQuery(api.settings.getPublic, {});
  if (settings === undefined) return <PortalPageState state="loading" locale={locale} />;
  return (
    <section className="report-sheet">
      <div className="receipt-toolbar" data-print-hidden>
        <Button variant="secondary" type="button" onClick={() => router.back()}>
          <ArrowLeft data-icon="inline-start" />
          {bn ? "ফিরে যান" : "Back to reports"}
        </Button>
        <Button type="button" onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          {bn ? "প্রিন্ট করুন" : "Print report"}
        </Button>
      </div>
      <header className="receipt-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div>
          <strong>{settings ? (bn ? settings.nameBn : settings.nameEn) : (bn ? "ধ্রুবক" : "Dhrubok")}</strong>
          <span>{settings ? (bn ? settings.addressBn : settings.addressEn) : (bn ? "সিস্টেম-তৈরি রিপোর্ট" : "System-generated report")}</span>
        </div>
      </header>
      {children}
    </section>
  );
}
