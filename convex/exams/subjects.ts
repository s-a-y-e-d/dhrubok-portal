import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { validateSubjectRule } from "./model";
import { subjectRule } from "./validators";

export const configure = mutation({
  args: { examId: v.id("exams"), subjects: v.array(subjectRule) },
  returns: v.array(v.id("examSubjects")),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam || exam.modelVersion !== 2 || exam.status !== "draft")
      throw new Error("Only a new-model draft can be configured");
    if (!args.subjects.length) throw new Error("Select at least one subject");
    if (
      new Set(args.subjects.map((row) => row.subjectId)).size !==
      args.subjects.length
    )
      throw new Error("A subject can appear only once");
    if (
      new Set(args.subjects.map((row) => row.sortOrder)).size !==
      args.subjects.length
    )
      throw new Error("Subject sort order must be unique");
    const existing = await ctx.db
      .query("examSubjects")
      .withIndex("by_examId_and_sortOrder", (q) => q.eq("examId", args.examId))
      .take(100);
    for (const row of existing) await ctx.db.delete("examSubjects", row._id);
    const ids = [];
    let grandFull = 0;
    for (const rule of args.subjects) {
      validateSubjectRule(rule);
      const link = await ctx.db
        .query("courseSubjects")
        .withIndex("by_courseId_and_subjectId", (q) =>
          q.eq("courseId", exam.courseId).eq("subjectId", rule.subjectId),
        )
        .unique();
      if (!link)
        throw new Error("Every subject must belong to the exam course");
      grandFull += rule.totalFullMarksScaled;
      ids.push(
        await ctx.db.insert("examSubjects", { examId: exam._id, ...rule }),
      );
    }
    await ctx.db.patch("exams", exam._id, {
      totalFullMarksScaled: grandFull,
      subjectCount: ids.length,
      markingRulesVersion: (exam.markingRulesVersion ?? 0) + 1,
      updatedAt: Date.now(),
    });
    return ids;
  },
});
