import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { courseStatus } from "./shared";

const listItem = v.object({
  courseId: v.id("courses"),
  code: v.string(),
  slug: v.string(),
  nameBn: v.string(),
  nameEn: v.string(),
  status: courseStatus,
  isPublic: v.boolean(),
  subjectCount: v.number(),
  teacherCount: v.number(),
  activeBatchCount: v.number(),
  activeEnrolmentCount: v.number(),
});

export const listCourses = query({
  args: { status: courseStatus, query: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(listItem),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const search = args.query.trim().toLowerCase();
    const result = search
      ? await ctx.db.query("courses").withSearchIndex("search_searchText", (q) => q.search("searchText", search).eq("status", args.status)).paginate(args.paginationOpts)
      : await ctx.db.query("courses").withIndex("by_status", (q) => q.eq("status", args.status)).order("desc").paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map(async (course) => {
        const [subjects, defaults, batches, enrolments] = await Promise.all([
          ctx.db.query("courseSubjects").withIndex("by_courseId_and_sortOrder", (q) => q.eq("courseId", course._id)).take(200),
          ctx.db.query("courseTeacherDefaults").withIndex("by_courseId_and_status", (q) => q.eq("courseId", course._id).eq("status", "active")).take(200),
          ctx.db.query("batches").withIndex("by_courseId_and_status", (q) => q.eq("courseId", course._id).eq("status", "active")).take(500),
          ctx.db.query("enrolments").withIndex("by_courseId_and_status", (q) => q.eq("courseId", course._id).eq("status", "active")).take(1000),
        ]);
        return {
          courseId: course._id,
          code: course.code,
          slug: course.slug,
          nameBn: course.nameBn,
          nameEn: course.nameEn,
          status: course.status,
          isPublic: course.isPublic,
          subjectCount: subjects.length,
          teacherCount: new Set(defaults.map((row) => row.teacherId)).size,
          activeBatchCount: batches.length,
          activeEnrolmentCount: enrolments.length,
        };
      })),
    };
  },
});

export const getCourseDetails = query({
  args: { courseId: v.id("courses") },
  returns: v.union(v.null(), v.object({
    course: v.object({
      courseId: v.id("courses"), code: v.string(), slug: v.string(), nameBn: v.string(), nameEn: v.string(),
      shortDescriptionBn: v.string(), shortDescriptionEn: v.string(), descriptionBn: v.string(), descriptionEn: v.string(),
      status: courseStatus, isPublic: v.boolean(), coverStorageId: v.optional(v.id("_storage")),
    }),
    defaults: v.array(v.object({
      defaultId: v.id("courseTeacherDefaults"), subjectId: v.id("subjects"), subjectCode: v.string(),
      subjectNameBn: v.string(), subjectNameEn: v.string(), teacherId: v.id("teachers"), teacherName: v.string(),
    })),
    batches: v.array(v.object({ batchId: v.id("batches"), code: v.string(), nameBn: v.string(), nameEn: v.string(), status: v.string(), startDate: v.string() })),
  })),
  handler: async (ctx, { courseId }) => {
    await requireOwner(ctx);
    const course = await ctx.db.get("courses", courseId);
    if (!course) return null;
    const defaults = await ctx.db.query("courseTeacherDefaults").withIndex("by_courseId_and_status", (q) => q.eq("courseId", courseId).eq("status", "active")).take(200);
    const defaultRows = [];
    for (const row of defaults) {
      const [subject, teacher] = await Promise.all([ctx.db.get("subjects", row.subjectId), ctx.db.get("teachers", row.teacherId)]);
      if (!subject || !teacher) continue;
      defaultRows.push({ defaultId: row._id, subjectId: subject._id, subjectCode: subject.code, subjectNameBn: subject.nameBn, subjectNameEn: subject.nameEn, teacherId: teacher._id, teacherName: teacher.displayName });
    }
    const statuses = ["planned", "active", "completed", "archived"] as const;
    const batches = (await Promise.all(statuses.map((status) => ctx.db.query("batches").withIndex("by_courseId_and_status", (q) => q.eq("courseId", courseId).eq("status", status)).take(200)))).flat();
    return {
      course: {
        courseId, code: course.code, slug: course.slug, nameBn: course.nameBn, nameEn: course.nameEn,
        shortDescriptionBn: course.shortDescriptionBn, shortDescriptionEn: course.shortDescriptionEn,
        descriptionBn: course.descriptionBn, descriptionEn: course.descriptionEn, status: course.status,
        isPublic: course.isPublic, coverStorageId: course.coverStorageId,
      },
      defaults: defaultRows,
      batches: batches.map((batch) => ({ batchId: batch._id, code: batch.code, nameBn: batch.nameBn, nameEn: batch.nameEn, status: batch.status, startDate: batch.startDate })),
    };
  },
});
