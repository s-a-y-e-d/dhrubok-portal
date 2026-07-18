import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import { scheduleCourseSnapshot } from "../academics/snapshotHooks";
import { assertLocalDate, dhakaDate } from "../model/dates";
import { assertMinorUnits } from "../model/money";
import { enqueueSms } from "../messaging/model";
import { renderSmsTemplate } from "../messaging/templates";
import {
  normalizeSubmission,
  optionalText,
  requiredText,
  validateOwnerSelection,
} from "./model";
import { paginationResultFields } from "../model/validators";
import {
  assertPeriodKey,
  materializeEnrolmentMonths,
  postCollection,
} from "../fees/model";

const applicationStatusValidator = v.union(
  v.literal("new"),
  v.literal("under_review"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("withdrawn"),
);

const inboxItemValidator = v.object({
  applicationId: v.id("admissionApplications"),
  applicationNumber: v.string(),
  submittedAt: v.number(),
  studentDisplayName: v.string(),
  studentEmail: v.string(),
  guardianName: v.string(),
  guardianPhone: v.string(),
  requestedCourseId: v.id("courses"),
  requestedBatchId: v.id("batches"),
  status: applicationStatusValidator,
});

const candidateValidator = v.object({
  kind: v.union(v.literal("application"), v.literal("student")),
  id: v.string(),
  reference: v.string(),
  displayName: v.string(),
  status: v.string(),
});

const applicationDetailValidator = v.object({
  applicationId: v.id("admissionApplications"),
  applicationNumber: v.string(),
  submittedAt: v.number(),
  locale: v.union(v.literal("bn"), v.literal("en")),
  studentDisplayName: v.string(),
  studentNameBn: v.union(v.string(), v.null()),
  studentNameEn: v.union(v.string(), v.null()),
  studentEmail: v.string(),
  studentPhone: v.union(v.string(), v.null()),
  dateOfBirth: v.union(v.string(), v.null()),
  gender: v.union(v.string(), v.null()),
  schoolCollege: v.string(),
  currentClass: v.string(),
  address: v.union(v.string(), v.null()),
  guardianName: v.string(),
  guardianPhone: v.string(),
  guardianRelationship: v.string(),
  alternateGuardianPhone: v.union(v.string(), v.null()),
  motherName: v.union(v.string(), v.null()),
  motherPhone: v.union(v.string(), v.null()),
  preferredSmsLocale: v.union(v.literal("bn"), v.literal("en")),
  requestedCourseId: v.id("courses"),
  requestedBatchId: v.id("batches"),
  applicantNote: v.union(v.string(), v.null()),
  status: applicationStatusValidator,
  reviewedByAccountId: v.union(v.id("portalAccounts"), v.null()),
  reviewedAt: v.union(v.number(), v.null()),
  rejectionReason: v.union(v.string(), v.null()),
  acceptedStudentId: v.union(v.id("students"), v.null()),
  duplicateCandidates: v.array(candidateValidator),
});

function assertReviewable(status: string) {
  if (status !== "new" && status !== "under_review") {
    throw new Error("Application is no longer reviewable");
  }
}

export const listApplications = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: applicationStatusValidator,
  },
  returns: v.object({
    page: v.array(inboxItemValidator),
    ...paginationResultFields,
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const result = await ctx.db
      .query("admissionApplications")
      .withIndex("by_status_and_submittedAt", (q) =>
        q.eq("status", args.status),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((application) => ({
        applicationId: application._id,
        applicationNumber: application.applicationNumber,
        submittedAt: application.submittedAt,
        studentDisplayName: application.studentDisplayName,
        studentEmail: application.studentEmail,
        guardianName: application.guardianName,
        guardianPhone: application.guardianPhone,
        requestedCourseId: application.requestedCourseId,
        requestedBatchId: application.requestedBatchId,
        status: application.status,
      })),
    };
  },
});

export const getApplication = query({
  args: { applicationId: v.id("admissionApplications") },
  returns: v.union(applicationDetailValidator, v.null()),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const application = await ctx.db.get(
      "admissionApplications",
      args.applicationId,
    );
    if (!application) return null;
    const [emailApplications, phoneApplications, emailStudents, phoneStudents] =
      await Promise.all([
        ctx.db
          .query("admissionApplications")
          .withIndex("by_normalizedStudentEmail", (q) =>
            q.eq("normalizedStudentEmail", application.normalizedStudentEmail),
          )
          .order("desc")
          .take(6),
        ctx.db
          .query("admissionApplications")
          .withIndex("by_normalizedGuardianPhone", (q) =>
            q.eq(
              "normalizedGuardianPhone",
              application.normalizedGuardianPhone,
            ),
          )
          .order("desc")
          .take(6),
        ctx.db
          .query("students")
          .withIndex("by_normalizedLoginEmail", (q) =>
            q.eq("normalizedLoginEmail", application.normalizedStudentEmail),
          )
          .take(5),
        ctx.db
          .query("students")
          .withIndex("by_normalizedGuardianPhone", (q) =>
            q.eq(
              "normalizedGuardianPhone",
              application.normalizedGuardianPhone,
            ),
          )
          .take(5),
      ]);

    const candidateMap = new Map<
      string,
      {
        kind: "application" | "student";
        id: string;
        reference: string;
        displayName: string;
        status: string;
      }
    >();
    for (const candidate of [...emailApplications, ...phoneApplications]) {
      if (candidate._id === application._id) continue;
      candidateMap.set(`application:${candidate._id}`, {
        kind: "application",
        id: candidate._id,
        reference: candidate.applicationNumber,
        displayName: candidate.studentDisplayName,
        status: candidate.status,
      });
    }
    for (const candidate of [...emailStudents, ...phoneStudents]) {
      candidateMap.set(`student:${candidate._id}`, {
        kind: "student",
        id: candidate._id,
        reference: candidate.studentNumber,
        displayName: candidate.displayName,
        status: candidate.status,
      });
    }

    return {
      applicationId: application._id,
      applicationNumber: application.applicationNumber,
      submittedAt: application.submittedAt,
      locale: application.locale,
      studentDisplayName: application.studentDisplayName,
      studentNameBn: application.studentNameBn ?? null,
      studentNameEn: application.studentNameEn ?? null,
      studentEmail: application.studentEmail,
      studentPhone: application.studentPhone ?? null,
      dateOfBirth: application.dateOfBirth ?? null,
      gender: application.gender ?? null,
      schoolCollege: application.schoolCollege,
      currentClass: application.currentClass,
      address: application.address ?? null,
      guardianName: application.guardianName,
      guardianPhone: application.guardianPhone,
      guardianRelationship: application.guardianRelationship,
      alternateGuardianPhone: application.alternateGuardianPhone ?? null,
      motherName: application.motherName ?? null,
      motherPhone: application.motherPhone ?? null,
      preferredSmsLocale: application.preferredSmsLocale,
      requestedCourseId: application.requestedCourseId,
      requestedBatchId: application.requestedBatchId,
      applicantNote: application.applicantNote ?? null,
      status: application.status,
      reviewedByAccountId: application.reviewedByAccountId ?? null,
      reviewedAt: application.reviewedAt ?? null,
      rejectionReason: application.rejectionReason ?? null,
      acceptedStudentId: application.acceptedStudentId ?? null,
      duplicateCandidates: [...candidateMap.values()].slice(0, 10),
    };
  },
});

export const setReviewState = mutation({
  args: {
    applicationId: v.id("admissionApplications"),
    status: v.union(v.literal("new"), v.literal("under_review")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const application = await ctx.db.get(
      "admissionApplications",
      args.applicationId,
    );
    if (!application) throw new Error("Application not found");
    assertReviewable(application.status);
    const now = Date.now();
    await ctx.db.patch("admissionApplications", application._id, {
      status: args.status,
      reviewedByAccountId: account._id,
      reviewedAt: now,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "admission.review_state_changed",
      entityType: "admissionApplication",
      entityId: application._id,
      summary: "Admission application review state changed",
      metadata: { status: args.status },
    });
    return null;
  },
});

export const adjustRequestedSelection = mutation({
  args: {
    applicationId: v.id("admissionApplications"),
    requestedCourseId: v.id("courses"),
    requestedBatchId: v.id("batches"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const application = await ctx.db.get(
      "admissionApplications",
      args.applicationId,
    );
    if (!application) throw new Error("Application not found");
    assertReviewable(application.status);
    await validateOwnerSelection(
      ctx,
      args.requestedCourseId,
      args.requestedBatchId,
    );
    const now = Date.now();
    await ctx.db.patch("admissionApplications", application._id, {
      requestedCourseId: args.requestedCourseId,
      requestedBatchId: args.requestedBatchId,
      status: "under_review",
      reviewedByAccountId: account._id,
      reviewedAt: now,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "admission.requested_selection_changed",
      entityType: "admissionApplication",
      entityId: application._id,
      summary: "Requested course and batch changed during review",
      metadata: {
        previousCourseId: application.requestedCourseId,
        previousBatchId: application.requestedBatchId,
        requestedCourseId: args.requestedCourseId,
        requestedBatchId: args.requestedBatchId,
      },
    });
    return null;
  },
});

export const rejectApplication = mutation({
  args: { applicationId: v.id("admissionApplications"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const application = await ctx.db.get(
      "admissionApplications",
      args.applicationId,
    );
    if (!application) throw new Error("Application not found");
    assertReviewable(application.status);
    const reason = requiredText(args.reason, "Rejection reason", 500);
    const now = Date.now();
    await ctx.db.patch("admissionApplications", application._id, {
      status: "rejected",
      reviewedByAccountId: account._id,
      reviewedAt: now,
      rejectionReason: reason,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "admission.rejected",
      entityType: "admissionApplication",
      entityId: application._id,
      summary: "Admission application rejected",
      metadata: { reason },
    });
    return null;
  },
});

export const withdrawApplication = mutation({
  args: {
    applicationId: v.id("admissionApplications"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const application = await ctx.db.get(
      "admissionApplications",
      args.applicationId,
    );
    if (!application) throw new Error("Application not found");
    assertReviewable(application.status);
    const reason = optionalText(args.reason, "Withdrawal reason", 500);
    const now = Date.now();
    await ctx.db.patch("admissionApplications", application._id, {
      status: "withdrawn",
      reviewedByAccountId: account._id,
      reviewedAt: now,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "admission.withdrawn",
      entityType: "admissionApplication",
      entityId: application._id,
      summary: "Admission application withdrawn",
      metadata: reason ? { reason } : undefined,
    });
    return null;
  },
});

export const acceptApplication = mutation({
  args: {
    applicationId: v.id("admissionApplications"),
    conversionKey: v.string(),
    studentNumber: v.string(),
    admissionDate: v.string(),
    confirmedCourseId: v.id("courses"),
    confirmedBatchId: v.id("batches"),
    agreedMonthlyAmountMinor: v.number(),
    admissionFeeMinor: v.number(),
    firstBillingMonth: v.string(),
    internalNote: v.optional(v.string()),
  },
  returns: v.object({
    studentId: v.id("students"),
    enrolmentId: v.id("enrolments"),
    collectionId: v.union(v.id("feeCollections"), v.null()),
    receiptNumber: v.union(v.string(), v.null()),
    replayed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const application = await ctx.db.get(
      "admissionApplications",
      args.applicationId,
    );
    if (!application) throw new Error("Application not found");
    if (application.status === "accepted" && application.acceptedStudentId) {
      const acceptedStudentId = application.acceptedStudentId;
      const enrolment = await ctx.db
        .query("enrolments")
        .withIndex("by_studentId_and_status", (q) =>
          q.eq("studentId", acceptedStudentId).eq("status", "active"),
        )
        .take(1);
      if (!enrolment[0])
        throw new Error("Accepted application has no active enrolment");
      const admissionCollection = (
        await ctx.db
          .query("feeCollections")
          .withIndex("by_studentId_and_collectedOn", (q) =>
            q.eq("studentId", acceptedStudentId),
          )
          .take(20)
      ).find((collection) => collection.collectionType === "admission");
      return {
        studentId: acceptedStudentId,
        enrolmentId: enrolment[0]._id,
        collectionId: admissionCollection?._id ?? null,
        receiptNumber: admissionCollection?.receiptNumber ?? null,
        replayed: true,
      };
    }
    assertReviewable(application.status);
    const conversionKey = requiredText(
      args.conversionKey,
      "Conversion key",
      128,
    );
    if (conversionKey.length < 16)
      throw new Error("Conversion key is too short");
    const duplicateConversion = await ctx.db
      .query("admissionApplications")
      .withIndex("by_conversionKey", (q) =>
        q.eq("conversionKey", conversionKey),
      )
      .unique();
    if (duplicateConversion && duplicateConversion._id !== application._id)
      throw new Error("Conversion key is already used");
    assertLocalDate(args.admissionDate);
    const studentNumber = requiredText(
      args.studentNumber,
      "Student number",
      40,
    );
    if (
      await ctx.db
        .query("students")
        .withIndex("by_studentNumber", (q) =>
          q.eq("studentNumber", studentNumber),
        )
        .unique()
    )
      throw new Error("Student number is already used");
    if (
      await ctx.db
        .query("students")
        .withIndex("by_normalizedLoginEmail", (q) =>
          q.eq("normalizedLoginEmail", application.normalizedStudentEmail),
        )
        .unique()
    )
      throw new Error("Student Google email is already admitted");
    if (
      await ctx.db
        .query("portalAccounts")
        .withIndex("by_normalizedLoginEmail", (q) =>
          q.eq("normalizedLoginEmail", application.normalizedStudentEmail),
        )
        .unique()
    )
      throw new Error("Student Google email already has portal access");
    const { course, batch } = await validateOwnerSelection(
      ctx,
      args.confirmedCourseId,
      args.confirmedBatchId,
    );
    assertMinorUnits(args.agreedMonthlyAmountMinor, "agreedMonthlyAmountMinor");
    if (args.agreedMonthlyAmountMinor <= 0)
      throw new Error("Monthly fee must be greater than zero");
    assertMinorUnits(args.admissionFeeMinor, "admissionFeeMinor");
    assertPeriodKey(args.firstBillingMonth);
    if (args.firstBillingMonth < args.admissionDate.slice(0, 7))
      throw new Error("First billing month cannot be before admission");
    const now = Date.now();
    const studentId = await ctx.db.insert("students", {
      studentNumber,
      displayName: application.studentDisplayName,
      nameBn: application.studentNameBn,
      nameEn: application.studentNameEn,
      loginEmail: application.studentEmail,
      normalizedLoginEmail: application.normalizedStudentEmail,
      phone: application.studentPhone,
      dateOfBirth: application.dateOfBirth,
      gender: application.gender,
      schoolCollege: application.schoolCollege,
      currentClass: application.currentClass,
      address: application.address,
      photoStorageId: application.photoStorageId,
      guardianName: application.guardianName,
      guardianPhone: application.guardianPhone,
      normalizedGuardianPhone: application.normalizedGuardianPhone,
      guardianRelationship: application.guardianRelationship,
      alternateGuardianPhone: application.alternateGuardianPhone,
      preferredSmsLocale: application.preferredSmsLocale,
      motherName: application.motherName,
      motherPhone: application.motherPhone,
      admissionDate: args.admissionDate,
      status: "active",
      sourceApplicationId: application._id,
      internalNote: optionalText(args.internalNote, "Internal note", 2000),
      searchText:
        `${studentNumber} ${application.studentDisplayName} ${application.studentEmail}`.toLowerCase(),
      createdAt: now,
      updatedAt: now,
      createdByAccountId: account._id,
      updatedByAccountId: account._id,
    });
    const enrolmentId = await ctx.db.insert("enrolments", {
      studentId,
      courseId: course._id,
      batchId: batch._id,
      enrolledOn: args.admissionDate,
      status: "active",
      agreedMonthlyAmountMinor: args.agreedMonthlyAmountMinor,
      firstBillingMonth: args.firstBillingMonth,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: account._id,
    });
    await ctx.db.insert("portalAccounts", {
      role: "student",
      status: "reserved",
      loginEmail: application.studentEmail,
      normalizedLoginEmail: application.normalizedStudentEmail,
      studentId,
      locale: application.locale,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: account._id,
    });
    const enrolment = await ctx.db.get("enrolments", enrolmentId);
    if (!enrolment) throw new Error("Enrolment was not created");
    await materializeEnrolmentMonths(ctx, enrolment, dhakaDate().slice(0, 7));
    const admissionCollection =
      args.admissionFeeMinor > 0
        ? await postCollection(ctx, {
            studentId,
            collectionType: "admission",
            collectedOn: args.admissionDate,
            collectedByAccountId: account._id,
            items: [
              {
                itemType: "admission",
                description: "Admission Fee",
                amountMinor: args.admissionFeeMinor,
              },
            ],
          })
        : null;
    const today = dhakaDate();
    const dailySummary = await ctx.db
      .query("dailyOperationalSummaries")
      .withIndex("by_date", (q) => q.eq("date", today))
      .unique();
    if (dailySummary) {
      await ctx.db.patch(dailySummary._id, {
        activeStudentCount: dailySummary.activeStudentCount + 1,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch("admissionApplications", application._id, {
      status: "accepted",
      acceptedStudentId: studentId,
      conversionKey,
      reviewedByAccountId: account._id,
      reviewedAt: now,
      updatedAt: now,
    });
    const template = await ctx.db
      .query("smsTemplates")
      .withIndex("by_key", (q) => q.eq("key", "admission_accepted"))
      .unique();
    if (template?.enabled) {
      const rendered = renderSmsTemplate(
        application.preferredSmsLocale === "bn"
          ? template.bodyBn
          : template.bodyEn,
        { studentName: application.studentDisplayName, studentNumber },
      );
      if (rendered.missingVariables.length === 0)
        await enqueueSms(ctx, {
          idempotencyKey: `admission:${application._id}:accepted`,
          eventType: "admission_accepted",
          relatedEntityType: "admissionApplication",
          relatedEntityId: application._id,
          studentId,
          guardianPhone: application.guardianPhone,
          locale: application.preferredSmsLocale,
          body: rendered.body,
        });
    }
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "admission.accepted",
      entityType: "admissionApplication",
      entityId: application._id,
      summary: "Application converted to an active student",
      metadata: {
        studentId,
        enrolmentId,
        courseId: course._id,
        batchId: batch._id,
      },
    });
    await scheduleCourseSnapshot(ctx, course._id);
    return {
      studentId,
      enrolmentId,
      collectionId: admissionCollection?.collectionId ?? null,
      receiptNumber: admissionCollection?.receiptNumber ?? null,
      replayed: false,
    };
  },
});

export const createDirectAdmission = mutation({
  args: {
    studentNumber: v.string(),
    admissionDate: v.string(),
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
    preferredSmsLocale: v.union(v.literal("bn"), v.literal("en")),
    courseId: v.id("courses"),
    batchId: v.id("batches"),
    agreedMonthlyAmountMinor: v.number(),
    firstBillingMonth: v.string(),
    internalNote: v.optional(v.string()),
    initialAdmissionFeeMinor: v.number(),
  },
  returns: v.object({
    studentId: v.id("students"),
    enrolmentId: v.id("enrolments"),
    collectionId: v.union(v.id("feeCollections"), v.null()),
    receiptNumber: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    assertLocalDate(args.admissionDate);
    const studentNumber = requiredText(
      args.studentNumber,
      "Student number",
      40,
    );
    const profile = normalizeSubmission(args);
    if (profile.dateOfBirth) assertLocalDate(profile.dateOfBirth);
    if (
      await ctx.db
        .query("students")
        .withIndex("by_studentNumber", (q) =>
          q.eq("studentNumber", studentNumber),
        )
        .unique()
    )
      throw new Error("Student number is already used");
    if (
      await ctx.db
        .query("students")
        .withIndex("by_normalizedLoginEmail", (q) =>
          q.eq("normalizedLoginEmail", profile.normalizedStudentEmail),
        )
        .unique()
    )
      throw new Error("Student Google email is already admitted");
    if (
      await ctx.db
        .query("portalAccounts")
        .withIndex("by_normalizedLoginEmail", (q) =>
          q.eq("normalizedLoginEmail", profile.normalizedStudentEmail),
        )
        .unique()
    )
      throw new Error("Student Google email already has portal access");
    const { course, batch } = await validateOwnerSelection(
      ctx,
      args.courseId,
      args.batchId,
    );
    assertMinorUnits(args.agreedMonthlyAmountMinor, "agreedMonthlyAmountMinor");
    if (args.agreedMonthlyAmountMinor <= 0)
      throw new Error("Monthly fee must be greater than zero");
    assertMinorUnits(args.initialAdmissionFeeMinor, "initialAdmissionFeeMinor");
    assertPeriodKey(args.firstBillingMonth);
    if (args.firstBillingMonth < args.admissionDate.slice(0, 7))
      throw new Error("First billing month cannot be before admission");
    const now = Date.now();
    const studentId = await ctx.db.insert("students", {
      studentNumber,
      displayName: profile.studentDisplayName,
      nameBn: profile.studentNameBn,
      nameEn: profile.studentNameEn,
      loginEmail: profile.studentEmail,
      normalizedLoginEmail: profile.normalizedStudentEmail,
      phone: profile.studentPhone,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      schoolCollege: profile.schoolCollege,
      currentClass: profile.currentClass,
      address: profile.address,
      guardianName: profile.guardianName,
      guardianPhone: profile.guardianPhone,
      normalizedGuardianPhone: profile.normalizedGuardianPhone,
      guardianRelationship: profile.guardianRelationship,
      alternateGuardianPhone: profile.alternateGuardianPhone,
      motherName: profile.motherName,
      motherPhone: profile.motherPhone,
      preferredSmsLocale: args.preferredSmsLocale,
      admissionDate: args.admissionDate,
      status: "active",
      internalNote: optionalText(args.internalNote, "Internal note", 2000),
      searchText:
        `${studentNumber} ${profile.studentDisplayName} ${profile.studentEmail}`.toLowerCase(),
      createdAt: now,
      updatedAt: now,
      createdByAccountId: account._id,
      updatedByAccountId: account._id,
    });
    const enrolmentId = await ctx.db.insert("enrolments", {
      studentId,
      courseId: course._id,
      batchId: batch._id,
      enrolledOn: args.admissionDate,
      status: "active",
      agreedMonthlyAmountMinor: args.agreedMonthlyAmountMinor,
      firstBillingMonth: args.firstBillingMonth,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: account._id,
    });
    await scheduleCourseSnapshot(ctx, course._id);
    await ctx.db.insert("portalAccounts", {
      role: "student",
      status: "reserved",
      loginEmail: profile.studentEmail,
      normalizedLoginEmail: profile.normalizedStudentEmail,
      studentId,
      locale: args.preferredSmsLocale,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: account._id,
    });
    const enrolment = await ctx.db.get("enrolments", enrolmentId);
    if (!enrolment) throw new Error("Enrolment was not created");
    await materializeEnrolmentMonths(ctx, enrolment, dhakaDate().slice(0, 7));
    const admissionCollection =
      args.initialAdmissionFeeMinor > 0
        ? await postCollection(ctx, {
            studentId,
            collectionType: "admission",
            collectedOn: args.admissionDate,
            collectedByAccountId: account._id,
            items: [
              {
                itemType: "admission",
                description: "Admission Fee",
                amountMinor: args.initialAdmissionFeeMinor,
              },
            ],
          })
        : null;
    const today = dhakaDate();
    const dailySummary = await ctx.db
      .query("dailyOperationalSummaries")
      .withIndex("by_date", (q) => q.eq("date", today))
      .unique();
    if (dailySummary) {
      await ctx.db.patch(dailySummary._id, {
        activeStudentCount: dailySummary.activeStudentCount + 1,
        updatedAt: Date.now(),
      });
    }
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "student.directly_admitted",
      entityType: "student",
      entityId: studentId,
      summary: "Student directly admitted by owner",
      metadata: { enrolmentId, courseId: course._id, batchId: batch._id },
    });
    return {
      studentId,
      enrolmentId,
      collectionId: admissionCollection?.collectionId ?? null,
      receiptNumber: admissionCollection?.receiptNumber ?? null,
    };
  },
});
