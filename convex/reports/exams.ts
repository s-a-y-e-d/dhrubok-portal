import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { query } from "../_generated/server";
import { requireAccount, requireOwner, requireStudent, requireTeacherExamAssignment } from "../model/auth";
import { localized, requireOwnerOrStudent } from "./shared";

const pageFields = {
  isDone: v.boolean(),
  continueCursor: v.string(),
  splitCursor: v.optional(v.union(v.string(), v.null())),
  pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
};

async function requireExamReportAccess(ctx: Parameters<typeof requireAccount>[0], examId: Parameters<typeof requireTeacherExamAssignment>[1]) {
  const account = await requireAccount(ctx);
  if (account.role === "owner") {
    await requireOwner(ctx);
    return { account, batchId: null };
  }
  if (account.role === "teacher") {
    const { assignment } = await requireTeacherExamAssignment(ctx, examId);
    return { account, batchId: assignment.batchId ?? null };
  }
  else throw new Error("Unauthorized");
}

const resultRow = v.object({ resultId: v.id("examResults"), studentId: v.id("students"), studentNumber: v.string(), studentName: v.string(), participation: v.string(), totalScoreScaled: v.union(v.number(), v.null()), passed: v.union(v.boolean(), v.null()), meritPosition: v.union(v.number(), v.null()), entryStatus: v.string() });

const examHeader = v.object({
  examId: v.id("exams"), examNumber: v.string(), examNameBn: v.string(), examNameEn: v.string(), examDate: v.string(),
  courseNameBn: v.string(), courseNameEn: v.string(), mode: v.string(), totalFullMarksScaled: v.number(),
  passMarksScaled: v.number(), publicationVersion: v.number(), publishedAt: v.union(v.number(), v.null()),
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
      examId: exam._id, examNumber: exam.examNumber, examNameBn: exam.nameBn, examNameEn: exam.nameEn,
      examDate: exam.examDate, courseNameBn: course?.nameBn ?? "", courseNameEn: course?.nameEn ?? "", mode: exam.mode,
      totalFullMarksScaled: exam.totalFullMarksScaled, passMarksScaled: exam.passMarksScaled,
      publicationVersion: exam.publicationVersion, publishedAt: exam.publishedAt ?? null,
    };
  },
});

export const resultSheet = query({
  args: { examId: v.id("exams"), entryStatus: v.union(v.literal("missing"), v.literal("draft"), v.literal("ready"), v.literal("published")), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(resultRow), ...pageFields }),
  handler: async (ctx, args) => {
    const access = await requireExamReportAccess(ctx, args.examId);
    const page = args.entryStatus === "published"
      ? await ctx.db.query("examResults").withIndex("by_examId_and_totalScoreScaled", (q) => q.eq("examId", args.examId)).paginate(args.paginationOpts)
      : await ctx.db.query("examResults").withIndex("by_examId_and_entryStatus", (q) => q.eq("examId", args.examId).eq("entryStatus", args.entryStatus)).paginate(args.paginationOpts);
    const visible = args.entryStatus === "published" ? page.page.filter((result) => result.publishedAt !== undefined) : page.page;
    const scoped = access.batchId == null ? visible : (await Promise.all(visible.map(async (result) => ({ result, enrolment: await ctx.db.get("enrolments", result.enrolmentId) })))).filter(({ enrolment }) => enrolment?.batchId === access.batchId).map(({ result }) => result);
    return { ...page, page: await Promise.all(scoped.map(async (result) => {
      const student = await ctx.db.get("students", result.studentId);
      const published = args.entryStatus === "published";
      return { resultId: result._id, studentId: result.studentId, studentNumber: student?.studentNumber ?? "", studentName: student?.displayName ?? "", participation: published ? result.publishedParticipation ?? result.participation : result.participation, totalScoreScaled: published ? result.publishedTotalScoreScaled ?? null : result.totalScoreScaled ?? null, passed: published ? result.publishedPassed ?? null : result.passed ?? null, meritPosition: published ? result.publishedMeritPosition ?? null : result.meritPosition ?? null, entryStatus: result.entryStatus };
    })) };
  },
});

export const meritList = query({
  args: { examId: v.id("exams"), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(resultRow), ...pageFields }),
  handler: async (ctx, args) => {
    const access = await requireExamReportAccess(ctx, args.examId);
    const page = await ctx.db.query("examResults").withIndex("by_examId_and_totalScoreScaled", (q) => q.eq("examId", args.examId)).paginate(args.paginationOpts);
    const visible = page.page.filter((result) => result.publishedAt !== undefined);
    const scoped = access.batchId == null ? visible : (await Promise.all(visible.map(async (result) => ({ result, enrolment: await ctx.db.get("enrolments", result.enrolmentId) })))).filter(({ enrolment }) => enrolment?.batchId === access.batchId).map(({ result }) => result);
    scoped.sort((a, b) => (b.publishedTotalScoreScaled ?? -1) - (a.publishedTotalScoreScaled ?? -1));
    return { ...page, page: await Promise.all(scoped.map(async (result) => {
      const student = await ctx.db.get("students", result.studentId);
      return { resultId: result._id, studentId: result.studentId, studentNumber: student?.studentNumber ?? "", studentName: student?.displayName ?? "", participation: result.publishedParticipation ?? result.participation, totalScoreScaled: result.publishedTotalScoreScaled ?? null, passed: result.publishedPassed ?? null, meritPosition: result.publishedMeritPosition ?? null, entryStatus: result.entryStatus };
    })) };
  },
});

export const publishedResult = query({
  args: { examId: v.id("exams"), studentId: v.optional(v.id("students")) },
  returns: v.union(v.object({
    header: examHeader,
    student: v.object({ studentId: v.id("students"), studentNumber: v.string(), displayName: v.string(), rollNumber: v.union(v.string(), v.null()) }),
    result: v.object({ participation: v.string(), mcqScoreScaled: v.union(v.number(), v.null()), writtenScoreScaled: v.union(v.number(), v.null()), totalScoreScaled: v.number(), passed: v.boolean(), meritPosition: v.union(v.number(), v.null()), teacherCommentBn: v.union(v.string(), v.null()), teacherCommentEn: v.union(v.string(), v.null()), publicationVersion: v.number(), publishedAt: v.number() }),
  }), v.null()),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    let studentId = args.studentId;
    if (account.role === "owner") await requireOwner(ctx);
    else if (account.role === "student") {
      const access = await requireStudent(ctx);
      if (studentId && studentId !== access.student._id) throw new Error("Unauthorized");
      studentId = access.student._id;
    } else throw new Error("Unauthorized");
    if (!studentId) throw new Error("Student is required");
    const [exam, student, result] = await Promise.all([
      ctx.db.get("exams", args.examId),
      ctx.db.get("students", studentId),
      ctx.db.query("examResults").withIndex("by_examId_and_studentId", (q) => q.eq("examId", args.examId).eq("studentId", studentId!)).unique(),
    ]);
    if (!exam || !student || !result || result.publishedAt === undefined || result.publicationVersion === undefined || result.publishedTotalScoreScaled === undefined || result.publishedPassed === undefined || result.publishedParticipation === undefined) return null;
    const course = await ctx.db.get("courses", exam.courseId);
    return {
      header: { examId: exam._id, examNumber: exam.examNumber, examNameBn: exam.nameBn, examNameEn: exam.nameEn, examDate: exam.examDate, courseNameBn: course?.nameBn ?? "", courseNameEn: course?.nameEn ?? "", mode: exam.mode, totalFullMarksScaled: exam.totalFullMarksScaled, passMarksScaled: exam.passMarksScaled, publicationVersion: exam.publicationVersion, publishedAt: exam.publishedAt ?? null },
      student: { studentId: student._id, studentNumber: student.studentNumber, displayName: student.displayName, rollNumber: student.rollNumber ?? null },
      result: { participation: result.publishedParticipation, mcqScoreScaled: result.publishedMcqScoreScaled ?? null, writtenScoreScaled: result.publishedWrittenScoreScaled ?? null, totalScoreScaled: result.publishedTotalScoreScaled, passed: result.publishedPassed, meritPosition: result.publishedMeritPosition ?? null, teacherCommentBn: result.publishedTeacherCommentBn ?? null, teacherCommentEn: result.publishedTeacherCommentEn ?? null, publicationVersion: result.publicationVersion, publishedAt: result.publishedAt },
    };
  },
});

export const studentResultHistory = query({
  args: { studentId: v.id("students"), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.object({ resultId: v.id("examResults"), examId: v.id("exams"), examName: v.string(), examDate: v.string(), participation: v.string(), totalScoreScaled: v.union(v.number(), v.null()), passed: v.union(v.boolean(), v.null()), meritPosition: v.union(v.number(), v.null()), publishedAt: v.number() })), ...pageFields }),
  handler: async (ctx, args) => {
    const account = await requireOwnerOrStudent(ctx, args.studentId);
    const page = await ctx.db.query("examResults").withIndex("by_studentId_and_publishedAt", (q) => q.eq("studentId", args.studentId).gt("publishedAt", 0)).order("desc").paginate(args.paginationOpts);
    return { ...page, page: await Promise.all(page.page.map(async (result) => {
      const exam = await ctx.db.get("exams", result.examId);
      return { resultId: result._id, examId: result.examId, examName: localized(account.locale, exam?.nameBn, exam?.nameEn), examDate: exam?.examDate ?? "", participation: result.publishedParticipation ?? result.participation, totalScoreScaled: result.publishedTotalScoreScaled ?? null, passed: result.publishedPassed ?? null, meritPosition: result.publishedMeritPosition ?? null, publishedAt: result.publishedAt! };
    })) };
  },
});
