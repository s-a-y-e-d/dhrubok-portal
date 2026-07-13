import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { normalizeBangladeshPhone } from "../model/normalization";
import { aggregateExamResult } from "./model";

async function loadExamRows(
  ctx: Parameters<typeof requireOwner>[0],
  examId: Id<"exams">,
) {
  const exam = await ctx.db.get("exams", examId);
  if (!exam || exam.modelVersion !== 2)
    throw new Error("New-model exam not found");
  const candidates = await ctx.db
    .query("examCandidates")
    .withIndex("by_examId_and_status", (q) =>
      q.eq("examId", examId).eq("status", "included"),
    )
    .take(501);
  const subjects = await ctx.db
    .query("examSubjects")
    .withIndex("by_examId_and_sortOrder", (q) => q.eq("examId", examId))
    .take(100);
  const results = await ctx.db
    .query("examSubjectResults")
    .withIndex("by_examId_and_studentId", (q) => q.eq("examId", examId))
    .take(10001);
  return { exam, candidates, subjects, results };
}

export const progress = query({
  args: { examId: v.id("exams") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const { subjects, results } = await loadExamRows(ctx, args.examId);
    const assignments = await ctx.db
      .query("examTeacherAssignments")
      .withIndex("by_examId", (q) => q.eq("examId", args.examId))
      .take(200);
    return await Promise.all(
      assignments.map(async (assignment) => {
        const rows = results.filter(
          (row) =>
            row.examSubjectId === assignment.examSubjectId &&
            (!assignment.batchId || row.batchId === assignment.batchId),
        );
        const subject = subjects.find(
          (row) => row._id === assignment.examSubjectId,
        );
        const subjectDoc = subject
          ? await ctx.db.get("subjects", subject.subjectId)
          : null;
        return {
          assignment,
          subject,
          subjectDoc,
          teacher: await ctx.db.get("teachers", assignment.teacherId),
          batch: assignment.batchId
            ? await ctx.db.get("batches", assignment.batchId)
            : null,
          complete: rows.filter((row) => row.entryStatus !== "missing").length,
          missing: rows.filter((row) => row.entryStatus === "missing").length,
          invalid: rows.filter(
            (row) =>
              row.entryStatus !== "missing" &&
              (row.totalScoreScaled === undefined || row.passed === undefined),
          ).length,
        };
      }),
    );
  },
});

export const summary = query({
  args: { examId: v.id("exams") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const { exam, candidates, subjects, results } = await loadExamRows(
      ctx,
      args.examId,
    );
    const expected = candidates.length * subjects.length;
    const missing = results.filter(
      (row) => row.entryStatus === "missing",
    ).length;
    const invalid = results.filter(
      (row) =>
        row.entryStatus !== "missing" &&
        (row.totalScoreScaled === undefined || row.passed === undefined),
    ).length;
    const assignments = await ctx.db
      .query("examTeacherAssignments")
      .withIndex("by_examId", (q) => q.eq("examId", args.examId))
      .take(200);
    let passed = 0,
      failed = 0,
      absent = 0;
    const guardianRecipients = new Set<string>();
    let contactProblems = 0;
    for (const candidate of candidates) {
      const student = await ctx.db.get("students", candidate.studentId);
      if (student) {
        const contacts =
          student.smsRecipient === "mother"
            ? [student.motherPhone]
            : student.smsRecipient === "both"
              ? [student.guardianPhone, student.motherPhone]
              : [student.guardianPhone];
        for (const phone of contacts) {
          if (!phone) {
            contactProblems += 1;
            continue;
          }
          try {
            guardianRecipients.add(
              `${student._id}:${normalizeBangladeshPhone(phone)}`,
            );
          } catch {
            contactProblems += 1;
          }
        }
      }
      const rows = results.filter((row) => row.candidateId === candidate._id);
      if (
        rows.length !== subjects.length ||
        rows.some(
          (row) =>
            row.totalScoreScaled === undefined || row.passed === undefined,
        )
      )
        continue;
      const aggregate = aggregateExamResult(
        rows.map((row) => {
          const subject = subjects.find(
            (item) => item._id === row.examSubjectId,
          )!;
          return {
            isRequired: subject.isRequired ?? true,
            participation: row.participation,
            totalScoreScaled: row.totalScoreScaled!,
            totalFullMarksScaled: subject.totalFullMarksScaled!,
            writtenScoreScaled: row.writtenScoreScaled,
            mcqScoreScaled: row.mcqScoreScaled,
            passed: row.passed!,
          };
        }),
      );
      if (aggregate.passed) passed += 1;
      else failed += 1;
      if (aggregate.absent) absent += 1;
    }
    return {
      exam,
      candidateCount: candidates.length,
      subjectCount: subjects.length,
      expectedResultRows: expected,
      actualResultRows: results.length,
      missing,
      invalid,
      passed,
      failed,
      absent,
      guardianRecipientCount: guardianRecipients.size,
      contactProblemCount: contactProblems,
      assignmentsSubmitted: assignments.filter(
        (row) => row.status === "submitted",
      ).length,
      assignmentsExpected: assignments.length,
      ready:
        expected > 0 &&
        results.length === expected &&
        missing === 0 &&
        invalid === 0 &&
        assignments.length > 0 &&
        assignments.every((row) => row.status === "submitted"),
    };
  },
});

export const exceptions = query({
  args: {
    examId: v.id("exams"),
    filter: v.union(
      v.literal("failures"),
      v.literal("absences"),
      v.literal("ties"),
      v.literal("high_low"),
      v.literal("changed"),
      v.literal("contacts"),
    ),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const { candidates, subjects, results } = await loadExamRows(
      ctx,
      args.examId,
    );
    const changedEvents =
      args.filter === "changed"
        ? await ctx.db
            .query("examAuditEvents")
            .withIndex("by_examId_and_eventType", (q) =>
              q
                .eq("examId", args.examId)
                .eq("eventType", "marks_changed_after_submission"),
            )
            .take(1000)
        : [];
    const changedResultIds = new Set(
      changedEvents.flatMap((event) => {
        try {
          return [JSON.parse(event.metadata ?? "{}").subjectResultId as string];
        } catch {
          return [];
        }
      }),
    );
    const summaries = [];
    for (const candidate of candidates) {
      const rows = results.filter((row) => row.candidateId === candidate._id);
      if (
        rows.length !== subjects.length ||
        rows.some(
          (row) =>
            row.totalScoreScaled === undefined || row.passed === undefined,
        )
      )
        continue;
      const aggregate = aggregateExamResult(
        rows.map((row) => {
          const subject = subjects.find(
            (item) => item._id === row.examSubjectId,
          )!;
          return {
            isRequired: subject.isRequired ?? true,
            participation: row.participation,
            totalScoreScaled: row.totalScoreScaled!,
            totalFullMarksScaled: subject.totalFullMarksScaled!,
            writtenScoreScaled: row.writtenScoreScaled,
            mcqScoreScaled: row.mcqScoreScaled,
            passed: row.passed!,
          };
        }),
      );
      const student = await ctx.db.get("students", candidate.studentId);
      if (!student) continue;
      const contacts =
        student.smsRecipient === "mother"
          ? [student.motherPhone]
          : student.smsRecipient === "both"
            ? [student.guardianPhone, student.motherPhone]
            : [student.guardianPhone];
      const contactProblem = contacts.some((phone) => {
        if (!phone) return true;
        try {
          normalizeBangladeshPhone(phone);
          return false;
        } catch {
          return true;
        }
      });
      summaries.push({
        candidate,
        student,
        rows,
        aggregate,
        contactProblem,
        changed: rows.some((row) => changedResultIds.has(row._id)),
      });
    }
    const tupleCount = new Map<string, number>();
    for (const row of summaries.filter(
      (item) => item.aggregate.passed && !item.aggregate.absent,
    )) {
      const key = `${row.aggregate.grandTotalScaled}:${row.aggregate.writtenTotalScaled}:${row.aggregate.mcqTotalScaled}`;
      tupleCount.set(key, (tupleCount.get(key) ?? 0) + 1);
    }
    return summaries
      .filter((row) => {
        if (args.filter === "failures") return !row.aggregate.passed;
        if (args.filter === "absences") return row.aggregate.absent;
        if (args.filter === "high_low")
          return (
            row.aggregate.grandTotalScaled * 100 >=
              row.aggregate.grandFullMarksScaled * 90 ||
            row.aggregate.grandTotalScaled * 100 <=
              row.aggregate.grandFullMarksScaled * 30
          );
        if (args.filter === "changed") return row.changed;
        if (args.filter === "contacts") return row.contactProblem;
        return (
          (tupleCount.get(
            `${row.aggregate.grandTotalScaled}:${row.aggregate.writtenTotalScaled}:${row.aggregate.mcqTotalScaled}`,
          ) ?? 0) > 1
        );
      })
      .map((row) => ({
        candidate: row.candidate,
        student: row.student,
        aggregate: row.aggregate,
        contactProblem: row.contactProblem,
        changed: row.changed,
      }));
  },
});

export const markReadyForPublication = mutation({
  args: { examId: v.id("exams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const { exam, candidates, subjects, results } = await loadExamRows(
      ctx,
      args.examId,
    );
    if (exam.status !== "marks_entry" && exam.status !== "reopened")
      throw new Error("Exam is not open for review");
    const assignments = await ctx.db
      .query("examTeacherAssignments")
      .withIndex("by_examId", (q) => q.eq("examId", args.examId))
      .take(200);
    if (
      !candidates.length ||
      results.length !== candidates.length * subjects.length ||
      results.some(
        (row) =>
          row.entryStatus !== "submitted" ||
          row.totalScoreScaled === undefined ||
          row.passed === undefined,
      ) ||
      !assignments.length ||
      assignments.some((row) => row.status !== "submitted")
    )
      throw new Error(
        "Every assignment and result row must be submitted and valid",
      );
    const now = Date.now();
    await ctx.db.patch("exams", exam._id, {
      status: "ready_for_review",
      updatedAt: now,
    });
    await ctx.db.insert("examAuditEvents", {
      examId: exam._id,
      eventType: "ready_for_publication",
      actorAccountId: account._id,
      createdAt: now,
    });
    return null;
  },
});

export const individualPreview = query({
  args: { examId: v.id("exams"), studentId: v.id("students") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const { exam, subjects, results } = await loadExamRows(ctx, args.examId);
    const student = await ctx.db.get("students", args.studentId);
    const rows = results.filter((row) => row.studentId === args.studentId);
    if (!student || !rows.length) throw new Error("Candidate not found");
    const aggregate =
      rows.length === subjects.length &&
      rows.every(
        (row) => row.totalScoreScaled !== undefined && row.passed !== undefined,
      )
        ? aggregateExamResult(
            rows.map((row) => {
              const subject = subjects.find(
                (item) => item._id === row.examSubjectId,
              )!;
              return {
                isRequired: subject.isRequired ?? true,
                participation: row.participation,
                totalScoreScaled: row.totalScoreScaled!,
                totalFullMarksScaled: subject.totalFullMarksScaled!,
                writtenScoreScaled: row.writtenScoreScaled,
                mcqScoreScaled: row.mcqScoreScaled,
                passed: row.passed!,
              };
            }),
          )
        : null;
    const subjectDetails = await Promise.all(
      subjects.map(async (subject) => ({
        subject,
        subjectDoc: await ctx.db.get("subjects", subject.subjectId),
      })),
    );
    return { exam, student, subjects, subjectDetails, rows, aggregate };
  },
});
