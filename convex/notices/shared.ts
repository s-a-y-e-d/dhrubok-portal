import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireAccount } from "../model/auth";
import { estimateSmsSegments } from "../messaging/templates";

export const MAX_NOTICE_RECIPIENTS = 1_000;

type AuthDbCtx = Pick<QueryCtx | MutationCtx, "auth" | "db">;

export function validateNoticeContent(input: { titleBn: string; titleEn: string; bodyBn: string; bodyEn: string }) {
  if (!input.titleBn.trim() || !input.titleEn.trim()) throw new Error("Bangla and English notice titles are required");
  if (!input.bodyBn.trim() || !input.bodyEn.trim()) throw new Error("Bangla and English notice bodies are required");
  if (input.titleBn.length > 200 || input.titleEn.length > 200) throw new Error("Notice title is too long");
  if (input.bodyBn.length > 8_000 || input.bodyEn.length > 8_000) throw new Error("Notice body is too long");
}

export async function requireNoticeManager(ctx: AuthDbCtx, input: {
  audienceType: Doc<"notices">["audienceType"];
  batchId?: Id<"batches">;
  courseId?: Id<"courses">;
  sendSms: boolean;
}) {
  const account = await requireAccount(ctx);
  if (account.role === "owner") return account;
  if (account.role !== "teacher" || input.audienceType !== "batch" || !input.batchId || input.sendSms) throw new Error("Unauthorized");
  const batch = await ctx.db.get("batches", input.batchId);
  if (!batch || (input.courseId && batch.courseId !== input.courseId)) throw new Error("Batch is not available in this course");
  const assignments = await ctx.db.query("teacherBatchAssignments").withIndex("by_teacherId_and_batchId", (q) => q.eq("teacherId", account.teacherId).eq("batchId", input.batchId!)).take(20);
  if (!assignments.some((assignment) => assignment.status === "active")) throw new Error("Unauthorized");
  return account;
}

export async function validateNoticeAudience(ctx: Pick<QueryCtx | MutationCtx, "db">, input: {
  audienceType: Doc<"notices">["audienceType"];
  courseId?: Id<"courses">;
  batchId?: Id<"batches">;
  studentIds?: Id<"students">[];
  sendSms: boolean;
}) {
  if (input.audienceType === "public") {
    if (input.courseId || input.batchId || input.studentIds?.length) throw new Error("Public notices cannot include a private audience scope");
    if (input.sendSms) throw new Error("Public notices cannot send guardian SMS");
    return;
  }
  if (input.audienceType === "all_students") {
    if (input.courseId || input.batchId || input.studentIds?.length) throw new Error("All-student notices cannot include another audience scope");
    return;
  }
  if (input.audienceType === "course") {
    if (!input.courseId || input.batchId || input.studentIds?.length) throw new Error("Course notices require only a course");
    const course = await ctx.db.get("courses", input.courseId);
    if (!course || course.status === "archived") throw new Error("Course is unavailable");
    return;
  }
  if (input.audienceType === "batch") {
    if (!input.batchId || input.studentIds?.length) throw new Error("Batch notices require only a batch");
    const batch = await ctx.db.get("batches", input.batchId);
    if (!batch || batch.status === "archived") throw new Error("Batch is unavailable");
    if (input.courseId && batch.courseId !== input.courseId) throw new Error("Batch is not part of this course");
    return;
  }
  if (input.courseId || input.batchId || !input.studentIds?.length) throw new Error("Individual notices require student recipients only");
  const unique = new Set(input.studentIds);
  if (unique.size !== input.studentIds.length) throw new Error("Duplicate notice recipient");
  if (unique.size > MAX_NOTICE_RECIPIENTS) throw new Error("Notice audience is too large");
  for (const studentId of unique) {
    const student = await ctx.db.get("students", studentId);
    if (!student || student.status !== "active") throw new Error("Notice recipient is not an active student");
  }
}

async function enforceAudienceLimit(studentIds: Id<"students">[]) {
  if (studentIds.length > MAX_NOTICE_RECIPIENTS) throw new Error(`Notice audience exceeds ${MAX_NOTICE_RECIPIENTS} students`);
  return studentIds;
}

export async function resolveAudienceStudents(ctx: Pick<QueryCtx | MutationCtx, "db">, notice: Pick<Doc<"notices">, "audienceType" | "courseId" | "batchId"> & { _id: Id<"notices"> }) {
  if (notice.audienceType === "public") return [];
  if (notice.audienceType === "individual_students") {
    const recipients = await ctx.db.query("noticeRecipients").withIndex("by_noticeId", (q) => q.eq("noticeId", notice._id)).take(MAX_NOTICE_RECIPIENTS + 1);
    return await enforceAudienceLimit(recipients.map((recipient) => recipient.studentId));
  }
  if (notice.audienceType === "all_students") {
    const students = await ctx.db.query("students").withIndex("by_status_and_admissionDate", (q) => q.eq("status", "active")).take(MAX_NOTICE_RECIPIENTS + 1);
    return await enforceAudienceLimit(students.map((student) => student._id));
  }
  const enrolments = notice.audienceType === "course"
    ? await ctx.db.query("enrolments").withIndex("by_courseId_and_status", (q) => q.eq("courseId", notice.courseId!).eq("status", "active")).take(MAX_NOTICE_RECIPIENTS + 1)
    : await ctx.db.query("enrolments").withIndex("by_batchId_and_status", (q) => q.eq("batchId", notice.batchId!).eq("status", "active")).take(MAX_NOTICE_RECIPIENTS + 1);
  return await enforceAudienceLimit([...new Set(enrolments.map((enrolment) => enrolment.studentId))]);
}

export function noticeSmsBodies(notice: Pick<Doc<"notices">, "titleBn" | "titleEn" | "bodyBn" | "bodyEn">, settings?: Doc<"coachingSettings">) {
  const bodyBn = `${settings?.shortNameBn.trim() || settings?.nameBn.trim() || "Dhrubok"}: ${notice.titleBn.trim()}\n${notice.bodyBn.trim()}`;
  const bodyEn = `${settings?.shortNameEn.trim() || settings?.nameEn.trim() || "Dhrubok"}: ${notice.titleEn.trim()}\n${notice.bodyEn.trim()}`;
  return { bodyBn, bodyEn, bn: estimateSmsSegments(bodyBn), en: estimateSmsSegments(bodyEn) };
}
