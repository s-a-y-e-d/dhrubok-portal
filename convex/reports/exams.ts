import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  requireAccount,
  requireOwner,
  requireStudent,
  requireTeacherExamAssignment,
} from "../model/auth";
import { localized, requireOwnerOrStudent } from "./shared";

const pageFields = {
  isDone: v.boolean(),
  continueCursor: v.string(),
  splitCursor: v.optional(v.union(v.string(), v.null())),
  pageStatus: v.optional(
    v.union(
      v.literal("SplitRecommended"),
      v.literal("SplitRequired"),
      v.null(),
    ),
  ),
};

async function requireExamReportAccess(
  ctx: Parameters<typeof requireAccount>[0],
  examId: Parameters<typeof requireTeacherExamAssignment>[1],
) {
  const account = await requireAccount(ctx);
  if (account.role === "owner") {
    await requireOwner(ctx);
    return { account, batchId: null };
  }
  if (account.role === "teacher") {
    const { assignment } = await requireTeacherExamAssignment(ctx, examId);
    return { account, batchId: assignment.batchId ?? null };
  } else throw new Error("Unauthorized");
}

const resultRow = v.object({
  resultId: v.id("examResults"),
  studentId: v.id("students"),
  studentNumber: v.string(),
  studentName: v.string(),
  participation: v.string(),
  totalScoreScaled: v.union(v.number(), v.null()),
  passed: v.union(v.boolean(), v.null()),
  meritPosition: v.union(v.number(), v.null()),
  entryStatus: v.string(),
});

const examHeader = v.object({
  examId: v.id("exams"),
  examNumber: v.string(),
  examNameBn: v.string(),
  examNameEn: v.string(),
  examDate: v.string(),
  courseNameBn: v.string(),
  courseNameEn: v.string(),
  mode: v.string(),
  totalFullMarksScaled: v.number(),
  passMarksScaled: v.number(),
  publicationVersion: v.number(),
  publishedAt: v.union(v.number(), v.null()),
});

export const header = query({
  args: { examId: v.id("exams") },
  returns: examHeader,
  handler: async (ctx, args) => {
    await requireExamReportAccess(ctx, args.examId);
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam) throw new Error("Exam not found");
    const course = await ctx.db.get("courses", exam.courseId);
    return {
      examId: exam._id,
      examNumber: exam.examNumber,
      examNameBn: exam.nameBn,
      examNameEn: exam.nameEn,
      examDate: exam.examDate,
      courseNameBn: course?.nameBn ?? "",
      courseNameEn: course?.nameEn ?? "",
      mode: exam.mode,
      totalFullMarksScaled: exam.totalFullMarksScaled,
      passMarksScaled: exam.passMarksScaled,
      publicationVersion: exam.publicationVersion,
      publishedAt: exam.publishedAt ?? null,
    };
  },
});

export const resultSheet = query({
  args: {
    examId: v.id("exams"),
    entryStatus: v.union(
      v.literal("missing"),
      v.literal("draft"),
      v.literal("ready"),
      v.literal("published"),
    ),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({ page: v.array(resultRow), ...pageFields }),
  handler: async (ctx, args) => {
    const access = await requireExamReportAccess(ctx, args.examId);
    const page =
      args.entryStatus === "published"
        ? await ctx.db
            .query("examResults")
            .withIndex("by_examId_and_totalScoreScaled", (q) =>
              q.eq("examId", args.examId),
            )
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("examResults")
            .withIndex("by_examId_and_entryStatus", (q) =>
              q.eq("examId", args.examId).eq("entryStatus", args.entryStatus),
            )
            .paginate(args.paginationOpts);
    const visible =
      args.entryStatus === "published"
        ? page.page.filter((result) => result.publishedAt !== undefined)
        : page.page;
    const scoped =
      access.batchId == null
        ? visible
        : (
            await Promise.all(
              visible.map(async (result) => ({
                result,
                enrolment: await ctx.db.get("enrolments", result.enrolmentId),
              })),
            )
          )
            .filter(({ enrolment }) => enrolment?.batchId === access.batchId)
            .map(({ result }) => result);
    return {
      ...page,
      page: await Promise.all(
        scoped.map(async (result) => {
          const student = await ctx.db.get("students", result.studentId);
          const published = args.entryStatus === "published";
          return {
            resultId: result._id,
            studentId: result.studentId,
            studentNumber: student?.studentNumber ?? "",
            studentName: student?.displayName ?? "",
            participation: published
              ? (result.publishedParticipation ?? result.participation)
              : result.participation,
            totalScoreScaled: published
              ? (result.publishedTotalScoreScaled ?? null)
              : (result.totalScoreScaled ?? null),
            passed: published
              ? (result.publishedPassed ?? null)
              : (result.passed ?? null),
            meritPosition: published
              ? (result.publishedMeritPosition ?? null)
              : (result.meritPosition ?? null),
            entryStatus: result.entryStatus,
          };
        }),
      ),
    };
  },
});

export const meritList = query({
  args: { examId: v.id("exams"), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(resultRow), ...pageFields }),
  handler: async (ctx, args) => {
    const access = await requireExamReportAccess(ctx, args.examId);
    const page = await ctx.db
      .query("examResults")
      .withIndex("by_examId_and_totalScoreScaled", (q) =>
        q.eq("examId", args.examId),
      )
      .paginate(args.paginationOpts);
    const visible = page.page.filter(
      (result) => result.publishedAt !== undefined,
    );
    const scoped =
      access.batchId == null
        ? visible
        : (
            await Promise.all(
              visible.map(async (result) => ({
                result,
                enrolment: await ctx.db.get("enrolments", result.enrolmentId),
              })),
            )
          )
            .filter(({ enrolment }) => enrolment?.batchId === access.batchId)
            .map(({ result }) => result);
    scoped.sort(
      (a, b) =>
        (b.publishedTotalScoreScaled ?? -1) -
        (a.publishedTotalScoreScaled ?? -1),
    );
    return {
      ...page,
      page: await Promise.all(
        scoped.map(async (result) => {
          const student = await ctx.db.get("students", result.studentId);
          return {
            resultId: result._id,
            studentId: result.studentId,
            studentNumber: student?.studentNumber ?? "",
            studentName: student?.displayName ?? "",
            participation:
              result.publishedParticipation ?? result.participation,
            totalScoreScaled: result.publishedTotalScoreScaled ?? null,
            passed: result.publishedPassed ?? null,
            meritPosition: result.publishedMeritPosition ?? null,
            entryStatus: result.entryStatus,
          };
        }),
      ),
    };
  },
});

export const publishedResult = query({
  args: { examId: v.id("exams"), studentId: v.optional(v.id("students")) },
  returns: v.union(
    v.object({
      header: examHeader,
      student: v.object({
        studentId: v.id("students"),
        studentNumber: v.string(),
        displayName: v.string(),
      }),
      result: v.object({
        participation: v.string(),
        mcqScoreScaled: v.union(v.number(), v.null()),
        writtenScoreScaled: v.union(v.number(), v.null()),
        totalScoreScaled: v.number(),
        passed: v.boolean(),
        meritPosition: v.union(v.number(), v.null()),
        teacherCommentBn: v.union(v.string(), v.null()),
        teacherCommentEn: v.union(v.string(), v.null()),
        publicationVersion: v.number(),
        publishedAt: v.number(),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    let studentId = args.studentId;
    if (account.role === "owner") await requireOwner(ctx);
    else if (account.role === "student") {
      const access = await requireStudent(ctx);
      if (studentId && studentId !== access.student._id)
        throw new Error("Unauthorized");
      studentId = access.student._id;
    } else throw new Error("Unauthorized");
    if (!studentId) throw new Error("Student is required");
    const [exam, student, result] = await Promise.all([
      ctx.db.get("exams", args.examId),
      ctx.db.get("students", studentId),
      ctx.db
        .query("examResults")
        .withIndex("by_examId_and_studentId", (q) =>
          q.eq("examId", args.examId).eq("studentId", studentId!),
        )
        .unique(),
    ]);
    if (
      !exam ||
      !student ||
      !result ||
      result.publishedAt === undefined ||
      result.publicationVersion === undefined ||
      result.publishedTotalScoreScaled === undefined ||
      result.publishedPassed === undefined ||
      result.publishedParticipation === undefined
    )
      return null;
    const course = await ctx.db.get("courses", exam.courseId);
    return {
      header: {
        examId: exam._id,
        examNumber: exam.examNumber,
        examNameBn: exam.nameBn,
        examNameEn: exam.nameEn,
        examDate: exam.examDate,
        courseNameBn: course?.nameBn ?? "",
        courseNameEn: course?.nameEn ?? "",
        mode: exam.mode,
        totalFullMarksScaled: exam.totalFullMarksScaled,
        passMarksScaled: exam.passMarksScaled,
        publicationVersion: exam.publicationVersion,
        publishedAt: exam.publishedAt ?? null,
      },
      student: {
        studentId: student._id,
        studentNumber: student.studentNumber,
        displayName: student.displayName,
      },
      result: {
        participation: result.publishedParticipation,
        mcqScoreScaled: result.publishedMcqScoreScaled ?? null,
        writtenScoreScaled: result.publishedWrittenScoreScaled ?? null,
        totalScoreScaled: result.publishedTotalScoreScaled,
        passed: result.publishedPassed,
        meritPosition: result.publishedMeritPosition ?? null,
        teacherCommentBn: result.publishedTeacherCommentBn ?? null,
        teacherCommentEn: result.publishedTeacherCommentEn ?? null,
        publicationVersion: result.publicationVersion,
        publishedAt: result.publishedAt,
      },
    };
  },
});

export const studentResultHistory = query({
  args: {
    studentId: v.id("students"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        resultId: v.id("examResults"),
        examId: v.id("exams"),
        examName: v.string(),
        examDate: v.string(),
        participation: v.string(),
        totalScoreScaled: v.union(v.number(), v.null()),
        passed: v.union(v.boolean(), v.null()),
        meritPosition: v.union(v.number(), v.null()),
        publishedAt: v.number(),
      }),
    ),
    ...pageFields,
  }),
  handler: async (ctx, args) => {
    const account = await requireOwnerOrStudent(ctx, args.studentId);
    const page = await ctx.db
      .query("examResults")
      .withIndex("by_studentId_and_publishedAt", (q) =>
        q.eq("studentId", args.studentId).gt("publishedAt", 0),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (result) => {
          const exam = await ctx.db.get("exams", result.examId);
          return {
            resultId: result._id,
            examId: result.examId,
            examName: localized(account.locale, exam?.nameBn, exam?.nameEn),
            examDate: exam?.examDate ?? "",
            participation:
              result.publishedParticipation ?? result.participation,
            totalScoreScaled: result.publishedTotalScoreScaled ?? null,
            passed: result.publishedPassed ?? null,
            meritPosition: result.publishedMeritPosition ?? null,
            publishedAt: result.publishedAt!,
          };
        }),
      ),
    };
  },
});

export const publishedResultV2 = query({
  args: { examId: v.id("exams"), studentId: v.optional(v.id("students")) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    let studentId = args.studentId;
    if (account.role === "owner") await requireOwner(ctx);
    else if (account.role === "student") {
      const access = await requireStudent(ctx);
      if (studentId && studentId !== access.student._id)
        throw new Error("Unauthorized");
      studentId = access.student._id;
    } else throw new Error("Unauthorized");
    if (!studentId) throw new Error("Student is required");
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam || exam.modelVersion !== 2 || !exam.publicationVersion)
      return null;
    const publication = await ctx.db
      .query("examPublications")
      .withIndex("by_examId_and_version", (q) =>
        q.eq("examId", exam._id).eq("version", exam.publicationVersion),
      )
      .unique();
    if (!publication || publication.status !== "published") return null;
    const result = await ctx.db
      .query("examPublishedResults")
      .withIndex("by_publicationId_and_studentId", (q) =>
        q.eq("publicationId", publication._id).eq("studentId", studentId!),
      )
      .unique();
    if (!result) return null;
    const [student, course, batch, subjects] = await Promise.all([
      ctx.db.get("students", studentId),
      ctx.db.get("courses", exam.courseId),
      ctx.db.get("batches", result.batchId),
      ctx.db
        .query("examPublishedSubjectResults")
        .withIndex("by_publishedResultId_and_sortOrder", (q) =>
          q.eq("publishedResultId", result._id),
        )
        .take(100),
    ]);
    return { exam, publication, result, student, course, batch, subjects };
  },
});

export const tabulationV2 = query({
  args: { examId: v.id("exams") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const access = await requireExamReportAccess(ctx, args.examId);
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam || exam.modelVersion !== 2 || !exam.publicationVersion)
      return null;
    const publication = await ctx.db
      .query("examPublications")
      .withIndex("by_examId_and_version", (q) =>
        q.eq("examId", exam._id).eq("version", exam.publicationVersion),
      )
      .unique();
    if (!publication) return null;
    const all = await ctx.db
      .query("examPublishedResults")
      .withIndex("by_examId_and_version", (q) =>
        q.eq("examId", exam._id).eq("version", exam.publicationVersion),
      )
      .take(501);
    const results = access.batchId
      ? all.filter((row) => row.batchId === access.batchId)
      : all;
    return {
      exam,
      publication,
      rows: await Promise.all(
        results.map(async (result) => ({
          result,
          student: await ctx.db.get("students", result.studentId),
          batch: await ctx.db.get("batches", result.batchId),
          subjects: await ctx.db
            .query("examPublishedSubjectResults")
            .withIndex("by_publishedResultId_and_sortOrder", (q) =>
              q.eq("publishedResultId", result._id),
            )
            .take(100),
        })),
      ),
    };
  },
});

export const subjectAnalysisV2 = query({
  args: { examId: v.id("exams") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const access = await requireExamReportAccess(ctx, args.examId);
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam || exam.modelVersion !== 2 || !exam.publicationVersion)
      return null;
    let rows = await ctx.db
      .query("examPublishedSubjectResults")
      .withIndex("by_examId_and_version_and_studentId", (q) =>
        q.eq("examId", exam._id).eq("version", exam.publicationVersion),
      )
      .take(1001);
    const resultBatch = new Map<string, Id<"batches">>();
    for (const id of new Set(rows.map((row) => row.publishedResultId))) {
      const result = await ctx.db.get("examPublishedResults", id);
      if (result) resultBatch.set(id, result.batchId);
    }
    if (access.batchId)
      rows = rows.filter(
        (row) => resultBatch.get(row.publishedResultId) === access.batchId,
      );
    const groups = new Map<string, typeof rows>();
    for (const row of rows)
      groups.set(row.subjectId, [...(groups.get(row.subjectId) ?? []), row]);
    const output = [];
    for (const [subjectId, group] of groups) {
      const present = group.filter((row) => row.participation === "present");
      const scores = present.map((row) => row.totalScoreScaled);
      const bands = {
        below40: 0,
        from40To59: 0,
        from60To79: 0,
        from80To100: 0,
      };
      for (const row of present) {
        const percentage =
          (row.totalScoreScaled * 100) / row.totalFullMarksScaled;
        if (percentage < 40) bands.below40 += 1;
        else if (percentage < 60) bands.from40To59 += 1;
        else if (percentage < 80) bands.from60To79 += 1;
        else bands.from80To100 += 1;
      }
      const batchGroups = new Map<string, typeof group>();
      for (const row of group) {
        const batchId = resultBatch.get(row.publishedResultId);
        if (batchId)
          batchGroups.set(batchId, [...(batchGroups.get(batchId) ?? []), row]);
      }
      const batchComparison = [];
      for (const [batchId, batchRows] of batchGroups) {
        const batch = await ctx.db.get("batches", batchId as Id<"batches">);
        const batchPresent = batchRows.filter(
          (row) => row.participation === "present",
        );
        batchComparison.push({
          batchId,
          nameBn: batch?.nameBn ?? "",
          nameEn: batch?.nameEn ?? "",
          candidateCount: batchRows.length,
          averageScaled: batchPresent.length
            ? Math.round(
                batchPresent.reduce(
                  (sum, row) => sum + row.totalScoreScaled,
                  0,
                ) / batchPresent.length,
              )
            : null,
          passRate: batchRows.length
            ? Math.round(
                (batchRows.filter((row) => row.passed).length * 10000) /
                  batchRows.length,
              ) / 100
            : 0,
        });
      }
      output.push({
        subjectId,
        nameBn: group[0].subjectNameBn,
        nameEn: group[0].subjectNameEn,
        highestScaled: scores.length ? Math.max(...scores) : null,
        lowestScaled: scores.length ? Math.min(...scores) : null,
        averageScaled: scores.length
          ? Math.round(
              scores.reduce((sum, value) => sum + value, 0) / scores.length,
            )
          : null,
        passCount: group.filter((row) => row.passed).length,
        failCount: group.filter((row) => !row.passed).length,
        passRate: group.length
          ? Math.round(
              (group.filter((row) => row.passed).length * 10000) / group.length,
            ) / 100
          : 0,
        absentCount: group.filter((row) => row.participation === "absent")
          .length,
        scoreBands: bands,
        batchComparison,
      });
    }
    return output;
  },
});
