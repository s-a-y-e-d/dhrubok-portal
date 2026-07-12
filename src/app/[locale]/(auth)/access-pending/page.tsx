import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

export default async function AccessPending({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);
  return <main id="main-content" className="auth-page"><section className="message-card"><h1>{dictionary.common.noAccessTitle}</h1><p>{dictionary.common.noAccessBody}</p></section></main>;
}
