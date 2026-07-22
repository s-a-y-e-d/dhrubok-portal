import { AdmissionForm } from "@/components/admission-form";
import { api } from "@convex/_generated/api";
import { isLocale } from "@/lib/i18n/config";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { descriptionFrom, publicMetadata } from "../_metadata";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await fetchQuery(api.publicSite.public.getContentBlock, {
    key: "admission_intro",
    locale,
  });
  const bn = locale === "bn";
  return publicMetadata({
    locale,
    path: "/admission",
    title: content?.title.value || (bn ? "ভর্তির আবেদন" : "Admission application"),
    description: descriptionFrom(
      content?.body.value ?? "",
      bn
        ? "ধ্রুবক কোচিং সেন্টারে ভর্তির জন্য অনলাইনে আবেদন করুন।"
        : "Apply online for admission to Dhrubok Coaching Centre."
    ),
  });
}

export default async function AdmissionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const content = await fetchQuery(api.publicSite.public.getContentBlock, {
    key: "admission_intro",
    locale,
  });
  const bn = locale === "bn";

  return (
    <div className="container max-w-4xl py-10 flex flex-col gap-10">
      <header className="flex flex-col items-start gap-4 sm:items-center sm:text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <Sparkles className="size-3.5" />
          <span>{bn ? "অনলাইন ভর্তির আবেদন" : "Online Admission Application"}</span>
        </div>

        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {content?.title.value || (bn ? "ধ্রুবক কোচিং সেন্টারে ভর্তির আবেদন" : "Admission Application")}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            {content?.body.value ||
              (bn
                ? "শিক্ষার্থীর ব্যবহারযোগ্য Google ইমেইল ও অভিভাবকের তথ্য প্রদান করুন। কর্তৃপক্ষ আবেদনের তথ্য পরীক্ষা করে অনুমোদন প্রদান করবে।"
                : "Provide student details and guardian contact info. Portal access begins after owner review and approval.")}
          </p>
        </div>

        {/* Admission Workflow Step Cards */}
        <ol
          className="grid w-full grid-cols-1 gap-4 text-start text-sm sm:grid-cols-3 mt-4"
          aria-label={bn ? "আবেদন প্রক্রিয়া" : "Application process"}
        >
          {[
            {
              step: 1,
              title: bn ? "তথ্য পূরণ করুন" : "Complete the form",
              desc: bn ? "শিক্ষার্থী ও অভিভাবকের তথ্য প্রদান" : "Fill student & guardian details",
            },
            {
              step: 2,
              title: bn ? "কর্তৃপক্ষ পর্যালোচনা করবে" : "Centre reviews it",
              desc: bn ? "তথ্য যাচাই ও কোর্স বরাদ্দকরণ" : "Verification & course allotment",
            },
            {
              step: 3,
              title: bn ? "অনুমোদনের পর প্রবেশাধিকার" : "Access after approval",
              desc: bn ? "Google লগইন দিয়ে পোর্টালে প্রবেশ" : "Portal access via Google login",
            },
          ].map((item) => (
            <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm" key={item.step}>
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-emerald-500 font-bold text-xs text-slate-950">
                  {item.step}
                </span>
                <span className="font-bold text-foreground text-sm">{item.title}</span>
              </div>
              <p className="text-xs text-muted-foreground pl-9">{item.desc}</p>
            </li>
          ))}
        </ol>
      </header>

      {/* Admission Form Container */}
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
        <AdmissionForm locale={locale} />
      </div>
    </div>
  );
}
