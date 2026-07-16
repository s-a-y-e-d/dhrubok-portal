import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner, requireOwnerForFinancialMutation } from "../model/auth";
import { assertMinorUnits } from "../model/money";
import { nextIdentifier } from "../model/identifiers";
import { writeAudit } from "../model/audit";
import { enqueueSms } from "../messaging/model";
import { estimateSmsSegments } from "../messaging/templates";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const scopeValidator = v.union(
  v.literal("all"),
  v.literal("course"),
  v.literal("batch"),
  v.literal("custom"),
);
const bucketValidator = v.union(
  v.literal("1_15"),
  v.literal("16_30"),
  v.literal("31_60"),
  v.literal("61_90"),
  v.literal("over_90"),
);
const DEFAULT_BN =
  "ধ্রুবক: {student}-এর বকেয়া ৳ {amount}। অনুগ্রহ করে অফিসে যোগাযোগ করুন।";
const DEFAULT_EN =
  "Dhrubok: {student} has overdue fees of BDT {amount}. Please contact the office.";

function money(minor: number) {
  return (minor / 100).toFixed(2);
}
function render(template: string, student: string, overdueMinor: number) {
  return template
    .replaceAll("{student}", student)
    .replaceAll("{amount}", money(overdueMinor));
}

export const createPreview = mutation({
  args: {
    scopeType: scopeValidator,
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    studentIds: v.optional(v.array(v.id("students"))),
    ageingBuckets: v.array(bucketValidator),
    minimumOverdueMinor: v.optional(v.number()),
    maximumOverdueMinor: v.optional(v.number()),
    suppressIfRemindedSince: v.optional(v.number()),
    localeMode: v.union(
      v.literal("student_preference"),
      v.literal("bn"),
      v.literal("en"),
    ),
    templateBn: v.optional(v.string()),
    templateEn: v.optional(v.string()),
  },
  returns: v.id("dueReminderCampaigns"),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    if (args.minimumOverdueMinor !== undefined)
      assertMinorUnits(args.minimumOverdueMinor);
    if (args.maximumOverdueMinor !== undefined)
      assertMinorUnits(args.maximumOverdueMinor);
    if (args.scopeType === "course" && !args.courseId)
      throw new Error("Course is required");
    if (args.scopeType === "batch" && !args.batchId)
      throw new Error("Batch is required");
    if (args.batchId) {
      const batch = await ctx.db.get("batches", args.batchId);
      if (!batch) throw new Error("Batch not found");
      if (args.courseId && batch.courseId !== args.courseId)
        throw new Error("Batch does not belong to course");
    }
    if ((args.studentIds?.length ?? 0) > 200)
      throw new Error("Custom campaign preview is limited to 200 students");
    const summaries =
      args.scopeType === "course"
        ? await ctx.db
            .query("receivableScopeSummaries")
            .withIndex("by_courseId_and_overdueMinor", (q) =>
              q.eq("courseId", args.courseId).gt("overdueMinor", 0),
            )
            .take(500)
        : args.scopeType === "batch"
          ? await ctx.db
              .query("receivableScopeSummaries")
              .withIndex("by_batchId_and_overdueMinor", (q) =>
                q.eq("batchId", args.batchId).gt("overdueMinor", 0),
              )
              .take(500)
          : await ctx.db
              .query("studentFinancialSummaries")
              .withIndex("by_overdueMinor", (q) => q.gt("overdueMinor", 0))
              .take(500);
    const requested = args.studentIds ? new Set(args.studentIds) : null;
    type Audience = {
      studentId: Id<"students">;
      currentMinor: number;
      overdue1To15Minor: number;
      overdue16To30Minor: number;
      overdue31To60Minor: number;
      overdue61To90Minor: number;
      overdueOver90Minor: number;
      overdueMinor: number;
    };
    const byStudent = new Map<string, Audience>();
    for (const summary of summaries) {
      if (requested && !requested.has(summary.studentId)) continue;
      const current = byStudent.get(summary.studentId) ?? {
        studentId: summary.studentId,
        currentMinor: 0,
        overdue1To15Minor: 0,
        overdue16To30Minor: 0,
        overdue31To60Minor: 0,
        overdue61To90Minor: 0,
        overdueOver90Minor: 0,
        overdueMinor: 0,
      };
      current.currentMinor += summary.currentMinor ?? 0;
      current.overdue1To15Minor += summary.overdue1To15Minor ?? 0;
      current.overdue16To30Minor += summary.overdue16To30Minor ?? 0;
      current.overdue31To60Minor += summary.overdue31To60Minor ?? 0;
      current.overdue61To90Minor += summary.overdue61To90Minor ?? 0;
      current.overdueOver90Minor += summary.overdueOver90Minor ?? 0;
      current.overdueMinor =
        current.overdue1To15Minor +
        current.overdue16To30Minor +
        current.overdue31To60Minor +
        current.overdue61To90Minor +
        current.overdueOver90Minor;
      byStudent.set(summary.studentId, current);
    }
    const now = Date.now();
    const templateBn = args.templateBn?.trim() || DEFAULT_BN;
    const templateEn = args.templateEn?.trim() || DEFAULT_EN;
    const campaignNumber = await nextIdentifier(
      ctx,
      "due_campaign",
      "DUE",
      Number(new Date().getUTCFullYear()),
    );
    const campaignId = await ctx.db.insert("dueReminderCampaigns", {
      campaignNumber,
      status: "previewed",
      scopeType: args.scopeType,
      courseId: args.courseId,
      batchId: args.batchId,
      ageingBuckets: args.ageingBuckets,
      minimumOverdueMinor: args.minimumOverdueMinor,
      maximumOverdueMinor: args.maximumOverdueMinor,
      suppressIfRemindedSince: args.suppressIfRemindedSince,
      localeMode: args.localeMode,
      templateBnSnapshot: templateBn,
      templateEnSnapshot: templateEn,
      resolvedStudentCount: byStudent.size,
      eligibleRecipientCount: 0,
      suppressedRecipientCount: 0,
      queuedMessageCount: 0,
      deliveredMessageCount: 0,
      failedMessageCount: 0,
      estimatedSegments: 0,
      createdByAccountId: account._id,
      createdAt: now,
      previewedAt: now,
    });
    let eligible = 0,
      suppressed = 0,
      segments = 0;
    for (const summary of byStudent.values()) {
      const selectedOverdueMinor =
        args.ageingBuckets.length === 0
          ? summary.overdueMinor
          : args.ageingBuckets.reduce(
              (total, bucket) =>
                total +
                (bucket === "1_15"
                  ? summary.overdue1To15Minor
                  : bucket === "16_30"
                    ? summary.overdue16To30Minor
                    : bucket === "31_60"
                      ? summary.overdue31To60Minor
                      : bucket === "61_90"
                        ? summary.overdue61To90Minor
                        : summary.overdueOver90Minor),
              0,
            );
      if (
        selectedOverdueMinor < (args.minimumOverdueMinor ?? 1) ||
        (args.maximumOverdueMinor !== undefined &&
          selectedOverdueMinor > args.maximumOverdueMinor)
      )
        continue;
      const student = await ctx.db.get("students", summary.studentId);
      if (!student) continue;
      const previous = args.suppressIfRemindedSince
        ? await ctx.db
            .query("dueReminderCampaignRecipients")
            .withIndex("by_studentId_and_createdAt", (q) =>
              q
                .eq("studentId", student._id)
                .gte("createdAt", args.suppressIfRemindedSince!),
            )
            .order("desc")
            .first()
        : null;
      const isSuppressed = Boolean(previous);
      const locale =
        args.localeMode === "student_preference"
          ? student.preferredSmsLocale
          : args.localeMode;
      const body = render(
        locale === "bn" ? templateBn : templateEn,
        student.displayName,
        selectedOverdueMinor,
      );
      const segmentCount = estimateSmsSegments(body).segmentCount;
      await ctx.db.insert("dueReminderCampaignRecipients", {
        campaignId,
        studentId: student._id,
        courseId: args.courseId,
        batchId: args.batchId,
        overdueMinorSnapshot: selectedOverdueMinor,
        currentMinor: summary.currentMinor ?? 0,
        overdue1To15Minor: summary.overdue1To15Minor ?? 0,
        overdue16To30Minor: summary.overdue16To30Minor ?? 0,
        overdue31To60Minor: summary.overdue31To60Minor ?? 0,
        overdue61To90Minor: summary.overdue61To90Minor ?? 0,
        overdueOver90Minor: summary.overdueOver90Minor ?? 0,
        guardianPhoneSnapshot: student.guardianPhone,
        locale,
        messageBodySnapshot: body,
        segmentCount,
        status: isSuppressed ? "suppressed" : "eligible",
        suppressionReason: isSuppressed ? "Recently reminded" : undefined,
        createdAt: now,
        updatedAt: now,
      });
      if (isSuppressed) suppressed += 1;
      else {
        eligible += 1;
        segments += segmentCount;
      }
    }
    await ctx.db.patch("dueReminderCampaigns", campaignId, {
      eligibleRecipientCount: eligible,
      suppressedRecipientCount: suppressed,
      estimatedSegments: segments,
    });
    return campaignId;
  },
});

export const queueCampaign = mutation({
  args: { campaignId: v.id("dueReminderCampaigns"), confirmed: v.boolean() },
  returns: v.object({ queued: v.number() }),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    if (!args.confirmed) throw new Error("Campaign confirmation is required");
    const campaign = await ctx.db.get("dueReminderCampaigns", args.campaignId);
    if (!campaign || campaign.status !== "previewed")
      throw new Error("Campaign is not ready to queue");
    const recipients = await ctx.db
      .query("dueReminderCampaignRecipients")
      .withIndex("by_campaignId_and_status", (q) =>
        q.eq("campaignId", campaign._id).eq("status", "eligible"),
      )
      .take(500);
    let queued = 0;
    const now = Date.now();
    for (const recipient of recipients) {
      const ids = await enqueueSms(ctx, {
        idempotencyKey: `due:${campaign._id}:${recipient.studentId}`,
        eventType: "due_reminder",
        relatedEntityType: "dueReminderCampaign",
        relatedEntityId: campaign._id,
        studentId: recipient.studentId,
        guardianPhone: recipient.guardianPhoneSnapshot,
        locale: recipient.locale,
        body: recipient.messageBodySnapshot,
      });
      await ctx.db.patch("dueReminderCampaignRecipients", recipient._id, {
        status: "queued",
        smsMessageId: ids[0],
        lastAttemptAt: now,
        updatedAt: now,
      });
      const summary = await ctx.db
        .query("studentFinancialSummaries")
        .withIndex("by_studentId", (q) =>
          q.eq("studentId", recipient.studentId),
        )
        .unique();
      if (summary)
        await ctx.db.patch("studentFinancialSummaries", summary._id, {
          lastReminderAt: now,
        });
      queued += ids.length;
    }
    await ctx.db.patch("dueReminderCampaigns", campaign._id, {
      status: "queued",
      approvedByAccountId: account._id,
      queuedMessageCount: queued,
      queuedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "due_campaign.queued",
      entityType: "dueReminderCampaign",
      entityId: campaign._id,
      summary: "Due reminder campaign queued",
      metadata: { queued },
    });
    return { queued };
  },
});

export const refreshOutcomes = mutation({
  args: { campaignId: v.id("dueReminderCampaigns") },
  returns: v.object({
    delivered: v.number(),
    failed: v.number(),
    pending: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const campaign = await ctx.db.get("dueReminderCampaigns", args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    const recipients = await ctx.db
      .query("dueReminderCampaignRecipients")
      .withIndex("by_campaignId_and_status", (q) =>
        q.eq("campaignId", campaign._id),
      )
      .take(500);
    let delivered = 0,
      failed = 0,
      pending = 0;
    for (const recipient of recipients) {
      if (!recipient.smsMessageId) continue;
      const sms = await ctx.db.get("smsMessages", recipient.smsMessageId);
      if (!sms) continue;
      const status =
        sms.status === "delivered"
          ? "delivered"
          : sms.status === "failed" || sms.status === "cancelled"
            ? "failed"
            : sms.status === "accepted" || sms.status === "sent"
              ? "accepted"
              : "queued";
      if (status === "delivered") delivered++;
      else if (status === "failed") failed++;
      else pending++;
      if (recipient.status !== status)
        await ctx.db.patch("dueReminderCampaignRecipients", recipient._id, {
          status,
          updatedAt: Date.now(),
        });
    }
    await ctx.db.patch("dueReminderCampaigns", campaign._id, {
      deliveredMessageCount: delivered,
      failedMessageCount: failed,
      status:
        pending === 0 && delivered + failed > 0 ? "completed" : campaign.status,
      completedAt:
        pending === 0 && delivered + failed > 0
          ? Date.now()
          : campaign.completedAt,
    });
    return { delivered, failed, pending };
  },
});

export const retryFailed = mutation({
  args: { campaignId: v.id("dueReminderCampaigns"), confirmed: v.boolean() },
  returns: v.object({ retried: v.number() }),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    if (!args.confirmed) throw new Error("Retry confirmation is required");
    const campaign = await ctx.db.get("dueReminderCampaigns", args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    const recipients = await ctx.db
      .query("dueReminderCampaignRecipients")
      .withIndex("by_campaignId_and_status", (q) =>
        q.eq("campaignId", campaign._id).eq("status", "failed"),
      )
      .take(200);
    let retried = 0;
    for (const recipient of recipients) {
      if (!recipient.smsMessageId) continue;
      const sms = await ctx.db.get("smsMessages", recipient.smsMessageId);
      if (!sms || (sms.status !== "failed" && sms.status !== "cancelled"))
        continue;
      await ctx.db.patch("smsMessages", sms._id, {
        status: "queued",
        nextAttemptAt: Date.now(),
        updatedAt: Date.now(),
        lastErrorCode: undefined,
        lastErrorMessage: undefined,
      });
      await ctx.db.patch("dueReminderCampaignRecipients", recipient._id, {
        status: "queued",
        lastAttemptAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.messaging.actions.sendQueued, {
        messageId: sms._id,
      });
      retried++;
    }
    if (retried)
      await ctx.db.patch("dueReminderCampaigns", campaign._id, {
        status: "queued",
        completedAt: undefined,
      });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "due_campaign.retried",
      entityType: "dueReminderCampaign",
      entityId: campaign._id,
      summary: "Failed campaign recipients retried",
      metadata: { retried },
    });
    return { retried };
  },
});

export const getCampaign = query({
  args: { campaignId: v.id("dueReminderCampaigns") },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const campaign = await ctx.db.get("dueReminderCampaigns", args.campaignId);
    if (!campaign) return null;
    const recipients = await ctx.db
      .query("dueReminderCampaignRecipients")
      .withIndex("by_campaignId_and_status", (q) =>
        q.eq("campaignId", campaign._id),
      )
      .take(500);
    return {
      campaign,
      recipients: await Promise.all(
        recipients.map(async (row) => {
          const student = await ctx.db.get("students", row.studentId);
          return {
            ...row,
            studentNumber: student?.studentNumber ?? "",
            displayName: student?.displayName ?? "",
          };
        }),
      ),
    };
  },
});

export const setRecipientIncluded = mutation({
  args: {
    recipientId: v.id("dueReminderCampaignRecipients"),
    included: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnerForFinancialMutation(ctx);
    const recipient = await ctx.db.get(
      "dueReminderCampaignRecipients",
      args.recipientId,
    );
    if (!recipient) throw new Error("Campaign recipient not found");
    const campaign = await ctx.db.get(
      "dueReminderCampaigns",
      recipient.campaignId,
    );
    if (!campaign || campaign.status !== "previewed")
      throw new Error("Only previewed campaigns can be edited");
    if (recipient.status === "suppressed")
      throw new Error("Suppressed recipients cannot be included");
    await ctx.db.patch("dueReminderCampaignRecipients", recipient._id, {
      status: args.included ? "eligible" : "cancelled",
      suppressionReason: args.included
        ? undefined
        : "Owner excluded before queueing",
      updatedAt: Date.now(),
    });
    const rows = await ctx.db
      .query("dueReminderCampaignRecipients")
      .withIndex("by_campaignId_and_status", (q) =>
        q.eq("campaignId", campaign._id),
      )
      .take(500);
    const eligible = rows.filter((row) =>
      row._id === recipient._id ? args.included : row.status === "eligible",
    );
    await ctx.db.patch("dueReminderCampaigns", campaign._id, {
      eligibleRecipientCount: eligible.length,
      estimatedSegments: eligible.reduce(
        (sum, row) => sum + row.segmentCount,
        0,
      ),
    });
    return null;
  },
});

export const listCampaigns = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.db
      .query("dueReminderCampaigns")
      .withIndex("by_status_and_createdAt")
      .order("desc")
      .take(50);
  },
});
