import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { normalizeBangladeshPhone, normalizeEmail } from "../model/normalization";
import { optionalText, requiredText } from "../admissions/model";

export const sensitiveFieldValidator = v.union(
  v.literal("displayName"),
  v.literal("loginEmail"),
  v.literal("guardianName"),
  v.literal("guardianPhone"),
  v.literal("guardianRelationship"),
  v.literal("alternateGuardianPhone"),
);

export type SensitiveField =
  | "displayName"
  | "loginEmail"
  | "guardianName"
  | "guardianPhone"
  | "guardianRelationship"
  | "alternateGuardianPhone";

export function studentSearchText(input: {
  studentNumber: string;
  displayName: string;
  loginEmail: string;
  phone?: string;
  guardianName: string;
  guardianPhone: string;
}) {
  return [input.studentNumber, input.displayName, input.loginEmail, input.phone, input.guardianName, input.guardianPhone]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

export function currentSensitiveValue(student: Doc<"students">, field: SensitiveField) {
  switch (field) {
    case "displayName": return student.displayName;
    case "loginEmail": return student.loginEmail;
    case "guardianName": return student.guardianName;
    case "guardianPhone": return student.guardianPhone;
    case "guardianRelationship": return student.guardianRelationship;
    case "alternateGuardianPhone": return student.alternateGuardianPhone ?? "";
  }
}

export function normalizeSensitiveValue(field: SensitiveField, value: string) {
  switch (field) {
    case "loginEmail": return normalizeEmail(requiredText(value, "Login email", 254));
    case "guardianPhone": return normalizeBangladeshPhone(requiredText(value, "Guardian phone", 32));
    case "alternateGuardianPhone": {
      const normalized = optionalText(value, "Alternate guardian phone", 32);
      return normalized ? normalizeBangladeshPhone(normalized) : "";
    }
    case "displayName": return requiredText(value, "Official name", 120);
    case "guardianName": return requiredText(value, "Guardian name", 120);
    case "guardianRelationship": return requiredText(value, "Guardian relationship", 80);
  }
}

async function assertUniqueLoginEmail(ctx: MutationCtx, studentId: Id<"students">, normalizedLoginEmail: string) {
  const student = await ctx.db.query("students")
    .withIndex("by_normalizedLoginEmail", (q) => q.eq("normalizedLoginEmail", normalizedLoginEmail))
    .unique();
  if (student && student._id !== studentId) throw new Error("Another student already uses this login email");
  const account = await ctx.db.query("portalAccounts")
    .withIndex("by_normalizedLoginEmail", (q) => q.eq("normalizedLoginEmail", normalizedLoginEmail))
    .unique();
  if (account && (account.role !== "student" || account.studentId !== studentId)) {
    throw new Error("Another portal account already uses this login email");
  }
}

export async function applySensitiveField(
  ctx: MutationCtx,
  student: Doc<"students">,
  field: SensitiveField,
  requestedValue: string,
  actorAccountId: Id<"portalAccounts">,
) {
  const value = normalizeSensitiveValue(field, requestedValue);
  const now = Date.now();
  const patch: Partial<Doc<"students">> = { updatedAt: now, updatedByAccountId: actorAccountId };
  if (field === "loginEmail") {
    await assertUniqueLoginEmail(ctx, student._id, value);
    patch.loginEmail = value;
    patch.normalizedLoginEmail = value;
    const account = await ctx.db.query("portalAccounts")
      .withIndex("by_studentId", (q) => q.eq("studentId", student._id))
      .unique();
    if (account) {
      await ctx.db.patch("portalAccounts", account._id, {
        loginEmail: value,
        normalizedLoginEmail: value,
        tokenIdentifier: undefined,
        status: "reserved",
        claimedAt: undefined,
        lastSignedInAt: undefined,
        updatedAt: now,
      });
    }
  } else if (field === "guardianPhone") {
    patch.guardianPhone = value;
    patch.normalizedGuardianPhone = value;
  } else if (field === "alternateGuardianPhone") {
    patch.alternateGuardianPhone = value || undefined;
  } else {
    patch[field] = value;
  }
  const merged = { ...student, ...patch };
  patch.searchText = studentSearchText(merged);
  await ctx.db.patch("students", student._id, patch);
  return value;
}
