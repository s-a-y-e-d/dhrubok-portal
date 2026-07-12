import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireAccount } from "../model/auth";

export const MAX_MATERIAL_BYTES = 20 * 1024 * 1024;

const allowedFileTypes: Record<string, readonly string[]> = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".gif": ["image/gif"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

type DbCtx = Pick<QueryCtx | MutationCtx, "db">;
type AuthDbCtx = Pick<QueryCtx | MutationCtx, "auth" | "db">;

function fileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot >= 0 ? normalized.slice(dot) : "";
}

export function validateMaterialText(input: {
  titleBn: string;
  titleEn: string;
  descriptionBn: string;
  descriptionEn: string;
}) {
  if (!input.titleBn.trim() || !input.titleEn.trim()) throw new Error("Bangla and English titles are required");
  if (input.titleBn.length > 200 || input.titleEn.length > 200) throw new Error("Material title is too long");
  if (input.descriptionBn.length > 4_000 || input.descriptionEn.length > 4_000) throw new Error("Material description is too long");
}

export async function validateStoredFile(ctx: MutationCtx, storageId: Id<"_storage">, fileName: string) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata) throw new Error("Uploaded file does not exist");
  validateFileMetadata(fileName, metadata.size, metadata.contentType);
}

export function validateFileMetadata(fileName: string, size: number, contentType?: string) {
  const extension = fileExtension(fileName);
  const acceptedTypes = allowedFileTypes[extension];
  if (!acceptedTypes) throw new Error("Unsupported material file extension");
  if (size <= 0 || size > MAX_MATERIAL_BYTES) throw new Error("Material file exceeds the 20 MB limit");
  if (!contentType || !acceptedTypes.includes(contentType.toLowerCase())) {
    throw new Error("Uploaded file type does not match its filename");
  }
}

export function validateExternalUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Material link must be a valid URL");
  }
  if (parsed.protocol !== "https:") throw new Error("Material link must use HTTPS");
}

export async function validateAcademicScope(ctx: DbCtx, input: {
  courseId: Id<"courses">;
  batchId?: Id<"batches">;
  subjectId?: Id<"subjects">;
  visibility: "course" | "batch";
}) {
  const course = await ctx.db.get("courses", input.courseId);
  if (!course || course.status === "archived") throw new Error("Course is unavailable");
  if (input.visibility === "course" && input.batchId) throw new Error("Course materials cannot target a batch");
  if (input.visibility === "batch" && !input.batchId) throw new Error("Batch materials require a batch");
  if (input.batchId) {
    const batch = await ctx.db.get("batches", input.batchId);
    if (!batch || batch.courseId !== input.courseId || batch.status === "archived") throw new Error("Batch is not available in this course");
  }
  if (input.subjectId) {
    const link = await ctx.db.query("courseSubjects").withIndex("by_courseId_and_subjectId", (q) => q.eq("courseId", input.courseId).eq("subjectId", input.subjectId!)).unique();
    if (!link) throw new Error("Subject is not part of this course");
  }
}

export async function requireMaterialManager(ctx: AuthDbCtx, input: {
  courseId: Id<"courses">;
  batchId?: Id<"batches">;
  subjectId?: Id<"subjects">;
  visibility: "course" | "batch";
}) {
  const account = await requireAccount(ctx);
  if (account.role === "owner") return account;
  if (account.role !== "teacher" || input.visibility !== "batch" || !input.batchId) throw new Error("Unauthorized");
  const assignments = await ctx.db.query("teacherBatchAssignments").withIndex("by_teacherId_and_batchId", (q) => q.eq("teacherId", account.teacherId).eq("batchId", input.batchId!)).take(20);
  const assigned = assignments.some((assignment) => assignment.status === "active" && (!input.subjectId || !assignment.subjectId || assignment.subjectId === input.subjectId));
  if (!assigned) throw new Error("Unauthorized");
  return account;
}

export async function canAccessMaterial(ctx: AuthDbCtx, material: Doc<"materials">) {
  const account = await requireAccount(ctx);
  if (account.role === "owner") return true;
  if (account.role === "teacher") {
    if (material.createdByAccountId === account._id) return true;
    if (material.batchId) {
      const assignments = await ctx.db.query("teacherBatchAssignments").withIndex("by_teacherId_and_batchId", (q) => q.eq("teacherId", account.teacherId).eq("batchId", material.batchId!)).take(20);
      return assignments.some((assignment) => assignment.status === "active" && (!material.subjectId || !assignment.subjectId || assignment.subjectId === material.subjectId));
    }
    const assignments = await ctx.db.query("teacherBatchAssignments").withIndex("by_teacherId_and_status", (q) => q.eq("teacherId", account.teacherId).eq("status", "active")).take(100);
    for (const assignment of assignments) {
      const batch = await ctx.db.get("batches", assignment.batchId);
      if (batch?.courseId === material.courseId && (!material.subjectId || !assignment.subjectId || assignment.subjectId === material.subjectId)) return true;
    }
    return false;
  }
  if (material.status !== "published") return false;
  if (material.visibility === "batch") {
    if (!material.batchId) return false;
    const enrolment = await ctx.db.query("enrolments").withIndex("by_studentId_and_batchId", (q) => q.eq("studentId", account.studentId).eq("batchId", material.batchId!)).unique();
    return enrolment?.status === "active";
  }
  const enrolments = await ctx.db.query("enrolments").withIndex("by_studentId_and_status", (q) => q.eq("studentId", account.studentId).eq("status", "active")).take(100);
  return enrolments.some((enrolment) => enrolment.courseId === material.courseId);
}
