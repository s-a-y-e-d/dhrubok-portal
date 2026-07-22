import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { localeValidator } from "../model/validators";
import { enqueueSms, renderEnabledSmsTemplate } from "../messaging/model";
import {
  assertSubmissionKey,
  nextApplicationNumber,
  normalizeSubmission,
  publicApplicationReference,
  requireAdmissionsOpen,
  requiredText,
} from "./model";

export const applicationReferenceValidator = v.object({
  applicationId: v.id("admissionApplications"),
  applicationNumber: v.string(),
  submittedAt: v.number(),
  replayed: v.boolean(),
});

export const getPreparation = query({
  args: {},
  returns: v.object({ admissionsOpen: v.boolean(), requiresServerChallenge: v.literal(false) }),
  handler: async (ctx) => {
    const settings = await ctx.db.query("coachingSettings").take(2);
    return {
      admissionsOpen: settings.length === 1 && settings[0].publicAdmissionsOpen,
      requiresServerChallenge: false as const,
    };
  },
});

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
    motherName: v.optional(v.string()),
    motherPhone: v.optional(v.string()),
    preferredSmsLocale: localeValidator,
    applicantNote: v.optional(v.string()),
} as const;

export const submit = mutation({
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
      status: "new",
      createdAt: now,
      updatedAt: now,
      submissionKey,
    });
    const body = await renderEnabledSmsTemplate(ctx, "admission_received", args.preferredSmsLocale, {
      brand: args.preferredSmsLocale === "bn" ? settings.shortNameBn : settings.shortNameEn,
      studentName: normalized.studentDisplayName,
      applicationNumber,
    });
    if (body) {
      await enqueueSms(ctx, {
          idempotencyKey: `admission:${applicationId}:received`, eventType: "admission_received",
          relatedEntityType: "admissionApplication", relatedEntityId: applicationId,
          guardianPhone: normalized.guardianPhone, locale: args.preferredSmsLocale, body,
      });
    }
    return { applicationId, applicationNumber, submittedAt: now, replayed: false };
  },
});
