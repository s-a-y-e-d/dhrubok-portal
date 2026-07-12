"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PortalPageState } from "./PortalPageState";

export function AccessResolver({ locale }: { locale: "bn" | "en" }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const ensureAccount = useMutation(api.accounts.ensureCurrentPortalAccount);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace(`/${locale}/sign-in`);
      return;
    }
    let cancelled = false;
    ensureAccount({}).then((result) => {
      if (cancelled) return;
      if (result.status === "active") router.replace(`/${locale}/${result.role}`);
      else router.replace(`/${locale}/access-pending`);
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to resolve portal access");
    });
    return () => { cancelled = true; };
  }, [authLoading, ensureAccount, isAuthenticated, locale, retryKey, router]);

  if (error) {
    return <PortalPageState state="error" locale={locale} errorMessage={error} onRetry={() => { setError(null); setRetryKey((value) => value + 1); }} />;
  }
  return <PortalPageState state="loading" locale={locale} />;
}
