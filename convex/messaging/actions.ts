import { v } from "convex/values";
import { env, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  BulkSmsBdError,
  getBulkSmsBdBalance,
  sendBulkSmsBd,
} from "../integrations/bulkSmsBd";

export const sendQueued = internalAction({
  args: { messageId: v.id("smsMessages") }, returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.runQuery(internal.messaging.functions.getForDelivery, args);
    if (!message || (message.status !== "queued" && message.status !== "failed")) return null;
    if (!["admission_received", "admission_accepted", "attendance_late", "attendance_absent", "payment_posted"].includes(message.eventType)) {
      await ctx.runMutation(internal.messaging.functions.cancelDisallowed, args);
      return null;
    }
    if (!(await ctx.runMutation(internal.messaging.functions.markSending, args))) return null;
    const apiKey = env.BULKSMSBD_KEY;
    const senderId = env.BULKSMSBD_SENDER_ID;
    if (!apiKey || !senderId) {
      await ctx.runMutation(internal.messaging.functions.recordFailure, { ...args, code: "not_configured", message: "SMS provider is not configured", retryable: false });
      return null;
    }
    try {
      const result = await sendBulkSmsBd({ apiKey, senderId, recipient: message.recipient, body: message.body });
      await ctx.runMutation(internal.messaging.functions.recordAccepted, {
        ...args,
        providerRequestId: result.responseCode,
        providerStatus: result.providerStatus,
      });
    } catch (cause) {
      const error = cause instanceof BulkSmsBdError ? cause : new BulkSmsBdError("Unexpected SMS provider failure", "unexpected", true);
      const retryable = error.retryable && message.attemptCount < 4;
      const delay = Math.min(30 * 60_000, 30_000 * 2 ** message.attemptCount);
      await ctx.runMutation(internal.messaging.functions.recordFailure, { ...args, code: error.code, message: error.message, retryable, ...(retryable ? { nextAttemptAt: Date.now() + delay } : {}) });
      if (retryable) await ctx.scheduler.runAfter(delay, internal.messaging.actions.sendQueued, args);
    }
    return null;
  },
});

export const pollBalance = internalAction({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    if (!env.BULKSMSBD_KEY) return null;
    try {
      const balanceMinor = await getBulkSmsBdBalance(env.BULKSMSBD_KEY);
      await ctx.runMutation(internal.messaging.functions.recordBalance, { balanceMinor, providerStatus: "ok" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.slice(0, 300) : "Balance check failed";
      await ctx.runMutation(internal.messaging.functions.recordBalance, { providerStatus: "error", error: message });
    }
    return null;
  },
});
