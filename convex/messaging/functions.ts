import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import { paginationResultFields } from "../model/validators";
import { ENABLED_SMS_EVENT_TYPES } from "./templateCatalog";

const deliveryView = v.object({
  messageId: v.id("smsMessages"), status: v.union(v.literal("queued"), v.literal("sending"), v.literal("accepted"), v.literal("sent"), v.literal("delivered"), v.literal("failed"), v.literal("cancelled")),
  eventType: v.string(), recipient: v.string(), body: v.string(), attemptCount: v.number(), createdAt: v.number(), providerRequestId: v.union(v.string(), v.null()),
});

export const getForDelivery = internalQuery({
  args: { messageId: v.id("smsMessages") }, returns: v.union(deliveryView, v.null()),
  handler: async (ctx, args) => {
    const message = await ctx.db.get("smsMessages", args.messageId);
    return message ? { messageId: message._id, status: message.status, eventType: message.eventType, recipient: message.normalizedRecipient, body: message.body, attemptCount: message.attemptCount, createdAt: message.createdAt, providerRequestId: message.providerRequestId ?? null } : null;
  },
});

export const cancelDisallowed = internalMutation({
  args: { messageId: v.id("smsMessages") }, returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get("smsMessages", args.messageId);
    if (message && !ENABLED_SMS_EVENT_TYPES.has(message.eventType))
      await ctx.db.patch("smsMessages", message._id, { status: "cancelled", lastErrorCode: "event_disabled", lastErrorMessage: "This SMS event is disabled", nextAttemptAt: undefined, updatedAt: Date.now() });
    return null;
  },
});

export const markSending = internalMutation({
  args: { messageId: v.id("smsMessages") }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get("smsMessages", args.messageId);
    if (!message || (message.status !== "queued" && message.status !== "failed")) return false;
    await ctx.db.patch("smsMessages", message._id, { status: "sending", lastAttemptAt: Date.now(), nextAttemptAt: undefined, updatedAt: Date.now() });
    return true;
  },
});

export const recordAccepted = internalMutation({
  args: { messageId: v.id("smsMessages"), providerRequestId: v.string(), providerStatus: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get("smsMessages", args.messageId);
    if (!message) return null;
    await ctx.db.patch("smsMessages", message._id, { status: "accepted", providerRequestId: args.providerRequestId, providerStatus: args.providerStatus, attemptCount: message.attemptCount + 1, sentAt: Date.now(), updatedAt: Date.now(), lastErrorCode: undefined, lastErrorMessage: undefined });
    return null;
  },
});

export const recordFailure = internalMutation({
  args: { messageId: v.id("smsMessages"), code: v.string(), message: v.string(), retryable: v.boolean(), nextAttemptAt: v.optional(v.number()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("smsMessages", args.messageId);
    if (!row) return null;
    await ctx.db.patch("smsMessages", row._id, { status: args.retryable ? "queued" : "failed", attemptCount: row.attemptCount + 1, nextAttemptAt: args.nextAttemptAt, lastErrorCode: args.code, lastErrorMessage: args.message.slice(0, 300), updatedAt: Date.now() });
    return null;
  },
});

export const recordReport = internalMutation({
  args: { messageId: v.id("smsMessages"), status: v.union(v.literal("sent"), v.literal("delivered"), v.literal("failed"), v.literal("pending")), providerStatus: v.string(), chargeMinor: v.optional(v.number()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("smsMessages", args.messageId);
    if (!row) return null;
    const status = args.status === "pending" ? row.status : args.status;
    await ctx.db.patch("smsMessages", row._id, { status, providerStatus: args.providerStatus, providerChargeMinor: args.chargeMinor, deliveredAt: args.status === "delivered" ? Date.now() : row.deliveredAt, updatedAt: Date.now() });
    return null;
  },
});

export const recordBalance = internalMutation({
  args: { balanceMinor: v.optional(v.number()), providerStatus: v.string(), error: v.optional(v.string()) }, returns: v.null(),
  handler: async (ctx, args) => { await ctx.db.insert("smsProviderSnapshots", { checkedAt: Date.now(), ...args }); return null; },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator, status: v.optional(v.union(v.literal("queued"), v.literal("sending"), v.literal("accepted"), v.literal("sent"), v.literal("delivered"), v.literal("failed"), v.literal("cancelled"))) },
  returns: v.object({ page: v.array(v.object({ messageId: v.id("smsMessages"), eventType: v.string(), recipient: v.string(), status: v.string(), segmentEstimate: v.number(), attemptCount: v.number(), providerStatus: v.union(v.string(), v.null()), lastErrorMessage: v.union(v.string(), v.null()), createdAt: v.number() })), ...paginationResultFields }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const page = args.status
      ? await ctx.db.query("smsMessages").withIndex("by_status_and_nextAttemptAt", (q) => q.eq("status", args.status!)).order("desc").paginate(args.paginationOpts)
      : await ctx.db.query("smsMessages").order("desc").paginate(args.paginationOpts);
    return { ...page, page: page.page.map((row) => ({ messageId: row._id, eventType: row.eventType, recipient: row.normalizedRecipient, status: row.status, segmentEstimate: row.segmentEstimate, attemptCount: row.attemptCount, providerStatus: row.providerStatus ?? null, lastErrorMessage: row.lastErrorMessage ?? null, createdAt: row.createdAt })) };
  },
});

export const retry = mutation({
  args: { messageId: v.id("smsMessages") }, returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const row = await ctx.db.get("smsMessages", args.messageId);
    if (!row || row.status !== "failed") throw new Error("Message is not eligible for retry");
    if (!ENABLED_SMS_EVENT_TYPES.has(row.eventType)) throw new Error("This SMS event is disabled");
    await ctx.db.patch("smsMessages", row._id, { status: "queued", nextAttemptAt: Date.now(), updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.messaging.actions.sendQueued, { messageId: row._id });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "sms.retry", entityType: "smsMessage", entityId: row._id, summary: "SMS retry requested" });
    return null;
  },
});
