import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAccount, requireOwner } from "../model/auth";
import { assertLocalDate } from "../model/dates";
import { nextIdentifier } from "../model/identifiers";
import { examType, audienceMode, meritMode } from "./validators";

function validateTimes(startsAtMinutes?: number, endsAtMinutes?: number) {
  for (const [label, value] of [
    ["start", startsAtMinutes],
    ["end", endsAtMinutes],
  ] as const)
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value < 0 || value >= 1440)
    )
      throw new Error(`Invalid ${label} time`);
  if (
    startsAtMinutes !== undefined &&
    endsAtMinutes !== undefined &&
    endsAtMinutes <= startsAtMinutes
  )
    throw new Error("End time must be after start time");
}

export const createDraft = mutation({
  args: {
    courseId: v.id("courses"),
    nameBn: v.string(),
    nameEn: v.string(),
    examDate: v.string(),
    examType,
    startsAtMinutes: v.optional(v.number()),
    endsAtMinutes: v.optional(v.number()),
    venue: v.optional(v.string()),
    audienceMode,
    meritMode: v.optional(meritMode),
    setupDraftJson: v.optional(v.string()),
  },
  returns: v.id("exams"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const course = await ctx.db.get("courses", args.courseId);
    if (!course || course.status === "archived")
      throw new Error("Active course not found");
    assertLocalDate(args.examDate);
    if (!args.nameBn.trim() || !args.nameEn.trim())
      throw new Error("Both exam names are required");
    validateTimes(args.startsAtMinutes, args.endsAtMinutes);
    const officialMeritScope =
      args.audienceMode === "single_batch"
        ? "batch"
        : args.audienceMode === "selected_batches"
          ? "selected_batches"
          : "course";
    const defaultMerit =
      args.audienceMode === "single_batch"
        ? "official_only"
        : "official_and_batch";
    const now = Date.now();
    const examId = await ctx.db.insert("exams", {
      examNumber: await nextIdentifier(
        ctx,
        "exam",
        "EX",
        Number(args.examDate.slice(0, 4)),
      ),
      courseId: args.courseId,
      nameBn: args.nameBn.trim(),
      nameEn: args.nameEn.trim(),
      examDate: args.examDate,
      examType: args.examType,
      startsAtMinutes: args.startsAtMinutes,
      endsAtMinutes: args.endsAtMinutes,
      venue: args.venue?.trim() || undefined,
      audienceMode: args.audienceMode,
      rosterStatus: "preview",
      candidateCount: 0,
      meritMode: args.meritMode ?? defaultMerit,
      officialMeritScope,
      rankFailedStudents: false,
      markingRulesVersion: 1,
      subjectCount: 0,
      expectedResultCount: 0,
      completedResultCount: 0,
      setupDraftJson: args.setupDraftJson,
      modelVersion: 2,
      mode: "written",
      writtenFullMarksScaled: 1,
      totalFullMarksScaled: 1,
      passMarksScaled: 0,
      status: "draft",
      publicationVersion: 0,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: account._id,
    });
    await ctx.db.insert("examAuditEvents", {
      examId,
      eventType: "exam_draft_created",
      actorAccountId: account._id,
      createdAt: now,
    });
    return examId;
  },
});

export const updateDraft = mutation({
  args: {
    examId: v.id("exams"),
    courseId: v.optional(v.id("courses")),
    audienceMode: v.optional(audienceMode),
    nameBn: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    examDate: v.optional(v.string()),
    examType: v.optional(examType),
    startsAtMinutes: v.optional(v.number()),
    endsAtMinutes: v.optional(v.number()),
    venue: v.optional(v.string()),
    meritMode: v.optional(meritMode),
    setupDraftJson: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const exam = await ctx.db.get("exams", args.examId);
    if (
      !exam ||
      exam.modelVersion !== 2 ||
      exam.status !== "draft" ||
      exam.rosterStatus === "frozen"
    )
      throw new Error("Only an unfrozen draft can be edited");
    if (args.examDate) assertLocalDate(args.examDate);
    if (args.nameBn !== undefined && !args.nameBn.trim())
      throw new Error("Bangla name is required");
    if (args.nameEn !== undefined && !args.nameEn.trim())
      throw new Error("English name is required");
    validateTimes(
      args.startsAtMinutes ?? exam.startsAtMinutes,
      args.endsAtMinutes ?? exam.endsAtMinutes,
    );
    if (args.courseId) {
      const course = await ctx.db.get("courses", args.courseId);
      if (!course || course.status === "archived")
        throw new Error("Active course not found");
    }
    const officialMeritScope:
      "batch" | "selected_batches" | "course" | undefined = args.audienceMode
      ? args.audienceMode === "single_batch"
        ? "batch"
        : args.audienceMode === "selected_batches"
          ? "selected_batches"
          : "course"
      : undefined;
    const patch = {
      nameBn: args.nameBn,
      nameEn: args.nameEn,
      examDate: args.examDate,
      examType: args.examType,
      startsAtMinutes: args.startsAtMinutes,
      endsAtMinutes: args.endsAtMinutes,
      venue: args.venue,
      meritMode: args.meritMode,
      setupDraftJson: args.setupDraftJson,
      courseId: args.courseId,
      audienceMode: args.audienceMode,
      officialMeritScope,
    };
    await ctx.db.patch("exams", exam._id, {
      ...patch,
      nameBn: patch.nameBn?.trim(),
      nameEn: patch.nameEn?.trim(),
      venue: patch.venue?.trim() || undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("examAuditEvents", {
      examId: exam._id,
      eventType: "exam_draft_updated",
      actorAccountId: account._id,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const archiveDraft = mutation({
  args: { examId: v.id("exams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam || exam.status !== "draft")
      throw new Error("Only a draft can be archived");
    await ctx.db.patch("exams", exam._id, {
      status: "archived",
      updatedAt: Date.now(),
    });
    await ctx.db.insert("examAuditEvents", {
      examId: exam._id,
      eventType: "exam_archived",
      actorAccountId: account._id,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const detail = query({
  args: { examId: v.id("exams") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam) throw new Error("Exam not found");
    if (account.role === "teacher") {
      const rows = await ctx.db
        .query("examTeacherAssignments")
        .withIndex("by_examId_and_teacherId", (q) =>
          q.eq("examId", args.examId).eq("teacherId", account.teacherId),
        )
        .take(2);
      if (!rows.length) throw new Error("Unauthorized");
    } else if (account.role !== "owner") throw new Error("Unauthorized");
    const subjects = await ctx.db
      .query("examSubjects")
      .withIndex("by_examId_and_sortOrder", (q) => q.eq("examId", args.examId))
      .take(100);
    const batches = await ctx.db
      .query("examBatches")
      .withIndex("by_examId", (q) => q.eq("examId", args.examId))
      .take(100);
    return { exam, subjects, batches };
  },
});

export const listManaged = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    needsMyAction: v.optional(v.boolean()),
    academicSessionId: v.optional(v.id("academicSessions")),
    courseId: v.optional(v.id("courses")),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    const rows = [];
    if (account.role === "owner") {
      const statuses = args.status
        ? [args.status]
        : [
            "draft",
            "marks_initializing",
            "marks_entry",
            "ready_for_review",
            "publication_processing",
            "published",
            "reopened",
          ];
      for (const status of statuses)
        rows.push(
          ...(await ctx.db
            .query("exams")
            .withIndex("by_status_and_examDate", (q) =>
              q.eq("status", status as never),
            )
            .order("desc")
            .take(100)),
        );
    } else if (account.role === "teacher") {
      const assignments = await ctx.db
        .query("examTeacherAssignments")
        .withIndex("by_teacherId", (q) => q.eq("teacherId", account.teacherId))
        .take(200);
      for (const assignment of assignments) {
        if (args.needsMyAction && assignment.status === "submitted") continue;
        const exam = await ctx.db.get("exams", assignment.examId);
        if (exam) rows.push(exam);
      }
    } else throw new Error("Unauthorized");
    const search = args.search?.trim().toLocaleLowerCase();
    const unique = [
      ...new Map(rows.map((row) => [row._id, row])).values(),
    ].filter((row) => {
      if (
        search &&
        !`${row.examNumber} ${row.nameBn} ${row.nameEn}`
          .toLocaleLowerCase()
          .includes(search)
      )
        return false;
      if (args.courseId && row.courseId !== args.courseId) return false;
      if (args.dateFrom && row.examDate < args.dateFrom) return false;
      if (args.dateTo && row.examDate > args.dateTo) return false;
      if (
        account.role === "owner" &&
        args.needsMyAction &&
        !["draft", "ready_for_review", "reopened"].includes(row.status)
      )
        return false;
      return true;
    });
    const courseSession = new Map<string, string>();
    if (args.academicSessionId)
      for (const row of unique) {
        const course = await ctx.db.get("courses", row.courseId);
        if (course) courseSession.set(row._id, course.academicSessionId);
      }
    const filtered = unique.filter(
      (row) =>
        !args.academicSessionId ||
        courseSession.get(row._id) === args.academicSessionId,
    );
    const urgency: Record<string, number> = {
      ready_for_review: 0,
      publication_processing: 0,
      reopened: 1,
      marks_entry: 2,
      marks_initializing: 2,
      draft: 3,
      published: 4,
      archived: 5,
    };
    filtered.sort(
      (a, b) =>
        (urgency[a.status] ?? 9) - (urgency[b.status] ?? 9) ||
        b.examDate.localeCompare(a.examDate),
    );
    const start = Number(args.paginationOpts.cursor ?? 0);
    const page = filtered.slice(start, start + args.paginationOpts.numItems);
    const enrichedPage = await Promise.all(
      page.map(async (exam) => {
        const course = await ctx.db.get("courses", exam.courseId);
        if (exam.modelVersion !== 2)
          return {
            ...exam,
            courseNameBn: course?.nameBn ?? "",
            courseNameEn: course?.nameEn ?? "",
            subjectCount: 0,
            completionPercentage: exam.status === "published" ? 100 : 0,
            nextAction: "legacy_report",
          };
        const expected = exam.expectedResultCount ?? 0;
        const complete = exam.completedResultCount ?? 0;
        const nextAction =
          exam.status === "draft"
            ? "complete_setup"
            : exam.status === "marks_entry" ||
                exam.status === "marks_initializing"
              ? "complete_marks"
              : exam.status === "ready_for_review"
                ? "review_publish"
                : exam.status === "publication_processing"
                  ? "wait_for_publication"
                  : exam.status === "reopened"
                    ? "complete_correction"
                    : exam.status === "published"
                      ? "view_reports"
                      : "none";
        return {
          ...exam,
          courseNameBn: course?.nameBn ?? "",
          courseNameEn: course?.nameEn ?? "",
          subjectCount: exam.subjectCount ?? 0,
          completionPercentage: expected
            ? Math.round((complete * 100) / expected)
            : 0,
          nextAction,
        };
      }),
    );
    return {
      page: enrichedPage,
      isDone: start + page.length >= filtered.length,
      continueCursor: String(start + page.length),
    };
  },
});
