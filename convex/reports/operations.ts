import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { smsEventTypeValidator, smsStatusValidator } from "../model/validators";

const pageFields = {
  isDone: v.boolean(),
  continueCursor: v.string(),
  splitCursor: v.optional(v.union(v.string(), v.null())),
  pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
};

export const admissionApplications = query({
  args: { status: v.union(v.literal("new"), v.literal("under_review"), v.literal("accepted"), v.literal("rejected"), v.literal("withdrawn")), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.object({ applicationId: v.id("admissionApplications"), applicationNumber: v.string(), studentDisplayName: v.string(), normalizedStudentEmail: v.string(), guardianPhone: v.string(), requestedCourseId: v.optional(v.id("courses")), requestedBatchId: v.optional(v.id("batches")), status: v.string(), submittedAt: v.number() })), ...pageFields }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const page = await ctx.db.query("admissionApplications").withIndex("by_status_and_submittedAt", (q) => q.eq("status", args.status)).order("desc").paginate(args.paginationOpts);
    return { ...page, page: page.page.map((application) => ({ applicationId: application._id, applicationNumber: application.applicationNumber, studentDisplayName: application.studentDisplayName, normalizedStudentEmail: application.normalizedStudentEmail, guardianPhone: application.guardianPhone, requestedCourseId: application.requestedCourseId, requestedBatchId: application.requestedBatchId, status: application.status, submittedAt: application.submittedAt })) };
  },
});

export const admissionsFunnel = query({
  args: { fromAt: v.number(), toAt: v.number() },
  returns: v.object({ stages: v.array(v.object({ status: v.string(), count: v.number() })), truncated: v.boolean() }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.fromAt >= args.toAt) throw new Error("Invalid admissions range");
    const statuses = ["new", "under_review", "accepted", "rejected", "withdrawn"] as const;
    let truncated = false;
    const stages = [];
    for (const status of statuses) {
      const applications = await ctx.db.query("admissionApplications").withIndex("by_status_and_submittedAt", (q) => q.eq("status", status).gte("submittedAt", args.fromAt).lt("submittedAt", args.toAt)).take(1001);
      truncated ||= applications.length > 1000;
      stages.push({ status, count: Math.min(1000, applications.length) });
    }
    return { stages, truncated };
  },
});

export const smsDelivery = query({
  args: { eventType: smsEventTypeValidator, fromAt: v.number(), toAt: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.object({ smsMessageId: v.id("smsMessages"), eventType: smsEventTypeValidator, studentId: v.union(v.id("students"), v.null()), recipient: v.string(), locale: v.string(), status: smsStatusValidator, providerStatus: v.union(v.string(), v.null()), segmentEstimate: v.number(), providerChargeMinor: v.union(v.number(), v.null()), attemptCount: v.number(), createdAt: v.number(), deliveredAt: v.union(v.number(), v.null()) })), ...pageFields }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.fromAt >= args.toAt) throw new Error("Invalid SMS range");
    const page = await ctx.db.query("smsMessages").withIndex("by_eventType_and_createdAt", (q) => q.eq("eventType", args.eventType).gte("createdAt", args.fromAt).lt("createdAt", args.toAt)).order("desc").paginate(args.paginationOpts);
    return { ...page, page: page.page.map((message) => ({ smsMessageId: message._id, eventType: message.eventType, studentId: message.studentId ?? null, recipient: message.normalizedRecipient, locale: message.locale, status: message.status, providerStatus: message.providerStatus ?? null, segmentEstimate: message.segmentEstimate, providerChargeMinor: message.providerChargeMinor ?? null, attemptCount: message.attemptCount, createdAt: message.createdAt, deliveredAt: message.deliveredAt ?? null })) };
  },
});

export const smsCharges = query({
  args: { eventType: smsEventTypeValidator, fromAt: v.number(), toAt: v.number() },
  returns: v.object({ messageCount: v.number(), deliveredCount: v.number(), failedCount: v.number(), segments: v.number(), knownChargeMinor: v.number(), unknownChargeCount: v.number(), truncated: v.boolean() }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.fromAt >= args.toAt) throw new Error("Invalid SMS range");
    const messages = await ctx.db.query("smsMessages").withIndex("by_eventType_and_createdAt", (q) => q.eq("eventType", args.eventType).gte("createdAt", args.fromAt).lt("createdAt", args.toAt)).take(1001);
    const bounded = messages.slice(0, 1000);
    return {
      messageCount: bounded.length,
      deliveredCount: bounded.filter((message) => message.status === "delivered").length,
      failedCount: bounded.filter((message) => message.status === "failed").length,
      segments: bounded.reduce((sum, message) => sum + message.segmentEstimate, 0),
      knownChargeMinor: bounded.reduce((sum, message) => sum + (message.providerChargeMinor ?? 0), 0),
      unknownChargeCount: bounded.filter((message) => message.providerChargeMinor == null).length,
      truncated: messages.length > 1000,
    };
  },
});
