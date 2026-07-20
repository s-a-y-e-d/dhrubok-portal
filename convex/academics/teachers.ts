import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import { normalizeEmail } from "../model/normalization";
import { accountStatusValidator } from "../model/validators";
import { cleanRequired, mustGet, normalizeCode, paginationResult, teacherDoc, teacherStatus } from "./shared";

const teacherFields = {
  employeeCode: v.string(), displayName: v.string(), nameBn: v.optional(v.string()), nameEn: v.optional(v.string()), loginEmail: v.string(), phone: v.string(),
  bioBn: v.string(), bioEn: v.string(), qualificationsBn: v.string(), qualificationsEn: v.string(), photoStorageId: v.optional(v.id("_storage")),
  status: v.union(v.literal("active"), v.literal("inactive")), isPublic: v.boolean(), publicSortOrder: v.number(), joinedAt: v.optional(v.number()),
};

async function validateTeacherPhoto(ctx: MutationCtx, storageId: Id<"_storage">) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata) throw new Error("Uploaded teacher image does not exist");
  if (!metadata.contentType || !["image/jpeg", "image/png", "image/webp"].includes(metadata.contentType.toLowerCase())) {
    throw new Error("Teacher image must be a JPEG, PNG, or WebP file");
  }
  if (metadata.size > 8 * 1024 * 1024) throw new Error("Teacher image must be 8 MB or smaller");
}

export const generatePhotoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({ args: { status: teacherStatus, paginationOpts: paginationOptsValidator }, returns: paginationResult(teacherDoc), handler: async (ctx, args) => { await requireOwner(ctx); return await ctx.db.query("teachers").withIndex("by_status", q => q.eq("status", args.status)).paginate(args.paginationOpts); } });
export const get = query({
  args: { teacherId: v.id("teachers") },
  returns: v.object({
    teacher: teacherDoc,
    accountStatus: accountStatusValidator,
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const teacher = await mustGet(ctx, "teachers", args.teacherId, "Teacher");
    const account = await ctx.db
      .query("portalAccounts")
      .withIndex("by_teacherId", (q) => q.eq("teacherId", args.teacherId))
      .unique();
    if (!account) throw new Error("Teacher portal account not found");
    return { teacher, accountStatus: account.status };
  },
});

export const createWithReservedAccount = mutation({ args: { ...teacherFields, locale: v.union(v.literal("bn"), v.literal("en")) }, returns: v.object({ teacherId: v.id("teachers"), accountId: v.id("portalAccounts") }), handler: async (ctx, args) => {
  const { account } = await requireOwner(ctx); const employeeCode = normalizeCode(args.employeeCode); const normalizedLoginEmail = normalizeEmail(args.loginEmail);
  if (args.photoStorageId) await validateTeacherPhoto(ctx, args.photoStorageId);
  if (await ctx.db.query("teachers").withIndex("by_employeeCode", q => q.eq("employeeCode", employeeCode)).unique()) throw new Error("Teacher employee code already exists");
  if (await ctx.db.query("teachers").withIndex("by_normalizedLoginEmail", q => q.eq("normalizedLoginEmail", normalizedLoginEmail)).unique()) throw new Error("Teacher email already exists");
  if (await ctx.db.query("portalAccounts").withIndex("by_normalizedLoginEmail", q => q.eq("normalizedLoginEmail", normalizedLoginEmail)).unique()) throw new Error("An account already uses this email");
  if (args.isPublic && args.status !== "active") throw new Error("Only active teachers may be public");
  const now = Date.now(); const { locale, ...teacher } = args; const teacherId = await ctx.db.insert("teachers", { ...teacher, employeeCode, displayName: cleanRequired(args.displayName, "Display name"), loginEmail: args.loginEmail.trim(), normalizedLoginEmail, createdAt: now, updatedAt: now });
  const accountId = await ctx.db.insert("portalAccounts", { role: "teacher", status: "reserved", loginEmail: args.loginEmail.trim(), normalizedLoginEmail, teacherId, locale, createdAt: now, updatedAt: now, createdByAccountId: account._id });
  await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "teacher.created", entityType: "teacher", entityId: teacherId, summary: "Teacher and reserved portal account created" }); return { teacherId, accountId };
} });

export const update = mutation({ args: { teacherId: v.id("teachers"), ...teacherFields }, returns: v.null(), handler: async (ctx, args) => {
  await requireOwner(ctx); const current = await mustGet(ctx, "teachers", args.teacherId, "Teacher"); if (current.status === "archived") throw new Error("Archived teachers cannot be edited"); const employeeCode = normalizeCode(args.employeeCode); const normalizedLoginEmail = normalizeEmail(args.loginEmail);
  if (args.photoStorageId) await validateTeacherPhoto(ctx, args.photoStorageId);
  const codeDuplicate = await ctx.db.query("teachers").withIndex("by_employeeCode", q => q.eq("employeeCode", employeeCode)).unique(); const emailDuplicate = await ctx.db.query("teachers").withIndex("by_normalizedLoginEmail", q => q.eq("normalizedLoginEmail", normalizedLoginEmail)).unique(); if (codeDuplicate && codeDuplicate._id !== args.teacherId) throw new Error("Teacher employee code already exists"); if (emailDuplicate && emailDuplicate._id !== args.teacherId) throw new Error("Teacher email already exists");
  const portalAccount = await ctx.db.query("portalAccounts").withIndex("by_teacherId", q => q.eq("teacherId", args.teacherId)).unique(); if (!portalAccount) throw new Error("Teacher portal account not found"); if (normalizedLoginEmail !== current.normalizedLoginEmail) { if (portalAccount.status !== "reserved") throw new Error("Email cannot be changed after the teacher account is claimed"); const accountDuplicate = await ctx.db.query("portalAccounts").withIndex("by_normalizedLoginEmail", q => q.eq("normalizedLoginEmail", normalizedLoginEmail)).unique(); if (accountDuplicate && accountDuplicate._id !== portalAccount._id) throw new Error("An account already uses this email"); await ctx.db.patch("portalAccounts", portalAccount._id, { loginEmail: args.loginEmail.trim(), normalizedLoginEmail, updatedAt: Date.now() }); }
  if (args.isPublic && args.status !== "active") throw new Error("Only active teachers may be public"); if (args.status === "inactive" && current.status === "active") { const activeAssignments = await ctx.db.query("teacherBatchAssignments").withIndex("by_teacherId_and_status", q => q.eq("teacherId", args.teacherId).eq("status", "active")).take(1); if (activeAssignments.length) throw new Error("Teacher with active assignments cannot be made inactive"); } const { teacherId, ...patch } = args; await ctx.db.patch("teachers", teacherId, { ...patch, employeeCode, displayName: cleanRequired(args.displayName, "Display name"), loginEmail: args.loginEmail.trim(), normalizedLoginEmail, updatedAt: Date.now() }); if (args.status === "inactive" && portalAccount.status === "active") await ctx.db.patch("portalAccounts", portalAccount._id, { status: "suspended", updatedAt: Date.now() }); return null;
} });

export const archive = mutation({ args: { teacherId: v.id("teachers") }, returns: v.null(), handler: async (ctx, args) => { const { account } = await requireOwner(ctx); const teacher = await mustGet(ctx, "teachers", args.teacherId, "Teacher"); if (teacher.status === "archived") return null; const activeAssignments = await ctx.db.query("teacherBatchAssignments").withIndex("by_teacherId_and_status", q => q.eq("teacherId", args.teacherId).eq("status", "active")).take(1); const schedules = await ctx.db.query("batchSchedules").withIndex("by_teacherId_and_status", q => q.eq("teacherId", args.teacherId).eq("status", "active")).take(1); if (activeAssignments.length || schedules.length) throw new Error("Teacher with active assignments or schedules cannot be archived"); await ctx.db.patch("teachers", args.teacherId, { status: "archived", isPublic: false, updatedAt: Date.now() }); const portalAccount = await ctx.db.query("portalAccounts").withIndex("by_teacherId", q => q.eq("teacherId", args.teacherId)).unique(); if (portalAccount && portalAccount.status !== "revoked") await ctx.db.patch("portalAccounts", portalAccount._id, { status: "revoked", updatedAt: Date.now() }); await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "teacher.archived", entityType: "teacher", entityId: args.teacherId, summary: "Teacher and portal access archived" }); return null; } });
