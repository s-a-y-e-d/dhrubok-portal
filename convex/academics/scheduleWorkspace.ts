import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import { assertLocalDate, dhakaDate } from "../model/dates";

const sessionStatus = v.union(
  v.literal("scheduled"),
  v.literal("open"),
  v.literal("submitted"),
  v.literal("cancelled"),
);
const filterStatus = v.union(
  v.literal("all"),
  v.literal("scheduled"),
  v.literal("open"),
  v.literal("submitted"),
  v.literal("cancelled"),
);
const sessionProjection = v.object({
  sessionId: v.id("classSessions"),
  batchId: v.id("batches"),
  batchNameBn: v.string(),
  batchNameEn: v.string(),
  batchCode: v.string(),
  courseId: v.id("courses"),
  courseNameBn: v.string(),
  courseNameEn: v.string(),
  courseCode: v.string(),
  teacherId: v.id("teachers"),
  teacherName: v.string(),
  subjectId: v.union(v.id("subjects"), v.null()),
  subjectNameBn: v.union(v.string(), v.null()),
  subjectNameEn: v.union(v.string(), v.null()),
  sessionDate: v.string(),
  startsAt: v.number(),
  endsAt: v.number(),
  status: sessionStatus,
  occurrenceType: v.union(v.literal("generated"), v.literal("extra")),
  isOneOffOverride: v.boolean(),
  changeReason: v.union(v.string(), v.null()),
  originalSessionDate: v.union(v.string(), v.null()),
  originalStartsAt: v.union(v.number(), v.null()),
  originalEndsAt: v.union(v.number(), v.null()),
  cancellationType: v.union(
    v.literal("manual"),
    v.literal("routine"),
    v.null(),
  ),
  canModify: v.boolean(),
  canRestore: v.boolean(),
  canOpenAttendance: v.boolean(),
});
const conflictProjection = v.object({
  kind: v.union(v.literal("teacher"), v.literal("batch")),
  sessionId: v.id("classSessions"),
  batchName: v.string(),
  teacherName: v.string(),
  sessionDate: v.string(),
  startsAt: v.number(),
  endsAt: v.number(),
});

type DbCtx = Pick<QueryCtx | MutationCtx, "db">;

function cleanReason(value?: string) {
  const cleaned = value?.trim();
  if (cleaned && cleaned.length > 300)
    throw new Error("Reason must be 300 characters or fewer");
  return cleaned || undefined;
}

function validateTime(sessionDate: string, startsAt: number, endsAt: number) {
  assertLocalDate(sessionDate);
  if (
    !Number.isSafeInteger(startsAt) ||
    !Number.isSafeInteger(endsAt) ||
    endsAt <= startsAt
  )
    throw new Error("Invalid class time");
  if (dhakaDate(startsAt) !== sessionDate || dhakaDate(endsAt) !== sessionDate)
    throw new Error("Class date and time must match in Asia/Dhaka");
}

async function findConflicts(
  ctx: DbCtx,
  input: {
    sessionId?: Id<"classSessions">;
    batchId: Id<"batches">;
    teacherId: Id<"teachers">;
    sessionDate: string;
    startsAt: number;
    endsAt: number;
  },
) {
  const [teacherRows, batchRows] = await Promise.all([
    ctx.db
      .query("classSessions")
      .withIndex("by_teacherId_and_sessionDate", (q) =>
        q.eq("teacherId", input.teacherId).eq("sessionDate", input.sessionDate),
      )
      .take(100),
    ctx.db
      .query("classSessions")
      .withIndex("by_batchId_and_sessionDate", (q) =>
        q.eq("batchId", input.batchId).eq("sessionDate", input.sessionDate),
      )
      .take(100),
  ]);
  const overlaps = (row: Doc<"classSessions">) =>
    row._id !== input.sessionId &&
    row.status !== "cancelled" &&
    input.startsAt < row.endsAt &&
    input.endsAt > row.startsAt;
  const combined = [
    ...teacherRows
      .filter(overlaps)
      .map((row) => ({ kind: "teacher" as const, row })),
    ...batchRows
      .filter(overlaps)
      .map((row) => ({ kind: "batch" as const, row })),
  ];
  const unique = combined.filter(
    (item, index) =>
      combined.findIndex(
        (other) => other.kind === item.kind && other.row._id === item.row._id,
      ) === index,
  );
  return await Promise.all(
    unique.map(async ({ kind, row }) => {
      const [batch, teacher] = await Promise.all([
        ctx.db.get("batches", row.batchId),
        ctx.db.get("teachers", row.teacherId),
      ]);
      return {
        kind,
        sessionId: row._id,
        batchName: batch?.nameEn ?? "Unknown batch",
        teacherName: teacher?.displayName ?? "Unknown teacher",
        sessionDate: row.sessionDate,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      };
    }),
  );
}

async function project(ctx: DbCtx, row: Doc<"classSessions">) {
  const [batch, teacher, subject] = await Promise.all([
    ctx.db.get("batches", row.batchId),
    ctx.db.get("teachers", row.teacherId),
    row.subjectId ? ctx.db.get("subjects", row.subjectId) : null,
  ]);
  if (!batch || !teacher) return null;
  const course = await ctx.db.get("courses", batch.courseId);
  if (!course) return null;
  const occurrenceType =
    row.occurrenceType ?? (row.scheduleId ? "generated" : "extra");
  const canModify = row.status === "scheduled" && row.startsAt > Date.now();
  const canRestore =
    row.status === "cancelled" &&
    row.cancellationType === "manual" &&
    occurrenceType === "generated" &&
    (row.originalStartsAt ?? 0) > Date.now();
  return {
    sessionId: row._id,
    batchId: batch._id,
    batchNameBn: batch.nameBn,
    batchNameEn: batch.nameEn,
    batchCode: batch.code,
    courseId: course._id,
    courseNameBn: course.nameBn,
    courseNameEn: course.nameEn,
    courseCode: course.code,
    teacherId: teacher._id,
    teacherName: teacher.displayName,
    subjectId: subject?._id ?? null,
    subjectNameBn: subject?.nameBn ?? null,
    subjectNameEn: subject?.nameEn ?? null,
    sessionDate: row.sessionDate,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    occurrenceType,
    isOneOffOverride: row.isOneOffOverride ?? false,
    changeReason: row.changeReason ?? null,
    originalSessionDate: row.originalSessionDate ?? null,
    originalStartsAt: row.originalStartsAt ?? null,
    originalEndsAt: row.originalEndsAt ?? null,
    cancellationType: row.cancellationType ?? null,
    canModify,
    canRestore,
    canOpenAttendance:
      row.status === "scheduled" && row.sessionDate === dhakaDate(),
  };
}

async function requireActiveAssignment(
  ctx: DbCtx,
  batchId: Id<"batches">,
  teacherId: Id<"teachers">,
  subjectId?: Id<"subjects">,
) {
  const [batch, teacher, assignments] = await Promise.all([
    ctx.db.get("batches", batchId),
    ctx.db.get("teachers", teacherId),
    ctx.db
      .query("teacherBatchAssignments")
      .withIndex("by_teacherId_and_batchId", (q) =>
        q.eq("teacherId", teacherId).eq("batchId", batchId),
      )
      .take(100),
  ]);
  if (!batch || batch.status !== "active")
    throw new Error("Batch is not active");
  if (!teacher || teacher.status !== "active")
    throw new Error("Teacher is not active");
  if (
    !assignments.some(
      (row) =>
        row.status === "active" &&
        (subjectId === undefined || row.subjectId === subjectId),
    )
  )
    throw new Error(
      "Teacher and subject must have an active assignment for this batch",
    );
}

export const listWeek = query({
  args: {
    startDate: v.string(),
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    teacherId: v.optional(v.id("teachers")),
    subjectId: v.optional(v.id("subjects")),
    status: filterStatus,
  },
  returns: v.array(sessionProjection),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    assertLocalDate(args.startDate);
    const endDate = new Date(
      Date.parse(`${args.startDate}T00:00:00Z`) + 6 * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    const rows = await ctx.db
      .query("classSessions")
      .withIndex("by_sessionDate", (q) =>
        q.gte("sessionDate", args.startDate).lte("sessionDate", endDate),
      )
      .take(500);
    const projected = (
      await Promise.all(rows.map((row) => project(ctx, row)))
    ).filter((row): row is NonNullable<typeof row> => Boolean(row));
    return projected
      .filter(
        (row) =>
          (!args.courseId || row.courseId === args.courseId) &&
          (!args.batchId || row.batchId === args.batchId) &&
          (!args.teacherId || row.teacherId === args.teacherId) &&
          (!args.subjectId || row.subjectId === args.subjectId) &&
          (args.status === "all" || row.status === args.status),
      )
      .sort((a, b) => a.startsAt - b.startsAt);
  },
});

export const getOptions = query({
  args: {},
  returns: v.object({
    courses: v.array(
      v.object({
        id: v.id("courses"),
        nameBn: v.string(),
        nameEn: v.string(),
        code: v.string(),
      }),
    ),
    batches: v.array(
      v.object({
        id: v.id("batches"),
        courseId: v.id("courses"),
        nameBn: v.string(),
        nameEn: v.string(),
        code: v.string(),
      }),
    ),
    teachers: v.array(v.object({ id: v.id("teachers"), name: v.string() })),
    subjects: v.array(
      v.object({
        id: v.id("subjects"),
        nameBn: v.string(),
        nameEn: v.string(),
      }),
    ),
    assignments: v.array(
      v.object({
        batchId: v.id("batches"),
        teacherId: v.id("teachers"),
        subjectId: v.union(v.id("subjects"), v.null()),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const [courses, batches, teachers, subjects] = await Promise.all([
      ctx.db
        .query("courses")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .take(200),
      ctx.db
        .query("batches")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .take(300),
      ctx.db
        .query("teachers")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .take(300),
      ctx.db
        .query("subjects")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .take(300),
    ]);
    const assignments = await ctx.db
      .query("teacherBatchAssignments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1000);
    return {
      courses: courses.map((row) => ({
        id: row._id,
        nameBn: row.nameBn,
        nameEn: row.nameEn,
        code: row.code,
      })),
      batches: batches.map((row) => ({
        id: row._id,
        courseId: row.courseId,
        nameBn: row.nameBn,
        nameEn: row.nameEn,
        code: row.code,
      })),
      teachers: teachers.map((row) => ({ id: row._id, name: row.displayName })),
      subjects: subjects.map((row) => ({
        id: row._id,
        nameBn: row.nameBn,
        nameEn: row.nameEn,
      })),
      assignments: assignments.map((row) => ({
        batchId: row.batchId,
        teacherId: row.teacherId,
        subjectId: row.subjectId ?? null,
      })),
    };
  },
});

export const getDetails = query({
  args: { sessionId: v.id("classSessions") },
  returns: v.union(sessionProjection, v.null()),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const row = await ctx.db.get("classSessions", args.sessionId);
    return row ? await project(ctx, row) : null;
  },
});

export const previewConflict = query({
  args: {
    sessionId: v.optional(v.id("classSessions")),
    batchId: v.id("batches"),
    teacherId: v.id("teachers"),
    sessionDate: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
  },
  returns: v.array(conflictProjection),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    validateTime(args.sessionDate, args.startsAt, args.endsAt);
    return await findConflicts(ctx, args);
  },
});

async function assertNoConflict(
  ctx: DbCtx,
  input: Parameters<typeof findConflicts>[1],
) {
  const conflicts = await findConflicts(ctx, input);
  if (conflicts.length)
    throw new ConvexError({ code: "CLASS_CONFLICT", conflicts });
}

export const reschedule = mutation({
  args: {
    sessionId: v.id("classSessions"),
    sessionDate: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const row = await ctx.db.get("classSessions", args.sessionId);
    if (!row) throw new Error("Class not found");
    if (row.status !== "scheduled" || row.startsAt <= Date.now())
      throw new Error("Only future scheduled classes can be rescheduled");
    validateTime(args.sessionDate, args.startsAt, args.endsAt);
    if (args.startsAt <= Date.now())
      throw new Error("The new class time must be in the future");
    await assertNoConflict(ctx, {
      sessionId: row._id,
      batchId: row.batchId,
      teacherId: row.teacherId,
      sessionDate: args.sessionDate,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
    });
    const occurrenceType =
      row.occurrenceType ?? (row.scheduleId ? "generated" : "extra");
    const now = Date.now();
    await ctx.db.patch("classSessions", row._id, {
      sessionDate: args.sessionDate,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      occurrenceType,
      isOneOffOverride:
        occurrenceType === "generated" ? true : row.isOneOffOverride,
      originalSessionDate: row.originalSessionDate ?? row.sessionDate,
      originalStartsAt: row.originalStartsAt ?? row.startsAt,
      originalEndsAt: row.originalEndsAt ?? row.endsAt,
      changeReason: cleanReason(args.reason),
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "class.rescheduled",
      entityType: "classSession",
      entityId: row._id,
      summary: "One class occurrence rescheduled",
      metadata: { from: row.sessionDate, to: args.sessionDate },
    });
    return null;
  },
});

export const createExtra = mutation({
  args: {
    batchId: v.id("batches"),
    teacherId: v.id("teachers"),
    subjectId: v.optional(v.id("subjects")),
    sessionDate: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    reason: v.optional(v.string()),
  },
  returns: v.id("classSessions"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    validateTime(args.sessionDate, args.startsAt, args.endsAt);
    if (args.startsAt <= Date.now())
      throw new Error("Extra class must be in the future");
    await requireActiveAssignment(
      ctx,
      args.batchId,
      args.teacherId,
      args.subjectId,
    );
    await assertNoConflict(ctx, args);
    const now = Date.now();
    const id = await ctx.db.insert("classSessions", {
      sessionKey: `extra:${args.batchId}:${args.startsAt}:${now}`,
      batchId: args.batchId,
      teacherId: args.teacherId,
      subjectId: args.subjectId,
      sessionDate: args.sessionDate,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      status: "scheduled",
      occurrenceType: "extra",
      changeReason: cleanReason(args.reason),
      rosterCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "class.extra_created",
      entityType: "classSession",
      entityId: id,
      summary: "Extra class created",
    });
    return id;
  },
});

export const cancel = mutation({
  args: { sessionId: v.id("classSessions"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const row = await ctx.db.get("classSessions", args.sessionId);
    if (!row) throw new Error("Class not found");
    if (row.status !== "scheduled" || row.startsAt <= Date.now())
      throw new Error("Only future scheduled classes can be cancelled");
    const now = Date.now();
    await ctx.db.patch("classSessions", row._id, {
      status: "cancelled",
      cancellationType: "manual",
      cancelledAt: now,
      cancelledByAccountId: account._id,
      changeReason: cleanReason(args.reason),
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "class.cancelled",
      entityType: "classSession",
      entityId: row._id,
      summary: "One class occurrence cancelled",
    });
    return null;
  },
});

export const restore = mutation({
  args: { sessionId: v.id("classSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const row = await ctx.db.get("classSessions", args.sessionId);
    if (!row) throw new Error("Class not found");
    const type = row.occurrenceType ?? (row.scheduleId ? "generated" : "extra");
    if (
      row.status !== "cancelled" ||
      row.cancellationType !== "manual" ||
      type !== "generated" ||
      !row.originalSessionDate ||
      !row.originalStartsAt ||
      !row.originalEndsAt ||
      row.originalStartsAt <= Date.now()
    )
      throw new Error("This class cannot be restored");
    await assertNoConflict(ctx, {
      sessionId: row._id,
      batchId: row.batchId,
      teacherId: row.teacherId,
      sessionDate: row.originalSessionDate,
      startsAt: row.originalStartsAt,
      endsAt: row.originalEndsAt,
    });
    const now = Date.now();
    await ctx.db.patch("classSessions", row._id, {
      status: "scheduled",
      sessionDate: row.originalSessionDate,
      startsAt: row.originalStartsAt,
      endsAt: row.originalEndsAt,
      isOneOffOverride: false,
      changeReason: undefined,
      cancelledAt: undefined,
      cancelledByAccountId: undefined,
      cancellationType: undefined,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "class.restored",
      entityType: "classSession",
      entityId: row._id,
      summary: "Class restored to its original routine time",
    });
    return null;
  },
});

export const openAttendance = mutation({
  args: { sessionId: v.id("classSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const row = await ctx.db.get("classSessions", args.sessionId);
    if (!row) throw new Error("Class not found");
    if (row.status !== "scheduled" || row.sessionDate !== dhakaDate())
      throw new Error(
        "Attendance can only be opened for a scheduled class today",
      );
    const enrolments = await ctx.db
      .query("enrolments")
      .withIndex("by_batchId_and_status", (q) => q.eq("batchId", row.batchId))
      .take(500);
    const rosterCount = enrolments.filter(
      (item) =>
        item.enrolledOn <= row.sessionDate &&
        (!item.endedOn || item.endedOn >= row.sessionDate),
    ).length;
    await ctx.db.patch("classSessions", row._id, {
      status: "open",
      rosterCount,
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "attendance.opened",
      entityType: "classSession",
      entityId: row._id,
      summary: "Attendance roster opened",
      metadata: { rosterCount },
    });
    return null;
  },
});
