import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { enqueueSms } from "../messaging/model";
import {
  requireAccount,
  requireOwner,
  requireStudent,
  requireTeacherExamAssignment,
} from "../model/auth";
import { writeAudit } from "../model/audit";
import { assertLocalDate } from "../model/dates";
import { nextIdentifier } from "../model/identifiers";
import {
  calculateResult,
  competitionRanks,
  resultSmsBody,
  validateExamMarks,
} from "./model";

const modeValidator = v.union(
  v.literal("mcq"),
  v.literal("written"),
  v.literal("both"),
);
const participationValidator = v.union(
  v.literal("present"),
  v.literal("absent"),
);
const publishedStudentResultValidator = v.object({
  examId: v.id("exams"),
  courseId: v.id("courses"),
  nameBn: v.string(),
  nameEn: v.string(),
  examDate: v.string(),
  mode: modeValidator,
  participation: participationValidator,
  mcqScoreScaled: v.optional(v.number()),
  writtenScoreScaled: v.optional(v.number()),
  totalScoreScaled: v.number(),
  totalFullMarksScaled: v.number(),
  passed: v.boolean(),
  meritPosition: v.optional(v.number()),
  teacherCommentBn: v.optional(v.string()),
  teacherCommentEn: v.optional(v.string()),
  publicationVersion: v.number(),
  publishedAt: v.number(),
});
const MAX_CANDIDATES = 500;

async function mustExam(ctx: MutationCtx, examId: Id<"exams">) {
  const exam = await ctx.db.get("exams", examId);
  if (!exam) throw new Error("Exam not found");
  return exam;
}

async function loadCandidateEnrolments(
  ctx: MutationCtx,
  courseId: Id<"courses">,
  batchIds: Id<"batches">[],
) {
  const candidates: Doc<"enrolments">[] = [];
  const seenStudents = new Set<string>();
  for (const batchId of batchIds) {
    const rows = await ctx.db
      .query("enrolments")
      .withIndex("by_batchId_and_status", (q) =>
        q.eq("batchId", batchId).eq("status", "active"),
      )
      .take(MAX_CANDIDATES + 1);
    for (const row of rows) {
      if (row.courseId !== courseId)
        throw new Error(
          "Exam roster contains an enrolment from another course",
        );
      if (seenStudents.has(row.studentId))
        throw new Error(
          "A student cannot appear in multiple selected exam batches",
        );
      seenStudents.add(row.studentId);
      candidates.push(row);
      if (candidates.length > MAX_CANDIDATES)
        throw new Error(
          `Exam candidate roster cannot exceed ${MAX_CANDIDATES} students`,
        );
    }
  }
  return candidates;
}

export const create = mutation({
  args: {
    courseId: v.id("courses"),
    nameBn: v.string(),
    nameEn: v.string(),
    examDate: v.string(),
    mode: modeValidator,
    mcqFullMarksScaled: v.optional(v.number()),
    writtenFullMarksScaled: v.optional(v.number()),
    totalFullMarksScaled: v.number(),
    passMarksScaled: v.number(),
    subjectIds: v.array(v.id("subjects")),
    batchIds: v.array(v.id("batches")),
    teacherAssignments: v.array(
      v.object({
        teacherId: v.id("teachers"),
        batchId: v.optional(v.id("batches")),
      }),
    ),
  },
  returns: v.id("exams"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    validateExamMarks(args);
    const course = await ctx.db.get("courses", args.courseId);
    if (!course || course.status === "archived")
      throw new Error("Active course not found");
    assertLocalDate(args.examDate);
    if (!args.nameBn.trim() || !args.nameEn.trim())
      throw new Error("Exam names are required");
    if (!args.subjectIds.length) throw new Error("Select at least one subject");
    if (!args.batchIds.length) throw new Error("Select at least one batch");
    if (!args.teacherAssignments.length)
      throw new Error("Assign at least one teacher");
    if (
      new Set(args.subjectIds).size !== args.subjectIds.length ||
      new Set(args.batchIds).size !== args.batchIds.length
    )
      throw new Error("Duplicate exam metadata is not allowed");

    for (const [index, subjectId] of args.subjectIds.entries()) {
      const subject = await ctx.db.get("subjects", subjectId);
      const courseSubject = await ctx.db
        .query("courseSubjects")
        .withIndex("by_courseId_and_subjectId", (q) =>
          q.eq("courseId", args.courseId).eq("subjectId", subjectId),
        )
        .unique();
      if (!subject || !courseSubject)
        throw new Error(`Subject ${index + 1} is not active in this course`);
    }
    for (const batchId of args.batchIds) {
      const batch = await ctx.db.get("batches", batchId);
      if (
        !batch ||
        batch.courseId !== args.courseId ||
        batch.status === "archived"
      )
        throw new Error("Every exam batch must belong to the selected course");
    }
    const teacherIds = new Set<string>();
    for (const assignment of args.teacherAssignments) {
      if (teacherIds.has(assignment.teacherId))
        throw new Error("A teacher can have only one assignment per exam");
      teacherIds.add(assignment.teacherId);
      const teacher = await ctx.db.get("teachers", assignment.teacherId);
      if (!teacher || teacher.status !== "active")
        throw new Error("Every assigned teacher must be active");
      if (assignment.batchId && !args.batchIds.includes(assignment.batchId))
        throw new Error(
          "Teacher assignment batch must be selected for the exam",
        );
    }
    const candidates = await loadCandidateEnrolments(
      ctx,
      args.courseId,
      args.batchIds,
    );
    if (!candidates.length) throw new Error("Exam candidate roster is empty");

    const now = Date.now();
    const year = Number(args.examDate.slice(0, 4));
    const examNumber = await nextIdentifier(ctx, "exam", "EX", year);
    const examId = await ctx.db.insert("exams", {
      examNumber,
      courseId: args.courseId,
      nameBn: args.nameBn.trim(),
      nameEn: args.nameEn.trim(),
      examDate: args.examDate,
      mode: args.mode,
      mcqFullMarksScaled: args.mcqFullMarksScaled,
      writtenFullMarksScaled: args.writtenFullMarksScaled,
      totalFullMarksScaled: args.totalFullMarksScaled,
      passMarksScaled: args.passMarksScaled,
      status: "marks_entry",
      publicationVersion: 0,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: account._id,
    });
    await Promise.all(
      args.subjectIds.map((subjectId, sortOrder) =>
        ctx.db.insert("examSubjects", { examId, subjectId, sortOrder }),
      ),
    );
    await Promise.all(
      args.batchIds.map((batchId) =>
        ctx.db.insert("examBatches", { examId, batchId }),
      ),
    );
    await Promise.all(
      args.teacherAssignments.map((assignment) =>
        ctx.db.insert("examTeacherAssignments", {
          examId,
          ...assignment,
          createdAt: now,
        }),
      ),
    );
    await Promise.all(
      candidates.map((enrolment) =>
        ctx.db.insert("examResults", {
          examId,
          courseId: args.courseId,
          studentId: enrolment.studentId,
          enrolmentId: enrolment._id,
          participation: "present",
          entryStatus: "missing",
          updatedAt: now,
        }),
      ),
    );
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "exam.created",
      entityType: "exam",
      entityId: examId,
      summary: "Exam created with candidate roster",
      metadata: { candidateCount: candidates.length },
    });
    return examId;
  },
});

export const saveResult = mutation({
  args: {
    examId: v.id("exams"),
    studentId: v.id("students"),
    participation: participationValidator,
    mcqScoreScaled: v.optional(v.number()),
    writtenScoreScaled: v.optional(v.number()),
    teacherCommentBn: v.optional(v.string()),
    teacherCommentEn: v.optional(v.string()),
  },
  returns: v.object({ totalScoreScaled: v.number(), passed: v.boolean() }),
  handler: async (ctx, args) => {
    const { account, assignment } = await requireTeacherExamAssignment(
      ctx,
      args.examId,
    );
    const exam = await mustExam(ctx, args.examId);
    if (exam.status !== "marks_entry" && exam.status !== "reopened")
      throw new Error("Exam is not open for mark entry");
    const result = await ctx.db
      .query("examResults")
      .withIndex("by_examId_and_studentId", (q) =>
        q.eq("examId", args.examId).eq("studentId", args.studentId),
      )
      .unique();
    if (!result) throw new Error("Student is not in the exam roster");
    if (assignment.batchId) {
      const enrolment = await ctx.db.get("enrolments", result.enrolmentId);
      if (!enrolment || enrolment.batchId !== assignment.batchId)
        throw new Error("Unauthorized");
    }
    const calculated = calculateResult({
      ...args,
      mode: exam.mode,
      mcqFullMarksScaled: exam.mcqFullMarksScaled,
      writtenFullMarksScaled: exam.writtenFullMarksScaled,
      passMarksScaled: exam.passMarksScaled,
    });
    const now = Date.now();
    await ctx.db.patch("examResults", result._id, {
      participation: args.participation,
      mcqScoreScaled: args.mcqScoreScaled,
      writtenScoreScaled: args.writtenScoreScaled,
      ...calculated,
      teacherCommentBn: args.teacherCommentBn?.trim() || undefined,
      teacherCommentEn: args.teacherCommentEn?.trim() || undefined,
      entryStatus: "draft",
      enteredByAccountId: account._id,
      enteredAt: now,
      meritPosition: undefined,
      updatedAt: now,
    });
    return calculated;
  },
});

export const markResultReady = mutation({
  args: { examId: v.id("exams"), studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { assignment } = await requireTeacherExamAssignment(ctx, args.examId);
    const exam = await mustExam(ctx, args.examId);
    if (exam.status !== "marks_entry" && exam.status !== "reopened")
      throw new Error("Exam is not open for review submission");
    const result = await ctx.db
      .query("examResults")
      .withIndex("by_examId_and_studentId", (q) =>
        q.eq("examId", args.examId).eq("studentId", args.studentId),
      )
      .unique();
    if (
      !result ||
      result.totalScoreScaled === undefined ||
      result.passed === undefined ||
      result.entryStatus === "missing"
    )
      throw new Error("Complete marks before submitting for review");
    if (assignment.batchId) {
      const enrolment = await ctx.db.get("enrolments", result.enrolmentId);
      if (!enrolment || enrolment.batchId !== assignment.batchId)
        throw new Error("Unauthorized");
    }
    await ctx.db.patch("examResults", result._id, {
      entryStatus: "ready",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const submitForOwnerReview = mutation({
  args: { examId: v.id("exams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const exam = await mustExam(ctx, args.examId);
    if (exam.status !== "marks_entry" && exam.status !== "reopened")
      throw new Error("Exam is not open for review");
    const results = await ctx.db
      .query("examResults")
      .withIndex("by_examId_and_entryStatus", (q) =>
        q.eq("examId", args.examId).eq("entryStatus", "ready"),
      )
      .take(MAX_CANDIDATES + 1);
    const all = await ctx.db
      .query("examResults")
      .withIndex("by_examId_and_totalScoreScaled", (q) =>
        q.eq("examId", args.examId),
      )
      .take(MAX_CANDIDATES + 1);
    if (
      !all.length ||
      all.length > MAX_CANDIDATES ||
      results.length !== all.length
    )
      throw new Error("Every roster result must be complete and ready");
    await ctx.db.patch("exams", exam._id, {
      status: "ready_for_review",
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "exam.ready_for_review",
      entityType: "exam",
      entityId: exam._id,
      summary: "Exam results submitted for owner review",
      metadata: { candidateCount: all.length },
    });
    return null;
  },
});

export const publish = mutation({
  args: { examId: v.id("exams") },
  returns: v.object({
    publicationVersion: v.number(),
    recipientCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const exam = await mustExam(ctx, args.examId);
    if (exam.status !== "ready_for_review")
      throw new Error("Exam is not ready for publication");
    const ready = await ctx.db
      .query("examResults")
      .withIndex("by_examId_and_entryStatus", (q) =>
        q.eq("examId", args.examId).eq("entryStatus", "ready"),
      )
      .take(MAX_CANDIDATES + 1);
    const roster = await ctx.db
      .query("examResults")
      .withIndex("by_examId_and_totalScoreScaled", (q) =>
        q.eq("examId", args.examId),
      )
      .take(MAX_CANDIDATES + 1);
    if (
      !roster.length ||
      roster.length > MAX_CANDIDATES ||
      ready.length !== roster.length ||
      roster.some(
        (row) => row.totalScoreScaled === undefined || row.passed === undefined,
      )
    )
      throw new Error("Cannot publish an incomplete unresolved roster");

    const ranks = competitionRanks(
      roster
        .filter((row) => row.participation === "present")
        .map((row) => ({
          key: row._id,
          totalScoreScaled: row.totalScoreScaled!,
        })),
    );
    const now = Date.now();
    const publicationVersion = exam.publicationVersion + 1;
    const isCorrection = exam.publicationVersion > 0;
    let recipientCount = 0;
    for (const result of roster) {
      const meritPosition =
        result.participation === "present" ? ranks.get(result._id) : undefined;
      await ctx.db.patch("examResults", result._id, {
        entryStatus: "published",
        meritPosition,
        publicationVersion,
        publishedAt: now,
        updatedAt: now,
        publishedParticipation: result.participation,
        publishedMcqScoreScaled: result.mcqScoreScaled,
        publishedWrittenScoreScaled: result.writtenScoreScaled,
        publishedTotalScoreScaled: result.totalScoreScaled,
        publishedPassed: result.passed,
        publishedMeritPosition: meritPosition,
        publishedTeacherCommentBn: result.teacherCommentBn,
        publishedTeacherCommentEn: result.teacherCommentEn,
      });
      const student = await ctx.db.get("students", result.studentId);
      if (!student || student.status === "archived") continue;
      const body = resultSmsBody({
        locale: student.preferredSmsLocale,
        isCorrection,
        examNameBn: exam.nameBn,
        examNameEn: exam.nameEn,
        totalScoreScaled: result.totalScoreScaled!,
        totalFullMarksScaled: exam.totalFullMarksScaled,
        passed: result.passed!,
        meritPosition,
      });
      const messageIds = await enqueueSms(ctx, {
        idempotencyKey: `exam:${exam._id}:v${publicationVersion}:${student._id}`,
        eventType: isCorrection ? "result_corrected" : "result_published",
        relatedEntityType: "exam",
        relatedEntityId: exam._id,
        studentId: student._id,
        guardianPhone: student.guardianPhone,
        locale: student.preferredSmsLocale,
        body,
      });
      recipientCount += messageIds.length;
    }
    await ctx.db.patch("exams", exam._id, {
      status: "published",
      publicationVersion,
      publishedAt: now,
      publishedByAccountId: account._id,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: isCorrection ? "exam.republished" : "exam.published",
      entityType: "exam",
      entityId: exam._id,
      summary: isCorrection
        ? "Corrected exam results published"
        : "Exam results published",
      metadata: { publicationVersion, recipientCount },
    });
    return { publicationVersion, recipientCount };
  },
});

export const reopen = mutation({
  args: { examId: v.id("exams"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const exam = await mustExam(ctx, args.examId);
    if (exam.status !== "published")
      throw new Error("Only a published exam can be reopened");
    if (!args.reason.trim()) throw new Error("A reopen reason is required");
    const published = await ctx.db
      .query("examResults")
      .withIndex("by_examId_and_entryStatus", (q) =>
        q.eq("examId", args.examId).eq("entryStatus", "published"),
      )
      .take(MAX_CANDIDATES + 1);
    for (const result of published)
      await ctx.db.patch("examResults", result._id, {
        entryStatus: "draft",
        meritPosition: undefined,
        updatedAt: Date.now(),
      });
    await ctx.db.patch("exams", exam._id, {
      status: "reopened",
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "exam.reopened",
      entityType: "exam",
      entityId: exam._id,
      summary: "Published exam reopened for correction",
      metadata: {
        reason: args.reason.trim(),
        publicationVersion: exam.publicationVersion,
      },
    });
    return null;
  },
});

export const ownerReview = query({
  args: { examId: v.id("exams") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam) throw new Error("Exam not found");
    const results = await ctx.db
      .query("examResults")
      .withIndex("by_examId_and_totalScoreScaled", (q) =>
        q.eq("examId", args.examId),
      )
      .take(MAX_CANDIDATES + 1);
    return { exam, results };
  },
});

export const teacherRoster = query({
  args: { examId: v.id("exams") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { assignment } = await requireTeacherExamAssignment(ctx, args.examId);
    const results = await ctx.db
      .query("examResults")
      .withIndex("by_examId_and_totalScoreScaled", (q) =>
        q.eq("examId", args.examId),
      )
      .take(MAX_CANDIDATES + 1);
    const project = async (result: Doc<"examResults">) => {
      const student = await ctx.db.get("students", result.studentId);
      return {
        ...result,
        studentNumber: student?.studentNumber ?? "",
        studentName: student?.displayName ?? "",
      };
    };
    if (!assignment.batchId) return await Promise.all(results.map(project));
    const visible = [];
    for (const result of results) {
      const enrolment = await ctx.db.get("enrolments", result.enrolmentId);
      if (enrolment?.batchId === assignment.batchId)
        visible.push(await project(result));
    }
    return visible;
  },
});

export const listManaged = query({
  args: {},
  returns: v.array(
    v.object({
      examId: v.id("exams"),
      examNumber: v.string(),
      courseId: v.id("courses"),
      nameBn: v.string(),
      nameEn: v.string(),
      examDate: v.string(),
      mode: modeValidator,
      status: v.string(),
      publicationVersion: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const account = await requireAccount(ctx);
    const exams: Doc<"exams">[] = [];
    if (account.role === "owner") {
      await requireOwner(ctx);
      for (const status of [
        "draft",
        "marks_entry",
        "ready_for_review",
        "published",
        "reopened",
      ] as const)
        exams.push(
          ...(await ctx.db
            .query("exams")
            .withIndex("by_status_and_examDate", (q) => q.eq("status", status))
            .order("desc")
            .take(100)),
        );
    } else if (account.role === "teacher") {
      const assignments = await ctx.db
        .query("examTeacherAssignments")
        .withIndex("by_teacherId", (q) => q.eq("teacherId", account.teacherId))
        .take(100);
      for (const assignment of assignments) {
        const exam = await ctx.db.get("exams", assignment.examId);
        if (exam && exam.status !== "archived") exams.push(exam);
      }
    } else throw new Error("Unauthorized");
    return exams
      .sort((a, b) => b.examDate.localeCompare(a.examDate))
      .map((exam) => ({
        examId: exam._id,
        examNumber: exam.examNumber,
        courseId: exam.courseId,
        nameBn: exam.nameBn,
        nameEn: exam.nameEn,
        examDate: exam.examDate,
        mode: exam.mode,
        status: exam.status,
        publicationVersion: exam.publicationVersion,
      }));
  },
});

export const myPublishedResults = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(publishedStudentResultValidator),
  handler: async (ctx, args) => {
    const { student } = await requireStudent(ctx);
    const page = await ctx.db
      .query("examResults")
      .withIndex("by_studentId_and_publishedAt", (q) =>
        q.eq("studentId", student._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const visible = [];
    for (const result of page.page) {
      if (
        result.publishedAt === undefined ||
        result.publishedTotalScoreScaled === undefined ||
        result.publishedPassed === undefined ||
        result.publicationVersion === undefined ||
        result.publishedParticipation === undefined
      )
        continue;
      const exam = await ctx.db.get("exams", result.examId);
      if (!exam || exam.status === "archived") continue;
      visible.push({
        examId: result.examId,
        courseId: result.courseId,
        nameBn: exam.nameBn,
        nameEn: exam.nameEn,
        examDate: exam.examDate,
        mode: exam.mode,
        participation: result.publishedParticipation,
        mcqScoreScaled: result.publishedMcqScoreScaled,
        writtenScoreScaled: result.publishedWrittenScoreScaled,
        totalScoreScaled: result.publishedTotalScoreScaled,
        totalFullMarksScaled: exam.totalFullMarksScaled,
        passed: result.publishedPassed,
        meritPosition: result.publishedMeritPosition,
        teacherCommentBn: result.publishedTeacherCommentBn,
        teacherCommentEn: result.publishedTeacherCommentEn,
        publicationVersion: result.publicationVersion,
        publishedAt: result.publishedAt,
      });
    }
    return { ...page, page: visible };
  },
});
