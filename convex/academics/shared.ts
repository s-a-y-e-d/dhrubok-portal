import { v } from "convex/values";
import { paginationResultFields } from "../model/validators";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const academicStatus = v.union(v.literal("planned"), v.literal("active"), v.literal("completed"), v.literal("archived"));
export const courseStatus = v.union(v.literal("active"), v.literal("archived"));
export const teacherStatus = v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"));
export const assignmentStatus = v.union(v.literal("active"), v.literal("ended"));
export const scheduleStatus = v.union(v.literal("active"), v.literal("cancelled"));

export const subjectDoc = v.object({
  _id: v.id("subjects"), _creationTime: v.number(), code: v.string(), nameBn: v.string(), nameEn: v.string(),
  status: v.union(v.literal("active"), v.literal("archived")), createdAt: v.number(), updatedAt: v.number(),
});
export const courseDoc = v.object({
  _id: v.id("courses"), _creationTime: v.number(), code: v.string(), slug: v.string(),
  nameBn: v.string(), nameEn: v.string(), searchText: v.optional(v.string()), shortDescriptionBn: v.string(), shortDescriptionEn: v.string(),
  descriptionBn: v.string(), descriptionEn: v.string(), status: courseStatus, isPublic: v.boolean(), publicSortOrder: v.number(),
  coverStorageId: v.optional(v.id("_storage")), createdAt: v.number(), updatedAt: v.number(),
  createdByAccountId: v.id("portalAccounts"), updatedByAccountId: v.id("portalAccounts"),
});
export const courseSubjectDoc = v.object({
  _id: v.id("courseSubjects"), _creationTime: v.number(), courseId: v.id("courses"), subjectId: v.id("subjects"),
  sortOrder: v.number(), createdAt: v.number(),
});
export const teacherDoc = v.object({
  _id: v.id("teachers"), _creationTime: v.number(), employeeCode: v.string(), displayName: v.string(),
  nameBn: v.optional(v.string()), nameEn: v.optional(v.string()), loginEmail: v.string(), normalizedLoginEmail: v.string(),
  phone: v.string(), bioBn: v.string(), bioEn: v.string(), qualificationsBn: v.string(), qualificationsEn: v.string(),
  photoStorageId: v.optional(v.id("_storage")), status: teacherStatus, isPublic: v.boolean(), publicSortOrder: v.number(),
  joinedAt: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(),
});
export const batchDoc = v.object({
  _id: v.id("batches"), _creationTime: v.number(), courseId: v.id("courses"),
  code: v.string(), slug: v.string(), nameBn: v.string(), nameEn: v.string(), roomBn: v.optional(v.string()), roomEn: v.optional(v.string()),
  startDate: v.string(), status: academicStatus,
  admissionOpen: v.boolean(), isPublic: v.boolean(), publicSortOrder: v.number(), createdAt: v.number(), updatedAt: v.number(),
});
export const assignmentDoc = v.object({
  _id: v.id("teacherBatchAssignments"), _creationTime: v.number(), teacherId: v.id("teachers"), batchId: v.id("batches"),
  subjectId: v.optional(v.id("subjects")), startsOn: v.string(), endsOn: v.optional(v.string()), status: assignmentStatus,
  createdAt: v.number(), createdByAccountId: v.id("portalAccounts"),
});
export const scheduleDoc = v.object({
  _id: v.id("batchSchedules"), _creationTime: v.number(), batchId: v.id("batches"), teacherId: v.id("teachers"),
  subjectId: v.optional(v.id("subjects")), weekday: v.number(), startMinutes: v.number(), endMinutes: v.number(),
  roomBn: v.optional(v.string()), roomEn: v.optional(v.string()), effectiveFrom: v.string(), effectiveUntil: v.optional(v.string()),
  status: scheduleStatus, createdAt: v.number(), updatedAt: v.number(),
});

export const paginationResult = <T extends ReturnType<typeof v.object>>(item: T) => v.object({
  page: v.array(item), ...paginationResultFields,
});

export function cleanRequired(value: string, label: string) {
  const result = value.trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

export function normalizeCode(value: string) {
  const result = cleanRequired(value, "Code").toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(result)) throw new Error("Code must contain 1-32 letters, numbers, underscores, or hyphens");
  return result;
}

export function normalizeSlug(value: string) {
  const result = cleanRequired(value, "Slug").toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) throw new Error("Invalid slug");
  return result;
}

export function assertIsoDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new Error(`${label} must be an ISO date`);
}

export function assertDateRange(start: string, end?: string) {
  assertIsoDate(start, "Start date");
  if (end !== undefined) {
    assertIsoDate(end, "End date");
    if (end < start) throw new Error("End date cannot be before start date");
  }
}

export async function mustGet<T extends keyof import("../_generated/dataModel").DataModel>(
  ctx: Pick<QueryCtx | MutationCtx, "db">, table: T, id: Id<T>, label: string,
) {
  const doc = await ctx.db.get(table, id);
  if (!doc) throw new Error(`${label} not found`);
  return doc;
}

export function assertNonNegativeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

export function isArchived(doc: Doc<"subjects"> | Doc<"courses"> | Doc<"teachers"> | Doc<"batches">) {
  return doc.status === "archived";
}
