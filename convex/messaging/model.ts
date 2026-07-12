import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { estimateSmsSegments } from "./templates";
import { normalizeBangladeshPhone } from "../model/normalization";

export async function enqueueSms(ctx: MutationCtx, input: {
  idempotencyKey: string;
  eventType: "admission_received" | "admission_accepted" | "payment_posted" | "attendance_late" | "attendance_absent" | "result_published" | "result_corrected" | "due_reminder" | "custom_notice";
  relatedEntityType: string;
  relatedEntityId: string;
  studentId?: Id<"students">;
  guardianPhone: string;
  locale: "bn" | "en";
  body: string;
}) {
  const existing = await ctx.db.query("smsMessages").withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", input.idempotencyKey)).unique();
  if (existing) return existing._id;
  const now = Date.now();
  const normalizedRecipient = normalizeBangladeshPhone(input.guardianPhone);
  const { segmentCount } = estimateSmsSegments(input.body);
  const settings = (await ctx.db.query("coachingSettings").take(1))[0];
  const enabled = settings?.smsEnabled ?? true;
  const messageId = await ctx.db.insert("smsMessages", {
    ...input, normalizedRecipient, segmentEstimate: segmentCount, status: enabled ? "queued" : "cancelled", provider: "sms_bd", attemptCount: 0,
    nextAttemptAt: enabled ? now : undefined, createdAt: now, updatedAt: now,
  });
  if (enabled) await ctx.scheduler.runAfter(0, internal.messaging.actions.sendQueued, { messageId });
  return messageId;
}
