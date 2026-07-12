import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import { estimateSmsSegments, renderSmsTemplate } from "./templates";

const templateKey = v.union(
  v.literal("admission_received"), v.literal("admission_accepted"), v.literal("payment_posted"),
  v.literal("attendance_late"), v.literal("attendance_absent"), v.literal("result_published"),
  v.literal("result_corrected"), v.literal("due_reminder"), v.literal("custom_notice"),
);

const item = v.object({
  templateId: v.id("smsTemplates"), key: v.string(), name: v.string(), bodyBn: v.string(), bodyEn: v.string(),
  enabled: v.boolean(), variables: v.array(v.string()), updatedAt: v.number(),
});

function extractVariables(body: string) {
  return [...new Set([...body.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((match) => match[1]))].sort();
}

export const list = query({
  args: {}, returns: v.array(item),
  handler: async (ctx) => {
    await requireOwner(ctx);
    return (await ctx.db.query("smsTemplates").take(50)).map((row) => ({ templateId: row._id, key: row.key, name: row.name, bodyBn: row.bodyBn, bodyEn: row.bodyEn, enabled: row.enabled, variables: row.variables, updatedAt: row.updatedAt }));
  },
});

export const save = mutation({
  args: { key: templateKey, name: v.string(), bodyBn: v.string(), bodyEn: v.string(), enabled: v.boolean() },
  returns: v.id("smsTemplates"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const name = args.name.trim();
    const bodyBn = args.bodyBn.trim();
    const bodyEn = args.bodyEn.trim();
    if (!name || name.length > 100) throw new Error("Template name is required and must be at most 100 characters");
    if (!bodyBn || !bodyEn || bodyBn.length > 2_000 || bodyEn.length > 2_000) throw new Error("Both template languages are required and must be at most 2000 characters");
    const variables = [...new Set([...extractVariables(bodyBn), ...extractVariables(bodyEn)])];
    if (variables.length > 24) throw new Error("Template has too many variables");
    const existing = await ctx.db.query("smsTemplates").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    const updatedAt = Date.now();
    let id;
    if (existing) {
      id = existing._id;
      await ctx.db.patch("smsTemplates", id, { name, bodyBn, bodyEn, enabled: args.enabled, variables, updatedAt, updatedByAccountId: account._id });
    } else {
      id = await ctx.db.insert("smsTemplates", { key: args.key, name, bodyBn, bodyEn, enabled: args.enabled, variables, updatedAt, updatedByAccountId: account._id });
    }
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "sms.template_saved", entityType: "smsTemplate", entityId: id, summary: "SMS template configuration saved", metadata: { key: args.key, enabled: args.enabled } });
    return id;
  },
});

export const preview = query({
  args: { key: templateKey, locale: v.union(v.literal("bn"), v.literal("en")), variables: v.array(v.object({ key: v.string(), value: v.string() })) },
  returns: v.object({ body: v.string(), missingVariables: v.array(v.string()), characterCount: v.number(), segmentCount: v.number(), encoding: v.union(v.literal("gsm"), v.literal("ucs2")) }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const template = await ctx.db.query("smsTemplates").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    if (!template) throw new Error("Template not found");
    const values = Object.fromEntries(args.variables.slice(0, 50).map(({ key, value }) => [key, value]));
    const rendered = renderSmsTemplate(args.locale === "bn" ? template.bodyBn : template.bodyEn, values);
    return { ...rendered, ...estimateSmsSegments(rendered.body) };
  },
});

export const latestBalance = query({
  args: {}, returns: v.union(v.object({ checkedAt: v.number(), balanceMinor: v.union(v.number(), v.null()), providerStatus: v.string(), error: v.union(v.string(), v.null()), isLow: v.boolean() }), v.null()),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const snapshot = (await ctx.db.query("smsProviderSnapshots").withIndex("by_checkedAt").order("desc").take(1))[0];
    if (!snapshot) return null;
    return { checkedAt: snapshot.checkedAt, balanceMinor: snapshot.balanceMinor ?? null, providerStatus: snapshot.providerStatus, error: snapshot.error ?? null, isLow: snapshot.balanceMinor !== undefined && snapshot.balanceMinor < 5_000 };
  },
});

const defaults = [
  ["admission_received", "Admission received", "ধ্রুবক: {studentName}-এর ভর্তি আবেদন গ্রহণ করা হয়েছে। রেফারেন্স: {applicationNumber}", "Dhrubok: Admission application received for {studentName}. Reference: {applicationNumber}"],
  ["admission_accepted", "Admission accepted", "ধ্রুবক: {studentName}-এর ভর্তি নিশ্চিত হয়েছে। শিক্ষার্থী আইডি: {studentNumber}", "Dhrubok: Admission confirmed for {studentName}. Student ID: {studentNumber}"],
  ["payment_posted", "Payment confirmation", "ধ্রুবক: {studentName}-এর ৳ {amount} পেমেন্ট গ্রহণ করা হয়েছে। রশিদ: {receiptNumber}", "Dhrubok: Payment of BDT {amount} received for {studentName}. Receipt: {receiptNumber}"],
  ["attendance_late", "Attendance late", "ধ্রুবক: {studentName} আজ ক্লাসে দেরিতে উপস্থিত হয়েছে।", "Dhrubok: {studentName} was late to class today."],
  ["attendance_absent", "Attendance absent", "ধ্রুবক: {studentName} আজ ক্লাসে অনুপস্থিত ছিল।", "Dhrubok: {studentName} was absent from class today."],
  ["result_published", "Result published", "ধ্রুবক: {studentName}-এর {examName} ফল প্রকাশিত। ফল: {outcome}, মেধাস্থান: {meritPosition}", "Dhrubok: {examName} result for {studentName}: {outcome}, merit position {meritPosition}."],
  ["result_corrected", "Result corrected", "ধ্রুবক: {studentName}-এর {examName} সংশোধিত ফল প্রকাশিত। ফল: {outcome}, মেধাস্থান: {meritPosition}", "Dhrubok: Corrected {examName} result for {studentName}: {outcome}, merit position {meritPosition}."],
  ["due_reminder", "Due reminder", "ধ্রুবক: {studentName}-এর বকেয়া ৳ {amount}। অনুগ্রহ করে অফিসে যোগাযোগ করুন।", "Dhrubok: {studentName} has overdue fees of BDT {amount}. Please contact the office."],
  ["custom_notice", "Custom notice", "ধ্রুবক: {notice}", "Dhrubok: {notice}"],
] as const;

export const seedDefaults = mutation({
  args: {}, returns: v.number(),
  handler: async (ctx) => {
    const { account } = await requireOwner(ctx);
    let created = 0;
    for (const [key, name, bodyBn, bodyEn] of defaults) {
      if (await ctx.db.query("smsTemplates").withIndex("by_key", (q) => q.eq("key", key)).unique()) continue;
      const variables = [...new Set([...extractVariables(bodyBn), ...extractVariables(bodyEn)])];
      await ctx.db.insert("smsTemplates", { key, name, bodyBn, bodyEn, enabled: true, variables, updatedAt: Date.now(), updatedByAccountId: account._id });
      created += 1;
    }
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "sms.templates_seeded", entityType: "smsTemplate", entityId: "defaults", summary: "Default SMS templates initialized", metadata: { created } });
    return created;
  },
});
