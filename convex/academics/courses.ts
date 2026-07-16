import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import {
  assertIsoDate,
  cleanRequired,
  courseDoc,
  courseSubjectDoc,
  courseStatus,
  mustGet,
  normalizeCode,
  normalizeSlug,
  paginationResult,
} from "./shared";

const courseFields = {
  code: v.string(),
  nameBn: v.string(),
  nameEn: v.string(),
  shortDescriptionBn: v.string(),
  shortDescriptionEn: v.string(),
  descriptionBn: v.string(),
  descriptionEn: v.string(),
  isPublic: v.boolean(),
  publicSortOrder: v.number(),
  coverStorageId: v.optional(v.id("_storage")),
};

const defaultInput = v.object({
  teacherId: v.id("teachers"),
  subjectIds: v.array(v.id("subjects")),
});

const routineInput = v.object({
  weekday: v.number(),
  startMinutes: v.number(),
  endMinutes: v.number(),
  teacherId: v.id("teachers"),
  subjectId: v.optional(v.id("subjects")),
});

const searchTextFor = (code: string, nameBn: string, nameEn: string) =>
  `${code} ${nameBn} ${nameEn}`.trim().toLowerCase();

const slugFromCode = (code: string) => normalizeSlug(code.toLowerCase().replace(/_/g, "-").replace(/-+/g, "-"));

const refreshSnapshot = async (ctx: MutationCtx, courseId: Parameters<typeof mustGet<"courses">>[2]) => {
  await ctx.scheduler.runAfter(0, internal.academics.courseSnapshots.refresh, { courseId });
};

function validateRoutineRows(
  rows: Array<{ weekday: number; startMinutes: number; endMinutes: number; teacherId: string; subjectId?: string }>,
) {
  if (!rows.length) throw new Error("Add at least one weekly routine");
  for (const row of rows) {
    if (!Number.isSafeInteger(row.weekday) || row.weekday < 0 || row.weekday > 6) throw new Error("Weekday must be between 0 and 6");
    if (!Number.isSafeInteger(row.startMinutes) || !Number.isSafeInteger(row.endMinutes) || row.startMinutes < 0 || row.endMinutes > 1440 || row.endMinutes <= row.startMinutes) {
      throw new Error("Routine time range is invalid");
    }
  }
  for (let index = 0; index < rows.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < rows.length; otherIndex += 1) {
      const a = rows[index];
      const b = rows[otherIndex];
      if (a.weekday !== b.weekday || a.startMinutes >= b.endMinutes || a.endMinutes <= b.startMinutes) continue;
      if (a.teacherId === b.teacherId) throw new Error(`Routine rows ${index + 1} and ${otherIndex + 1} overlap for the same teacher`);
      throw new Error(`Routine rows ${index + 1} and ${otherIndex + 1} overlap for the batch`);
    }
  }
}

export const list = query({
  args: { status: courseStatus, paginationOpts: paginationOptsValidator },
  returns: paginationResult(courseDoc),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    return await ctx.db.query("courses").withIndex("by_status", (q) => q.eq("status", args.status)).paginate(args.paginationOpts);
  },
});

export const get = query({
  args: { courseId: v.id("courses") },
  returns: courseDoc,
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    return await mustGet(ctx, "courses", args.courseId, "Course");
  },
});

export const generateCoverUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createWithFirstBatch = mutation({
  args: {
    course: v.object({
      code: v.string(),
      nameBn: v.string(),
      nameEn: v.string(),
      shortDescriptionBn: v.string(),
      shortDescriptionEn: v.string(),
      descriptionBn: v.string(),
      descriptionEn: v.string(),
      coverStorageId: v.optional(v.id("_storage")),
    }),
    defaults: v.array(defaultInput),
    batch: v.object({ code: v.string(), nameBn: v.string(), nameEn: v.string(), startDate: v.string() }),
    routine: v.array(routineInput),
  },
  returns: v.object({ courseId: v.id("courses"), batchId: v.id("batches") }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const courseCode = normalizeCode(args.course.code);
    const courseSlug = slugFromCode(courseCode);
    const batchCode = normalizeCode(args.batch.code);
    const batchSlug = slugFromCode(batchCode);
    const courseNameBn = cleanRequired(args.course.nameBn, "Course Bangla name");
    const courseNameEn = cleanRequired(args.course.nameEn, "Course English name");
    const batchNameBn = cleanRequired(args.batch.nameBn, "Batch Bangla name");
    const batchNameEn = cleanRequired(args.batch.nameEn, "Batch English name");
    assertIsoDate(args.batch.startDate, "Batch start date");
    validateRoutineRows(args.routine);

    if (!args.defaults.length) throw new Error("Select at least one teacher and subject");
    if (await ctx.db.query("courses").withIndex("by_code", (q) => q.eq("code", courseCode)).unique()) throw new Error("Course code already exists");
    if (await ctx.db.query("courses").withIndex("by_slug", (q) => q.eq("slug", courseSlug)).unique()) throw new Error("Course slug already exists");
    if (await ctx.db.query("batches").withIndex("by_code", (q) => q.eq("code", batchCode)).unique()) throw new Error("Batch code already exists");
    if (await ctx.db.query("batches").withIndex("by_slug", (q) => q.eq("slug", batchSlug)).unique()) throw new Error("Batch slug already exists");

    const teacherIds = new Set<string>();
    const subjectToTeacher = new Map<string, string>();
    for (const row of args.defaults) {
      if (teacherIds.has(row.teacherId)) throw new Error("A teacher may only appear once");
      teacherIds.add(row.teacherId);
      if (!row.subjectIds.length) throw new Error("Every selected teacher needs at least one subject");
      const rowSubjects = new Set<string>();
      for (const subjectId of row.subjectIds) {
        if (rowSubjects.has(subjectId)) throw new Error("A subject may only appear once per teacher");
        rowSubjects.add(subjectId);
        if (subjectToTeacher.has(subjectId)) throw new Error("A subject may only have one default teacher");
        subjectToTeacher.set(subjectId, row.teacherId);
      }
    }

    const teachers = await Promise.all([...teacherIds].map((id) => ctx.db.get("teachers", id as never)));
    if (teachers.some((teacher) => !teacher || teacher.status !== "active")) throw new Error("Every selected teacher must be active");
    const subjectIds = [...subjectToTeacher.keys()];
    const subjects = await Promise.all(subjectIds.map((id) => ctx.db.get("subjects", id as never)));
    if (subjects.some((subject) => !subject || subject.status !== "active")) throw new Error("Every selected subject must be active");

    for (const row of args.routine) {
      if (!teacherIds.has(row.teacherId)) throw new Error("Routine teacher must be selected in the teacher step");
      if (row.subjectId && subjectToTeacher.get(row.subjectId) !== row.teacherId) throw new Error("Routine subject must match its default teacher");
      const existing = await ctx.db
        .query("batchSchedules")
        .withIndex("by_teacherId_and_weekday_and_status", (q) => q.eq("teacherId", row.teacherId).eq("weekday", row.weekday).eq("status", "active"))
        .take(200);
      if (existing.some((item) => item.startMinutes < row.endMinutes && item.endMinutes > row.startMinutes && (!item.effectiveUntil || item.effectiveUntil >= args.batch.startDate))) {
        throw new Error("A selected teacher already has an overlapping routine");
      }
    }

    const now = Date.now();
    const courseId = await ctx.db.insert("courses", {
      code: courseCode,
      slug: courseSlug,
      nameBn: courseNameBn,
      nameEn: courseNameEn,
      searchText: searchTextFor(courseCode, courseNameBn, courseNameEn),
      shortDescriptionBn: cleanRequired(args.course.shortDescriptionBn, "Bangla short description"),
      shortDescriptionEn: cleanRequired(args.course.shortDescriptionEn, "English short description"),
      descriptionBn: cleanRequired(args.course.descriptionBn, "Bangla description"),
      descriptionEn: cleanRequired(args.course.descriptionEn, "English description"),
      coverStorageId: args.course.coverStorageId,
      status: "active",
      isPublic: false,
      publicSortOrder: 0,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: account._id,
      updatedByAccountId: account._id,
    });

    for (let index = 0; index < subjectIds.length; index += 1) {
      const subjectId = subjectIds[index] as never;
      await ctx.db.insert("courseSubjects", { courseId, subjectId, sortOrder: index, createdAt: now });
      await ctx.db.insert("courseTeacherDefaults", {
        courseId,
        subjectId,
        teacherId: subjectToTeacher.get(subjectIds[index]) as never,
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdByAccountId: account._id,
        updatedByAccountId: account._id,
      });
    }

    const batchId = await ctx.db.insert("batches", {
      courseId,
      code: batchCode,
      slug: batchSlug,
      nameBn: batchNameBn,
      nameEn: batchNameEn,
      startDate: args.batch.startDate,
      status: "active",
      admissionOpen: true,
      isPublic: true,
      publicSortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });

    for (const row of args.defaults) {
      for (const subjectId of row.subjectIds) {
        await ctx.db.insert("teacherBatchAssignments", {
          teacherId: row.teacherId,
          batchId,
          subjectId,
          startsOn: args.batch.startDate,
          status: "active",
          createdAt: now,
          createdByAccountId: account._id,
        });
      }
    }

    const scheduleIds = [];
    for (const row of args.routine) {
      scheduleIds.push(await ctx.db.insert("batchSchedules", {
        batchId,
        teacherId: row.teacherId,
        subjectId: row.subjectId,
        weekday: row.weekday,
        startMinutes: row.startMinutes,
        endMinutes: row.endMinutes,
        effectiveFrom: args.batch.startDate,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }));
    }

    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "course.created_with_first_batch",
      entityType: "course",
      entityId: courseId,
      summary: `Course created with first batch ${batchId}`,
    });
    await refreshSnapshot(ctx, courseId);
    await ctx.scheduler.runAfter(0, internal.academics.classOccurrenceMaterializer.materializeSchedules, { scheduleIds });
    return { courseId, batchId };
  },
});

export const update = mutation({
  args: { courseId: v.id("courses"), ...courseFields },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const current = await mustGet(ctx, "courses", args.courseId, "Course");
    if (current.status === "archived") throw new Error("Archived courses cannot be edited");
    const code = normalizeCode(args.code);
    const slug = slugFromCode(code);
    const byCode = await ctx.db.query("courses").withIndex("by_code", (q) => q.eq("code", code)).unique();
    const bySlug = await ctx.db.query("courses").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (byCode && byCode._id !== args.courseId) throw new Error("Course code already exists");
    if (bySlug && bySlug._id !== args.courseId) throw new Error("Course slug already exists");
    const { courseId, ...patch } = args;
    await ctx.db.patch("courses", courseId, {
      ...patch,
      code,
      slug,
      nameBn: cleanRequired(args.nameBn, "Bangla name"),
      nameEn: cleanRequired(args.nameEn, "English name"),
      searchText: searchTextFor(code, args.nameBn, args.nameEn),
      status: "active",
      updatedAt: Date.now(),
      updatedByAccountId: account._id,
    });
    await refreshSnapshot(ctx, courseId);
    return null;
  },
});

export const archive = mutation({
  args: { courseId: v.id("courses") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const course = await mustGet(ctx, "courses", args.courseId, "Course");
    if (course.status === "archived") return null;
    const children = await Promise.all(
      (["planned", "active", "completed"] as const).map((status) =>
        ctx.db.query("batches").withIndex("by_courseId_and_status", (q) => q.eq("courseId", args.courseId).eq("status", status)).take(1),
      ),
    );
    if (children.some((rows) => rows.length)) throw new Error("Archive all course batches first");
    await ctx.db.patch("courses", args.courseId, { status: "archived", isPublic: false, updatedAt: Date.now(), updatedByAccountId: account._id });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "course.archived", entityType: "course", entityId: args.courseId, summary: "Course archived" });
    await refreshSnapshot(ctx, args.courseId);
    return null;
  },
});

export const listSubjects = query({
  args: { courseId: v.id("courses") },
  returns: v.array(courseSubjectDoc),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    await mustGet(ctx, "courses", args.courseId, "Course");
    return await ctx.db.query("courseSubjects").withIndex("by_courseId_and_sortOrder", (q) => q.eq("courseId", args.courseId)).take(200);
  },
});
