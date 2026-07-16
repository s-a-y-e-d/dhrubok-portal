import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation, query, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import {
  assertIsoDate,
  cleanRequired,
  normalizeCode,
  normalizeSlug,
} from "./shared";
import { scheduleCourseSnapshot } from "./snapshotHooks";

const batchStatus = v.union(
  v.literal("planned"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("archived"),
);
const routineRow = v.object({
  weekday: v.number(),
  startMinutes: v.number(),
  endMinutes: v.number(),
  teacherId: v.id("teachers"),
  subjectId: v.optional(v.id("subjects")),
});
const listItem = v.object({
  batchId: v.id("batches"),
  courseId: v.id("courses"),
  courseNameBn: v.string(),
  courseNameEn: v.string(),
  code: v.string(),
  nameBn: v.string(),
  nameEn: v.string(),
  startDate: v.string(),
  status: batchStatus,
  admissionOpen: v.boolean(),
  isPublic: v.boolean(),
  teacherCount: v.number(),
  routineCount: v.number(),
  activeEnrolmentCount: v.number(),
});

function slugFromCode(code: string) {
  return normalizeSlug(
    code.toLowerCase().replace(/_/g, "-").replace(/-+/g, "-"),
  );
}

function previousDate(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function validateRoutine(
  rows: Array<{
    weekday: number;
    startMinutes: number;
    endMinutes: number;
    teacherId: Id<"teachers">;
    subjectId?: Id<"subjects">;
  }>,
) {
  if (!rows.length) throw new Error("Add at least one weekly class");
  rows.forEach((row) => {
    if (
      !Number.isSafeInteger(row.weekday) ||
      row.weekday < 0 ||
      row.weekday > 6
    )
      throw new Error("Invalid weekday");
    if (
      !Number.isSafeInteger(row.startMinutes) ||
      !Number.isSafeInteger(row.endMinutes) ||
      row.startMinutes < 0 ||
      row.endMinutes > 1440 ||
      row.endMinutes <= row.startMinutes
    )
      throw new Error("Invalid class time");
  });
  for (let i = 0; i < rows.length; i += 1)
    for (let j = i + 1; j < rows.length; j += 1) {
      if (
        rows[i].weekday === rows[j].weekday &&
        rows[i].startMinutes < rows[j].endMinutes &&
        rows[i].endMinutes > rows[j].startMinutes
      ) {
        throw new ConvexError({
          code: "SCHEDULE_CONFLICT",
          message: "Weekly routine rows overlap",
          rows: [i, j],
        });
      }
    }
}

async function validateExistingConflicts(
  ctx: MutationCtx,
  rows: Array<{
    weekday: number;
    startMinutes: number;
    endMinutes: number;
    teacherId: Id<"teachers">;
  }>,
  effectiveFrom: string,
  excludeBatchId?: Id<"batches">,
) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const existing = await ctx.db
      .query("batchSchedules")
      .withIndex("by_teacherId_and_weekday_and_status", (q) =>
        q
          .eq("teacherId", row.teacherId)
          .eq("weekday", row.weekday)
          .eq("status", "active"),
      )
      .take(200);
    const conflict = existing.find(
      (item) =>
        item.batchId !== excludeBatchId &&
        item.startMinutes < row.endMinutes &&
        item.endMinutes > row.startMinutes &&
        (!item.effectiveUntil || item.effectiveUntil >= effectiveFrom),
    );
    if (conflict)
      throw new ConvexError({
        code: "SCHEDULE_CONFLICT",
        message: "Teacher already has an overlapping class",
        rows: [index],
        scheduleId: conflict._id,
      });
  }
}

export const listBatches = query({
  args: {
    status: batchStatus,
    courseId: v.optional(v.id("courses")),
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listItem),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const result = args.courseId
      ? await ctx.db
          .query("batches")
          .withIndex("by_courseId_and_status", (q) =>
            q.eq("courseId", args.courseId!).eq("status", args.status),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("batches")
          .withIndex("by_status", (q) => q.eq("status", args.status))
          .order("desc")
          .paginate(args.paginationOpts);
    const search = args.query.trim().toLowerCase();
    const page = [];
    for (const batch of result.page) {
      const course = await ctx.db.get("courses", batch.courseId);
      if (!course) continue;
      const haystack =
        `${batch.code} ${batch.nameBn} ${batch.nameEn} ${course.code} ${course.nameBn} ${course.nameEn}`.toLowerCase();
      if (search && !haystack.includes(search)) continue;
      const [assignments, schedules, enrolments] = await Promise.all([
        ctx.db
          .query("teacherBatchAssignments")
          .withIndex("by_batchId_and_status", (q) =>
            q.eq("batchId", batch._id).eq("status", "active"),
          )
          .take(200),
        ctx.db
          .query("batchSchedules")
          .withIndex("by_batchId_and_status", (q) =>
            q.eq("batchId", batch._id).eq("status", "active"),
          )
          .take(200),
        ctx.db
          .query("enrolments")
          .withIndex("by_batchId_and_status", (q) =>
            q.eq("batchId", batch._id).eq("status", "active"),
          )
          .take(1000),
      ]);
      page.push({
        batchId: batch._id,
        courseId: course._id,
        courseNameBn: course.nameBn,
        courseNameEn: course.nameEn,
        code: batch.code,
        nameBn: batch.nameBn,
        nameEn: batch.nameEn,
        startDate: batch.startDate,
        status: batch.status,
        admissionOpen: batch.admissionOpen,
        isPublic: batch.isPublic,
        teacherCount: new Set(assignments.map((row) => row.teacherId)).size,
        routineCount: schedules.length,
        activeEnrolmentCount: enrolments.length,
      });
    }
    return { ...result, page };
  },
});

export const getBatchDetails = query({
  args: { batchId: v.id("batches") },
  returns: v.union(
    v.null(),
    v.object({
      batch: listItem,
      assignments: v.array(
        v.object({
          assignmentId: v.id("teacherBatchAssignments"),
          teacherId: v.id("teachers"),
          teacherName: v.string(),
          subjectId: v.optional(v.id("subjects")),
          subjectNameBn: v.optional(v.string()),
          subjectNameEn: v.optional(v.string()),
        }),
      ),
      routine: v.array(
        v.object({
          scheduleId: v.id("batchSchedules"),
          weekday: v.number(),
          startMinutes: v.number(),
          endMinutes: v.number(),
          teacherId: v.id("teachers"),
          teacherName: v.string(),
          subjectId: v.optional(v.id("subjects")),
          subjectNameBn: v.optional(v.string()),
          subjectNameEn: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { batchId }) => {
    await requireOwner(ctx);
    const batch = await ctx.db.get("batches", batchId);
    if (!batch) return null;
    const course = await ctx.db.get("courses", batch.courseId);
    if (!course) return null;
    const [assignments, schedules, enrolments] = await Promise.all([
      ctx.db
        .query("teacherBatchAssignments")
        .withIndex("by_batchId_and_status", (q) =>
          q.eq("batchId", batchId).eq("status", "active"),
        )
        .take(200),
      ctx.db
        .query("batchSchedules")
        .withIndex("by_batchId_and_status", (q) =>
          q.eq("batchId", batchId).eq("status", "active"),
        )
        .take(200),
      ctx.db
        .query("enrolments")
        .withIndex("by_batchId_and_status", (q) =>
          q.eq("batchId", batchId).eq("status", "active"),
        )
        .take(1000),
    ]);
    const assignmentRows = [];
    for (const row of assignments) {
      const [teacher, subject] = await Promise.all([
        ctx.db.get("teachers", row.teacherId),
        row.subjectId ? ctx.db.get("subjects", row.subjectId) : null,
      ]);
      if (teacher)
        assignmentRows.push({
          assignmentId: row._id,
          teacherId: teacher._id,
          teacherName: teacher.displayName,
          subjectId: subject?._id,
          subjectNameBn: subject?.nameBn,
          subjectNameEn: subject?.nameEn,
        });
    }
    const routineRows = [];
    for (const row of schedules) {
      const [teacher, subject] = await Promise.all([
        ctx.db.get("teachers", row.teacherId),
        row.subjectId ? ctx.db.get("subjects", row.subjectId) : null,
      ]);
      if (teacher)
        routineRows.push({
          scheduleId: row._id,
          weekday: row.weekday,
          startMinutes: row.startMinutes,
          endMinutes: row.endMinutes,
          teacherId: teacher._id,
          teacherName: teacher.displayName,
          subjectId: subject?._id,
          subjectNameBn: subject?.nameBn,
          subjectNameEn: subject?.nameEn,
        });
    }
    return {
      batch: {
        batchId,
        courseId: course._id,
        courseNameBn: course.nameBn,
        courseNameEn: course.nameEn,
        code: batch.code,
        nameBn: batch.nameBn,
        nameEn: batch.nameEn,
        startDate: batch.startDate,
        status: batch.status,
        admissionOpen: batch.admissionOpen,
        isPublic: batch.isPublic,
        teacherCount: new Set(assignments.map((row) => row.teacherId)).size,
        routineCount: schedules.length,
        activeEnrolmentCount: enrolments.length,
      },
      assignments: assignmentRows,
      routine: routineRows.sort(
        (a, b) => a.weekday - b.weekday || a.startMinutes - b.startMinutes,
      ),
    };
  },
});

export const createWithRoutine = mutation({
  args: {
    courseId: v.id("courses"),
    code: v.string(),
    nameBn: v.string(),
    nameEn: v.string(),
    startDate: v.string(),
    routine: v.array(routineRow),
  },
  returns: v.id("batches"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    assertIsoDate(args.startDate, "Batch start date");
    validateRoutine(args.routine);
    const course = await ctx.db.get("courses", args.courseId);
    if (!course || course.status !== "active")
      throw new Error("Select an active course");
    const defaults = await ctx.db
      .query("courseTeacherDefaults")
      .withIndex("by_courseId_and_status", (q) =>
        q.eq("courseId", args.courseId).eq("status", "active"),
      )
      .take(200);
    if (!defaults.length)
      throw new Error(
        "The course needs teacher-subject defaults before creating a batch",
      );
    const defaultMap = new Map(
      defaults.map((row) => [String(row.subjectId), String(row.teacherId)]),
    );
    for (const row of args.routine) {
      if (
        row.subjectId &&
        defaultMap.get(String(row.subjectId)) !== String(row.teacherId)
      )
        throw new Error(
          "Routine subject must match the course default teacher",
        );
    }
    await validateExistingConflicts(ctx, args.routine, args.startDate);
    const code = normalizeCode(args.code),
      slug = slugFromCode(code);
    if (
      await ctx.db
        .query("batches")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique()
    )
      throw new Error("Batch code already exists");
    if (
      await ctx.db
        .query("batches")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
    )
      throw new Error("Batch slug already exists");
    const now = Date.now();
    const batchId = await ctx.db.insert("batches", {
      courseId: args.courseId,
      code,
      slug,
      nameBn: cleanRequired(args.nameBn, "Bangla name"),
      nameEn: cleanRequired(args.nameEn, "English name"),
      startDate: args.startDate,
      status: "active",
      admissionOpen: true,
      isPublic: true,
      publicSortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
    for (const row of defaults)
      await ctx.db.insert("teacherBatchAssignments", {
        teacherId: row.teacherId,
        batchId,
        subjectId: row.subjectId,
        startsOn: args.startDate,
        status: "active",
        createdAt: now,
        createdByAccountId: account._id,
      });
    const scheduleIds = [];
    for (const row of args.routine)
      scheduleIds.push(
        await ctx.db.insert("batchSchedules", {
          batchId,
          ...row,
          effectiveFrom: args.startDate,
          status: "active",
          createdAt: now,
          updatedAt: now,
        }),
      );
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "batch.created_with_routine",
      entityType: "batch",
      entityId: batchId,
      summary: "Batch created with assignments and weekly routine",
    });
    await scheduleCourseSnapshot(ctx, args.courseId);
    await ctx.scheduler.runAfter(
      0,
      internal.academics.classOccurrenceMaterializer.materializeSchedules,
      { scheduleIds },
    );
    return batchId;
  },
});

export const updateWithRoutine = mutation({
  args: {
    batchId: v.id("batches"),
    code: v.string(),
    nameBn: v.string(),
    nameEn: v.string(),
    startDate: v.string(),
    admissionOpen: v.boolean(),
    isPublic: v.boolean(),
    effectiveFrom: v.string(),
    routine: v.array(routineRow),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const batch = await ctx.db.get("batches", args.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.status === "archived")
      throw new Error("Archived batches cannot be edited");
    assertIsoDate(args.startDate, "Batch start date");
    assertIsoDate(args.effectiveFrom, "Routine effective date");
    validateRoutine(args.routine);
    await validateExistingConflicts(
      ctx,
      args.routine,
      args.effectiveFrom,
      args.batchId,
    );

    const assignments = await ctx.db
      .query("teacherBatchAssignments")
      .withIndex("by_batchId_and_status", (q) =>
        q.eq("batchId", args.batchId).eq("status", "active"),
      )
      .take(200);
    const assignmentKeys = new Set(
      assignments.map(
        (row) => `${String(row.teacherId)}:${String(row.subjectId ?? "")}`,
      ),
    );
    for (const row of args.routine) {
      const exact = `${String(row.teacherId)}:${String(row.subjectId ?? "")}`;
      const teacherOnly = `${String(row.teacherId)}:`;
      if (!assignmentKeys.has(exact) && !assignmentKeys.has(teacherOnly))
        throw new Error(
          "Routine teacher and subject must match an active batch assignment",
        );
    }

    if (args.startDate !== batch.startDate) {
      const enrolments = await ctx.db
        .query("enrolments")
        .withIndex("by_batchId_and_status", (q) =>
          q.eq("batchId", args.batchId).eq("status", "active"),
        )
        .take(1000);
      if (enrolments.some((row) => row.enrolledOn < args.startDate))
        throw new Error(
          "Start date cannot move after an active enrolment began",
        );
      const sessions = await ctx.db
        .query("classSessions")
        .withIndex("by_batchId_and_sessionDate", (q) =>
          q.eq("batchId", args.batchId),
        )
        .take(1000);
      if (sessions.some((row) => row.status === "submitted"))
        throw new Error(
          "Start date cannot change after attendance is submitted",
        );
    }

    const code = normalizeCode(args.code);
    const slug = slugFromCode(code);
    const [sameCode, sameSlug] = await Promise.all([
      ctx.db
        .query("batches")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique(),
      ctx.db
        .query("batches")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique(),
    ]);
    if (sameCode && sameCode._id !== args.batchId)
      throw new Error("Batch code already exists");
    if (sameSlug && sameSlug._id !== args.batchId)
      throw new Error("Batch slug already exists");
    if (batch.status !== "active" && (args.admissionOpen || args.isPublic))
      throw new Error(
        "Only active batches can be public or open for admission",
      );

    const oldSchedules = await ctx.db
      .query("batchSchedules")
      .withIndex("by_batchId_and_status", (q) =>
        q.eq("batchId", args.batchId).eq("status", "active"),
      )
      .take(200);
    const now = Date.now();
    for (const schedule of oldSchedules)
      await ctx.db.patch("batchSchedules", schedule._id, {
        status: "cancelled",
        effectiveUntil: previousDate(args.effectiveFrom),
        updatedAt: now,
      });

    for (const schedule of oldSchedules) {
      const sessions = await ctx.db
        .query("classSessions")
        .withIndex("by_scheduleId_and_sessionDate", (q) =>
          q
            .eq("scheduleId", schedule._id)
            .gte("sessionDate", args.effectiveFrom),
        )
        .take(200);
      for (const session of sessions)
        if (session.status === "scheduled" && !session.isOneOffOverride)
          await ctx.db.patch("classSessions", session._id, {
            status: "cancelled",
            cancellationType: "routine",
            cancelledAt: now,
            updatedAt: now,
          });
    }

    const scheduleIds = [];
    for (const row of args.routine)
      scheduleIds.push(
        await ctx.db.insert("batchSchedules", {
          batchId: args.batchId,
          ...row,
          effectiveFrom: args.effectiveFrom,
          status: "active",
          createdAt: now,
          updatedAt: now,
        }),
      );
    await ctx.db.patch("batches", args.batchId, {
      code,
      slug,
      nameBn: cleanRequired(args.nameBn, "Bangla name"),
      nameEn: cleanRequired(args.nameEn, "English name"),
      startDate: args.startDate,
      admissionOpen: args.admissionOpen,
      isPublic: args.isPublic,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "batch.updated_with_routine",
      entityType: "batch",
      entityId: args.batchId,
      summary: "Batch details and future weekly routine updated",
    });
    await scheduleCourseSnapshot(ctx, batch.courseId);
    await ctx.scheduler.runAfter(
      0,
      internal.academics.classOccurrenceMaterializer.materializeSchedules,
      { scheduleIds },
    );
    return null;
  },
});
