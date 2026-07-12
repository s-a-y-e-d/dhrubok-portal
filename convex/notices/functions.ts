import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAccount, requireOwner, requireStudent } from "../model/auth";
import { writeAudit } from "../model/audit";
import { enqueueSms } from "../messaging/model";
import { noticeSmsBodies, requireNoticeManager, resolveAudienceStudents, validateNoticeAudience, validateNoticeContent } from "./shared";

const audienceValidator = v.union(v.literal("public"), v.literal("all_students"), v.literal("course"), v.literal("batch"), v.literal("individual_students"));
const statusValidator = v.union(v.literal("draft"), v.literal("published"), v.literal("archived"));

const noticeValidator = v.object({
  _id: v.id("notices"), _creationTime: v.number(), titleBn: v.string(), titleEn: v.string(), bodyBn: v.string(), bodyEn: v.string(),
  audienceType: audienceValidator, courseId: v.optional(v.id("courses")), batchId: v.optional(v.id("batches")), status: statusValidator,
  sendSms: v.boolean(), publishedAt: v.optional(v.number()), createdByAccountId: v.id("portalAccounts"), createdAt: v.number(), updatedAt: v.number(),
});

const studentNoticeValidator = v.object({
  _id: v.id("notices"), titleBn: v.string(), titleEn: v.string(), bodyBn: v.string(), bodyEn: v.string(),
  audienceType: audienceValidator, courseId: v.optional(v.id("courses")), batchId: v.optional(v.id("batches")), publishedAt: v.optional(v.number()),
});
const toStudentNotice = (notice: import("../_generated/dataModel").Doc<"notices">) => ({ _id: notice._id, titleBn: notice.titleBn, titleEn: notice.titleEn, bodyBn: notice.bodyBn, bodyEn: notice.bodyEn, audienceType: notice.audienceType, courseId: notice.courseId, batchId: notice.batchId, publishedAt: notice.publishedAt });

const noticeInput = {
  titleBn: v.string(), titleEn: v.string(), bodyBn: v.string(), bodyEn: v.string(), audienceType: audienceValidator,
  courseId: v.optional(v.id("courses")), batchId: v.optional(v.id("batches")), studentIds: v.optional(v.array(v.id("students"))), sendSms: v.boolean(),
};

async function replaceIndividualRecipients(ctx: Parameters<typeof writeAudit>[0], noticeId: Parameters<typeof resolveAudienceStudents>[1]["_id"], studentIds: Parameters<typeof validateNoticeAudience>[1]["studentIds"]) {
  const existing = await ctx.db.query("noticeRecipients").withIndex("by_noticeId", (q) => q.eq("noticeId", noticeId)).take(1_001);
  if (existing.length > 1_000) throw new Error("Notice audience is too large");
  for (const recipient of existing) await ctx.db.delete("noticeRecipients", recipient._id);
  for (const studentId of studentIds ?? []) await ctx.db.insert("noticeRecipients", { noticeId, studentId });
}

async function freezeRecipients(ctx: Parameters<typeof writeAudit>[0], notice: Parameters<typeof resolveAudienceStudents>[1], studentIds: Awaited<ReturnType<typeof resolveAudienceStudents>>) {
  if (notice.audienceType === "public" || notice.audienceType === "individual_students") return;
  await replaceIndividualRecipients(ctx, notice._id, studentIds);
}

export const create = mutation({
  args: { ...noticeInput, publish: v.boolean(), confirmSms: v.boolean(), expectedSmsRecipientCount: v.optional(v.number()) }, returns: v.id("notices"),
  handler: async (ctx, args) => {
    validateNoticeContent(args);
    await validateNoticeAudience(ctx, args);
    const account = await requireNoticeManager(ctx, args);
    if (account.role === "teacher" && args.audienceType !== "batch") throw new Error("Unauthorized");
    const now = Date.now();
    const id = await ctx.db.insert("notices", {
      titleBn: args.titleBn.trim(), titleEn: args.titleEn.trim(), bodyBn: args.bodyBn.trim(), bodyEn: args.bodyEn.trim(), audienceType: args.audienceType,
      courseId: args.courseId, batchId: args.batchId, status: "draft", sendSms: args.sendSms, createdByAccountId: account._id, createdAt: now, updatedAt: now,
    });
    if (args.audienceType === "individual_students") await replaceIndividualRecipients(ctx, id, args.studentIds);
    if (args.publish) await publishNotice(ctx, id, account, args.confirmSms, args.expectedSmsRecipientCount);
    else await writeAudit(ctx, { actorAccountId: account._id, actorRole: account.role, action: "notice.created", entityType: "notice", entityId: id, summary: "Created notice draft" });
    return id;
  },
});

export const updateDraft = mutation({
  args: { noticeId: v.id("notices"), ...noticeInput }, returns: v.null(),
  handler: async (ctx, args) => {
    const notice = await ctx.db.get("notices", args.noticeId);
    if (!notice || notice.status !== "draft") throw new Error("Only draft notices can be edited");
    validateNoticeContent(args);
    await validateNoticeAudience(ctx, args);
    const account = await requireNoticeManager(ctx, args);
    if (account.role === "teacher" && notice.createdByAccountId !== account._id) throw new Error("Unauthorized");
    await ctx.db.patch("notices", args.noticeId, {
      titleBn: args.titleBn.trim(), titleEn: args.titleEn.trim(), bodyBn: args.bodyBn.trim(), bodyEn: args.bodyEn.trim(), audienceType: args.audienceType,
      courseId: args.courseId, batchId: args.batchId, sendSms: args.sendSms, updatedAt: Date.now(),
    });
    await replaceIndividualRecipients(ctx, args.noticeId, args.audienceType === "individual_students" ? args.studentIds : []);
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: account.role, action: "notice.updated", entityType: "notice", entityId: args.noticeId, summary: "Updated notice draft" });
    return null;
  },
});

async function publishNotice(ctx: Parameters<typeof writeAudit>[0], noticeId: Parameters<typeof replaceIndividualRecipients>[1], account: Awaited<ReturnType<typeof requireAccount>>, confirmSms: boolean, expectedSmsRecipientCount?: number) {
  const notice = await ctx.db.get("notices", noticeId);
  if (!notice || notice.status !== "draft") throw new Error("Only draft notices can be published");
  const studentIds = await resolveAudienceStudents(ctx, notice);
  await freezeRecipients(ctx, notice, studentIds);
  const settings = (await ctx.db.query("coachingSettings").take(1))[0];
  if (notice.sendSms) {
    if (account.role !== "owner") throw new Error("Only owners can send notice SMS");
    if (!settings?.smsEnabled) throw new Error("SMS is disabled in coaching settings");
    if (!confirmSms || expectedSmsRecipientCount !== studentIds.length) throw new Error("SMS preview confirmation is stale or missing");
  }
  const now = Date.now();
  await ctx.db.patch("notices", noticeId, { status: "published", publishedAt: now, updatedAt: now });
  if (notice.sendSms) {
    const bodies = noticeSmsBodies(notice, settings);
    for (const studentId of studentIds) {
      const student = await ctx.db.get("students", studentId);
      if (!student || student.status !== "active") continue;
      const locale = student.preferredSmsLocale;
      await enqueueSms(ctx, {
        idempotencyKey: `notice:${noticeId}:${studentId}`, eventType: "custom_notice", relatedEntityType: "notice", relatedEntityId: noticeId,
        studentId, guardianPhone: student.guardianPhone, locale, body: locale === "bn" ? bodies.bodyBn : bodies.bodyEn,
      });
    }
  }
  await writeAudit(ctx, { actorAccountId: account._id, actorRole: account.role, action: "notice.published", entityType: "notice", entityId: noticeId, summary: notice.sendSms ? "Published notice and queued guardian SMS" : "Published notice", metadata: { recipientCount: studentIds.length, smsRequested: notice.sendSms } });
}

export const publish = mutation({
  args: { noticeId: v.id("notices"), confirmSms: v.boolean(), expectedSmsRecipientCount: v.optional(v.number()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const notice = await ctx.db.get("notices", args.noticeId);
    if (!notice) throw new Error("Notice not found");
    const account = await requireNoticeManager(ctx, notice);
    if (account.role === "teacher" && notice.createdByAccountId !== account._id) throw new Error("Unauthorized");
    await publishNotice(ctx, args.noticeId, account, args.confirmSms, args.expectedSmsRecipientCount);
    return null;
  },
});

export const previewSms = query({
  args: { noticeId: v.id("notices") },
  returns: v.object({ enabled: v.boolean(), recipientCount: v.number(), bangla: v.object({ body: v.string(), encoding: v.union(v.literal("ucs2"), v.literal("gsm")), characterCount: v.number(), segmentCount: v.number() }), english: v.object({ body: v.string(), encoding: v.union(v.literal("ucs2"), v.literal("gsm")), characterCount: v.number(), segmentCount: v.number() }) }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const notice = await ctx.db.get("notices", args.noticeId);
    if (!notice || notice.status !== "draft") throw new Error("Only draft notices can be previewed");
    if (!notice.sendSms) throw new Error("SMS is not enabled for this notice");
    const studentIds = await resolveAudienceStudents(ctx, notice);
    const settings = (await ctx.db.query("coachingSettings").take(1))[0];
    const bodies = noticeSmsBodies(notice, settings);
    void account;
    return { enabled: settings?.smsEnabled ?? false, recipientCount: studentIds.length, bangla: { body: bodies.bodyBn, ...bodies.bn }, english: { body: bodies.bodyEn, ...bodies.en } };
  },
});

export const archive = mutation({
  args: { noticeId: v.id("notices") }, returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const notice = await ctx.db.get("notices", args.noticeId);
    if (!notice) throw new Error("Notice not found");
    if (notice.status === "archived") return null;
    await ctx.db.patch("notices", args.noticeId, { status: "archived", updatedAt: Date.now() });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "notice.archived", entityType: "notice", entityId: args.noticeId, summary: "Archived notice" });
    return null;
  },
});

export const listForStudent = query({
  args: {}, returns: v.array(v.object({ notice: studentNoticeValidator, readAt: v.union(v.number(), v.null()) })),
  handler: async (ctx) => {
    const { student } = await requireStudent(ctx);
    const recipients = await ctx.db.query("noticeRecipients").withIndex("by_studentId_and_readAt", (q) => q.eq("studentId", student._id)).order("desc").take(200);
    const rows = [];
    for (const recipient of recipients) {
      const notice = await ctx.db.get("notices", recipient.noticeId);
      if (notice?.status === "published" && notice.audienceType !== "public") rows.push({ notice: toStudentNotice(notice), readAt: recipient.readAt ?? null });
    }
    const publicNotices = await ctx.db.query("notices").withIndex("by_audienceType_and_status", (q) => q.eq("audienceType", "public").eq("status", "published")).order("desc").take(50);
    for (const notice of publicNotices) rows.push({ notice: toStudentNotice(notice), readAt: null });
    return rows.sort((a, b) => (b.notice.publishedAt ?? 0) - (a.notice.publishedAt ?? 0));
  },
});

export const markRead = mutation({
  args: { noticeId: v.id("notices") }, returns: v.null(),
  handler: async (ctx, args) => {
    const { student } = await requireStudent(ctx);
    const notice = await ctx.db.get("notices", args.noticeId);
    if (!notice || notice.status !== "published" || notice.audienceType === "public") throw new Error("Notice is unavailable");
    const recipient = await ctx.db.query("noticeRecipients").withIndex("by_noticeId_and_studentId", (q) => q.eq("noticeId", args.noticeId).eq("studentId", student._id)).unique();
    if (!recipient) throw new Error("Unauthorized");
    if (!recipient.readAt) await ctx.db.patch("noticeRecipients", recipient._id, { readAt: Date.now() });
    return null;
  },
});

export const listManaged = query({
  args: { status: statusValidator }, returns: v.array(noticeValidator),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    if (account.role === "student") throw new Error("Unauthorized");
    if (account.role === "owner") return await ctx.db.query("notices").withIndex("by_status_and_publishedAt", (q) => q.eq("status", args.status)).order("desc").take(200);
    const notices = await ctx.db.query("notices").withIndex("by_createdByAccountId_and_status", (q) => q.eq("createdByAccountId", account._id).eq("status", args.status)).order("desc").take(200);
    return notices.filter((notice) => notice.audienceType === "batch");
  },
});
