import React from "react";
import { Button } from "@/components/ui/button";
import styles from "./portal.module.css";

interface PortalPageStateProps {
  state: "loading" | "error" | "empty" | "content";
  locale: "bn" | "en";
  errorMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  children?: React.ReactNode;
}

export function PortalPageState({
  state,
  locale,
  errorMessage,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
}: PortalPageStateProps) {
  const isBn = locale === "bn";

  if (state === "loading") {
    return (
      <div className={styles.stateContainer} role="status" aria-live="polite">
        <div className={styles.spinner} />
        <p className={styles.stateTitle}>
          {isBn ? "লোড হচ্ছে..." : "Loading..."}
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={styles.stateContainer} role="alert">
        <p className={styles.stateTitle}>
          {isBn ? "ত্রুটি ঘটেছে" : "An error occurred"}
        </p>
        <p className={styles.stateDesc}>
          {errorMessage || (isBn ? "অনুগ্রহ করে আবার চেষ্টা করুন।" : "Please try again.")}
        </p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            {isBn ? "আবার চেষ্টা করুন" : "Try again"}
          </Button>
        )}
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className={styles.stateContainer}>
        <h2 className={styles.stateTitle}>
          {emptyTitle || (isBn ? "কোনো তথ্য নেই" : "No records found")}
        </h2>
        {emptyDescription && (
          <p className={styles.stateDesc}>{emptyDescription}</p>
        )}
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return <>{children}</>;
}
