import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireStudent } from "../model/auth";
import { writeAudit } from "../model/audit";
import { localeValidator } from "../model/validators";
import { normalizeBangladeshPhone } from "../model/normalization";
import { optionalText, requiredText } from "../admissions/model";
import { currentSensitiveValue, normalizeSensitiveValue, sensitiveFieldValidator, studentSearchText } from "./model";

const ownProfileValidator = v.object({
  studentId: v.id("students"),
  studentNumber: v.string(),
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
  status: v.union(v.literal("active"), v.literal("inactive")),
  pendingChanges: v.array(v.object({
    requestId: v.id("studentProfileChangeRequests"),
    fieldKey: sensitiveFieldValidator,
    requestedValue: v.string(),
    reason: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })),
});

export const getMyProfile = query({
  args: {},
  returns: ownProfileValidator,
  handler: async (ctx) => {
    const { student } = await requireStudent(ctx);
    const [pendingChanges, activeEnrolment] = await Promise.all([
      ctx.db.query("studentProfileChangeRequests")
      .withIndex("by_studentId_and_status", (q) => q.eq("studentId", student._id).eq("status", "pending"))
      .order("desc")
      .take(50),
      ctx.db.query("enrolments")
        .withIndex("by_studentId_and_status", (q) => q.eq("studentId", student._id).eq("status", "active"))
        .first(),
    ]);
    return {
      studentId: student._id,
      studentNumber: student.studentNumber,
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
      status: activeEnrolment ? "active" as const : "inactive" as const,
      pendingChanges: pendingChanges.map((request) => ({
        requestId: request._id,
        fieldKey: request.fieldKey as "displayName" | "loginEmail" | "guardianName" | "guardianPhone" | "guardianRelationship" | "alternateGuardianPhone",
        requestedValue: request.requestedValue,
        reason: request.reason ?? null,
        createdAt: request.createdAt,
      })),
    };
  },
});

export const updateMyProfile = mutation({
  args: {
    phone: v.optional(v.union(v.string(), v.null())),
    schoolCollege: v.optional(v.string()),
    currentClass: v.optional(v.string()),
    address: v.optional(v.union(v.string(), v.null())),
    preferredSmsLocale: v.optional(localeValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account, student } = await requireStudent(ctx);
    const patch: Record<string, unknown> = {};
    if (args.phone !== undefined) patch.phone = args.phone === null ? undefined : normalizeBangladeshPhone(args.phone);
    if (args.schoolCollege !== undefined) patch.schoolCollege = requiredText(args.schoolCollege, "School or college", 160);
    if (args.currentClass !== undefined) patch.currentClass = requiredText(args.currentClass, "Current class", 80);
    if (args.address !== undefined) patch.address = args.address === null ? undefined : optionalText(args.address, "Address", 500);
    if (args.preferredSmsLocale !== undefined) patch.preferredSmsLocale = args.preferredSmsLocale;
    if (Object.keys(patch).length === 0) throw new Error("No permitted profile changes were provided");
    const merged = { ...student, ...patch };
    patch.searchText = studentSearchText(merged);
    patch.updatedAt = Date.now();
    patch.updatedByAccountId = account._id;
    await ctx.db.patch("students", student._id, patch);
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "student",
      action: "student.self_profile_updated",
      entityType: "student",
      entityId: student._id,
      summary: "Student updated permitted profile fields",
    });
    return null;
  },
});

export const requestSensitiveChange = mutation({
  args: { fieldKey: sensitiveFieldValidator, requestedValue: v.string(), reason: v.optional(v.string()) },
  returns: v.id("studentProfileChangeRequests"),
  handler: async (ctx, args) => {
    const { account, student } = await requireStudent(ctx);
    const requestedValue = normalizeSensitiveValue(args.fieldKey, args.requestedValue);
    const oldValue = currentSensitiveValue(student, args.fieldKey);
    if (requestedValue === oldValue) throw new Error("Requested value is unchanged");
    const pending = await ctx.db.query("studentProfileChangeRequests")
      .withIndex("by_studentId_and_status", (q) => q.eq("studentId", student._id).eq("status", "pending"))
      .take(50);
    if (pending.some((request) => request.fieldKey === args.fieldKey)) {
      throw new Error("A pending request already exists for this field");
    }
    const requestId = await ctx.db.insert("studentProfileChangeRequests", {
      studentId: student._id,
      requestedByAccountId: account._id,
      fieldKey: args.fieldKey,
      oldValue,
      requestedValue,
      reason: optionalText(args.reason, "Reason", 500),
      status: "pending",
      createdAt: Date.now(),
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "student",
      action: "student.profile_change_requested",
      entityType: "studentProfileChangeRequest",
      entityId: requestId,
      summary: "Student requested a sensitive profile change",
      metadata: { studentId: student._id, fieldKey: args.fieldKey },
    });
    return requestId;
  },
});
