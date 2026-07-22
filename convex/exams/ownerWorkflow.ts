import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { requireAccount, requireOwner } from "../model/auth";
import { assertLocalDate } from "../model/dates";
import { nextIdentifier } from "../model/identifiers";
import { calculateSubjectResult, validateSubjectRule } from "./model";
import { examType, subjectRule } from "./validators";

const MAX_CANDIDATES = 500;
const MAX_SUBJECTS = 50;

const completeSubject = v.object({
  rule: subjectRule,
  teacherId: v.id("teachers"),
});

function validateSchedule(
  examDate: string,
  startsAtMinutes: number,
  durationMinutes: number,
) {
  assertLocalDate(examDate);
  if (
    !Number.isInteger(startsAtMinutes) ||
    startsAtMinutes < 0 ||
    startsAtMinutes >= 1440
  )
    throw new Error("Invalid exam start time");
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 15 ||
    durationMinutes > 720
  )
    throw new Error("Duration must be between 15 and 720 minutes");
  const endsAtMinutes = startsAtMinutes + durationMinutes;
  if (endsAtMinutes > 1440) throw new Error("An exam must end on the same day");
  return endsAtMinutes;
}

async function findConflict(
  ctx: QueryCtx | MutationCtx,
  input: {
    batchId: Id<"batches">;
    examDate: string;
    startsAtMinutes: number;
    endsAtMinutes: number;
    excludeExamId?: Id<"exams">;
  },
) {
  const [year, month, day] = input.examDate.split("-").map(Number);
  const startTimestamp =
    Date.UTC(year, month - 1, day, 0, input.startsAtMinutes) -
    6 * 60 * 60 * 1000;
  const endTimestamp =
    Date.UTC(year, month - 1, day, 0, input.endsAtMinutes) - 6 * 60 * 60 * 1000;
  const classes = await ctx.db
    .query("classSessions")
    .withIndex("by_batchId_and_sessionDate", (q) =>
      q.eq("batchId", input.batchId).eq("sessionDate", input.examDate),
    )
    .take(200);
  const classConflict = classes.find(
    (row) =>
      row.status !== "cancelled" &&
      startTimestamp < row.endsAt &&
      endTimestamp > row.startsAt,
  );
  if (classConflict)
    return {
      kind: "class" as const,
      id: classConflict._id,
      startsAt: classConflict.startsAt,
      endsAt: classConflict.endsAt,
    };

  const direct = await ctx.db
    .query("exams")
    .withIndex("by_batchId_and_examDate", (q) =>
      q.eq("batchId", input.batchId).eq("examDate", input.examDate),
    )
    .take(100);
  for (const exam of direct) {
    if (exam._id === input.excludeExamId || exam.status === "archived")
      continue;
    if (exam.startsAtMinutes === undefined || exam.endsAtMinutes === undefined)
      continue;
    if (
      input.startsAtMinutes < exam.endsAtMinutes &&
      input.endsAtMinutes > exam.startsAtMinutes
    )
      return {
        kind: "exam" as const,
        id: exam._id,
        startsAt: exam.startsAtMinutes,
        endsAt: exam.endsAtMinutes,
      };
  }

  // Compatibility check for pre-rebuild exams that still use examBatches.
  const legacyLinks = await ctx.db
    .query("examBatches")
    .withIndex("by_batchId", (q) => q.eq("batchId", input.batchId))
    .take(100);
  for (const link of legacyLinks) {
    if (link.examId === input.excludeExamId) continue;
    const exam = await ctx.db.get("exams", link.examId);
    if (!exam || exam.examDate !== input.examDate || exam.status === "archived")
      continue;
    if (exam.startsAtMinutes === undefined || exam.endsAtMinutes === undefined)
      continue;
    if (
      input.startsAtMinutes < exam.endsAtMinutes &&
      input.endsAtMinutes > exam.startsAtMinutes
    )
      return {
        kind: "exam" as const,
        id: exam._id,
        startsAt: exam.startsAtMinutes,
        endsAt: exam.endsAtMinutes,
      };
  }
  return null;
}

export const creationOptions = query({
  args: { batchId: v.optional(v.id("batches")) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const batches = [];
    for (const status of ["active", "planned"] as const) {
      const rows = await ctx.db
        .query("batches")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(200);
      for (const batch of rows) {
        const course = await ctx.db.get("courses", batch.courseId);
        if (course?.status === "active") batches.push({ batch, course });
      }
    }
    if (!args.batchId) return { batches, selected: null };
    const batch = await ctx.db.get("batches", args.batchId);
    if (!batch || !["active", "planned"].includes(batch.status))
      throw new Error("Active or planned batch not found");
    const course = await ctx.db.get("courses", batch.courseId);
    if (!course || course.status !== "active")
      throw new Error("Active course not found");
    const [links, batchAssignments, defaults, enrolments] = await Promise.all([
      ctx.db
        .query("courseSubjects")
        .withIndex("by_courseId_and_sortOrder", (q) =>
          q.eq("courseId", course._id),
        )
        .take(200),
      ctx.db
        .query("teacherBatchAssignments")
        .withIndex("by_batchId_and_status", (q) =>
          q.eq("batchId", batch._id).eq("status", "active"),
        )
        .take(200),
      ctx.db
        .query("courseTeacherDefaults")
        .withIndex("by_courseId_and_status", (q) =>
          q.eq("courseId", course._id).eq("status", "active"),
        )
        .take(200),
      ctx.db
        .query("enrolments")
        .withIndex("by_batchId_and_status", (q) =>
          q.eq("batchId", batch._id).eq("status", "active"),
        )
        .take(MAX_CANDIDATES + 1),
    ]);
    if (enrolments.length > MAX_CANDIDATES)
      throw new Error(`Candidate roster cannot exceed ${MAX_CANDIDATES}`);
    const subjects = [];
    for (const link of links) {
      const subject = await ctx.db.get("subjects", link.subjectId);
      if (!subject) continue;
      const assigned = batchAssignments.filter(
        (row) => row.subjectId === subject._id,
      );
      const fallback = defaults.filter((row) => row.subjectId === subject._id);
      const teacherIds = [
        ...new Set(
          (assigned.length ? assigned : fallback).map((row) => row.teacherId),
        ),
      ];
      const teachers = [];
      for (const teacherId of teacherIds) {
        const teacher = await ctx.db.get("teachers", teacherId);
        if (teacher?.status === "active")
          teachers.push({ teacherId, displayName: teacher.displayName });
      }
      subjects.push({ subject, teachers, sortOrder: link.sortOrder });
    }
    const candidates = [];
    for (const enrolment of enrolments) {
      const student = await ctx.db.get("students", enrolment.studentId);
      if (student) candidates.push({ enrolmentId: enrolment._id, student });
    }
    return { batches, selected: { batch, course, subjects, candidates } };
  },
});

export const previewConflict = query({
  args: {
    batchId: v.id("batches"),
    examDate: v.string(),
    startsAtMinutes: v.number(),
    durationMinutes: v.number(),
    excludeExamId: v.optional(v.id("exams")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const endsAtMinutes = validateSchedule(
      args.examDate,
      args.startsAtMinutes,
      args.durationMinutes,
    );
    return await findConflict(ctx, { ...args, endsAtMinutes });
  },
});

export const createComplete = mutation({
  args: {
    batchId: v.id("batches"),
    nameBn: v.string(),
    nameEn: v.string(),
    examDate: v.string(),
    examType,
    startsAtMinutes: v.number(),
    durationMinutes: v.number(),
    subjects: v.array(completeSubject),
    excludedStudentIds: v.array(v.id("students")),
  },
  returns: v.id("exams"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    if (!args.nameBn.trim() || !args.nameEn.trim())
      throw new Error("Both exam names are required");
    if (!args.subjects.length || args.subjects.length > MAX_SUBJECTS)
      throw new Error("Select at least one valid subject");
    if (
      new Set(args.subjects.map((row) => row.rule.subjectId)).size !==
      args.subjects.length
    )
      throw new Error("A subject can appear only once");
    const endsAtMinutes = validateSchedule(
      args.examDate,
      args.startsAtMinutes,
      args.durationMinutes,
    );
    const batch = await ctx.db.get("batches", args.batchId);
    if (!batch || !["active", "planned"].includes(batch.status))
      throw new Error("Active or planned batch not found");
    const course = await ctx.db.get("courses", batch.courseId);
    if (!course || course.status !== "active")
      throw new Error("Active course not found");
    if (
      await findConflict(ctx, {
        batchId: batch._id,
        examDate: args.examDate,
        startsAtMinutes: args.startsAtMinutes,
        endsAtMinutes,
      })
    )
      throw new Error(
        "This batch already has a class or exam during that time",
      );
    let grandFull = 0;
    for (const { rule, teacherId } of args.subjects) {
      validateSubjectRule(rule);
      grandFull += rule.totalFullMarksScaled;
      const link = await ctx.db
        .query("courseSubjects")
        .withIndex("by_courseId_and_subjectId", (q) =>
          q.eq("courseId", course._id).eq("subjectId", rule.subjectId),
        )
        .unique();
      if (!link)
        throw new Error("Every subject must belong to the batch course");
      const teacher = await ctx.db.get("teachers", teacherId);
      if (!teacher || teacher.status !== "active")
        throw new Error("Every subject requires an active teacher");
      const batchMatch = await ctx.db
        .query("teacherBatchAssignments")
        .withIndex("by_teacherId_and_batchId", (q) =>
          q.eq("teacherId", teacherId).eq("batchId", batch._id),
        )
        .take(100);
      const defaultMatch = await ctx.db
        .query("courseTeacherDefaults")
        .withIndex("by_courseId_and_subjectId", (q) =>
          q.eq("courseId", course._id).eq("subjectId", rule.subjectId),
        )
        .take(20);
      if (
        !batchMatch.some(
          (row) => row.status === "active" && row.subjectId === rule.subjectId,
        ) &&
        !defaultMatch.some(
          (row) => row.status === "active" && row.teacherId === teacherId,
        )
      )
        throw new Error("Teacher is not assigned to this subject");
    }
    const enrolments = await ctx.db
      .query("enrolments")
      .withIndex("by_batchId_and_status", (q) =>
        q.eq("batchId", batch._id).eq("status", "active"),
      )
      .take(MAX_CANDIDATES + 1);
    if (!enrolments.length || enrolments.length > MAX_CANDIDATES)
      throw new Error("Candidate roster is empty or too large");
    const eligibleStudents = new Set(enrolments.map((row) => row.studentId));
    const exclusions = new Set(args.excludedStudentIds);
    if (
      exclusions.size !== args.excludedStudentIds.length ||
      [...exclusions].some((id) => !eligibleStudents.has(id))
    )
      throw new Error("Invalid candidate exclusions");
    const included = enrolments.length - exclusions.size;
    if (!included)
      throw new Error("At least one candidate must remain included");
    const now = Date.now();
    const examId = await ctx.db.insert("exams", {
      examNumber: await nextIdentifier(
        ctx,
        "exam",
        "EX",
        Number(args.examDate.slice(0, 4)),
      ),
      courseId: course._id,
      batchId: batch._id,
      nameBn: args.nameBn.trim(),
      nameEn: args.nameEn.trim(),
      examDate: args.examDate,
      examType: args.examType,
      startsAtMinutes: args.startsAtMinutes,
      endsAtMinutes,
      durationMinutes: args.durationMinutes,
      mode: "written",
      writtenFullMarksScaled: grandFull,
      totalFullMarksScaled: grandFull,
      passMarksScaled: 0,
      status: "scheduled",
      publicationVersion: 0,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: account._id,
      modelVersion: 3,
      audienceMode: "single_batch",
      rosterStatus: "frozen",
      rosterFrozenAt: now,
      candidateCount: included,
      meritMode: "official_only",
      officialMeritScope: "batch",
      rankFailedStudents: false,
      markingRulesVersion: 1,
      subjectCount: args.subjects.length,
      expectedResultCount: args.subjects.length * included,
      completedResultCount: 0,
    });
    await ctx.db.insert("examBatches", { examId, batchId: batch._id });
    for (const enrolment of enrolments) {
      const excluded = exclusions.has(enrolment.studentId);
      await ctx.db.insert("examCandidates", {
        examId,
        studentId: enrolment.studentId,
        enrolmentId: enrolment._id,
        batchId: batch._id,
        courseId: course._id,
        includedAt: now,
        source: "single_batch",
        status: excluded ? "excluded" : "included",
        excludedAt: excluded ? now : undefined,
      });
    }
    for (const { rule, teacherId } of args.subjects) {
      const examSubjectId = await ctx.db.insert("examSubjects", {
        examId,
        ...rule,
      });
      await ctx.db.insert("examTeacherAssignments", {
        examId,
        examSubjectId,
        teacherId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("examAuditEvents", {
      examId,
      eventType: "exam_created_complete",
      actorAccountId: account._id,
      createdAt: now,
      metadata: JSON.stringify({
        batchId: batch._id,
        subjectCount: args.subjects.length,
        included,
        excluded: exclusions.size,
      }),
    });
    return examId;
  },
});

export const listOwner = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    batchId: v.optional(v.id("batches")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const statuses = args.status
      ? [args.status]
      : [
          "scheduled",
          "marks_entry",
          "ready_for_review",
          "publication_processing",
          "published",
          "reopened",
        ];
    const rows = [];
    for (const status of statuses)
      rows.push(
        ...(await ctx.db
          .query("exams")
          .withIndex("by_status_and_examDate", (q) =>
            q.eq("status", status as never),
          )
          .order("desc")
          .take(200)),
      );
    const term = args.search?.trim().toLocaleLowerCase();
    const filtered = rows.filter(
      (exam) =>
        exam.modelVersion === 3 &&
        (!args.batchId || exam.batchId === args.batchId) &&
        (!term ||
          `${exam.examNumber} ${exam.nameBn} ${exam.nameEn}`
            .toLocaleLowerCase()
            .includes(term)),
    );
    filtered.sort(
      (a, b) =>
        b.examDate.localeCompare(a.examDate) ||
        (a.startsAtMinutes ?? 0) - (b.startsAtMinutes ?? 0),
    );
    const start = Number(args.paginationOpts.cursor ?? 0);
    const page = filtered.slice(start, start + args.paginationOpts.numItems);
    const enriched = [];
    for (const exam of page) {
      const [batch, course] = await Promise.all([
        exam.batchId ? ctx.db.get("batches", exam.batchId) : null,
        ctx.db.get("courses", exam.courseId),
      ]);
      enriched.push({ exam, batch, course });
    }
    return {
      page: enriched,
      isDone: start + page.length >= filtered.length,
      continueCursor: String(start + page.length),
    };
  },
});

export const ownerDetail = query({
  args: { examId: v.id("exams") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    if (account.role !== "owner") throw new Error("Unauthorized");
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam || exam.modelVersion !== 3)
      throw new Error("Owner exam not found");
    const [batch, course, subjects, assignments, candidates] =
      await Promise.all([
        exam.batchId ? ctx.db.get("batches", exam.batchId) : null,
        ctx.db.get("courses", exam.courseId),
        ctx.db
          .query("examSubjects")
          .withIndex("by_examId_and_sortOrder", (q) => q.eq("examId", exam._id))
          .take(MAX_SUBJECTS),
        ctx.db
          .query("examTeacherAssignments")
          .withIndex("by_examId", (q) => q.eq("examId", exam._id))
          .take(MAX_SUBJECTS),
        ctx.db
          .query("examCandidates")
          .withIndex("by_examId_and_status", (q) =>
            q.eq("examId", exam._id).eq("status", "included"),
          )
          .take(MAX_CANDIDATES),
      ]);
    const subjectRows = [];
    for (const subject of subjects) {
      const assignment = assignments.find(
        (row) => row.examSubjectId === subject._id,
      );
      subjectRows.push({
        subject,
        subjectRecord: await ctx.db.get("subjects", subject.subjectId),
        assignment,
        teacher: assignment
          ? await ctx.db.get("teachers", assignment.teacherId)
          : null,
      });
    }
    return {
      exam,
      batch,
      course,
      subjects: subjectRows,
      candidateCount: candidates.length,
    };
  },
});

export const scheduleItems = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const statuses = [
      "scheduled",
      "marks_entry",
      "ready_for_review",
      "published",
      "reopened",
    ] as const;
    const exams = (
      await Promise.all(
        statuses.map((status) =>
          ctx.db
            .query("exams")
            .withIndex("by_status_and_examDate", (q) =>
              q
                .eq("status", status)
                .gte("examDate", args.startDate)
                .lte("examDate", args.endDate),
            )
            .take(100),
        ),
      )
    ).flat();
    const rows = [];
    for (const exam of exams) {
      if (exam.modelVersion !== 3 || !exam.batchId) continue;
      if (args.batchId && exam.batchId !== args.batchId) continue;
      const batch = await ctx.db.get("batches", exam.batchId);
      if (!batch || (args.courseId && batch.courseId !== args.courseId))
        continue;
      rows.push({
        id: exam._id,
        nameBn: exam.nameBn,
        nameEn: exam.nameEn,
        examDate: exam.examDate,
        startsAtMinutes: exam.startsAtMinutes ?? 0,
        endsAtMinutes: exam.endsAtMinutes ?? 0,
        status: exam.status,
        batchNameBn: batch.nameBn,
        batchNameEn: batch.nameEn,
      });
    }
    return rows.sort(
      (a, b) =>
        a.examDate.localeCompare(b.examDate) ||
        a.startsAtMinutes - b.startsAtMinutes,
    );
  },
});

export const ownerSubjectGrid = query({
  args: {
    examId: v.id("exams"),
    examSubjectId: v.id("examSubjects"),
    search: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const [exam, subject] = await Promise.all([
      ctx.db.get("exams", args.examId),
      ctx.db.get("examSubjects", args.examSubjectId),
    ]);
    if (
      !exam ||
      exam.modelVersion !== 3 ||
      !subject ||
      subject.examId !== exam._id
    )
      throw new Error("Exam subject not found");
    const candidates = await ctx.db
      .query("examCandidates")
      .withIndex("by_examId_and_status", (q) =>
        q.eq("examId", exam._id).eq("status", "included"),
      )
      .take(MAX_CANDIDATES);
    const term = args.search?.trim().toLocaleLowerCase();
    const rows = [];
    let complete = 0;
    let absent = 0;
    for (const candidate of candidates) {
      const [student, result] = await Promise.all([
        ctx.db.get("students", candidate.studentId),
        ctx.db
          .query("examSubjectResults")
          .withIndex("by_candidateId_and_examSubjectId", (q) =>
            q.eq("candidateId", candidate._id).eq("examSubjectId", subject._id),
          )
          .unique(),
      ]);
      if (!student) continue;
      if (result) {
        complete += 1;
        if (result.participation === "absent") absent += 1;
      }
      if (
        !term ||
        `${student.studentNumber} ${student.displayName}`
          .toLocaleLowerCase()
          .includes(term)
      )
        rows.push({ candidate, student, result });
    }
    return {
      exam,
      subject,
      rows,
      counts: {
        total: candidates.length,
        complete,
        missing: candidates.length - complete,
        absent,
      },
    };
  },
});

export const saveOwnerRows = mutation({
  args: {
    examId: v.id("exams"),
    examSubjectId: v.id("examSubjects"),
    rows: v.array(
      v.object({
        studentId: v.id("students"),
        participation: v.union(v.literal("present"), v.literal("absent")),
        mcqScoreScaled: v.optional(v.number()),
        writtenScoreScaled: v.optional(v.number()),
      }),
    ),
  },
  returns: v.object({ saved: v.number() }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    if (!args.rows.length || args.rows.length > 50)
      throw new Error("Save between 1 and 50 rows");
    const [exam, subject] = await Promise.all([
      ctx.db.get("exams", args.examId),
      ctx.db.get("examSubjects", args.examSubjectId),
    ]);
    if (
      !exam ||
      exam.modelVersion !== 3 ||
      !["scheduled", "marks_entry", "reopened"].includes(exam.status)
    )
      throw new Error("Exam is not open for marks");
    if (
      !subject ||
      subject.examId !== exam._id ||
      !subject.mode ||
      subject.totalFullMarksScaled === undefined ||
      subject.passMarksScaled === undefined
    )
      throw new Error("Subject rule is incomplete");
    if (
      new Set(args.rows.map((row) => row.studentId)).size !== args.rows.length
    )
      throw new Error("Duplicate student rows are not allowed");
    let newlyCompleted = 0;
    const now = Date.now();
    for (const input of args.rows) {
      const candidate = await ctx.db
        .query("examCandidates")
        .withIndex("by_examId_and_studentId", (q) =>
          q.eq("examId", exam._id).eq("studentId", input.studentId),
        )
        .unique();
      if (!candidate || candidate.status !== "included")
        throw new Error("Student is outside the included exam roster");
      const calculated = calculateSubjectResult({
        mode: subject.mode,
        mcqFullMarksScaled: subject.mcqFullMarksScaled,
        writtenFullMarksScaled: subject.writtenFullMarksScaled,
        totalFullMarksScaled: subject.totalFullMarksScaled,
        passMarksScaled: subject.passMarksScaled,
        mcqPassMarksScaled: subject.mcqPassMarksScaled,
        writtenPassMarksScaled: subject.writtenPassMarksScaled,
        isRequired: subject.isRequired ?? true,
        participation: input.participation,
        mcqScoreScaled:
          input.participation === "absent" ? undefined : input.mcqScoreScaled,
        writtenScoreScaled:
          input.participation === "absent"
            ? undefined
            : input.writtenScoreScaled,
      });
      const existing = await ctx.db
        .query("examSubjectResults")
        .withIndex("by_candidateId_and_examSubjectId", (q) =>
          q.eq("candidateId", candidate._id).eq("examSubjectId", subject._id),
        )
        .unique();
      const values = {
        participation: input.participation,
        mcqScoreScaled:
          input.participation === "absent" ? undefined : input.mcqScoreScaled,
        writtenScoreScaled:
          input.participation === "absent"
            ? undefined
            : input.writtenScoreScaled,
        ...calculated,
        entryStatus: "draft" as const,
        enteredByAccountId: account._id,
        enteredAt: now,
        updatedAt: now,
      };
      if (existing)
        await ctx.db.patch("examSubjectResults", existing._id, values);
      else {
        await ctx.db.insert("examSubjectResults", {
          examId: exam._id,
          examSubjectId: subject._id,
          candidateId: candidate._id,
          studentId: candidate.studentId,
          batchId: candidate.batchId,
          ...values,
        });
        newlyCompleted += 1;
      }
    }
    await ctx.db.patch("exams", exam._id, {
      status: exam.status === "scheduled" ? "marks_entry" : exam.status,
      completedResultCount: Math.min(
        exam.expectedResultCount ?? Number.MAX_SAFE_INTEGER,
        (exam.completedResultCount ?? 0) + newlyCompleted,
      ),
      updatedAt: now,
    });
    return { saved: args.rows.length };
  },
});
