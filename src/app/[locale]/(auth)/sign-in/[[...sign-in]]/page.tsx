import { SignIn } from "@clerk/nextjs";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";

export default async function SignInPage({ params }: { params: Promise<{ locale: string; signIn?: string[] }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <main id="main-content" className="auth-page"><SignIn fallbackRedirectUrl={`/${locale}/access`} /></main>;
}
