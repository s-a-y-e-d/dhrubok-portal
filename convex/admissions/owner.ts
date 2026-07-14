import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import { scheduleCourseSnapshot } from "../academics/snapshotHooks";
import { assertLocalDate, dhakaDate } from "../model/dates";
import { assertMinorUnits, percentageDiscount } from "../model/money";
import { nextIdentifier } from "../model/identifiers";
import { chargeTypeValidator } from "../model/validators";
import { refreshFinancialSummary } from "../finance/model";
import { enqueueSms } from "../messaging/model";
import { renderSmsTemplate } from "../messaging/templates";
import { normalizeSubmission, optionalText, requiredText, validateOwnerSelection } from "./model";
import { paginationResultFields } from "../model/validators";

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
  args: { paginationOpts: paginationOptsValidator, status: applicationStatusValidator },
  returns: v.object({
    page: v.array(inboxItemValidator),
    ...paginationResultFields,
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const result = await ctx.db
      .query("admissionApplications")
      .withIndex("by_status_and_submittedAt", (q) => q.eq("status", args.status))
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
    const application = await ctx.db.get("admissionApplications", args.applicationId);
    if (!application) return null;
    const [emailApplications, phoneApplications, emailStudents, phoneStudents] = await Promise.all([
      ctx.db.query("admissionApplications")
        .withIndex("by_normalizedStudentEmail", (q) => q.eq("normalizedStudentEmail", application.normalizedStudentEmail))
        .order("desc").take(6),
      ctx.db.query("admissionApplications")
        .withIndex("by_normalizedGuardianPhone", (q) => q.eq("normalizedGuardianPhone", application.normalizedGuardianPhone))
        .order("desc").take(6),
      ctx.db.query("students")
        .withIndex("by_normalizedLoginEmail", (q) => q.eq("normalizedLoginEmail", application.normalizedStudentEmail))
        .take(5),
      ctx.db.query("students")
        .withIndex("by_normalizedGuardianPhone", (q) => q.eq("normalizedGuardianPhone", application.normalizedGuardianPhone))
        .take(5),
    ]);

    const candidateMap = new Map<string, { kind: "application" | "student"; id: string; reference: string; displayName: string; status: string }>();
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
    const application = await ctx.db.get("admissionApplications", args.applicationId);
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
    const application = await ctx.db.get("admissionApplications", args.applicationId);
    if (!application) throw new Error("Application not found");
    assertReviewable(application.status);
    await validateOwnerSelection(ctx, args.requestedCourseId, args.requestedBatchId);
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
    const application = await ctx.db.get("admissionApplications", args.applicationId);
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
  args: { applicationId: v.id("admissionApplications"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const application = await ctx.db.get("admissionApplications", args.applicationId);
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
    applicationId: v.id("admissionApplications"), conversionKey: v.string(), studentNumber: v.string(), rollNumber: v.optional(v.string()),
    admissionDate: v.string(), confirmedCourseId: v.id("courses"), confirmedBatchId: v.id("batches"), feePlanId: v.optional(v.id("feePlans")),
    agreedMonthlyAmountMinor: v.optional(v.number()), agreedCourseAmountMinor: v.optional(v.number()), internalNote: v.optional(v.string()),
    discounts: v.array(v.object({ feePlanItemId: v.optional(v.id("feePlanItems")), kind: v.union(v.literal("fixed"), v.literal("percentage")), valueMinor: v.optional(v.number()), percentageBasisPoints: v.optional(v.number()), reason: v.string(), startsOn: v.string(), endsOn: v.optional(v.string()) })),
    initialCharges: v.array(v.object({ type: chargeTypeValidator, descriptionBn: v.string(), descriptionEn: v.string(), amountMinor: v.number(), dueDate: v.string() })),
  },
  returns: v.object({ studentId: v.id("students"), enrolmentId: v.id("enrolments"), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const application = await ctx.db.get("admissionApplications", args.applicationId);
    if (!application) throw new Error("Application not found");
    if (application.status === "accepted" && application.acceptedStudentId) {
      const acceptedStudentId = application.acceptedStudentId;
      const enrolment = await ctx.db.query("enrolments").withIndex("by_studentId_and_status", (q) => q.eq("studentId", acceptedStudentId).eq("status", "active")).take(1);
      if (!enrolment[0]) throw new Error("Accepted application has no active enrolment");
      return { studentId: acceptedStudentId, enrolmentId: enrolment[0]._id, replayed: true };
    }
    assertReviewable(application.status);
    const conversionKey = requiredText(args.conversionKey, "Conversion key", 128);
    if (conversionKey.length < 16) throw new Error("Conversion key is too short");
    const duplicateConversion = await ctx.db.query("admissionApplications").withIndex("by_conversionKey", (q) => q.eq("conversionKey", conversionKey)).unique();
    if (duplicateConversion && duplicateConversion._id !== application._id) throw new Error("Conversion key is already used");
    assertLocalDate(args.admissionDate);
    const studentNumber = requiredText(args.studentNumber, "Student number", 40);
    if (await ctx.db.query("students").withIndex("by_studentNumber", (q) => q.eq("studentNumber", studentNumber)).unique()) throw new Error("Student number is already used");
    if (await ctx.db.query("students").withIndex("by_normalizedLoginEmail", (q) => q.eq("normalizedLoginEmail", application.normalizedStudentEmail)).unique()) throw new Error("Student Google email is already admitted");
    if (await ctx.db.query("portalAccounts").withIndex("by_normalizedLoginEmail", (q) => q.eq("normalizedLoginEmail", application.normalizedStudentEmail)).unique()) throw new Error("Student Google email already has portal access");
    const { course, batch } = await validateOwnerSelection(ctx, args.confirmedCourseId, args.confirmedBatchId);
    if (args.feePlanId) {
      const feePlan = await ctx.db.get("feePlans", args.feePlanId);
      if (!feePlan || feePlan.status !== "active" || (feePlan.courseId && feePlan.courseId !== course._id) || (feePlan.batchId && feePlan.batchId !== batch._id)) throw new Error("Fee plan does not match the enrolment");
    }
    if (args.agreedMonthlyAmountMinor !== undefined) assertMinorUnits(args.agreedMonthlyAmountMinor, "agreedMonthlyAmountMinor");
    if (args.agreedCourseAmountMinor !== undefined) assertMinorUnits(args.agreedCourseAmountMinor, "agreedCourseAmountMinor");
    if (args.discounts.length > 20 || args.initialCharges.length > 20) throw new Error("Too many admission financial items");
    const now = Date.now();
    const studentId = await ctx.db.insert("students", {
      studentNumber, rollNumber: optionalText(args.rollNumber, "Roll number", 40), displayName: application.studentDisplayName,
      nameBn: application.studentNameBn, nameEn: application.studentNameEn, loginEmail: application.studentEmail,
      normalizedLoginEmail: application.normalizedStudentEmail, phone: application.studentPhone, dateOfBirth: application.dateOfBirth,
      gender: application.gender, schoolCollege: application.schoolCollege, currentClass: application.currentClass, address: application.address,
      photoStorageId: application.photoStorageId, guardianName: application.guardianName, guardianPhone: application.guardianPhone,
      normalizedGuardianPhone: application.normalizedGuardianPhone, guardianRelationship: application.guardianRelationship,
      alternateGuardianPhone: application.alternateGuardianPhone, preferredSmsLocale: application.preferredSmsLocale,
      motherName: application.motherName, motherPhone: application.motherPhone,
      admissionDate: args.admissionDate, status: "active", sourceApplicationId: application._id,
      internalNote: optionalText(args.internalNote, "Internal note", 2000),
      searchText: `${studentNumber} ${application.studentDisplayName} ${application.studentEmail}`.toLowerCase(),
      createdAt: now, updatedAt: now, createdByAccountId: account._id, updatedByAccountId: account._id,
    });
    const enrolmentId = await ctx.db.insert("enrolments", {
      studentId, courseId: course._id, batchId: batch._id, academicSessionId: batch.academicSessionId,
      enrolledOn: args.admissionDate, status: "active", feePlanId: args.feePlanId,
      agreedMonthlyAmountMinor: args.agreedMonthlyAmountMinor, agreedCourseAmountMinor: args.agreedCourseAmountMinor,
      createdAt: now, updatedAt: now, createdByAccountId: account._id,
    });
    await ctx.db.insert("portalAccounts", {
      role: "student", status: "reserved", loginEmail: application.studentEmail, normalizedLoginEmail: application.normalizedStudentEmail,
      studentId, locale: application.locale, createdAt: now, updatedAt: now, createdByAccountId: account._id,
    });
    for (const discount of args.discounts) {
      assertLocalDate(discount.startsOn);
      if (discount.endsOn) assertLocalDate(discount.endsOn);
      if (discount.kind === "fixed") assertMinorUnits(discount.valueMinor ?? -1, "valueMinor");
      else percentageDiscount(100, discount.percentageBasisPoints ?? -1);
      await ctx.db.insert("discountPolicies", { studentId, enrolmentId, feePlanItemId: discount.feePlanItemId, kind: discount.kind, valueMinor: discount.valueMinor, percentageBasisPoints: discount.percentageBasisPoints, reason: requiredText(discount.reason, "Discount reason", 500), startsOn: discount.startsOn, endsOn: discount.endsOn, status: "active", approvedByAccountId: account._id, createdAt: now });
    }
    const year = Number(args.admissionDate.slice(0, 4));
    for (const [index, charge] of args.initialCharges.entries()) {
      assertMinorUnits(charge.amountMinor);
      if (charge.amountMinor === 0) throw new Error("Initial charge must be greater than zero");
      assertLocalDate(charge.dueDate);
      await ctx.db.insert("studentCharges", {
        chargeNumber: await nextIdentifier(ctx, "charge", "CHG", year), studentId, enrolmentId, type: charge.type,
        descriptionBn: requiredText(charge.descriptionBn, "Bangla charge description", 300), descriptionEn: requiredText(charge.descriptionEn, "English charge description", 300),
        originalAmountMinor: charge.amountMinor, discountAmountMinor: 0, netAmountMinor: charge.amountMinor, paidAmountMinor: 0,
        dueDate: charge.dueDate, status: charge.dueDate <= dhakaDate() ? "due" : "upcoming",
        generationKey: `admission:${conversionKey}:${index}`, createdAt: now, createdByAccountId: account._id,
      });
    }
    await refreshFinancialSummary(ctx, studentId);
    const today = dhakaDate();
    const dailySummary = await ctx.db.query("dailyOperationalSummaries").withIndex("by_date", (q) => q.eq("date", today)).unique();
    if (dailySummary) {
      await ctx.db.patch(dailySummary._id, {
        activeStudentCount: dailySummary.activeStudentCount + 1,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch("admissionApplications", application._id, { status: "accepted", acceptedStudentId: studentId, conversionKey, reviewedByAccountId: account._id, reviewedAt: now, updatedAt: now });
    const template = await ctx.db.query("smsTemplates").withIndex("by_key", (q) => q.eq("key", "admission_accepted")).unique();
    if (template?.enabled) {
      const rendered = renderSmsTemplate(application.preferredSmsLocale === "bn" ? template.bodyBn : template.bodyEn, { studentName: application.studentDisplayName, studentNumber });
      if (rendered.missingVariables.length === 0) await enqueueSms(ctx, { idempotencyKey: `admission:${application._id}:accepted`, eventType: "admission_accepted", relatedEntityType: "admissionApplication", relatedEntityId: application._id, studentId, guardianPhone: application.guardianPhone, locale: application.preferredSmsLocale, body: rendered.body });
    }
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "admission.accepted", entityType: "admissionApplication", entityId: application._id, summary: "Application converted to an active student", metadata: { studentId, enrolmentId, courseId: course._id, batchId: batch._id } });
    await scheduleCourseSnapshot(ctx, course._id);
    return { studentId, enrolmentId, replayed: false };
  },
});

export const createDirectAdmission = mutation({
  args: {
    studentNumber: v.string(), rollNumber: v.optional(v.string()), admissionDate: v.string(),
    studentDisplayName: v.string(), studentNameBn: v.optional(v.string()), studentNameEn: v.optional(v.string()),
    studentEmail: v.string(), studentPhone: v.optional(v.string()), dateOfBirth: v.optional(v.string()), gender: v.optional(v.string()),
    schoolCollege: v.string(), currentClass: v.string(), address: v.optional(v.string()),
    guardianName: v.string(), guardianPhone: v.string(), guardianRelationship: v.string(), alternateGuardianPhone: v.optional(v.string()), motherName: v.optional(v.string()), motherPhone: v.optional(v.string()),
    preferredSmsLocale: v.union(v.literal("bn"), v.literal("en")), courseId: v.id("courses"), batchId: v.id("batches"),
    feePlanId: v.optional(v.id("feePlans")), agreedMonthlyAmountMinor: v.optional(v.number()), agreedCourseAmountMinor: v.optional(v.number()),
    internalNote: v.optional(v.string()), initialAdmissionFeeMinor: v.optional(v.number()),
  },
  returns: v.object({ studentId: v.id("students"), enrolmentId: v.id("enrolments") }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    assertLocalDate(args.admissionDate);
    const studentNumber = requiredText(args.studentNumber, "Student number", 40);
    const profile = normalizeSubmission(args);
    if (profile.dateOfBirth) assertLocalDate(profile.dateOfBirth);
    if (await ctx.db.query("students").withIndex("by_studentNumber", (q) => q.eq("studentNumber", studentNumber)).unique()) throw new Error("Student number is already used");
    if (await ctx.db.query("students").withIndex("by_normalizedLoginEmail", (q) => q.eq("normalizedLoginEmail", profile.normalizedStudentEmail)).unique()) throw new Error("Student Google email is already admitted");
    if (await ctx.db.query("portalAccounts").withIndex("by_normalizedLoginEmail", (q) => q.eq("normalizedLoginEmail", profile.normalizedStudentEmail)).unique()) throw new Error("Student Google email already has portal access");
    const { course, batch } = await validateOwnerSelection(ctx, args.courseId, args.batchId);
    if (args.feePlanId) {
      const feePlan = await ctx.db.get("feePlans", args.feePlanId);
      if (!feePlan || feePlan.status !== "active" || (feePlan.courseId && feePlan.courseId !== course._id) || (feePlan.batchId && feePlan.batchId !== batch._id)) throw new Error("Fee plan does not match the enrolment");
    }
    if (args.agreedMonthlyAmountMinor !== undefined) assertMinorUnits(args.agreedMonthlyAmountMinor, "agreedMonthlyAmountMinor");
    if (args.agreedCourseAmountMinor !== undefined) assertMinorUnits(args.agreedCourseAmountMinor, "agreedCourseAmountMinor");
    if (args.initialAdmissionFeeMinor !== undefined) {
      assertMinorUnits(args.initialAdmissionFeeMinor, "initialAdmissionFeeMinor");
      if (args.initialAdmissionFeeMinor === 0) throw new Error("Initial admission fee must be greater than zero");
    }
    const now = Date.now();
    const studentId = await ctx.db.insert("students", {
      studentNumber, rollNumber: optionalText(args.rollNumber, "Roll number", 40), displayName: profile.studentDisplayName,
      nameBn: profile.studentNameBn, nameEn: profile.studentNameEn, loginEmail: profile.studentEmail,
      normalizedLoginEmail: profile.normalizedStudentEmail, phone: profile.studentPhone, dateOfBirth: profile.dateOfBirth,
      gender: profile.gender, schoolCollege: profile.schoolCollege, currentClass: profile.currentClass, address: profile.address,
      guardianName: profile.guardianName, guardianPhone: profile.guardianPhone, normalizedGuardianPhone: profile.normalizedGuardianPhone,
      guardianRelationship: profile.guardianRelationship, alternateGuardianPhone: profile.alternateGuardianPhone,
      motherName: profile.motherName, motherPhone: profile.motherPhone,
      preferredSmsLocale: args.preferredSmsLocale, admissionDate: args.admissionDate, status: "active",
      internalNote: optionalText(args.internalNote, "Internal note", 2000),
      searchText: `${studentNumber} ${profile.studentDisplayName} ${profile.studentEmail}`.toLowerCase(),
      createdAt: now, updatedAt: now, createdByAccountId: account._id, updatedByAccountId: account._id,
    });
    const enrolmentId = await ctx.db.insert("enrolments", {
      studentId, courseId: course._id, batchId: batch._id, academicSessionId: batch.academicSessionId,
      enrolledOn: args.admissionDate, status: "active", feePlanId: args.feePlanId,
      agreedMonthlyAmountMinor: args.agreedMonthlyAmountMinor, agreedCourseAmountMinor: args.agreedCourseAmountMinor,
      createdAt: now, updatedAt: now, createdByAccountId: account._id,
    });
    await scheduleCourseSnapshot(ctx, course._id);
    await ctx.db.insert("portalAccounts", {
      role: "student", status: "reserved", loginEmail: profile.studentEmail, normalizedLoginEmail: profile.normalizedStudentEmail,
      studentId, locale: args.preferredSmsLocale, createdAt: now, updatedAt: now, createdByAccountId: account._id,
    });
    if (args.initialAdmissionFeeMinor !== undefined) {
      const year = Number(args.admissionDate.slice(0, 4));
      await ctx.db.insert("studentCharges", {
        chargeNumber: await nextIdentifier(ctx, "charge", "CHG", year), studentId, enrolmentId, type: "admission",
        descriptionBn: "ভর্তি ফি", descriptionEn: "Admission fee", originalAmountMinor: args.initialAdmissionFeeMinor,
        discountAmountMinor: 0, netAmountMinor: args.initialAdmissionFeeMinor, paidAmountMinor: 0, dueDate: args.admissionDate,
        status: args.admissionDate <= dhakaDate() ? "due" : "upcoming", generationKey: `direct-admission:${studentId}`,
        createdAt: now, createdByAccountId: account._id,
      });
    }
    await refreshFinancialSummary(ctx, studentId);
    const today = dhakaDate();
    const dailySummary = await ctx.db.query("dailyOperationalSummaries").withIndex("by_date", (q) => q.eq("date", today)).unique();
    if (dailySummary) {
      await ctx.db.patch(dailySummary._id, {
        activeStudentCount: dailySummary.activeStudentCount + 1,
        updatedAt: Date.now(),
      });
    }
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "student.directly_admitted", entityType: "student", entityId: studentId, summary: "Student directly admitted by owner", metadata: { enrolmentId, courseId: course._id, batchId: batch._id } });
    return { studentId, enrolmentId };
  },
});
