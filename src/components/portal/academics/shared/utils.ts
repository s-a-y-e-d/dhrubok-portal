"use client";

import type { Feedback } from "./FeedbackMessage";

export function friendlyError(cause: unknown, bn: boolean): string {
  const raw = cause instanceof Error ? cause.message : "";
  const message = raw
    .replace(/^[\s\S]*?Uncaught Error:\s*/, "")
    .replace(/\s+Called by client[\s\S]*$/, "")
    .trim();

  if (message === "Subject is already linked to course") {
    return bn ? "এই বিষয়টি ইতিমধ্যে কোর্সে যুক্ত আছে।" : "This subject is already linked to the course.";
  }
  return message || (bn ? "কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।" : "The operation could not be completed. Please try again.");
}

export async function executeMutation(
  work: () => Promise<unknown>,
  setBusy: (busy: boolean) => void,
  setFeedback: (feedback: Feedback) => void,
  successMsg: string,
  bn: boolean = false
): Promise<boolean> {
  setBusy(true);
  setFeedback(null);
  try {
    await work();
    setFeedback({ ok: true, text: successMsg });
    return true;
  } catch (cause) {
    setFeedback({ ok: false, text: friendlyError(cause, bn) });
    return false;
  } finally {
    setBusy(false);
  }
}
