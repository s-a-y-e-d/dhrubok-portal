import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireOwner } from "../model/auth";
import { normalizeBangladeshPhone } from "../model/normalization";
import { enqueueSms } from "../messaging/model";
import { estimateSmsSegments } from "../messaging/templates";
import { writeAudit } from "../model/audit";

const MAX_RECIPIENTS = 1_000;
const MAX_SCHEDULED_SMS = 1_000;
const SMS_PRICE_MINOR_PER_SEGMENT = 30;
const audienceValidator = v.union(
  v.literal("all_students"),
  v.literal("course"),
  v.literal("batch"),
  v.literal("individual_students"),
);
const recipientValidator = v.union(v.literal("guardian"), v.literal("student"));

type Audience = "all_students" | "course" | "batch" | "individual_students";
type Recipient = "guardian" | "student";

function assertMessage(message: string) {
  if (!message.trim()) throw new Error("Enter an SMS message");
  if (message.trim().length > 1_000) throw new Error("SMS message is too long");
}

async function audienceStudents(
  ctx: Parameters<typeof requireOwner>[0],
  input: { audience: Audience; courseId?: Id<"courses">; batchId?: Id<"batches">; studentIds?: Id<"students">[] },
) {
  if (input.audience === "all_students") {
    if (input.courseId || input.batchId || input.studentIds?.length) throw new Error("All students cannot include another audience scope");
    return await ctx.db.query("students").withIndex("by_status_and_admissionDate", (q) => q.eq("status", "active")).take(MAX_RECIPIENTS + 1);
  }
  if (input.audience === "course") {
    if (!input.courseId || input.batchId || input.studentIds?.length) throw new Error("Select one course");
    const course = await ctx.db.get("courses", input.courseId);
    if (!course || course.status !== "active") throw new Error("Selected course is not available");
    const enrolments = await ctx.db.query("enrolments").withIndex("by_courseId_and_status", (q) => q.eq("courseId", input.courseId!).eq("status", "active")).take(MAX_RECIPIENTS + 1);
    return (await Promise.all([...new Set(enrolments.map((row) => row.studentId))].map((studentId) => ctx.db.get("students", studentId)))).filter((student): student is Doc<"students"> => student?.status === "active");
  }
  if (input.audience === "batch") {
    if (!input.batchId || input.courseId || input.studentIds?.length) throw new Error("Select one batch");
    const batch = await ctx.db.get("batches", input.batchId);
    if (!batch || batch.status !== "active") throw new Error("Selected batch is not available");
    const enrolments = await ctx.db.query("enrolments").withIndex("by_batchId_and_status", (q) => q.eq("batchId", input.batchId!).eq("status", "active")).take(MAX_RECIPIENTS + 1);
    return (await Promise.all([...new Set(enrolments.map((row) => row.studentId))].map((studentId) => ctx.db.get("students", studentId)))).filter((student): student is Doc<"students"> => student?.status === "active");
  }
  if (input.courseId || input.batchId || !input.studentIds?.length) throw new Error("Select at least one student");
  if (new Set(input.studentIds).size !== input.studentIds.length) throw new Error("Duplicate student recipient");
  return (await Promise.all(input.studentIds.map((studentId) => ctx.db.get("students", studentId)))).map((student) => {
    if (!student || student.status !== "active") throw new Error("A selected student is not active");
    return student;
  });
}

function recipientPhones(student: Doc<"students">, recipient: Recipient) {
  const candidates = recipient === "student"
    ? [student.phone]
    : student.smsRecipient === "both"
      ? [student.guardianPhone, student.motherPhone]
      : student.smsRecipient === "mother"
        ? [student.motherPhone]
        : [student.guardianPhone];
  return [...new Set(candidates.flatMap((phone) => {
    if (!phone) return [];
    try { return [normalizeBangladeshPhone(phone)]; } catch { return []; }
  }))];
}

async function confirmationFingerprint(input: {
  body: string;
  recipient: Recipient;
  studentIds: Id<"students">[];
  phones: string[];
}) {
  const payload = JSON.stringify({
    body: input.body,
    recipient: input.recipient,
    studentIds: [...input.studentIds].sort(),
    phones: [...input.phones].sort(),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function preview(ctx: Parameters<typeof requireOwner>[0], input: { audience: Audience; recipient: Recipient; courseId?: Id<"courses">; batchId?: Id<"batches">; studentIds?: Id<"students">[]; message: string }) {
  assertMessage(input.message);
  const students = await audienceStudents(ctx, input);
  if (students.length > MAX_RECIPIENTS) throw new Error("Audience exceeds 1,000 students");
  const phones = new Set<string>();
  let excludedStudentCount = 0;
  for (const student of students) {
    const studentPhones = recipientPhones(student, input.recipient);
    if (!studentPhones.length) excludedStudentCount += 1;
    for (const phone of studentPhones) phones.add(phone);
  }
  const settings = (await ctx.db.query("coachingSettings").take(1))[0];
  const body = input.message.trim();
  const sms = estimateSmsSegments(body);
  const recipientList = [...phones].sort();
  return {
    enabled: settings?.smsEnabled ?? false,
    body,
    studentCount: students.length,
    recipientCount: phones.size,
    excludedStudentCount,
    ...sms,
    estimatedCostMinor: phones.size * sms.segmentCount * SMS_PRICE_MINOR_PER_SEGMENT,
    recipientLimitExceeded: phones.size > MAX_SCHEDULED_SMS,
    confirmationFingerprint: await confirmationFingerprint({ body, recipient: input.recipient, studentIds: students.map((student) => student._id), phones: recipientList }),
    phones: recipientList,
  };
}

const bulkSmsInput = {
  audience: audienceValidator,
  recipient: recipientValidator,
  courseId: v.optional(v.id("courses")),
  batchId: v.optional(v.id("batches")),
  studentIds: v.optional(v.array(v.id("students"))),
  message: v.string(),
};

export const listActiveStudents = query({
  args: {},
  returns: v.array(v.object({ studentId: v.id("students"), displayName: v.string(), studentNumber: v.string() })),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const students = await ctx.db.query("students").withIndex("by_status_and_admissionDate", (q) => q.eq("status", "active")).take(MAX_RECIPIENTS + 1);
    if (students.length > MAX_RECIPIENTS) throw new Error("Student list exceeds 1,000 students");
    return students.map((student) => ({ studentId: student._id, displayName: student.nameBn || student.nameEn || student.displayName || student.studentNumber, studentNumber: student.studentNumber }));
  },
});

export const previewRecipients = query({
  args: bulkSmsInput,
  returns: v.object({ enabled: v.boolean(), body: v.string(), studentCount: v.number(), recipientCount: v.number(), excludedStudentCount: v.number(), encoding: v.union(v.literal("ucs2"), v.literal("gsm")), characterCount: v.number(), segmentCount: v.number(), estimatedCostMinor: v.number(), recipientLimitExceeded: v.boolean(), confirmationFingerprint: v.string() }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const result = await preview(ctx, args);
    return { enabled: result.enabled, body: result.body, studentCount: result.studentCount, recipientCount: result.recipientCount, excludedStudentCount: result.excludedStudentCount, encoding: result.encoding, characterCount: result.characterCount, segmentCount: result.segmentCount, estimatedCostMinor: result.estimatedCostMinor, recipientLimitExceeded: result.recipientLimitExceeded, confirmationFingerprint: result.confirmationFingerprint };
  },
});

export const queue = mutation({
  args: { ...bulkSmsInput, expectedRecipientCount: v.number(), expectedConfirmationFingerprint: v.string() },
  returns: v.object({ queuedCount: v.number() }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const result = await preview(ctx, args);
    if (!result.enabled) throw new Error("SMS is disabled in coaching settings");
    if (!result.recipientCount) throw new Error("No eligible phone numbers in this audience");
    if (result.recipientLimitExceeded) throw new Error("This campaign exceeds the 1,000 SMS recipient limit");
    if (args.expectedRecipientCount !== result.recipientCount) throw new Error("Recipient preview is stale. Review it again before queuing.");
    if (args.expectedConfirmationFingerprint !== result.confirmationFingerprint) throw new Error("Recipient preview is stale. Review it again before queuing.");
    const campaignId = `bulk-sms:${account._id}:${Date.now()}`;
    for (const phone of result.phones) {
      await enqueueSms(ctx, {
        idempotencyKey: `${campaignId}:${phone}`,
        eventType: "custom_notice",
        relatedEntityType: "bulkSms",
        relatedEntityId: campaignId,
        guardianPhone: phone,
        locale: "bn",
        body: result.body,
      });
    }
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "bulk_sms.queued", entityType: "bulkSms", entityId: campaignId, summary: "Queued bulk SMS", metadata: { audience: args.audience, recipient: args.recipient, studentCount: result.studentCount, recipientCount: result.recipientCount, estimatedCostMinor: result.estimatedCostMinor } });
    return { queuedCount: result.recipientCount };
  },
});
