import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { computeCourseReadiness } from "./courseReadiness";

export const refresh = internalMutation({
  args: { courseId: v.id("courses") },
  returns: v.null(),
  handler: async (ctx, { courseId }) => {
    const course = await ctx.db.get("courses", courseId);
    if (!course) return null;
    const statuses = ["planned", "active", "completed", "archived"] as const;
    const grouped = await Promise.all(statuses.map(status => ctx.db.query("batches").withIndex("by_courseId_and_status", q => q.eq("courseId", courseId).eq("status", status)).take(500)));
    const qualifying = [...grouped[0], ...grouped[1]];
    const enrolments = await ctx.db.query("enrolments").withIndex("by_courseId_and_status", q => q.eq("courseId", courseId).eq("status", "active")).take(1000);
    const readiness = await computeCourseReadiness(ctx, courseId);
    const routines = (await Promise.all(qualifying.map(batch => ctx.db.query("batchSchedules").withIndex("by_batchId_and_status", q => q.eq("batchId", batch._id).eq("status", "active")).take(100)))).flat().sort((a, b) => a.weekday - b.weekday || a.startMinutes - b.startMinutes);
    const value = {
      courseId, academicSessionId: course.academicSessionId, lifecycleStatus: course.status,
      qualifyingBatchCount: qualifying.length, plannedBatchCount: grouped[0].length, activeBatchCount: grouped[1].length,
      completedBatchCount: grouped[2].length, archivedBatchCount: grouped[3].length,
      activeEnrolmentCount: enrolments.length, totalCapacity: qualifying.reduce((sum, batch) => sum + (batch.capacity ?? 0), 0),
      academicReady: readiness.ready, feeConfigured: readiness.feesConfigured,
      missingBatchCount: readiness.issues.filter(issue => issue.code === "NO_QUALIFYING_BATCH").length,
      missingTeacherCount: readiness.issues.filter(issue => issue.code === "BATCH_SUBJECT_TEACHER_MISSING").length,
      missingRoutineCount: readiness.issues.filter(issue => issue.code === "BATCH_ROUTINE_MISSING").length,
      missingFeeCount: readiness.issues.filter(issue => issue.code.includes("FEE_PLAN")).length,
      websitePublished: course.isPublic,
      nextRoutineWeekday: routines[0]?.weekday, nextRoutineStartMinutes: routines[0]?.startMinutes, updatedAt: Date.now(),
    };
    const existing = await ctx.db.query("courseOperationalSnapshots").withIndex("by_courseId", q => q.eq("courseId", courseId)).unique();
    if (existing) await ctx.db.replace("courseOperationalSnapshots", existing._id, value); else await ctx.db.insert("courseOperationalSnapshots", value);
    return null;
  },
});
