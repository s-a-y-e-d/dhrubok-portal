import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireAccount, requireOwner } from "../model/auth";
import { calculateSubjectResult } from "./model";
import { participation } from "./validators";

const markRow = v.object({
  subjectResultId: v.id("examSubjectResults"),
  participation,
  mcqScoreScaled: v.optional(v.number()),
  writtenScoreScaled: v.optional(v.number()),
  teacherCommentBn: v.optional(v.string()),
  teacherCommentEn: v.optional(v.string()),
});

async function readAssignmentRows(
  ctx: Parameters<typeof requireAccount>[0],
  assignment: Doc<"examTeacherAssignments">,
) {
  if (!assignment.examSubjectId)
    throw new Error("Legacy assignment has no subject scope");
  const rows: Doc<"examSubjectResults">[] = [];
  const query = assignment.batchId
    ? ctx.db
        .query("examSubjectResults")
        .withIndex("by_examSubjectId_and_batchId", (q) =>
          q
            .eq("examSubjectId", assignment.examSubjectId!)
            .eq("batchId", assignment.batchId!),
        )
    : ctx.db
        .query("examSubjectResults")
        .withIndex("by_examSubjectId_and_entryStatus", (q) =>
          q.eq("examSubjectId", assignment.examSubjectId!),
        );
  for await (const row of query) rows.push(row);
  return rows;
}

async function requireAssignmentAccess(
  ctx: Parameters<typeof requireAccount>[0],
  assignmentId: Doc<"examTeacherAssignments">["_id"],
  allowOwner = true,
) {
  const account = await requireAccount(ctx);
  const assignment = await ctx.db.get("examTeacherAssignments", assignmentId);
  if (!assignment) throw new Error("Assignment not found");
  if (account.role === "owner" && allowOwner) {
    await requireOwner(ctx);
    return { account, assignment };
  }
  if (account.role !== "teacher" || account.teacherId !== assignment.teacherId)
    throw new Error("Unauthorized");
  return { account, assignment };
}

export const entryGrid = query({
  args: {
    assignmentId: v.id("examTeacherAssignments"),
    filter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("incomplete"),
        v.literal("absent"),
        v.literal("complete"),
      ),
    ),
    search: v.optional(v.string()),
    batchId: v.optional(v.id("batches")),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { assignment } = await requireAssignmentAccess(
      ctx,
      args.assignmentId,
    );
    if (!assignment.examSubjectId)
      throw new Error("Legacy assignment has no subject scope");
    const allScoped = await readAssignmentRows(ctx, assignment);
    const scoped = args.batchId
      ? allScoped.filter((row) => row.batchId === args.batchId)
      : allScoped;
    if (
      args.batchId &&
      assignment.batchId &&
      args.batchId !== assignment.batchId
    )
      throw new Error("Batch is outside the assignment scope");
    if (args.batchId && !allScoped.some((row) => row.batchId === args.batchId))
      throw new Error("Batch is outside the assignment scope");
    const rows = [];
    const search = args.search?.trim().toLocaleLowerCase();
    for (const result of scoped) {
      const student = await ctx.db.get("students", result.studentId);
      if (
        !student ||
        (search &&
          !`${student.studentNumber} ${student.displayName}`
            .toLocaleLowerCase()
            .includes(search))
      )
        continue;
      const filter = args.filter ?? "all";
      if (filter === "incomplete" && result.entryStatus !== "missing") continue;
      if (filter === "absent" && result.participation !== "absent") continue;
      if (filter === "complete" && result.entryStatus === "missing") continue;
      rows.push({ result, student });
    }
    const start = Number(args.paginationOpts.cursor ?? 0);
    const page = rows.slice(start, start + args.paginationOpts.numItems);
    return {
      assignment,
      subject: await ctx.db.get("examSubjects", assignment.examSubjectId),
      batches: await Promise.all(
        [...new Set(allScoped.map((row) => row.batchId))].map((id) =>
          ctx.db.get("batches", id),
        ),
      ),
      counts: {
        complete: scoped.filter((row) => row.entryStatus !== "missing").length,
        missing: scoped.filter((row) => row.entryStatus === "missing").length,
        absent: scoped.filter(
          (row) =>
            row.participation === "absent" && row.entryStatus !== "missing",
        ).length,
        invalid: scoped.filter(
          (row) =>
            row.entryStatus !== "missing" &&
            (row.totalScoreScaled === undefined || row.passed === undefined),
        ).length,
      },
      page,
      isDone: start + page.length >= rows.length,
      continueCursor: String(start + page.length),
    };
  },
});

export const saveDraft = mutation({
  args: {
    assignmentId: v.id("examTeacherAssignments"),
    rows: v.array(markRow),
  },
  returns: v.object({
    saved: v.number(),
    errors: v.array(
      v.object({
        subjectResultId: v.id("examSubjectResults"),
        message: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    if (!args.rows.length || args.rows.length > 50)
      throw new Error("Save between 1 and 50 rows");
    const { account, assignment } = await requireAssignmentAccess(
      ctx,
      args.assignmentId,
    );
    const exam = await ctx.db.get("exams", assignment.examId);
    if (!exam || (exam.status !== "marks_entry" && exam.status !== "reopened"))
      throw new Error("Exam is not open for marks");
    if (assignment.status === "submitted" && account.role !== "owner")
      throw new Error("Submitted work is read-only");
    const subject = assignment.examSubjectId
      ? await ctx.db.get("examSubjects", assignment.examSubjectId)
      : null;
    if (
      !subject ||
      !subject.mode ||
      subject.totalFullMarksScaled === undefined ||
      subject.passMarksScaled === undefined
    )
      throw new Error("Subject rule is incomplete");
    const errors = [];
    let saved = 0;
    let newlyCompleted = 0;
    const seen = new Set<string>();
    for (const input of args.rows) {
      if (seen.has(input.subjectResultId)) {
        errors.push({
          subjectResultId: input.subjectResultId,
          message: "Duplicate row",
        });
        continue;
      }
      seen.add(input.subjectResultId);
      const row = await ctx.db.get("examSubjectResults", input.subjectResultId);
      if (
        !row ||
        row.examId !== assignment.examId ||
        row.examSubjectId !== assignment.examSubjectId ||
        (assignment.batchId && row.batchId !== assignment.batchId)
      ) {
        errors.push({
          subjectResultId: input.subjectResultId,
          message: "Row is outside the assignment scope",
        });
        continue;
      }
      try {
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
          mcqScoreScaled: input.mcqScoreScaled,
          writtenScoreScaled: input.writtenScoreScaled,
        });
        const now = Date.now();
        const ownerCorrection =
          account.role === "owner" && assignment.status === "submitted";
        await ctx.db.patch("examSubjectResults", row._id, {
          participation: input.participation,
          mcqScoreScaled: input.mcqScoreScaled,
          writtenScoreScaled: input.writtenScoreScaled,
          ...calculated,
          teacherCommentBn: input.teacherCommentBn?.trim() || undefined,
          teacherCommentEn: input.teacherCommentEn?.trim() || undefined,
          entryStatus: ownerCorrection ? "submitted" : "draft",
          enteredByAccountId: account._id,
          enteredAt: now,
          updatedAt: now,
        });
        if (row.entryStatus === "missing") newlyCompleted += 1;
        if (ownerCorrection)
          await ctx.db.insert("examAuditEvents", {
            examId: assignment.examId,
            eventType: "marks_changed_after_submission",
            actorAccountId: account._id,
            createdAt: now,
            metadata: JSON.stringify({
              assignmentId: assignment._id,
              subjectResultId: row._id,
              before: {
                participation: row.participation,
                mcqScoreScaled: row.mcqScoreScaled,
                writtenScoreScaled: row.writtenScoreScaled,
                totalScoreScaled: row.totalScoreScaled,
                passed: row.passed,
              },
              after: {
                participation: input.participation,
                mcqScoreScaled: input.mcqScoreScaled,
                writtenScoreScaled: input.writtenScoreScaled,
                totalScoreScaled: calculated.totalScoreScaled,
                passed: calculated.passed,
              },
            }),
          });
        saved += 1;
      } catch (error) {
        errors.push({
          subjectResultId: input.subjectResultId,
          message: error instanceof Error ? error.message : "Invalid marks",
        });
      }
    }
    if (
      saved &&
      assignment.status !== "in_progress" &&
      assignment.status !== "submitted"
    )
      await ctx.db.patch("examTeacherAssignments", assignment._id, {
        status: "in_progress",
        updatedAt: Date.now(),
      });
    if (newlyCompleted)
      await ctx.db.patch("exams", exam._id, {
        completedResultCount: Math.min(
          exam.expectedResultCount ?? Number.MAX_SAFE_INTEGER,
          (exam.completedResultCount ?? 0) + newlyCompleted,
        ),
        updatedAt: Date.now(),
      });
    return { saved, errors };
  },
});

export const submitAssignment = mutation({
  args: { assignmentId: v.id("examTeacherAssignments") },
  returns: v.object({ complete: v.number(), absent: v.number() }),
  handler: async (ctx, args) => {
    const { account, assignment } = await requireAssignmentAccess(
      ctx,
      args.assignmentId,
      false,
    );
    if (!assignment.examSubjectId || assignment.status === "submitted")
      throw new Error("Assignment cannot be submitted");
    const rows = await readAssignmentRows(ctx, assignment);
    if (
      !rows.length ||
      rows.some(
        (row) =>
          row.entryStatus === "missing" ||
          row.totalScoreScaled === undefined ||
          row.passed === undefined,
      )
    )
      throw new Error("Complete every assigned row before submission");
    const now = Date.now();
    for (const row of rows)
      await ctx.db.patch("examSubjectResults", row._id, {
        entryStatus: "submitted",
        submittedAt: now,
        updatedAt: now,
      });
    await ctx.db.patch("examTeacherAssignments", assignment._id, {
      status: "submitted",
      submittedAt: now,
      returnReason: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("examAuditEvents", {
      examId: assignment.examId,
      eventType: "teacher_assignment_submitted",
      actorAccountId: account._id,
      createdAt: now,
      metadata: JSON.stringify({ assignmentId: assignment._id }),
    });
    return {
      complete: rows.length,
      absent: rows.filter((row) => row.participation === "absent").length,
    };
  },
});

export const returnAssignment = mutation({
  args: { assignmentId: v.id("examTeacherAssignments"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    if (!args.reason.trim()) throw new Error("A return reason is required");
    const assignment = await ctx.db.get(
      "examTeacherAssignments",
      args.assignmentId,
    );
    if (!assignment || assignment.status !== "submitted")
      throw new Error("Only submitted work can be returned");
    const now = Date.now();
    await ctx.db.patch("examTeacherAssignments", assignment._id, {
      status: "returned",
      returnedAt: now,
      returnReason: args.reason.trim(),
      updatedAt: now,
    });
    await ctx.db.insert("examAuditEvents", {
      examId: assignment.examId,
      eventType: "teacher_assignment_returned",
      actorAccountId: account._id,
      createdAt: now,
      reason: args.reason.trim(),
      metadata: JSON.stringify({ assignmentId: assignment._id }),
    });
    return null;
  },
});
