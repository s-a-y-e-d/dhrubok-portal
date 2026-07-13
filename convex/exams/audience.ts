import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";

const MAX_CANDIDATES = 500;

async function resolveBatches(
  ctx: Parameters<typeof requireOwner>[0],
  exam: Doc<"exams">,
  requested: Id<"batches">[],
) {
  const mode = exam.audienceMode;
  if (!mode) throw new Error("Exam audience mode is missing");
  let batches: Doc<"batches">[] = [];
  if (mode === "all_course_batches")
    batches = await ctx.db
      .query("batches")
      .withIndex("by_courseId_and_status", (q) =>
        q.eq("courseId", exam.courseId).eq("status", "active"),
      )
      .take(100);
  else {
    if (mode === "single_batch" && requested.length !== 1)
      throw new Error("Select exactly one batch");
    if (mode === "selected_batches" && requested.length < 2)
      throw new Error("Select at least two batches");
    if (new Set(requested).size !== requested.length)
      throw new Error("Duplicate batches are not allowed");
    for (const id of requested) {
      const batch = await ctx.db.get("batches", id);
      if (
        !batch ||
        batch.courseId !== exam.courseId ||
        batch.status !== "active"
      )
        throw new Error(
          "Every selected batch must be active in the exam course",
        );
      batches.push(batch);
    }
  }
  return batches;
}

async function resolveRoster(
  ctx: Parameters<typeof requireOwner>[0],
  exam: Doc<"exams">,
  requested: Id<"batches">[],
) {
  const batches = await resolveBatches(ctx, exam, requested);
  const enrolments: Doc<"enrolments">[] = [];
  const conflicts = new Map<string, Doc<"enrolments">[]>();
  for (const batch of batches)
    for (const row of await ctx.db
      .query("enrolments")
      .withIndex("by_batchId_and_status", (q) =>
        q.eq("batchId", batch._id).eq("status", "active"),
      )
      .take(MAX_CANDIDATES + 1)) {
      if (row.courseId !== exam.courseId) continue;
      const existing = conflicts.get(row.studentId) ?? [];
      existing.push(row);
      conflicts.set(row.studentId, existing);
      enrolments.push(row);
      if (enrolments.length > MAX_CANDIDATES)
        throw new Error(`Candidate roster cannot exceed ${MAX_CANDIDATES}`);
    }
  return {
    batches,
    enrolments,
    duplicates: [...conflicts.values()].filter((rows) => rows.length > 1),
  };
}

export const preview = query({
  args: {
    examId: v.id("exams"),
    batchIds: v.array(v.id("batches")),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam || exam.modelVersion !== 2 || exam.status !== "draft")
      throw new Error("Draft exam not found");
    const roster = await resolveRoster(ctx, exam, args.batchIds);
    const search = args.search?.trim().toLocaleLowerCase();
    const candidates = [];
    for (const enrolment of roster.enrolments) {
      const student = await ctx.db.get("students", enrolment.studentId);
      if (
        student &&
        (!search ||
          `${student.studentNumber} ${student.displayName}`
            .toLocaleLowerCase()
            .includes(search))
      )
        candidates.push({ enrolment, student });
    }
    const start = Number(args.paginationOpts.cursor ?? 0);
    const page = candidates.slice(start, start + args.paginationOpts.numItems);
    return {
      candidateCount: roster.enrolments.length,
      duplicateStudents: roster.duplicates.map((rows) => ({
        studentId: rows[0].studentId,
        enrolmentIds: rows.map((row) => row._id),
        batchIds: rows.map((row) => row.batchId),
      })),
      page,
      isDone: start + page.length >= candidates.length,
      continueCursor: String(start + page.length),
    };
  },
});

export const freezeRoster = mutation({
  args: {
    examId: v.id("exams"),
    batchIds: v.array(v.id("batches")),
    exclusions: v.array(
      v.object({ studentId: v.id("students"), reason: v.string() }),
    ),
  },
  returns: v.object({ candidateCount: v.number(), excludedCount: v.number() }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const exam = await ctx.db.get("exams", args.examId);
    if (
      !exam ||
      exam.modelVersion !== 2 ||
      exam.status !== "draft" ||
      exam.rosterStatus === "frozen"
    )
      throw new Error("Only an unfrozen new-model draft can be confirmed");
    const roster = await resolveRoster(ctx, exam, args.batchIds);
    if (roster.duplicates.length)
      throw new Error(
        "Duplicate student enrolments must be resolved before freezing",
      );
    if (!roster.enrolments.length) throw new Error("Candidate roster is empty");
    const exclusionMap = new Map(
      args.exclusions.map((item) => {
        if (!item.reason.trim())
          throw new Error("Every exclusion requires a reason");
        return [item.studentId, item.reason.trim()];
      }),
    );
    const now = Date.now();
    for (const batch of roster.batches)
      await ctx.db.insert("examBatches", {
        examId: exam._id,
        batchId: batch._id,
      });
    let included = 0;
    for (const enrolment of roster.enrolments) {
      const reason = exclusionMap.get(enrolment.studentId);
      await ctx.db.insert("examCandidates", {
        examId: exam._id,
        studentId: enrolment.studentId,
        enrolmentId: enrolment._id,
        batchId: enrolment.batchId,
        courseId: exam.courseId,
        includedAt: now,
        source: exam.audienceMode!,
        status: reason ? "excluded" : "included",
        excludedAt: reason ? now : undefined,
        exclusionReason: reason,
      });
      if (!reason) included += 1;
    }
    if (!included)
      throw new Error("At least one candidate must remain included");
    await ctx.db.patch("exams", exam._id, {
      rosterStatus: "frozen",
      rosterFrozenAt: now,
      candidateCount: included,
      updatedAt: now,
    });
    await ctx.db.insert("examAuditEvents", {
      examId: exam._id,
      eventType: "roster_frozen",
      actorAccountId: account._id,
      createdAt: now,
      metadata: JSON.stringify({
        included,
        excluded: roster.enrolments.length - included,
      }),
    });
    return {
      candidateCount: included,
      excludedCount: roster.enrolments.length - included,
    };
  },
});

export const listCandidates = query({
  args: {
    examId: v.id("exams"),
    status: v.optional(v.union(v.literal("included"), v.literal("excluded"))),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const status = args.status ?? "included";
    const page = await ctx.db
      .query("examCandidates")
      .withIndex("by_examId_and_status", (q) =>
        q.eq("examId", args.examId).eq("status", status),
      )
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (candidate) => ({
          candidate,
          student: await ctx.db.get("students", candidate.studentId),
          batch: await ctx.db.get("batches", candidate.batchId),
        })),
      ),
    };
  },
});
