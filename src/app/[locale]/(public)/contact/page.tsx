import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { descriptionFrom, publicMetadata } from "../_metadata";
import { MapPin, Phone, Mail, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await fetchQuery(api.publicSite.public.getContentBlock, { key: "contact", locale });
  const bn = locale === "bn";
  return publicMetadata({
    locale,
    path: "/contact",
    title: content?.title.value || (bn ? "যোগাযোগ" : "Contact"),
    description: descriptionFrom(
      content?.body.value ?? "",
      bn ? "ধ্রুবক কোচিং সেন্টারের ঠিকানা, ফোন ও ইমেইল দেখুন।" : "Find the address, phone number, and email for Dhrubok Coaching Centre."
    ),
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [content, settings] = await Promise.all([
    fetchQuery(api.publicSite.public.getContentBlock, { key: "contact", locale }),
    fetchQuery(api.settings.getPublic, {}),
  ]);

  const bn = locale === "bn";
  const address = settings ? (bn ? settings.addressBn : settings.addressEn) : "";
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className="container max-w-4xl py-10 flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          {bn ? "যোগাযোগ" : "Contact"}
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {content?.title.value || (bn ? "আমাদের সাথে যোগাযোগ করুন" : "Contact us")}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          {content?.body.value ||
            (bn ? "ভর্তি ও কোর্স সংক্রান্ত যে কোনো তথ্যের জন্য আমাদের সাথে সরাসরি ফোন, ইমেইল বা কার্যালয়ে যোগাযোগ করতে পারেন।" : "Call, email, or visit our office to inquire about courses and admission.")}
        </p>
      </div>

      {settings ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Address Card */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MapPin className="size-5" />
            </div>
            <h2 className="text-base font-bold text-foreground">{bn ? "ঠিকানা" : "Address"}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{address}</p>
            {address && (
              <a
                className="mt-auto pt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>{bn ? "মানচিত্রে দেখুন" : "Open in Google Maps"}</span>
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          {/* Phone Card */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Phone className="size-5" />
            </div>
            <h2 className="text-base font-bold text-foreground">{bn ? "ফোন" : "Phone"}</h2>
            <a
              href={`tel:+${settings.phone}`}
              className="text-base font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              +{settings.phone}
            </a>
            <p className="text-xs text-muted-foreground">{bn ? "সকাল ৯:০০ - সন্ধ্যা ৭:০০" : "9:00 AM - 7:00 PM"}</p>
          </div>

          {/* Email Card */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Mail className="size-5" />
            </div>
            <h2 className="text-base font-bold text-foreground">{bn ? "ইমেইল" : "Email"}</h2>
            <a
              href={`mailto:${settings.email}`}
              className="text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400 break-all"
            >
              {settings.email}
            </a>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <p>{bn ? "যোগাযোগের তথ্য এখনো প্রকাশিত হয়নি।" : "Contact details have not been published yet."}</p>
        </div>
      )}
    </div>
  );
}
