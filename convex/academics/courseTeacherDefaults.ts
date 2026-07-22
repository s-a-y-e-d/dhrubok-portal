import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { mustGet } from "./shared";

export const listForCourse = query({
  args: { courseId: v.id("courses") },
  returns: v.array(v.object({ defaultId: v.id("courseTeacherDefaults"), subjectId: v.id("subjects"), teacherId: v.id("teachers") })),
  handler: async (ctx, { courseId }) => {
    await requireOwner(ctx);
    return (await ctx.db.query("courseTeacherDefaults").withIndex("by_courseId_and_status", (q) => q.eq("courseId", courseId).eq("status", "active")).take(200))
      .map((row) => ({ defaultId: row._id, subjectId: row.subjectId, teacherId: row.teacherId }));
  },
});

export const replace = mutation({
  args: { courseId: v.id("courses"), defaults: v.array(v.object({ subjectId: v.id("subjects"), teacherId: v.id("teachers") })) },
  returns: v.null(),
  handler: async (ctx, { courseId, defaults }) => {
    const { account } = await requireOwner(ctx);
    const course = await mustGet(ctx, "courses", courseId, "Course");
    if (course.status === "archived") throw new Error("Archived courses cannot be edited");
    if (!defaults.length) throw new Error("Every course needs at least one subject and teacher");
    const subjects = new Set<string>();
    for (const item of defaults) {
      if (subjects.has(item.subjectId)) throw new Error("A subject may only have one default teacher");
      subjects.add(item.subjectId);
      const [subject, teacher] = await Promise.all([ctx.db.get("subjects", item.subjectId), ctx.db.get("teachers", item.teacherId)]);
      if (!subject || !teacher || teacher.status !== "active") throw new Error("Defaults require existing subjects and active teachers");
    }
    const now = Date.now();
    const existing = await ctx.db.query("courseTeacherDefaults").withIndex("by_courseId_and_status", (q) => q.eq("courseId", courseId).eq("status", "active")).take(200);
    for (const row of existing) await ctx.db.patch("courseTeacherDefaults", row._id, { status: "ended", updatedAt: now, updatedByAccountId: account._id });
    const links = await ctx.db.query("courseSubjects").withIndex("by_courseId_and_sortOrder", (q) => q.eq("courseId", courseId)).take(200);
    for (const link of links) await ctx.db.delete("courseSubjects", link._id);
    for (let index = 0; index < defaults.length; index += 1) {
      const item = defaults[index];
      await ctx.db.insert("courseSubjects", { courseId, subjectId: item.subjectId, sortOrder: index, createdAt: now });
      await ctx.db.insert("courseTeacherDefaults", { courseId, subjectId: item.subjectId, teacherId: item.teacherId, status: "active", createdAt: now, updatedAt: now, createdByAccountId: account._id, updatedByAccountId: account._id });
    }
    return null;
  },
});
