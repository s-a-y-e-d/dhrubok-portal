"use client";

import { useCallback, useRef, useState } from "react";
import { ownerErrorResult, type OwnerErrorLocale, type ParsedOwnerError } from "@/lib/owner-errors";

export function useOwnerFormErrors(locale: OwnerErrorLocale) {
  const [error, setError] = useState<ParsedOwnerError | null>(null);
  const firstErrorRef = useRef<string | null>(null);
  const capture = useCallback((cause: unknown) => {
    const next = ownerErrorResult(cause, locale);
    firstErrorRef.current = Object.keys(next.fieldErrors)[0] ?? null;
    setError(next);
    requestAnimationFrame(() => {
      const field = firstErrorRef.current;
      if (field) document.querySelector<HTMLElement>(`[name="${CSS.escape(field)}"]`)?.focus();
    });
    return next;
  }, [locale]);
  const clearField = useCallback((field: string) => setError((current) => {
    if (!current?.fieldErrors[field]) return current;
    const fieldErrors = { ...current.fieldErrors };
    delete fieldErrors[field];
    return Object.keys(fieldErrors).length ? { ...current, fieldErrors } : null;
  }), []);
  return { error, capture, clearField, clear: () => setError(null) };
}

export function OwnerFormErrorSummary({ error }: { error: ParsedOwnerError | null }) {
  if (!error) return null;
  const fields = Object.keys(error.fieldErrors);
  return <div className="form-message error" role="alert"><p>{error.summary}</p>{fields.length > 1 ? <ul>{fields.map((field) => <li key={field}><a href={`#${field}`}>{error.fieldErrors[field]}</a></li>)}</ul> : null}</div>;
}
