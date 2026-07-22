import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { estimateSmsSegments } from "./templates";
import { normalizeBangladeshPhone } from "../model/normalization";
import { renderSmsTemplate as renderTemplate } from "./templates";
import { ENABLED_SMS_EVENT_TYPES, SMS_TEMPLATE_DEFAULTS, type SmsTemplateKey } from "./templateCatalog";

type SmsTemplateCtx = Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">;

export async function renderSmsTemplate(
  ctx: SmsTemplateCtx,
  key: SmsTemplateKey,
  locale: "bn" | "en",
  variables: Record<string, string | number>,
) {
  const template = await ctx.db.query("smsTemplates").withIndex("by_key", (q) => q.eq("key", key)).unique();
  const source = template ?? SMS_TEMPLATE_DEFAULTS[key];
  const rendered = renderTemplate(locale === "bn" ? source.bodyBn : source.bodyEn, variables);
  return rendered.missingVariables.length === 0 ? rendered.body : null;
}

export async function renderEnabledSmsTemplate(
  ctx: SmsTemplateCtx,
  key: SmsTemplateKey,
  locale: "bn" | "en",
  variables: Record<string, string | number>,
) {
  if (!ENABLED_SMS_EVENT_TYPES.has(key)) return null;
  const template = await ctx.db.query("smsTemplates").withIndex("by_key", (q) => q.eq("key", key)).unique();
  if (template && !template.enabled) return null;
  return await renderSmsTemplate(ctx, key, locale, variables);
}

export async function enqueueSms(
  ctx: MutationCtx,
  input: {
    idempotencyKey: string;
    eventType:
      | "admission_received"
      | "admission_accepted"
      | "payment_posted"
      | "attendance_late"
      | "attendance_absent"
      | "result_published"
      | "result_corrected"
      | "due_reminder"
      | "custom_notice";
    relatedEntityType: string;
    relatedEntityId: string;
    studentId?: Id<"students">;
    guardianPhone: string;
    locale: "bn" | "en";
    body: string;
  },
) {
  if (!ENABLED_SMS_EVENT_TYPES.has(input.eventType)) return [];
  const student = input.studentId
    ? await ctx.db.get("students", input.studentId)
    : null;
  const preference = student?.smsRecipient ?? "father";
  const recipients =
    preference === "both" && student?.motherPhone
      ? [input.guardianPhone, student.motherPhone]
      : preference === "mother" && student?.motherPhone
        ? [student.motherPhone]
        : [input.guardianPhone];
  const uniqueRecipients = [
    ...new Set(
      recipients.flatMap((recipient) => {
        try {
          return [normalizeBangladeshPhone(recipient)];
        } catch {
          return [];
        }
      }),
    ),
  ];
  const now = Date.now();
  const { segmentCount } = estimateSmsSegments(input.body);
  const settings = (await ctx.db.query("coachingSettings").take(1))[0];
  const enabled = settings?.smsEnabled ?? true;
  const messageIds = [];
  for (const normalizedRecipient of uniqueRecipients) {
    const idempotencyKey = `${input.idempotencyKey}:${normalizedRecipient}`;
    const existing = await ctx.db
      .query("smsMessages")
      .withIndex("by_idempotencyKey", (q) =>
        q.eq("idempotencyKey", idempotencyKey),
      )
      .unique();
    if (existing) {
      messageIds.push(existing._id);
      continue;
    }
    const messageId = await ctx.db.insert("smsMessages", {
      ...input,
      idempotencyKey,
      guardianPhone: normalizedRecipient,
      normalizedRecipient,
      segmentEstimate: segmentCount,
      status: enabled ? "queued" : "cancelled",
      provider: "bulksmsbd",
      attemptCount: 0,
      nextAttemptAt: enabled ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
    messageIds.push(messageId);
    if (enabled)
      await ctx.scheduler.runAfter(0, internal.messaging.actions.sendQueued, {
        messageId,
      });
  }
  return messageIds;
}
