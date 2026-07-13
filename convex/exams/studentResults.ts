import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireStudent } from "../model/auth";

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { student } = await requireStudent(ctx);
    const page = await ctx.db
      .query("examPublishedResults")
      .withIndex("by_studentId_and_publishedAt", (q) =>
        q.eq("studentId", student._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const latestByExam = new Map();
    for (const row of page.page) {
      const current = latestByExam.get(row.examId);
      if (!current || current.version < row.version)
        latestByExam.set(row.examId, row);
    }
    return {
      ...page,
      page: await Promise.all(
        [...latestByExam.values()].map(async (result) => ({
          result,
          exam: await ctx.db.get("exams", result.examId),
          batch: await ctx.db.get("batches", result.batchId),
        })),
      ),
    };
  },
});

export const detailMine = query({
  args: { examId: v.id("exams"), version: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { student } = await requireStudent(ctx);
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam || exam.modelVersion !== 2 || exam.publicationVersion < 1)
      return null;
    const version = args.version ?? exam.publicationVersion;
    const publication = await ctx.db
      .query("examPublications")
      .withIndex("by_examId_and_version", (q) =>
        q.eq("examId", exam._id).eq("version", version),
      )
      .unique();
    if (
      !publication ||
      (version === exam.publicationVersion &&
        publication.status !== "published")
    )
      return null;
    const result = await ctx.db
      .query("examPublishedResults")
      .withIndex("by_publicationId_and_studentId", (q) =>
        q.eq("publicationId", publication._id).eq("studentId", student._id),
      )
      .unique();
    if (!result) return null;
    const subjects = await ctx.db
      .query("examPublishedSubjectResults")
      .withIndex("by_publishedResultId_and_sortOrder", (q) =>
        q.eq("publishedResultId", result._id),
      )
      .take(100);
    const course = await ctx.db.get("courses", exam.courseId);
    const batch = await ctx.db.get("batches", result.batchId);
    return {
      exam,
      course,
      batch,
      publication,
      result,
      subjects,
      student: {
        studentNumber: student.studentNumber,
        displayName: student.displayName,
        rollNumber: student.rollNumber,
      },
    };
  },
});
