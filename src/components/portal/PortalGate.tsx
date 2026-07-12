"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PortalPageState } from "./PortalPageState";

interface PortalGateProps {
  expectedRole: "owner" | "teacher" | "student";
  locale: "bn" | "en";
  children: React.ReactNode;
}

export function PortalGate({ expectedRole, locale, children }: PortalGateProps) {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.accounts.ensureCurrentPortalAccount);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const hasRun = useRef(false);

  const callMutation = useCallback(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    setLoading(true);
    setError(null);

    ensure()
      .then((res) => {
        if (res.status === "access_pending") {
          router.replace(`/${locale}/access-pending`);
        } else if (res.status === "active") {
          if (res.role !== expectedRole) {
            router.replace(`/${locale}/${res.role}`);
          } else {
            setLoading(false);
            setVerified(true);
          }
        }
      })
      .catch((err) => {
        hasRun.current = false;
        setLoading(false);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [ensure, expectedRole, locale, router]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.replace(`/${locale}/sign-in`);
      return;
    }

    callMutation();
  }, [authLoading, isAuthenticated, callMutation, locale, router]);

  const handleRetry = () => {
    hasRun.current = false;
    callMutation();
  };

  if (authLoading || loading) {
    return (
      <PortalPageState
        state="loading"
        locale={locale}
      />
    );
  }

  if (error) {
    return (
      <PortalPageState
        state="error"
        locale={locale}
        errorMessage={error}
        onRetry={handleRetry}
      />
    );
  }

  if (!verified) {
    return (
      <PortalPageState
        state="loading"
        locale={locale}
      />
    );
  }

  return <>{children}</>;
}
