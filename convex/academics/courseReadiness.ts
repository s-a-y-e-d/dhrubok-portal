import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const readinessIssueCode = v.union(
  v.literal("NO_QUALIFYING_BATCH"),
  v.literal("NO_COURSE_SUBJECT"),
  v.literal("BATCH_SUBJECT_TEACHER_MISSING"),
  v.literal("BATCH_ROUTINE_MISSING"),
  v.literal("BATCH_FEE_PLAN_MISSING"),
  v.literal("BATCH_FEE_PLAN_EMPTY"),
  v.literal("ENROLMENT_FEE_PLAN_MISSING"),
  v.literal("ENROLMENT_FEE_PLAN_INCOMPATIBLE"),
);

export const readinessIssue = v.object({
  code: readinessIssueCode,
  courseId: v.id("courses"),
  batchId: v.optional(v.id("batches")),
  subjectId: v.optional(v.id("subjects")),
  enrolmentId: v.optional(v.id("enrolments")),
  labelBn: v.string(),
  labelEn: v.string(),
});

export const courseReadinessResult = v.object({
  ready: v.boolean(),
  feesConfigured: v.boolean(),
  issues: v.array(readinessIssue),
});

export type ReadinessIssue = {
  code: "NO_QUALIFYING_BATCH" | "NO_COURSE_SUBJECT" | "BATCH_SUBJECT_TEACHER_MISSING" | "BATCH_ROUTINE_MISSING" | "BATCH_FEE_PLAN_MISSING" | "BATCH_FEE_PLAN_EMPTY" | "ENROLMENT_FEE_PLAN_MISSING" | "ENROLMENT_FEE_PLAN_INCOMPATIBLE";
  courseId: Id<"courses">;
  batchId?: Id<"batches">;
  subjectId?: Id<"subjects">;
  enrolmentId?: Id<"enrolments">;
  labelBn: string;
  labelEn: string;
};

export async function computeCourseReadiness(ctx: QueryCtx | MutationCtx, courseId: Id<"courses">) {
  const course = await ctx.db.get("courses", courseId);
  if (!course) throw new Error("Course not found");
  const issues: ReadinessIssue[] = [];
  const batches = [
    ...await ctx.db.query("batches").withIndex("by_courseId_and_status", q => q.eq("courseId", courseId).eq("status", "planned")).take(200),
    ...await ctx.db.query("batches").withIndex("by_courseId_and_status", q => q.eq("courseId", courseId).eq("status", "active")).take(200),
  ];
  const links = await ctx.db.query("courseSubjects").withIndex("by_courseId_and_sortOrder", q => q.eq("courseId", courseId)).take(200);
  const subjects = (await Promise.all(links.map(link => ctx.db.get("subjects", link.subjectId)))).filter(subject => subject?.status === "active");

  if (!batches.length) issues.push({ code: "NO_QUALIFYING_BATCH", courseId, labelBn: "কমপক্ষে একটি পরিকল্পিত বা সক্রিয় ব্যাচ যোগ করুন", labelEn: "Add at least one planned or active batch" });
  if (!subjects.length) issues.push({ code: "NO_COURSE_SUBJECT", courseId, labelBn: "কমপক্ষে একটি সক্রিয় বিষয় যোগ করুন", labelEn: "Add at least one active subject" });

  for (const batch of batches) {
    const [assignments, routines, batchPlans, coursePlans, enrolments] = await Promise.all([
      ctx.db.query("teacherBatchAssignments").withIndex("by_batchId_and_status", q => q.eq("batchId", batch._id).eq("status", "active")).take(200),
      ctx.db.query("batchSchedules").withIndex("by_batchId_and_status", q => q.eq("batchId", batch._id).eq("status", "active")).take(1),
      ctx.db.query("feePlans").withIndex("by_batchId_and_status", q => q.eq("batchId", batch._id).eq("status", "active")).take(10),
      ctx.db.query("feePlans").withIndex("by_courseId_and_status", q => q.eq("courseId", courseId).eq("status", "active")).take(10),
      ctx.db.query("enrolments").withIndex("by_batchId_and_status", q => q.eq("batchId", batch._id).eq("status", "active")).take(500),
    ]);
    for (const subject of subjects) if (!assignments.some(row => row.subjectId === subject!._id)) issues.push({ code: "BATCH_SUBJECT_TEACHER_MISSING", courseId, batchId: batch._id, subjectId: subject!._id, labelBn: `${batch.nameBn} · ${subject!.nameBn}`, labelEn: `${batch.nameEn} · ${subject!.nameEn}` });
    if (!routines.length) issues.push({ code: "BATCH_ROUTINE_MISSING", courseId, batchId: batch._id, labelBn: `${batch.nameBn}-এ রুটিন যোগ করুন`, labelEn: `Add a routine to ${batch.nameEn}` });
    const applicablePlans = batchPlans.length ? batchPlans : coursePlans;
    if (!applicablePlans.length) issues.push({ code: "BATCH_FEE_PLAN_MISSING", courseId, batchId: batch._id, labelBn: `${batch.nameBn}-এর ফি পরিকল্পনা নেই`, labelEn: `${batch.nameEn} has no fee plan` });
    else {
      const itemCounts = await Promise.all(applicablePlans.map(plan => ctx.db.query("feePlanItems").withIndex("by_feePlanId_and_status", q => q.eq("feePlanId", plan._id).eq("status", "active")).take(1)));
      if (!itemCounts.some(rows => rows.length)) issues.push({ code: "BATCH_FEE_PLAN_EMPTY", courseId, batchId: batch._id, labelBn: `${batch.nameBn}-এর ফি পরিকল্পনা খালি`, labelEn: `${batch.nameEn} has an empty fee plan` });
    }
    for (const enrolment of enrolments) {
      if (!enrolment.feePlanId) { issues.push({ code: "ENROLMENT_FEE_PLAN_MISSING", courseId, batchId: batch._id, enrolmentId: enrolment._id, labelBn: "সক্রিয় ভর্তিতে ফি পরিকল্পনা দিন", labelEn: "Assign a fee plan to the active enrolment" }); continue; }
      const plan = await ctx.db.get("feePlans", enrolment.feePlanId);
      if (!plan || plan.status !== "active" || (plan.batchId ? plan.batchId !== batch._id : plan.courseId !== courseId)) issues.push({ code: "ENROLMENT_FEE_PLAN_INCOMPATIBLE", courseId, batchId: batch._id, enrolmentId: enrolment._id, labelBn: "ভর্তির ফি পরিকল্পনা ব্যাচ বা কোর্সের সঙ্গে মিলছে না", labelEn: "Enrolment fee plan is incompatible with its batch or course" });
    }
  }
  const feeCodes = new Set(["BATCH_FEE_PLAN_MISSING", "BATCH_FEE_PLAN_EMPTY", "ENROLMENT_FEE_PLAN_MISSING", "ENROLMENT_FEE_PLAN_INCOMPATIBLE"]);
  return { ready: issues.length === 0, feesConfigured: !issues.some(issue => feeCodes.has(issue.code)), issues };
}
