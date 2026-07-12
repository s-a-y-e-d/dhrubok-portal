import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import { cleanRequired, courseDoc, courseStatus, courseSubjectDoc, mustGet, normalizeCode, normalizeSlug, paginationResult } from "./shared";

const courseFields = {
  academicSessionId: v.id("academicSessions"), code: v.string(), slug: v.string(), nameBn: v.string(), nameEn: v.string(),
  shortDescriptionBn: v.string(), shortDescriptionEn: v.string(), descriptionBn: v.string(), descriptionEn: v.string(),
  status: courseStatus, isPublic: v.boolean(), publicSortOrder: v.number(), coverStorageId: v.optional(v.id("_storage")),
};

async function validateCourseRelations(ctx: Parameters<typeof mustGet>[0], args: { academicSessionId: Parameters<typeof mustGet<"academicSessions">>[2]; status: "draft" | "active" | "completed" | "archived" }) {
  const session = await mustGet(ctx, "academicSessions", args.academicSessionId, "Academic session");
  if (session.status === "archived" && args.status !== "archived") throw new Error("Archived academic sessions cannot receive courses");
}

export const list = query({ args: { academicSessionId: v.id("academicSessions"), status: courseStatus, paginationOpts: paginationOptsValidator }, returns: paginationResult(courseDoc), handler: async (ctx, args) => { await requireOwner(ctx); return await ctx.db.query("courses").withIndex("by_academicSessionId_and_status", q => q.eq("academicSessionId", args.academicSessionId).eq("status", args.status)).paginate(args.paginationOpts); } });
export const get = query({ args: { courseId: v.id("courses") }, returns: courseDoc, handler: async (ctx, args) => { await requireOwner(ctx); return await mustGet(ctx, "courses", args.courseId, "Course"); } });

export const create = mutation({ args: courseFields, returns: v.id("courses"), handler: async (ctx, args) => {
  const { account } = await requireOwner(ctx); await validateCourseRelations(ctx, args); const code = normalizeCode(args.code); const slug = normalizeSlug(args.slug);
  if (await ctx.db.query("courses").withIndex("by_code", q => q.eq("code", code)).unique()) throw new Error("Course code already exists");
  if (await ctx.db.query("courses").withIndex("by_slug", q => q.eq("slug", slug)).unique()) throw new Error("Course slug already exists");
  if (args.isPublic && args.status !== "active") throw new Error("Only active courses may be public");
  const now = Date.now(); const id = await ctx.db.insert("courses", { ...args, code, slug, nameBn: cleanRequired(args.nameBn, "Bangla name"), nameEn: cleanRequired(args.nameEn, "English name"), createdAt: now, updatedAt: now, createdByAccountId: account._id, updatedByAccountId: account._id });
  await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "course.created", entityType: "course", entityId: id, summary: "Course created" }); return id;
} });

export const update = mutation({ args: { courseId: v.id("courses"), ...courseFields }, returns: v.null(), handler: async (ctx, args) => {
  const { account } = await requireOwner(ctx); const current = await mustGet(ctx, "courses", args.courseId, "Course"); if (current.status === "archived") throw new Error("Archived courses cannot be edited"); await validateCourseRelations(ctx, args);
  const code = normalizeCode(args.code); const slug = normalizeSlug(args.slug); const byCode = await ctx.db.query("courses").withIndex("by_code", q => q.eq("code", code)).unique(); const bySlug = await ctx.db.query("courses").withIndex("by_slug", q => q.eq("slug", slug)).unique();
  if (byCode && byCode._id !== args.courseId) throw new Error("Course code already exists"); if (bySlug && bySlug._id !== args.courseId) throw new Error("Course slug already exists"); if (args.isPublic && args.status !== "active") throw new Error("Only active courses may be public");
  if (current.academicSessionId !== args.academicSessionId) { const childStatuses = ["planned", "active", "completed", "archived"] as const; const children = await Promise.all(childStatuses.map(status => ctx.db.query("batches").withIndex("by_courseId_and_status", q => q.eq("courseId", args.courseId).eq("status", status)).take(1))); if (children.some(rows => rows.length)) throw new Error("A course with batches cannot change academic session"); }
  const { courseId, ...patch } = args; await ctx.db.patch("courses", courseId, { ...patch, code, slug, nameBn: cleanRequired(args.nameBn, "Bangla name"), nameEn: cleanRequired(args.nameEn, "English name"), updatedAt: Date.now(), updatedByAccountId: account._id }); return null;
} });

export const archive = mutation({ args: { courseId: v.id("courses") }, returns: v.null(), handler: async (ctx, args) => { const { account } = await requireOwner(ctx); const course = await mustGet(ctx, "courses", args.courseId, "Course"); if (course.status === "archived") return null; const children = await Promise.all(["planned", "active", "completed"].map(status => ctx.db.query("batches").withIndex("by_courseId_and_status", q => q.eq("courseId", args.courseId).eq("status", status as "planned" | "active" | "completed")).take(1))); if (children.some(rows => rows.length)) throw new Error("Course with non-archived batches cannot be archived"); await ctx.db.patch("courses", args.courseId, { status: "archived", isPublic: false, updatedAt: Date.now(), updatedByAccountId: account._id }); await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "course.archived", entityType: "course", entityId: args.courseId, summary: "Course archived" }); return null; } });

export const listSubjects = query({ args: { courseId: v.id("courses") }, returns: v.array(courseSubjectDoc), handler: async (ctx, args) => { await requireOwner(ctx); await mustGet(ctx, "courses", args.courseId, "Course"); return await ctx.db.query("courseSubjects").withIndex("by_courseId_and_sortOrder", q => q.eq("courseId", args.courseId)).take(200); } });
export const addSubject = mutation({ args: { courseId: v.id("courses"), subjectId: v.id("subjects"), sortOrder: v.number() }, returns: v.id("courseSubjects"), handler: async (ctx, args) => { await requireOwner(ctx); const course = await mustGet(ctx, "courses", args.courseId, "Course"); const subject = await mustGet(ctx, "subjects", args.subjectId, "Subject"); if (course.status === "archived" || subject.status === "archived") throw new Error("Archived records cannot receive course-subject links"); if (!Number.isSafeInteger(args.sortOrder) || args.sortOrder < 0) throw new Error("Sort order must be a non-negative integer"); if (await ctx.db.query("courseSubjects").withIndex("by_courseId_and_subjectId", q => q.eq("courseId", args.courseId).eq("subjectId", args.subjectId)).unique()) throw new Error("Subject is already linked to course"); return await ctx.db.insert("courseSubjects", { ...args, createdAt: Date.now() }); } });
export const removeSubject = mutation({
  args: { courseSubjectId: v.id("courseSubjects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const link = await mustGet(ctx, "courseSubjects", args.courseSubjectId, "Course subject");
    const course = await mustGet(ctx, "courses", link.courseId, "Course");
    if (course.status === "archived") throw new Error("Archived courses cannot be edited");
    const activeAssignments = await ctx.db
      .query("teacherBatchAssignments")
      .withIndex("by_subjectId_and_status", (q) => q.eq("subjectId", link.subjectId).eq("status", "active"))
      .collect();
    const activeSchedules = await ctx.db
      .query("batchSchedules")
      .withIndex("by_subjectId_and_status", (q) => q.eq("subjectId", link.subjectId).eq("status", "active"))
      .collect();
    if (activeAssignments.length > 0 || activeSchedules.length > 0) {
      const batches = await ctx.db
        .query("batches")
        .withIndex("by_courseId_and_status", (q) => q.eq("courseId", link.courseId))
        .collect();
      const courseBatchIds = new Set(batches.map((b) => b._id));
      const hasActiveAssignment = activeAssignments.some((a) => courseBatchIds.has(a.batchId));
      const hasActiveSchedule = activeSchedules.some((s) => courseBatchIds.has(s.batchId));
      if (hasActiveAssignment || hasActiveSchedule) {
        throw new Error("Cannot unlink subject because active assignments or routines exist for this subject in batches of this course");
      }
    }
    await ctx.db.delete(link._id);
    return null;
  },
});
