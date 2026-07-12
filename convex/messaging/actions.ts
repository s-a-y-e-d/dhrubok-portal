import { v } from "convex/values";
import { env, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getSmsBdBalance, getSmsBdReport, sendSmsBd, SmsProviderError } from "../integrations/smsBd";

export const sendQueued = internalAction({
  args: { messageId: v.id("smsMessages") }, returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.runQuery(internal.messaging.functions.getForDelivery, args);
    if (!message || (message.status !== "queued" && message.status !== "failed")) return null;
    if (!(await ctx.runMutation(internal.messaging.functions.markSending, args))) return null;
    const apiKey = env.SMS_BD_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.messaging.functions.recordFailure, { ...args, code: "not_configured", message: "SMS provider is not configured", retryable: false });
      return null;
    }
    try {
      const result = await sendSmsBd({ apiKey, senderId: env.SMS_BD_SENDER_ID, recipient: message.recipient, body: message.body });
      await ctx.runMutation(internal.messaging.functions.recordAccepted, { ...args, providerRequestId: result.requestId, providerStatus: result.providerStatus });
      await ctx.scheduler.runAfter(60_000, internal.messaging.actions.pollReport, args);
    } catch (cause) {
      const error = cause instanceof SmsProviderError ? cause : new SmsProviderError("Unexpected SMS provider failure", "unexpected", true);
      const retryable = error.retryable && message.attemptCount < 4;
      const delay = Math.min(30 * 60_000, 30_000 * 2 ** message.attemptCount);
      await ctx.runMutation(internal.messaging.functions.recordFailure, { ...args, code: error.code, message: error.message, retryable, ...(retryable ? { nextAttemptAt: Date.now() + delay } : {}) });
      if (retryable) await ctx.scheduler.runAfter(delay, internal.messaging.actions.sendQueued, args);
    }
    return null;
  },
});

export const pollReport = internalAction({
  args: { messageId: v.id("smsMessages") }, returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.runQuery(internal.messaging.functions.getForDelivery, args);
    const apiKey = env.SMS_BD_API_KEY;
    if (!message?.providerRequestId || !apiKey || (message.status !== "accepted" && message.status !== "sent")) return null;
    try {
      const report = await getSmsBdReport({ apiKey, requestId: message.providerRequestId });
      await ctx.runMutation(internal.messaging.functions.recordReport, { ...args, ...report });
      if (report.status === "pending" && Date.now() - message.createdAt < 24 * 60 * 60_000) await ctx.scheduler.runAfter(5 * 60_000, internal.messaging.actions.pollReport, args);
    } catch {
      if (Date.now() - message.createdAt < 24 * 60 * 60_000) await ctx.scheduler.runAfter(5 * 60_000, internal.messaging.actions.pollReport, args);
    }
    return null;
  },
});

export const pollBalance = internalAction({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    if (!env.SMS_BD_API_KEY) return null;
    try {
      const balanceMinor = await getSmsBdBalance(env.SMS_BD_API_KEY);
      await ctx.runMutation(internal.messaging.functions.recordBalance, { balanceMinor, providerStatus: "ok" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.slice(0, 300) : "Balance check failed";
      await ctx.runMutation(internal.messaging.functions.recordBalance, { providerStatus: "error", error: message });
    }
    return null;
  },
});
