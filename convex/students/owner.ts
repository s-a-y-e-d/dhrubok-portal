import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import { localeValidator, paginationResultFields, studentStatusValidator } from "../model/validators";
import { assertLocalDate, dhakaDate } from "../model/dates";
import { normalizeBangladeshPhone } from "../model/normalization";
import { assertMinorUnits } from "../model/money";
import { scheduleCourseSnapshot } from "../academics/snapshotHooks";
import { optionalText, requiredText } from "../admissions/model";
import { applySensitiveField, sensitiveFieldValidator, studentSearchText } from "./model";
import { assertPeriodKey, materializeEnrolmentMonths } from "../fees/model";
import { postCollection } from "../fees/model";

const studentListItemValidator = v.object({
  studentId: v.id("students"),
  studentNumber: v.string(),
  displayName: v.string(),
  loginEmail: v.string(),
  guardianName: v.string(),
  guardianPhone: v.string(),
  admissionDate: v.string(),
  status: v.union(v.literal("active"), v.literal("inactive")),
  photoUrl: v.union(v.string(), v.null()),
  currentClass: v.string(),
  activeEnrolments: v.array(v.object({
    enrolmentId: v.id("enrolments"), courseId: v.id("courses"), batchId: v.id("batches"),
    courseNameBn: v.string(), courseNameEn: v.string(), batchNameBn: v.string(), batchNameEn: v.string(),
    agreedMonthlyAmountMinor: v.union(v.number(), v.null()),
  })),
  outstandingMinor: v.number(),
});

const profileValidator = v.object({
  studentId: v.id("students"),
  studentNumber: v.string(),
  photoStorageId: v.union(v.id("_storage"), v.null()),
  photoUrl: v.union(v.string(), v.null()),
  displayName: v.string(),
  nameBn: v.union(v.string(), v.null()),
  nameEn: v.union(v.string(), v.null()),
  loginEmail: v.string(),
  phone: v.union(v.string(), v.null()),
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
  smsRecipient: v.union(v.literal("father"), v.literal("mother"), v.literal("both")),
  preferredSmsLocale: localeValidator,
  admissionDate: v.string(),
  status: v.union(v.literal("active"), v.literal("inactive")),
  internalNote: v.union(v.string(), v.null()),
  portalAccountStatus: v.union(v.literal("reserved"), v.literal("active"), v.literal("suspended"), v.literal("revoked"), v.null()),
  financialSummary: v.object({
    totalChargedMinor: v.number(), totalPaidMinor: v.number(), outstandingMinor: v.number(),
    overdueMinor: v.number(), advanceCreditMinor: v.number(),
  }),
  enrolments: v.array(v.object({
    enrolmentId: v.id("enrolments"),
    courseId: v.id("courses"),
    batchId: v.id("batches"),
    enrolledOn: v.string(),
    endedOn: v.union(v.string(), v.null()),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("withdrawn"), v.literal("transferred")),
    agreedMonthlyAmountMinor: v.union(v.number(), v.null()),
    courseNameBn: v.string(),
    courseNameEn: v.string(),
    batchNameBn: v.string(),
    batchNameEn: v.string(),
  })),
});

export const generatePhotoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const listStudents = query({
  args: { paginationOpts: paginationOptsValidator, status: v.optional(studentStatusValidator) },
  returns: v.object({ page: v.array(studentListItemValidator), ...paginationResultFields }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const result = await ctx.db.query("students").order("desc").paginate(args.paginationOpts);
    const page = await Promise.all(result.page.map(async (student) => {
        const activeEnrolments = await ctx.db.query("enrolments")
          .withIndex("by_studentId_and_status", (q) => q.eq("studentId", student._id).eq("status", "active"))
          .take(100);
        const [enrolmentRows, summary] = await Promise.all([
          Promise.all(activeEnrolments.map(async (enrolment) => {
            const [course, batch] = await Promise.all([ctx.db.get("courses", enrolment.courseId), ctx.db.get("batches", enrolment.batchId)]);
            if (!course || !batch) throw new Error("Enrolment course or batch not found");
            return { enrolmentId: enrolment._id, courseId: course._id, batchId: batch._id, courseNameBn: course.nameBn, courseNameEn: course.nameEn, batchNameBn: batch.nameBn, batchNameEn: batch.nameEn, agreedMonthlyAmountMinor: enrolment.agreedMonthlyAmountMinor ?? null };
          })),
          ctx.db.query("studentFinancialSummaries").withIndex("by_studentId", (q) => q.eq("studentId", student._id)).unique(),
        ]);
        return {
          studentId: student._id, studentNumber: student.studentNumber,
          displayName: student.displayName, loginEmail: student.loginEmail,
          guardianName: student.guardianName, guardianPhone: student.guardianPhone,
          admissionDate: student.admissionDate,
          status: activeEnrolments.length ? "active" as const : "inactive" as const,
          photoUrl: student.photoStorageId ? await ctx.storage.getUrl(student.photoStorageId) : null,
          currentClass: student.currentClass,
          activeEnrolments: enrolmentRows,
          outstandingMinor: summary?.outstandingMinor ?? 0,
        };
      }));
    return {
      ...result,
      page: args.status ? page.filter((student) => student.status === (args.status === "active" ? "active" : "inactive")) : page,
    };
  },
});

export const getStudent = query({
  args: { studentId: v.id("students") },
  returns: v.union(profileValidator, v.null()),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const student = await ctx.db.get("students", args.studentId);
    if (!student) return null;
    const [enrolments, account, financialSummary] = await Promise.all([
      ctx.db.query("enrolments").withIndex("by_studentId_and_status", (q) => q.eq("studentId", student._id)).take(100),
      ctx.db.query("portalAccounts").withIndex("by_studentId", (q) => q.eq("studentId", student._id)).unique(),
      ctx.db.query("studentFinancialSummaries").withIndex("by_studentId", (q) => q.eq("studentId", student._id)).unique(),
    ]);
    return {
      studentId: student._id,
      studentNumber: student.studentNumber,
      photoStorageId: student.photoStorageId ?? null,
      photoUrl: student.photoStorageId ? await ctx.storage.getUrl(student.photoStorageId) : null,
      displayName: student.displayName,
      nameBn: student.nameBn ?? null,
      nameEn: student.nameEn ?? null,
      loginEmail: student.loginEmail,
      phone: student.phone ?? null,
      dateOfBirth: student.dateOfBirth ?? null,
      gender: student.gender ?? null,
      schoolCollege: student.schoolCollege,
      currentClass: student.currentClass,
      address: student.address ?? null,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      guardianRelationship: student.guardianRelationship,
      alternateGuardianPhone: student.alternateGuardianPhone ?? null,
      motherName: student.motherName ?? null,
      motherPhone: student.motherPhone ?? null,
      smsRecipient: student.smsRecipient ?? "father",
      preferredSmsLocale: student.preferredSmsLocale,
      admissionDate: student.admissionDate,
      status: enrolments.some((enrolment) => enrolment.status === "active") ? "active" as const : "inactive" as const,
      internalNote: student.internalNote ?? null,
      portalAccountStatus: account?.status ?? null,
      financialSummary: {
        totalChargedMinor: financialSummary?.totalChargedMinor ?? 0,
        totalPaidMinor: financialSummary?.totalPaidMinor ?? 0,
        outstandingMinor: financialSummary?.outstandingMinor ?? 0,
        overdueMinor: financialSummary?.overdueMinor ?? 0,
        advanceCreditMinor: financialSummary?.advanceCreditMinor ?? 0,
      },
      enrolments: await Promise.all(enrolments.map(async (enrolment) => {
        const [course, batch] = await Promise.all([ctx.db.get("courses", enrolment.courseId), ctx.db.get("batches", enrolment.batchId)]);
        if (!course || !batch) throw new Error("Enrolment course or batch not found");
        return {
        enrolmentId: enrolment._id,
        courseId: enrolment.courseId,
        batchId: enrolment.batchId,
        enrolledOn: enrolment.enrolledOn,
        endedOn: enrolment.endedOn ?? null,
        status: enrolment.status,
        agreedMonthlyAmountMinor: enrolment.agreedMonthlyAmountMinor ?? null,
        courseNameBn: course.nameBn, courseNameEn: course.nameEn,
        batchNameBn: batch.nameBn, batchNameEn: batch.nameEn,
      }; })),
    };
  },
});

export const updateStudent = mutation({
  args: {
    studentId: v.id("students"),
    photoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    displayName: v.optional(v.string()),
    nameBn: v.optional(v.union(v.string(), v.null())),
    nameEn: v.optional(v.union(v.string(), v.null())),
    loginEmail: v.optional(v.string()),
    phone: v.optional(v.union(v.string(), v.null())),
    dateOfBirth: v.optional(v.union(v.string(), v.null())),
    gender: v.optional(v.union(v.string(), v.null())),
    schoolCollege: v.optional(v.string()),
    currentClass: v.optional(v.string()),
    address: v.optional(v.union(v.string(), v.null())),
    guardianName: v.optional(v.string()),
    guardianPhone: v.optional(v.string()),
    guardianRelationship: v.optional(v.string()),
    alternateGuardianPhone: v.optional(v.union(v.string(), v.null())),
    motherName: v.optional(v.string()),
    motherPhone: v.optional(v.string()),
    smsRecipient: v.optional(v.union(v.literal("father"), v.literal("mother"), v.literal("both"))),
    preferredSmsLocale: v.optional(localeValidator),
    admissionDate: v.optional(v.string()),
    internalNote: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const student = await ctx.db.get("students", args.studentId);
    if (!student) throw new Error("Student not found");
    let current = student;
    for (const [field, value] of [
      ["displayName", args.displayName],
      ["loginEmail", args.loginEmail],
      ["guardianName", args.guardianName],
      ["guardianPhone", args.guardianPhone],
      ["guardianRelationship", args.guardianRelationship],
      ["alternateGuardianPhone", args.alternateGuardianPhone === null ? "" : args.alternateGuardianPhone],
    ] as const) {
      if (value !== undefined) {
        await applySensitiveField(ctx, current, field, value, account._id);
        const refreshed = await ctx.db.get("students", current._id);
        if (!refreshed) throw new Error("Student not found");
        current = refreshed;
      }
    }
    const patch: Record<string, unknown> = {};
    if (args.photoStorageId !== undefined) patch.photoStorageId = args.photoStorageId ?? undefined;
    if (args.nameBn !== undefined) patch.nameBn = args.nameBn === null ? undefined : optionalText(args.nameBn, "Bangla name", 120);
    if (args.nameEn !== undefined) patch.nameEn = args.nameEn === null ? undefined : optionalText(args.nameEn, "English name", 120);
    if (args.phone !== undefined) patch.phone = args.phone === null ? undefined : normalizeBangladeshPhone(args.phone);
    if (args.dateOfBirth !== undefined) patch.dateOfBirth = args.dateOfBirth === null ? undefined : assertLocalDate(args.dateOfBirth);
    if (args.gender !== undefined) patch.gender = args.gender === null ? undefined : optionalText(args.gender, "Gender", 32);
    if (args.schoolCollege !== undefined) patch.schoolCollege = requiredText(args.schoolCollege, "School or college", 160);
    if (args.currentClass !== undefined) patch.currentClass = requiredText(args.currentClass, "Current class", 80);
    if (args.address !== undefined) patch.address = args.address === null ? undefined : optionalText(args.address, "Address", 500);
    if (args.motherName !== undefined) patch.motherName = requiredText(args.motherName, "Mother name", 120);
    if (args.motherPhone !== undefined) patch.motherPhone = normalizeBangladeshPhone(requiredText(args.motherPhone, "Mother phone", 32));
    if (args.smsRecipient !== undefined) patch.smsRecipient = args.smsRecipient;
    if (args.preferredSmsLocale !== undefined) patch.preferredSmsLocale = args.preferredSmsLocale;
    if (args.admissionDate !== undefined) patch.admissionDate = assertLocalDate(args.admissionDate);

    if (args.internalNote !== undefined) patch.internalNote = args.internalNote === null ? undefined : optionalText(args.internalNote, "Internal note", 2000);
    if (Object.keys(patch).length > 0) {
      const merged = { ...current, ...patch };
      patch.searchText = studentSearchText(merged);
      patch.updatedAt = Date.now();
      patch.updatedByAccountId = account._id;
      await ctx.db.patch("students", student._id, patch);
    }

    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "student.profile_updated",
      entityType: "student",
      entityId: student._id,
      summary: "Student profile updated by owner",
    });
    return null;
  },
});

export const addEnrolment = mutation({
  args: { studentId: v.id("students"), courseId: v.id("courses"), batchId: v.id("batches"), agreedMonthlyAmountMinor: v.number(), effectiveDate: v.string(), firstBillingMonth: v.optional(v.string()), admissionFeeMinor: v.number() },
  returns: v.object({ enrolmentId: v.id("enrolments"), receiptNumber: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    assertLocalDate(args.effectiveDate); assertMinorUnits(args.agreedMonthlyAmountMinor, "agreedMonthlyAmountMinor"); assertMinorUnits(args.admissionFeeMinor, "admissionFeeMinor");
    if (args.agreedMonthlyAmountMinor <= 0) throw new Error("Monthly fee must be greater than zero");
    const firstBillingMonth = args.firstBillingMonth ?? args.effectiveDate.slice(0, 7); assertPeriodKey(firstBillingMonth);
    if (firstBillingMonth < args.effectiveDate.slice(0, 7)) throw new Error("First billing month cannot be before the enrolment start");
    const [student, course, batch, duplicate] = await Promise.all([
      ctx.db.get("students", args.studentId), ctx.db.get("courses", args.courseId), ctx.db.get("batches", args.batchId),
      ctx.db.query("enrolments").withIndex("by_studentId_and_status", q => q.eq("studentId", args.studentId).eq("status", "active")).take(100),
    ]);
    if (!student) throw new Error("Student not found"); if (!course || course.status !== "active") throw new Error("Choose an active course");
    if (!batch || batch.status !== "active" || batch.courseId !== course._id) throw new Error("Choose an active batch from the selected course");
    if (duplicate.some(row => row.courseId === course._id)) throw new Error("Student is already actively enrolled in this course");
    const now = Date.now();
    const enrolmentId = await ctx.db.insert("enrolments", { studentId: student._id, courseId: course._id, batchId: batch._id, enrolledOn: args.effectiveDate, status: "active", agreedMonthlyAmountMinor: args.agreedMonthlyAmountMinor, firstBillingMonth, createdAt: now, updatedAt: now, createdByAccountId: account._id });
    const enrolment = await ctx.db.get("enrolments", enrolmentId); if (!enrolment) throw new Error("Enrolment was not created");
    await materializeEnrolmentMonths(ctx, enrolment, dhakaDate().slice(0, 7));
    const collection = args.admissionFeeMinor > 0 ? await postCollection(ctx, { studentId: student._id, collectionType: "admission", collectedOn: args.effectiveDate, collectedByAccountId: account._id, items: [{ itemType: "admission", description: `Admission Fee - ${course.nameEn}`, amountMinor: args.admissionFeeMinor, enrolmentId }] }) : null;
    await ctx.db.patch("students", student._id, { status: "active", updatedAt: now, updatedByAccountId: account._id });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "student.enrolment_added", entityType: "student", entityId: student._id, summary: "Student enrolled in an additional course", metadata: { enrolmentId, courseId: course._id, batchId: batch._id } });
    await scheduleCourseSnapshot(ctx, course._id); return { enrolmentId, receiptNumber: collection?.receiptNumber ?? null };
  },
});

export const transferEnrolment = mutation({
  args: {
    enrolmentId: v.id("enrolments"), batchId: v.id("batches"),
    agreedMonthlyAmountMinor: v.number(), effectiveDate: v.string(), firstBillingMonth: v.optional(v.string()),
  },
  returns: v.id("enrolments"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    assertLocalDate(args.effectiveDate);
    assertMinorUnits(args.agreedMonthlyAmountMinor, "agreedMonthlyAmountMinor");
    if (args.agreedMonthlyAmountMinor <= 0) throw new Error("Monthly fee must be greater than zero");
    const firstBillingMonth = args.firstBillingMonth ?? args.effectiveDate.slice(0, 7);
    assertPeriodKey(firstBillingMonth);
    if (firstBillingMonth < args.effectiveDate.slice(0, 7)) throw new Error("First billing month cannot be before the enrolment start");
    const current = await ctx.db.get("enrolments", args.enrolmentId); if (!current || current.status !== "active") throw new Error("Active enrolment not found");
    const [student, course, batch] = await Promise.all([ctx.db.get("students", current.studentId), ctx.db.get("courses", current.courseId), ctx.db.get("batches", args.batchId)]);
    if (!student) throw new Error("Student not found");
    if (!course || course.status !== "active") throw new Error("Choose an active course");
    if (!batch || batch.status !== "active" || batch.courseId !== course._id) throw new Error("Choose an active batch from the enrolment course");
    if (current.batchId === batch._id) throw new Error(JSON.stringify({ code: "SAME_BATCH" }));
    const finalPeriod = args.effectiveDate.slice(0, 7);
    const laterFees = await ctx.db.query("monthlyFeeRecords")
      .withIndex("by_enrolmentId_and_periodKey", (q) => q.eq("enrolmentId", current._id).gt("periodKey", finalPeriod))
      .take(240);
    if (laterFees.some((record) => record.status === "paid"))
      throw new Error("Void later monthly fee collections before transferring this enrolment");
    for (const record of laterFees) await ctx.db.delete(record._id);
    const now = Date.now();
    await ctx.db.patch("enrolments", current._id, { status: "transferred", endedOn: args.effectiveDate, updatedAt: now });
    const enrolmentId = await ctx.db.insert("enrolments", {
      studentId: student._id, courseId: current.courseId, batchId: batch._id, enrolledOn: args.effectiveDate,
      status: "active", agreedMonthlyAmountMinor: args.agreedMonthlyAmountMinor, firstBillingMonth,
      createdAt: now, updatedAt: now, createdByAccountId: account._id,
    });
    const createdEnrolment = await ctx.db.get("enrolments", enrolmentId);
    if (createdEnrolment) await materializeEnrolmentMonths(ctx, createdEnrolment, dhakaDate().slice(0, 7));
    await ctx.db.patch("students", student._id, { status: "active", updatedAt: now, updatedByAccountId: account._id });
    await writeAudit(ctx, {
      actorAccountId: account._id, actorRole: "owner", action: "student.enrolment_transferred",
      entityType: "student", entityId: student._id, summary: "Student course and batch changed",
      metadata: { previousEnrolmentId: current._id, enrolmentId, courseId: course._id, batchId: batch._id, effectiveDate: args.effectiveDate, agreedMonthlyAmountMinor: args.agreedMonthlyAmountMinor },
    });
    await scheduleCourseSnapshot(ctx, course._id);
    return enrolmentId;
  },
});

export const endEnrolment = mutation({
  args: { enrolmentId: v.id("enrolments"), status: v.union(v.literal("completed"), v.literal("withdrawn")), effectiveDate: v.string(), note: v.optional(v.string()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    assertLocalDate(args.effectiveDate);
    const enrolment = await ctx.db.get("enrolments", args.enrolmentId);
    if (!enrolment || enrolment.status !== "active") throw new Error("Active enrolment not found");
    if (args.effectiveDate < enrolment.enrolledOn) throw new Error("End date cannot be before enrolment date");
    const finalPeriod = args.effectiveDate.slice(0, 7);
    const laterFees = await ctx.db.query("monthlyFeeRecords")
      .withIndex("by_enrolmentId_and_periodKey", (q) => q.eq("enrolmentId", enrolment._id).gt("periodKey", finalPeriod))
      .take(240);
    if (laterFees.some((record) => record.status === "paid"))
      throw new Error("Void later monthly fee collections before ending this enrolment");
    for (const record of laterFees) await ctx.db.delete(record._id);
    const now = Date.now();
    await ctx.db.patch("enrolments", enrolment._id, { status: args.status, endedOn: args.effectiveDate, updatedAt: now });
    const remaining = await ctx.db.query("enrolments").withIndex("by_studentId_and_status", q => q.eq("studentId", enrolment.studentId).eq("status", "active")).take(1);
    if (!remaining.length) await ctx.db.patch("students", enrolment.studentId, { status: "inactive", updatedAt: now, updatedByAccountId: account._id });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: `student.enrolment_${args.status}`, entityType: "enrolment", entityId: enrolment._id, summary: `Student enrolment marked ${args.status}`, metadata: args.note ? { note: args.note } : undefined });
    await scheduleCourseSnapshot(ctx, enrolment.courseId);
    return null;
  },
});

export const updateMonthlyFee = mutation({
  args: { enrolmentId: v.id("enrolments"), agreedMonthlyAmountMinor: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    assertMinorUnits(args.agreedMonthlyAmountMinor, "agreedMonthlyAmountMinor");
    if (args.agreedMonthlyAmountMinor <= 0) throw new Error("Monthly fee must be greater than zero");
    const enrolment = await ctx.db.get("enrolments", args.enrolmentId);
    if (!enrolment || enrolment.status !== "active") throw new Error("Active enrolment not found");
    await ctx.db.patch(enrolment._id, { agreedMonthlyAmountMinor: args.agreedMonthlyAmountMinor, updatedAt: Date.now() });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "student.monthly_fee_updated", entityType: "enrolment", entityId: enrolment._id, summary: "Updated agreed monthly fee", metadata: { amountMinor: args.agreedMonthlyAmountMinor } });
    return null;
  },
});

export const listChangeRequests = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
  },
  returns: v.object({
    page: v.array(v.object({
      requestId: v.id("studentProfileChangeRequests"),
      studentId: v.id("students"),
      fieldKey: sensitiveFieldValidator,
      oldValue: v.string(),
      requestedValue: v.string(),
      reason: v.union(v.string(), v.null()),
      status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
      createdAt: v.number(),
    })),
    ...paginationResultFields,
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const result = await ctx.db.query("studentProfileChangeRequests")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", args.status))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((request) => ({
        requestId: request._id,
        studentId: request.studentId,
        fieldKey: request.fieldKey as "displayName" | "loginEmail" | "guardianName" | "guardianPhone" | "guardianRelationship" | "alternateGuardianPhone",
        oldValue: request.oldValue,
        requestedValue: request.requestedValue,
        reason: request.reason ?? null,
        status: request.status,
        createdAt: request.createdAt,
      })),
    };
  },
});

export const reviewChangeRequest = mutation({
  args: {
    requestId: v.id("studentProfileChangeRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const request = await ctx.db.get("studentProfileChangeRequests", args.requestId);
    if (!request || request.status !== "pending") throw new Error("Pending change request not found");
    const student = await ctx.db.get("students", request.studentId);
    if (!student) throw new Error("Student not found");
    if (args.decision === "approved") {
      await applySensitiveField(
        ctx,
        student,
        request.fieldKey as "displayName" | "loginEmail" | "guardianName" | "guardianPhone" | "guardianRelationship" | "alternateGuardianPhone",
        request.requestedValue,
        account._id,
      );
    }
    await ctx.db.patch("studentProfileChangeRequests", request._id, {
      status: args.decision,
      reviewedByAccountId: account._id,
      reviewedAt: Date.now(),
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: `student.profile_change_${args.decision}`,
      entityType: "studentProfileChangeRequest",
      entityId: request._id,
      summary: `Student profile change request ${args.decision}`,
      metadata: { studentId: student._id, fieldKey: request.fieldKey },
    });
    return null;
  },
});

export const searchStudentsForOwner = query({
  args: { queryText: v.string() },
  returns: v.array(
    v.object({
      studentId: v.id("students"),
      studentNumber: v.string(),
      displayName: v.string(),
      status: v.union(v.literal("active"), v.literal("inactive")),
      phone: v.union(v.string(), v.null()),
      guardianPhone: v.string(),
      coursesAndBatches: v.array(v.object({ courseName: v.string(), batchName: v.string() })),
      outstandingMinor: v.number(),
      overdueMinor: v.number(),
      portalAccountStatus: v.union(v.literal("reserved"), v.literal("active"), v.literal("suspended"), v.literal("revoked"), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const text = args.queryText.trim().toLowerCase();
    if (text.length < 2) return [];

    const statuses = ["active", "inactive", "paused", "completed", "left", "archived"] as const;
    const searchPromises = statuses.map((status) =>
      ctx.db
        .query("students")
        .withSearchIndex("search_searchText", (q) =>
          q.search("searchText", text).eq("status", status)
        )
        .take(10)
    );
    const searchResults = await Promise.all(searchPromises);
    const matchedStudents = searchResults.flat();

    const statusOrder: Record<string, number> = { active: 0, inactive: 1, paused: 1, completed: 1, left: 1, archived: 1 };
    matchedStudents.sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 99;
      const orderB = statusOrder[b.status] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.displayName.localeCompare(b.displayName);
    });

    const limitedStudents = matchedStudents.slice(0, 20);
    const localized = (locale: "bn" | "en", bn: string | null | undefined, en: string | null | undefined) =>
      locale === "bn" ? bn || en || "" : en || bn || "";

    const results = [];
    for (const student of limitedStudents) {
      const enrolments = await ctx.db
        .query("enrolments")
        .withIndex("by_studentId_and_status", (q) => q.eq("studentId", student._id).eq("status", "active"))
        .take(5);

      const coursesAndBatches = [];
      for (const enrolment of enrolments) {
        const [course, batch] = await Promise.all([
          ctx.db.get("courses", enrolment.courseId),
          ctx.db.get("batches", enrolment.batchId),
        ]);
        if (course && batch) {
          coursesAndBatches.push({
            courseName: localized(account.locale, course.nameBn, course.nameEn),
            batchName: localized(account.locale, batch.nameBn, batch.nameEn),
          });
        }
      }

      const summary = await ctx.db
        .query("studentFinancialSummaries")
        .withIndex("by_studentId", (q) => q.eq("studentId", student._id))
        .unique();

      const portalAccount = await ctx.db
        .query("portalAccounts")
        .withIndex("by_studentId", (q) => q.eq("studentId", student._id))
        .unique();

      results.push({
        studentId: student._id,
        studentNumber: student.studentNumber,
        displayName: student.displayName,
        status: enrolments.length > 0 ? "active" as const : "inactive" as const,
        phone: student.phone ?? null,
        guardianPhone: student.guardianPhone,
        coursesAndBatches,
        outstandingMinor: summary?.outstandingMinor ?? 0,
        overdueMinor: summary?.overdueMinor ?? 0,
        portalAccountStatus: portalAccount?.status ?? null,
      });
    }

    return results;
  },
});
