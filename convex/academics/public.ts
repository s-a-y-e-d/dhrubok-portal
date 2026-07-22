import { v } from "convex/values";
import { query } from "../_generated/server";
import { normalizeSlug } from "./shared";

const publicCourse = v.object({
  id: v.id("courses"), slug: v.string(), code: v.string(), nameBn: v.string(), nameEn: v.string(),
  shortDescriptionBn: v.string(), shortDescriptionEn: v.string(), descriptionBn: v.string(), descriptionEn: v.string(),
  coverStorageId: v.optional(v.id("_storage")), publicSortOrder: v.number(),
});
const publicTeacher = v.object({
  id: v.id("teachers"), displayName: v.string(), nameBn: v.optional(v.string()), nameEn: v.optional(v.string()),
  bioBn: v.string(), bioEn: v.string(), qualificationsBn: v.string(), qualificationsEn: v.string(),
  photoStorageId: v.optional(v.id("_storage")), publicSortOrder: v.number(),
});
const publicSubject = v.object({ id: v.id("subjects"), code: v.string(), nameBn: v.string(), nameEn: v.string(), sortOrder: v.number() });
const publicCourseDetail = v.object({ ...publicCourse.fields, subjects: v.array(publicSubject) });

function projectCourse(course: { _id: never; slug: string; code: string; nameBn: string; nameEn: string; shortDescriptionBn: string; shortDescriptionEn: string; descriptionBn: string; descriptionEn: string; coverStorageId?: never; publicSortOrder: number }) {
  return { id: course._id, slug: course.slug, code: course.code, nameBn: course.nameBn, nameEn: course.nameEn, shortDescriptionBn: course.shortDescriptionBn, shortDescriptionEn: course.shortDescriptionEn, descriptionBn: course.descriptionBn, descriptionEn: course.descriptionEn, coverStorageId: course.coverStorageId, publicSortOrder: course.publicSortOrder };
}

export const listCourses = query({ args: { limit: v.optional(v.number()) }, returns: v.array(publicCourse), handler: async (ctx, args) => { const limit = Math.min(Math.max(Math.trunc(args.limit ?? 50), 1), 100); const candidates = await ctx.db.query("courses").withIndex("by_isPublic_and_status_and_publicSortOrder", q => q.eq("isPublic", true).eq("status", "active")).take(limit); return candidates.map(course => projectCourse(course as never)); } });
export const getCourseBySlug = query({ args: { slug: v.string() }, returns: v.union(publicCourseDetail, v.null()), handler: async (ctx, args) => { const course = await ctx.db.query("courses").withIndex("by_slug", q => q.eq("slug", normalizeSlug(args.slug))).unique(); if (!course || !course.isPublic || course.status !== "active") return null; const links = await ctx.db.query("courseSubjects").withIndex("by_courseId_and_sortOrder", q => q.eq("courseId", course._id)).take(100); const subjects = []; for (const link of links) { const subject = await ctx.db.get("subjects", link.subjectId); if (subject) subjects.push({ id: subject._id, code: subject.code, nameBn: subject.nameEn, nameEn: subject.nameEn, sortOrder: link.sortOrder }); } return { ...projectCourse(course as never), subjects }; } });
export const listTeachers = query({ args: { limit: v.optional(v.number()) }, returns: v.array(publicTeacher), handler: async (ctx, args) => { const limit = Math.min(Math.max(Math.trunc(args.limit ?? 50), 1), 100); const candidates = await ctx.db.query("teachers").withIndex("by_isPublic_and_status_and_publicSortOrder", q => q.eq("isPublic", true).eq("status", "active")).take(limit); return candidates.map(teacher => ({ id: teacher._id, displayName: teacher.displayName, nameBn: teacher.nameBn, nameEn: teacher.nameEn, bioBn: teacher.bioBn, bioEn: teacher.bioEn, qualificationsBn: teacher.qualificationsBn, qualificationsEn: teacher.qualificationsEn, photoStorageId: teacher.photoStorageId, publicSortOrder: teacher.publicSortOrder })); } });
