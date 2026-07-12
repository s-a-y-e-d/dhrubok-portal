import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import { localeValidator, paginationResultFields, studentStatusValidator } from "../model/validators";
import { assertLocalDate } from "../model/dates";
import { normalizeBangladeshPhone } from "../model/normalization";
import { optionalText, requiredText } from "../admissions/model";
import { applySensitiveField, sensitiveFieldValidator, studentSearchText } from "./model";

const studentListItemValidator = v.object({
  studentId: v.id("students"),
  studentNumber: v.string(),
  displayName: v.string(),
  loginEmail: v.string(),
  guardianName: v.string(),
  guardianPhone: v.string(),
  admissionDate: v.string(),
  status: studentStatusValidator,
});

const profileValidator = v.object({
  studentId: v.id("students"),
  studentNumber: v.string(),
  rollNumber: v.union(v.string(), v.null()),
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
  preferredSmsLocale: localeValidator,
  admissionDate: v.string(),
  status: studentStatusValidator,
  internalNote: v.union(v.string(), v.null()),
  portalAccountStatus: v.union(v.literal("reserved"), v.literal("active"), v.literal("suspended"), v.literal("revoked"), v.null()),
  enrolments: v.array(v.object({
    enrolmentId: v.id("enrolments"),
    courseId: v.id("courses"),
    batchId: v.id("batches"),
    academicSessionId: v.id("academicSessions"),
    enrolledOn: v.string(),
    endedOn: v.union(v.string(), v.null()),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("withdrawn"), v.literal("transferred")),
  })),
});

export const listStudents = query({
  args: { paginationOpts: paginationOptsValidator, status: studentStatusValidator },
  returns: v.object({ page: v.array(studentListItemValidator), ...paginationResultFields }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const result = await ctx.db.query("students")
      .withIndex("by_status_and_admissionDate", (q) => q.eq("status", args.status))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((student) => ({
        studentId: student._id,
        studentNumber: student.studentNumber,
        displayName: student.displayName,
        loginEmail: student.loginEmail,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        admissionDate: student.admissionDate,
        status: student.status,
      })),
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
    const [enrolments, account] = await Promise.all([
      ctx.db.query("enrolments").withIndex("by_studentId_and_status", (q) => q.eq("studentId", student._id)).take(100),
      ctx.db.query("portalAccounts").withIndex("by_studentId", (q) => q.eq("studentId", student._id)).unique(),
    ]);
    return {
      studentId: student._id,
      studentNumber: student.studentNumber,
      rollNumber: student.rollNumber ?? null,
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
      preferredSmsLocale: student.preferredSmsLocale,
      admissionDate: student.admissionDate,
      status: student.status,
      internalNote: student.internalNote ?? null,
      portalAccountStatus: account?.status ?? null,
      enrolments: enrolments.map((enrolment) => ({
        enrolmentId: enrolment._id,
        courseId: enrolment.courseId,
        batchId: enrolment.batchId,
        academicSessionId: enrolment.academicSessionId,
        enrolledOn: enrolment.enrolledOn,
        endedOn: enrolment.endedOn ?? null,
        status: enrolment.status,
      })),
    };
  },
});

export const updateStudent = mutation({
  args: {
    studentId: v.id("students"),
    rollNumber: v.optional(v.union(v.string(), v.null())),
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
    preferredSmsLocale: v.optional(localeValidator),
    admissionDate: v.optional(v.string()),
    status: v.optional(studentStatusValidator),
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
    if (args.rollNumber !== undefined) patch.rollNumber = args.rollNumber === null ? undefined : optionalText(args.rollNumber, "Roll number", 40);
    if (args.nameBn !== undefined) patch.nameBn = args.nameBn === null ? undefined : optionalText(args.nameBn, "Bangla name", 120);
    if (args.nameEn !== undefined) patch.nameEn = args.nameEn === null ? undefined : optionalText(args.nameEn, "English name", 120);
    if (args.phone !== undefined) patch.phone = args.phone === null ? undefined : normalizeBangladeshPhone(args.phone);
    if (args.dateOfBirth !== undefined) patch.dateOfBirth = args.dateOfBirth === null ? undefined : assertLocalDate(args.dateOfBirth);
    if (args.gender !== undefined) patch.gender = args.gender === null ? undefined : optionalText(args.gender, "Gender", 32);
    if (args.schoolCollege !== undefined) patch.schoolCollege = requiredText(args.schoolCollege, "School or college", 160);
    if (args.currentClass !== undefined) patch.currentClass = requiredText(args.currentClass, "Current class", 80);
    if (args.address !== undefined) patch.address = args.address === null ? undefined : optionalText(args.address, "Address", 500);
    if (args.preferredSmsLocale !== undefined) patch.preferredSmsLocale = args.preferredSmsLocale;
    if (args.admissionDate !== undefined) patch.admissionDate = assertLocalDate(args.admissionDate);
    if (args.status !== undefined) patch.status = args.status;
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
