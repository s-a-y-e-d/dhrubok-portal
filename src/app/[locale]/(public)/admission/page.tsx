import { AdmissionForm } from "@/components/admission-form";
import { Badge } from "@/components/ui/badge";
import { api } from "@convex/_generated/api";
import { isLocale } from "@/lib/i18n/config";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { descriptionFrom, publicMetadata } from "../_metadata";

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
        : "Apply online for admission to Dhrubok Coaching Centre.",
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
    <section className="section container">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col items-start gap-4 sm:items-center sm:text-center">
          <Badge variant="info">{bn ? "অনলাইন আবেদন" : "Online application"}</Badge>
          <div className="flex max-w-2xl flex-col gap-3">
            <h1>{content?.title.value || (bn ? "ভর্তির আবেদন" : "Admission application")}</h1>
            <p className="lead-copy">
              {content?.body.value ||
                (bn
                  ? "শিক্ষার্থীর ব্যবহারযোগ্য Google ইমেইল, অভিভাবকের তথ্য এবং পছন্দের কোর্স ও ব্যাচ দিন। আবেদন অনুমোদন না হওয়া পর্যন্ত পোর্টাল অ্যাক্সেস চালু হবে না।"
                  : "Provide the student's usable Google email, guardian details, and preferred course and batch. Portal access starts only after owner approval.")}
            </p>
          </div>
          <ol className="grid w-full grid-cols-1 gap-3 text-start text-sm sm:grid-cols-3" aria-label={bn ? "আবেদন প্রক্রিয়া" : "Application process"}>
            {[
              bn ? "তথ্য পূরণ করুন" : "Complete the form",
              bn ? "কর্তৃপক্ষ পর্যালোচনা করবে" : "Centre reviews it",
              bn ? "অনুমোদনের পর প্রবেশাধিকার" : "Access after approval",
            ].map((label, index) => (
              <li className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3" key={label}>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted font-semibold" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="font-medium">{label}</span>
              </li>
            ))}
          </ol>
        </header>
        <AdmissionForm locale={locale} />
      </div>
    </section>
  );
}
