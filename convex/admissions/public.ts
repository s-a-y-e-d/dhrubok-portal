import { v } from "convex/values";
import { internalMutation, query } from "../_generated/server";
import { localeValidator } from "../model/validators";
import { enqueueSms } from "../messaging/model";
import { renderSmsTemplate } from "../messaging/templates";
import {
  assertSubmissionKey,
  MAX_PUBLIC_OPTIONS,
  nextApplicationNumber,
  normalizeSubmission,
  publicApplicationReference,
  requireAdmissionsOpen,
  requiredText,
  validateOpenSelection,
} from "./model";

export const applicationReferenceValidator = v.object({
  applicationId: v.id("admissionApplications"),
  applicationNumber: v.string(),
  submittedAt: v.number(),
  replayed: v.boolean(),
});

export const getPreparation = query({
  args: {},
  returns: v.object({ admissionsOpen: v.boolean(), requiresServerChallenge: v.literal(true) }),
  handler: async (ctx) => {
    const settings = await ctx.db.query("coachingSettings").take(2);
    return {
      admissionsOpen: settings.length === 1 && settings[0].publicAdmissionsOpen,
      requiresServerChallenge: true as const,
    };
  },
});

export const listOpenCourses = query({
  args: {},
  returns: v.array(v.object({
    courseId: v.id("courses"),
    slug: v.string(),
    nameBn: v.string(),
    nameEn: v.string(),
    shortDescriptionBn: v.string(),
    shortDescriptionEn: v.string(),
  })),
  handler: async (ctx) => {
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_isPublic_and_status_and_publicSortOrder", (q) => q.eq("isPublic", true).eq("status", "active"))
      .take(MAX_PUBLIC_OPTIONS);
    return courses
      .map((course) => ({
        courseId: course._id,
        slug: course.slug,
        nameBn: course.nameBn,
        nameEn: course.nameEn,
        shortDescriptionBn: course.shortDescriptionBn,
        shortDescriptionEn: course.shortDescriptionEn,
      }));
  },
});

export const listOpenBatches = query({
  args: { courseId: v.id("courses") },
  returns: v.array(v.object({
    batchId: v.id("batches"),
    slug: v.string(),
    nameBn: v.string(),
    nameEn: v.string(),
    startDate: v.union(v.string(), v.null()),
    endDate: v.union(v.string(), v.null()),
  })),
  handler: async (ctx, args) => {
    const course = await ctx.db.get("courses", args.courseId);
    if (!course || course.status !== "active" || !course.isPublic) return [];
    const batches = await ctx.db
      .query("batches")
      .withIndex("by_courseId_and_status", (q) => q.eq("courseId", args.courseId).eq("status", "active"))
      .take(MAX_PUBLIC_OPTIONS);
    return batches
      .filter((batch) => batch.isPublic && batch.admissionOpen)
      .map((batch) => ({
        batchId: batch._id,
        slug: batch.slug,
        nameBn: batch.nameBn,
        nameEn: batch.nameEn,
        startDate: batch.startDate ?? null,
        endDate: batch.endDate ?? null,
      }));
  },
});

// This mutation is the database submission primitive. A production Turnstile
// action must verify the challenge before calling equivalent internal logic.
// The preparation response is explicit about that unresolved server contract.
export const submissionArgs = {
    submissionKey: v.string(),
    honeypot: v.string(),
    locale: localeValidator,
    studentDisplayName: v.string(),
    studentNameBn: v.optional(v.string()),
    studentNameEn: v.optional(v.string()),
    studentEmail: v.string(),
    studentPhone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.string()),
    schoolCollege: v.string(),
    currentClass: v.string(),
    address: v.optional(v.string()),
    guardianName: v.string(),
    guardianPhone: v.string(),
    guardianRelationship: v.string(),
    alternateGuardianPhone: v.optional(v.string()),
    preferredSmsLocale: localeValidator,
    requestedCourseId: v.id("courses"),
    requestedBatchId: v.id("batches"),
    applicantNote: v.optional(v.string()),
} as const;

export const submitVerified = internalMutation({
  args: submissionArgs,
  returns: applicationReferenceValidator,
  handler: async (ctx, args) => {
    const submissionKey = assertSubmissionKey(args.submissionKey);
    const replay = await ctx.db
      .query("admissionApplications")
      .withIndex("by_submissionKey", (q) => q.eq("submissionKey", submissionKey))
      .unique();
    if (replay) return { ...publicApplicationReference(replay), replayed: true };
    if (args.honeypot !== "") throw new Error("Invalid application submission");

    const settings = await requireAdmissionsOpen(ctx);
    await validateOpenSelection(ctx, args.requestedCourseId, args.requestedBatchId);
    const normalized = normalizeSubmission(args);
    const cutoff = Date.now() - 15 * 60 * 1000;
    const [recentEmail, recentGuardian] = await Promise.all([
      ctx.db.query("admissionApplications")
        .withIndex("by_normalizedStudentEmail", (q) => q.eq("normalizedStudentEmail", normalized.normalizedStudentEmail))
        .order("desc").take(4),
      ctx.db.query("admissionApplications")
        .withIndex("by_normalizedGuardianPhone", (q) => q.eq("normalizedGuardianPhone", normalized.normalizedGuardianPhone))
        .order("desc").take(4),
    ]);
    if (
      recentEmail.filter((item) => item.submittedAt >= cutoff).length >= 3 ||
      recentGuardian.filter((item) => item.submittedAt >= cutoff).length >= 3
    ) {
      throw new Error("Too many recent application attempts");
    }

    const now = Date.now();
    const applicationNumber = await nextApplicationNumber(ctx, requiredText(settings.applicationPrefix, "Application prefix", 24));
    const applicationId = await ctx.db.insert("admissionApplications", {
      applicationNumber,
      submittedAt: now,
      locale: args.locale,
      ...normalized,
      preferredSmsLocale: args.preferredSmsLocale,
      requestedCourseId: args.requestedCourseId,
      requestedBatchId: args.requestedBatchId,
      status: "new",
      createdAt: now,
      updatedAt: now,
      submissionKey,
    });
    const template = await ctx.db.query("smsTemplates").withIndex("by_key", (q) => q.eq("key", "admission_received")).unique();
    if (template?.enabled) {
      const rendered = renderSmsTemplate(args.preferredSmsLocale === "bn" ? template.bodyBn : template.bodyEn, {
        studentName: normalized.studentDisplayName,
        applicationNumber,
      });
      if (rendered.missingVariables.length === 0) {
        await enqueueSms(ctx, {
          idempotencyKey: `admission:${applicationId}:received`, eventType: "admission_received",
          relatedEntityType: "admissionApplication", relatedEntityId: applicationId,
          guardianPhone: normalized.guardianPhone, locale: args.preferredSmsLocale, body: rendered.body,
        });
      }
    }
    return { applicationId, applicationNumber, submittedAt: now, replayed: false };
  },
});
