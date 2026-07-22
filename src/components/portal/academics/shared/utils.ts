"use client";

import { ownerErrorResult } from "@/lib/owner-errors";
import type { Feedback } from "./FeedbackMessage";

/** @deprecated Use useOwnerFormErrors for new owner forms. */
export function friendlyError(cause: unknown, bn: boolean): string {
  return ownerErrorResult(cause, bn ? "bn" : "en").summary;
}

/** @deprecated Compatibility wrapper for existing academic forms. */
export async function executeMutation(
  work: () => Promise<unknown>,
  setBusy: (busy: boolean) => void,
  setFeedback: (feedback: Feedback) => void,
  successMsg: string,
  bn = false,
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
