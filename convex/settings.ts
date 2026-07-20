import { v } from "convex/values";
import { mutation, query, env } from "./_generated/server";
import { localeValidator } from "./model/validators";
import { requireOwner } from "./model/auth";
import { writeAudit } from "./model/audit";
import { normalizeEmail, normalizeBangladeshPhone } from "./model/normalization";

const publicSettingsValidator = v.object({
  nameBn: v.string(), nameEn: v.string(), shortNameBn: v.string(), shortNameEn: v.string(),
  addressBn: v.string(), addressEn: v.string(), phone: v.string(), email: v.string(), websiteUrl: v.union(v.string(), v.null()),
  defaultLocale: localeValidator, publicAdmissionsOpen: v.boolean(), logoUrl: v.union(v.string(), v.null()),
});

const ownerSettingsValidator = v.object({
  settingsId: v.id("coachingSettings"), nameBn: v.string(), nameEn: v.string(), shortNameBn: v.string(), shortNameEn: v.string(),
  defaultLocale: localeValidator, defaultGuardianSmsLocale: localeValidator,
  publicAdmissionsOpen: v.boolean(), smsEnabled: v.boolean(), receiptFooterBn: v.string(), receiptFooterEn: v.string(), updatedAt: v.number(),
  smsConfigured: v.boolean(), smsSenderIdConfigured: v.boolean(),
});

export const getOwner = query({
  args: {}, returns: v.union(ownerSettingsValidator, v.null()),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const current = (await ctx.db.query("coachingSettings").take(1))[0];
    return current ? {
      settingsId: current._id,
      nameBn: current.nameBn,
      nameEn: current.nameEn,
      shortNameBn: current.shortNameBn,
      shortNameEn: current.shortNameEn,
      defaultLocale: current.defaultLocale,
      defaultGuardianSmsLocale: current.defaultGuardianSmsLocale,
      publicAdmissionsOpen: current.publicAdmissionsOpen,
      smsEnabled: current.smsEnabled,
      receiptFooterBn: current.receiptFooterBn,
      receiptFooterEn: current.receiptFooterEn,
      updatedAt: current.updatedAt,
      smsConfigured: Boolean(env.BULKSMSBD_KEY?.trim()),
      smsSenderIdConfigured: Boolean(env.BULKSMSBD_SENDER_ID?.trim()),
    } : null;
  },
});

export const getPublic = query({
  args: {},
  returns: v.union(publicSettingsValidator, v.null()),
  handler: async (ctx) => {
    const settings = await ctx.db.query("coachingSettings").take(1);
    const current = settings[0];
    if (!current) return null;
    return {
      nameBn: current.nameBn, nameEn: current.nameEn, shortNameBn: current.shortNameBn, shortNameEn: current.shortNameEn,
      addressBn: current.addressBn, addressEn: current.addressEn, phone: current.phone, email: current.email,
      websiteUrl: current.websiteUrl ?? null, defaultLocale: current.defaultLocale, publicAdmissionsOpen: current.publicAdmissionsOpen,
      logoUrl: current.logoStorageId ? await ctx.storage.getUrl(current.logoStorageId) : null,
    };
  },
});

export const initialize = mutation({
  args: {
    nameBn: v.string(), nameEn: v.string(), shortNameBn: v.string(), shortNameEn: v.string(), addressBn: v.string(), addressEn: v.string(),
    phone: v.string(), email: v.string(), defaultLocale: localeValidator, defaultGuardianSmsLocale: localeValidator,
  },
  returns: v.id("coachingSettings"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    if ((await ctx.db.query("coachingSettings").take(1)).length > 0) throw new Error("Coaching settings already exist");
    const now = Date.now();
    const id = await ctx.db.insert("coachingSettings", {
      ...args,
      phone: normalizeBangladeshPhone(args.phone),
      email: normalizeEmail(args.email),
      timezone: "Asia/Dhaka",
      currency: "BDT",
      receiptPrefix: "RCPT",
      studentIdPrefix: "ST",
      applicationPrefix: "APP",
      receiptFooterBn: "ধন্যবাদ",
      receiptFooterEn: "Thank you",
      smsEnabled: false,
      publicAdmissionsOpen: false,
      createdAt: now,
      updatedAt: now,
      updatedByAccountId: account._id,
    });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "settings.initialized", entityType: "coachingSettings", entityId: id, summary: "Coaching settings initialized" });
    return id;
  },
});

export const updateOperations = mutation({
  args: {
    expectedUpdatedAt: v.number(),
    monthlyDueDay: v.optional(v.number()),
    defaultLocale: localeValidator, defaultGuardianSmsLocale: localeValidator,
    publicAdmissionsOpen: v.boolean(), smsEnabled: v.boolean(), receiptFooterBn: v.string(), receiptFooterEn: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    if (args.monthlyDueDay !== undefined && (!Number.isInteger(args.monthlyDueDay) || args.monthlyDueDay < 1 || args.monthlyDueDay > 28)) throw new Error("Monthly due day must be between 1 and 28");
    const settings = (await ctx.db.query("coachingSettings").take(1))[0];
    if (!settings) throw new Error("Coaching settings are not initialized");
    if (settings.updatedAt !== args.expectedUpdatedAt) throw new Error("Settings have been modified by another owner. Please reload and try again.");
    const updateData = {
      defaultLocale: args.defaultLocale,
      defaultGuardianSmsLocale: args.defaultGuardianSmsLocale,
      publicAdmissionsOpen: args.publicAdmissionsOpen,
      smsEnabled: args.smsEnabled,
      receiptFooterBn: args.receiptFooterBn,
      receiptFooterEn: args.receiptFooterEn,
    };
    await ctx.db.patch("coachingSettings", settings._id, { ...updateData, updatedAt: Date.now(), updatedByAccountId: account._id });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "settings.operations_updated", entityType: "coachingSettings", entityId: settings._id, summary: "Operational settings updated" });
    return null;
  },
});

export const setSmsEnabled = mutation({
  args: { enabled: v.boolean(), expectedUpdatedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const settings = (await ctx.db.query("coachingSettings").take(1))[0];
    if (!settings) throw new Error("Coaching settings are not initialized");
    if (settings.updatedAt !== args.expectedUpdatedAt)
      throw new Error("Settings have been modified by another owner. Please reload and try again.");
    const updatedAt = Date.now();
    await ctx.db.patch("coachingSettings", settings._id, { smsEnabled: args.enabled, updatedAt, updatedByAccountId: account._id });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "settings.sms_delivery_updated", entityType: "coachingSettings", entityId: settings._id, summary: args.enabled ? "Enabled SMS delivery" : "Disabled SMS delivery" });
    return null;
  },
});
