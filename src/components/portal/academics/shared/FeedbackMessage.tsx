"use client";

export type Feedback = { ok: boolean; text: string } | null;

export function FeedbackMessage({ value }: { value: Feedback }) {
  if (!value) return null;
  return (
    <p
      className={`form-message ${value.ok ? "success" : "error"}`}
      role={value.ok ? "status" : "alert"}
    >
      {value.text}
    </p>
  );
}
