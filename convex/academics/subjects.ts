import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import { cleanRequired, mustGet, normalizeCode, paginationResult } from "./shared";

const subjectListItem = v.object({
  subjectId: v.id("subjects"),
  code: v.string(),
  nameEn: v.string(),
  isConnected: v.boolean(),
});

const compatibleSubjectDoc = v.object({
  _id: v.id("subjects"), _creationTime: v.number(), code: v.string(),
  nameBn: v.string(), nameEn: v.string(),
  status: v.literal("active"), createdAt: v.number(), updatedAt: v.number(),
});

export const list = query({
  args: { status: v.optional(v.literal("active")), paginationOpts: paginationOptsValidator },
  returns: paginationResult(compatibleSubjectDoc),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const result = await ctx.db.query("subjects").withIndex("by_code").paginate(args.paginationOpts);
    return { ...result, page: result.page.map((subject) => ({ ...subject, nameBn: subject.nameEn, status: "active" as const })) };
  },
});

export const listCatalog = query({
  args: {},
  returns: v.array(subjectListItem),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const subjects = await ctx.db.query("subjects").withIndex("by_code").take(500);
    return await Promise.all(subjects.map(async (subject) => ({
      subjectId: subject._id,
      code: subject.code,
      nameEn: subject.nameEn,
      isConnected: Boolean((await ctx.db.query("courseSubjects").withIndex("by_subjectId", (q) => q.eq("subjectId", subject._id)).take(1)).length),
    })));
  },
});

export const create = mutation({ args: { code: v.string(), nameEn: v.string() }, returns: v.id("subjects"), handler: async (ctx, args) => { const { account } = await requireOwner(ctx); const code = normalizeCode(args.code); if (await ctx.db.query("subjects").withIndex("by_code", q => q.eq("code", code)).unique()) throw new Error("Subject code already exists"); const now = Date.now(); const id = await ctx.db.insert("subjects", { code, nameEn: cleanRequired(args.nameEn, "English name"), createdAt: now, updatedAt: now }); await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "subject.created", entityType: "subject", entityId: id, summary: "Subject created" }); return id; } });
export const update = mutation({ args: { subjectId: v.id("subjects"), code: v.string(), nameEn: v.string() }, returns: v.null(), handler: async (ctx, args) => { await requireOwner(ctx); await mustGet(ctx, "subjects", args.subjectId, "Subject"); const code = normalizeCode(args.code); const duplicate = await ctx.db.query("subjects").withIndex("by_code", q => q.eq("code", code)).unique(); if (duplicate && duplicate._id !== args.subjectId) throw new Error("Subject code already exists"); await ctx.db.patch("subjects", args.subjectId, { code, nameEn: cleanRequired(args.nameEn, "English name"), updatedAt: Date.now() }); return null; } });
export const remove = mutation({ args: { subjectId: v.id("subjects") }, returns: v.null(), handler: async (ctx, args) => { const { account } = await requireOwner(ctx); await mustGet(ctx, "subjects", args.subjectId, "Subject"); const links = await ctx.db.query("courseSubjects").withIndex("by_subjectId", q => q.eq("subjectId", args.subjectId)).take(1); if (links.length) throw new Error("A subject connected to a course cannot be deleted"); await ctx.db.delete("subjects", args.subjectId); await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "subject.deleted", entityType: "subject", entityId: args.subjectId, summary: "Subject permanently deleted" }); return null; } });
