import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfillLegacyExamCompatibility = migrations.define({
  table: "exams",
  batchSize: 1,
  migrateOne: async (ctx, exam) => {
    if (exam.modelVersion !== undefined) return;
    const batches = await ctx.db
      .query("examBatches")
      .withIndex("by_examId", (q) => q.eq("examId", exam._id))
      .take(100);
    const results = await ctx.db
      .query("examResults")
      .withIndex("by_examId_and_totalScoreScaled", (q) =>
        q.eq("examId", exam._id),
      )
      .take(501);
    if (!batches.length || !results.length)
      return { modelVersion: 1, legacyCompatibility: "combined" as const };
    const audienceMode =
      batches.length === 1
        ? ("single_batch" as const)
        : ("selected_batches" as const);
    for (const result of results) {
      const existing = await ctx.db
        .query("examCandidates")
        .withIndex("by_examId_and_studentId", (q) =>
          q.eq("examId", exam._id).eq("studentId", result.studentId),
        )
        .first();
      if (existing) continue;
      const enrolment = await ctx.db.get("enrolments", result.enrolmentId);
      if (!enrolment || enrolment.courseId !== exam.courseId) continue;
      await ctx.db.insert("examCandidates", {
        examId: exam._id,
        studentId: result.studentId,
        enrolmentId: result.enrolmentId,
        batchId: enrolment.batchId,
        courseId: exam.courseId,
        includedAt: result.updatedAt,
        source: audienceMode,
        status: "included",
      });
    }
    const migratedCandidates = await ctx.db
      .query("examCandidates")
      .withIndex("by_examId_and_status", (q) =>
        q.eq("examId", exam._id).eq("status", "included"),
      )
      .take(501);
    return {
      modelVersion: 1,
      legacyCompatibility: "combined" as const,
      audienceMode,
      rosterStatus: "frozen" as const,
      rosterFrozenAt: exam.createdAt,
      candidateCount: migratedCandidates.length,
      meritMode: "official_only" as const,
      officialMeritScope:
        batches.length === 1
          ? ("batch" as const)
          : ("selected_batches" as const),
      rankFailedStudents: false,
      markingRulesVersion: 1,
    };
  },
});
