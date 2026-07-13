import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { normalizeBangladeshPhone, normalizeEmail } from "../model/normalization";

type DbCtx = Pick<QueryCtx | MutationCtx, "db">;

export const MAX_PUBLIC_OPTIONS = 100;

export function requiredText(value: string, field: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > maxLength) throw new Error(`${field} is too long`);
  return normalized;
}

export function optionalText(value: string | undefined, field: string, maxLength: number) {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) throw new Error(`${field} is too long`);
  return normalized;
}

export function normalizedOptionalPhone(value: string | undefined) {
  const display = optionalText(value, "Phone", 32);
  return display === undefined ? undefined : normalizeBangladeshPhone(display);
}

export function assertSubmissionKey(value: string) {
  if (value !== value.trim() || value.length < 16 || value.length > 128) {
    throw new Error("Invalid submission key");
  }
  return value;
}

export async function requireAdmissionsOpen(ctx: DbCtx) {
  const settings = await ctx.db.query("coachingSettings").take(2);
  if (settings.length !== 1 || !settings[0].publicAdmissionsOpen) {
    throw new Error("Public admissions are closed");
  }
  return settings[0];
}

export async function validateOpenSelection(
  ctx: DbCtx,
  courseId: Id<"courses">,
  batchId: Id<"batches">,
) {
  const [course, batch] = await Promise.all([
    ctx.db.get("courses", courseId),
    ctx.db.get("batches", batchId),
  ]);
  if (!course || course.status !== "active" || !course.isPublic) {
    throw new Error("Selected course is not open for admission");
  }
  if (
    !batch ||
    batch.courseId !== courseId ||
    batch.status !== "active" ||
    !batch.isPublic ||
    !batch.admissionOpen
  ) {
    throw new Error("Selected batch is not open for admission");
  }
  return { course, batch };
}

export async function validateOwnerSelection(
  ctx: DbCtx,
  courseId: Id<"courses">,
  batchId: Id<"batches">,
) {
  const [course, batch] = await Promise.all([
    ctx.db.get("courses", courseId),
    ctx.db.get("batches", batchId),
  ]);
  if (!course || course.status !== "active") throw new Error("Course is not active");
  if (!batch || batch.courseId !== courseId || batch.status !== "active" || !batch.admissionOpen) {
    throw new Error("Batch is not open for admission");
  }
  return { course, batch };
}

export async function nextApplicationNumber(ctx: MutationCtx, prefix: string) {
  const year = Number(
    new Intl.DateTimeFormat("en", { timeZone: "Asia/Dhaka", year: "numeric" }).format(Date.now()),
  );
  const sequence = await ctx.db
    .query("numberSequences")
    .withIndex("by_key_and_yearScope", (q) => q.eq("key", "application").eq("yearScope", year))
    .unique();
  const value = sequence?.nextValue ?? 1;
  if (sequence) {
    await ctx.db.patch("numberSequences", sequence._id, { nextValue: value + 1, updatedAt: Date.now() });
  } else {
    await ctx.db.insert("numberSequences", {
      key: "application",
      prefix,
      nextValue: value + 1,
      yearScope: year,
      updatedAt: Date.now(),
    });
  }
  return `${prefix}-${year}-${String(value).padStart(6, "0")}`;
}

export function normalizeSubmission(input: {
  studentDisplayName: string;
  studentNameBn?: string;
  studentNameEn?: string;
  studentEmail: string;
  studentPhone?: string;
  dateOfBirth?: string;
  gender?: string;
  schoolCollege: string;
  currentClass: string;
  address?: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelationship: string;
  alternateGuardianPhone?: string;
  motherName?: string;
  motherPhone?: string;
  applicantNote?: string;
}) {
  const studentEmail = requiredText(input.studentEmail, "Student Google email", 254);
  const guardianPhone = requiredText(input.guardianPhone, "Guardian phone", 32);
  return {
    studentDisplayName: requiredText(input.studentDisplayName, "Student name", 120),
    studentNameBn: optionalText(input.studentNameBn, "Bangla student name", 120),
    studentNameEn: optionalText(input.studentNameEn, "English student name", 120),
    studentEmail,
    normalizedStudentEmail: normalizeEmail(studentEmail),
    studentPhone: normalizedOptionalPhone(input.studentPhone),
    dateOfBirth: optionalText(input.dateOfBirth, "Date of birth", 10),
    gender: optionalText(input.gender, "Gender", 32),
    schoolCollege: requiredText(input.schoolCollege, "School or college", 160),
    currentClass: requiredText(input.currentClass, "Current class", 80),
    address: optionalText(input.address, "Address", 500),
    guardianName: requiredText(input.guardianName, "Guardian name", 120),
    guardianPhone,
    normalizedGuardianPhone: normalizeBangladeshPhone(guardianPhone),
    guardianRelationship: requiredText(input.guardianRelationship, "Guardian relationship", 80),
    alternateGuardianPhone: normalizedOptionalPhone(input.alternateGuardianPhone),
    motherName: optionalText(input.motherName, "Mother name", 120),
    motherPhone: normalizedOptionalPhone(input.motherPhone),
    applicantNote: optionalText(input.applicantNote, "Applicant note", 1000),
  };
}

export function publicApplicationReference(application: Doc<"admissionApplications">) {
  return {
    applicationId: application._id,
    applicationNumber: application.applicationNumber,
    submittedAt: application.submittedAt,
    replayed: false,
  };
}
