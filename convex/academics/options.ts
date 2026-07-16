import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireOwner } from "../model/auth";

export const contentScopes = query({
  args: {},
  returns: v.object({
    courses: v.array(v.object({ courseId: v.id("courses"), nameBn: v.string(), nameEn: v.string() })),
    batches: v.array(v.object({ batchId: v.id("batches"), courseId: v.id("courses"), nameBn: v.string(), nameEn: v.string() })),
    subjects: v.array(v.object({ subjectId: v.id("subjects"), nameBn: v.string(), nameEn: v.string() })),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const [courses, batches, subjects] = await Promise.all([
      ctx.db.query("courses").withIndex("by_status", (q) => q.eq("status", "active")).take(200),
      ctx.db.query("batches").withIndex("by_status", (q) => q.eq("status", "active")).take(500),
      ctx.db.query("subjects").withIndex("by_status", (q) => q.eq("status", "active")).take(200),
    ]);
    return { courses: courses.map((course) => ({ courseId: course._id, nameBn: course.nameBn, nameEn: course.nameEn })), batches: batches.map((batch) => ({ batchId: batch._id, courseId: batch.courseId, nameBn: batch.nameBn, nameEn: batch.nameEn })), subjects: subjects.map((subject) => ({ subjectId: subject._id, nameBn: subject.nameBn, nameEn: subject.nameEn })) };
  },
});

export const ownerWorkspace = query({
  args: {},
  returns: v.object({
    courses: v.array(v.object({ courseId: v.id("courses"), nameBn: v.string(), nameEn: v.string() })),
    batches: v.array(v.object({ batchId: v.id("batches"), courseId: v.id("courses"), nameBn: v.string(), nameEn: v.string() })),
    subjects: v.array(v.object({ subjectId: v.id("subjects"), code: v.string(), nameBn: v.string(), nameEn: v.string() })),
    teachers: v.array(v.object({ teacherId: v.id("teachers"), displayName: v.string() })),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const [courses, batches, subjects, teachers] = await Promise.all([
      ctx.db.query("courses").withIndex("by_status", (q) => q.eq("status", "active")).take(200),
      ctx.db.query("batches").withIndex("by_status", (q) => q.eq("status", "active")).take(500),
      ctx.db.query("subjects").withIndex("by_status", (q) => q.eq("status", "active")).take(200),
      ctx.db.query("teachers").withIndex("by_status", (q) => q.eq("status", "active")).take(200),
    ]);
    return {
      courses: courses.map((row) => ({ courseId: row._id, nameBn: row.nameBn, nameEn: row.nameEn })),
      batches: batches.map((row) => ({ batchId: row._id, courseId: row.courseId, nameBn: row.nameBn, nameEn: row.nameEn })),
      subjects: subjects.map((row) => ({ subjectId: row._id, code: row.code, nameBn: row.nameBn, nameEn: row.nameEn })),
      teachers: teachers.map((row) => ({ teacherId: row._id, displayName: row.displayName })),
    };
  },
});
