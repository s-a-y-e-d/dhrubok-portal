import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAccount, requireOwner } from "../model/auth";
import { assignmentInput } from "./validators";

export const configure = mutation({
  args: { examId: v.id("exams"), assignments: v.array(assignmentInput) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam || exam.modelVersion !== 2 || exam.status !== "draft")
      throw new Error("Only a new-model draft can be configured");
    if (!args.assignments.length)
      throw new Error("Every exam requires teacher assignments");
    const subjects = await ctx.db
      .query("examSubjects")
      .withIndex("by_examId_and_sortOrder", (q) => q.eq("examId", exam._id))
      .take(100);
    const subjectIds = new Set(subjects.map((row) => row._id));
    const batches = await ctx.db
      .query("examBatches")
      .withIndex("by_examId", (q) => q.eq("examId", exam._id))
      .take(100);
    const batchIds = new Set(batches.map((row) => row.batchId));
    const coverage = new Set<string>();
    for (const input of args.assignments) {
      if (!subjectIds.has(input.examSubjectId))
        throw new Error("Assignment subject is outside this exam");
      const teacher = await ctx.db.get("teachers", input.teacherId);
      if (!teacher || teacher.status !== "active")
        throw new Error("Assigned teacher must be active");
      if (input.batchId && !batchIds.has(input.batchId))
        throw new Error("Assignment batch is outside this exam");
      const keys = input.batchId
        ? [`${input.examSubjectId}:${input.batchId}`]
        : [...batchIds].map((batchId) => `${input.examSubjectId}:${batchId}`);
      for (const key of keys) {
        if (coverage.has(key))
          throw new Error("Teacher assignment scopes overlap");
        coverage.add(key);
      }
    }
    for (const subject of subjects)
      for (const batchId of batchIds)
        if (!coverage.has(`${subject._id}:${batchId}`))
          throw new Error("Every subject and batch must have teacher coverage");
    const existing = await ctx.db
      .query("examTeacherAssignments")
      .withIndex("by_examId", (q) => q.eq("examId", exam._id))
      .take(200);
    for (const row of existing)
      await ctx.db.delete("examTeacherAssignments", row._id);
    const now = Date.now();
    for (const input of args.assignments)
      await ctx.db.insert("examTeacherAssignments", {
        examId: exam._id,
        ...input,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
    await ctx.db.insert("examAuditEvents", {
      examId: exam._id,
      eventType: "teacher_assignments_configured",
      actorAccountId: account._id,
      createdAt: now,
      metadata: JSON.stringify({ assignmentCount: args.assignments.length }),
    });
    return null;
  },
});

export const openMarksEntry = mutation({
  args: { examId: v.id("exams") },
  returns: v.object({ resultRowCount: v.number(), initializing: v.boolean() }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const exam = await ctx.db.get("exams", args.examId);
    if (
      !exam ||
      exam.modelVersion !== 2 ||
      exam.status !== "draft" ||
      exam.rosterStatus !== "frozen"
    )
      throw new Error("Freeze the new-model draft roster first");
    const subjects = await ctx.db
      .query("examSubjects")
      .withIndex("by_examId_and_sortOrder", (q) => q.eq("examId", exam._id))
      .take(100);
    const candidates = await ctx.db
      .query("examCandidates")
      .withIndex("by_examId_and_status", (q) =>
        q.eq("examId", exam._id).eq("status", "included"),
      )
      .take(501);
    const assignments = await ctx.db
      .query("examTeacherAssignments")
      .withIndex("by_examId", (q) => q.eq("examId", exam._id))
      .take(200);
    if (
      !subjects.length ||
      candidates.length !== exam.candidateCount ||
      !assignments.length
    )
      throw new Error("Subjects, candidates, and assignments must reconcile");
    const resultRowCount = subjects.length * candidates.length;
    if (resultRowCount > 1000) {
      const now = Date.now();
      await ctx.db.patch("exams", exam._id, {
        status: "marks_initializing",
        expectedResultCount: resultRowCount,
        completedResultCount: 0,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.exams.assignments.initializeMarksBatch,
        { examId: exam._id, offset: 0 },
      );
      await ctx.db.insert("examAuditEvents", {
        examId: exam._id,
        eventType: "marks_initialization_started",
        actorAccountId: account._id,
        createdAt: now,
        metadata: JSON.stringify({ resultRows: resultRowCount }),
      });
      return { resultRowCount, initializing: true };
    }
    const now = Date.now();
    for (const subject of subjects)
      for (const candidate of candidates)
        await ctx.db.insert("examSubjectResults", {
          examId: exam._id,
          examSubjectId: subject._id,
          candidateId: candidate._id,
          studentId: candidate.studentId,
          batchId: candidate.batchId,
          participation: "present",
          entryStatus: "missing",
          updatedAt: now,
        });
    await ctx.db.patch("exams", exam._id, {
      status: "marks_entry",
      expectedResultCount: subjects.length * candidates.length,
      completedResultCount: 0,
      updatedAt: now,
    });
    await ctx.db.insert("examAuditEvents", {
      examId: exam._id,
      eventType: "marks_entry_opened",
      actorAccountId: account._id,
      createdAt: now,
      metadata: JSON.stringify({
        resultRows: subjects.length * candidates.length,
      }),
    });
    return { resultRowCount, initializing: false };
  },
});

export const initializeMarksBatch = internalMutation({
  args: { examId: v.id("exams"), offset: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam || exam.status !== "marks_initializing") return null;
    const subjects = await ctx.db
      .query("examSubjects")
      .withIndex("by_examId_and_sortOrder", (q) => q.eq("examId", exam._id))
      .take(100);
    const candidates = await ctx.db
      .query("examCandidates")
      .withIndex("by_examId_and_status", (q) =>
        q.eq("examId", exam._id).eq("status", "included"),
      )
      .take(501);
    const total = subjects.length * candidates.length;
    const end = Math.min(total, args.offset + 200);
    const now = Date.now();
    for (let index = args.offset; index < end; index++) {
      const subject = subjects[Math.floor(index / candidates.length)];
      const candidate = candidates[index % candidates.length];
      const existing = await ctx.db
        .query("examSubjectResults")
        .withIndex("by_candidateId_and_examSubjectId", (q) =>
          q.eq("candidateId", candidate._id).eq("examSubjectId", subject._id),
        )
        .unique();
      if (!existing)
        await ctx.db.insert("examSubjectResults", {
          examId: exam._id,
          examSubjectId: subject._id,
          candidateId: candidate._id,
          studentId: candidate.studentId,
          batchId: candidate.batchId,
          participation: "present",
          entryStatus: "missing",
          updatedAt: now,
        });
    }
    if (end < total)
      await ctx.scheduler.runAfter(
        0,
        internal.exams.assignments.initializeMarksBatch,
        { examId: exam._id, offset: end },
      );
    else {
      await ctx.db.patch("exams", exam._id, {
        status: "marks_entry",
        updatedAt: now,
      });
      const audit = await ctx.db
        .query("examAuditEvents")
        .withIndex("by_examId_and_eventType", (q) =>
          q
            .eq("examId", exam._id)
            .eq("eventType", "marks_initialization_started"),
        )
        .order("desc")
        .first();
      if (audit)
        await ctx.db.insert("examAuditEvents", {
          examId: exam._id,
          eventType: "marks_entry_opened",
          actorAccountId: audit.actorAccountId,
          createdAt: now,
          metadata: JSON.stringify({
            resultRows: total,
            initializedInBatches: true,
          }),
        });
    }
    return null;
  },
});

export const myWork = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const account = await requireAccount(ctx);
    if (account.role !== "teacher") throw new Error("Unauthorized");
    const assignments = await ctx.db
      .query("examTeacherAssignments")
      .withIndex("by_teacherId", (q) => q.eq("teacherId", account.teacherId))
      .take(200);
    return await Promise.all(
      assignments.map(async (assignment) => ({
        assignment,
        exam: await ctx.db.get("exams", assignment.examId),
        examSubject: assignment.examSubjectId
          ? await ctx.db.get("examSubjects", assignment.examSubjectId)
          : null,
        batch: assignment.batchId
          ? await ctx.db.get("batches", assignment.batchId)
          : null,
      })),
    );
  },
});
