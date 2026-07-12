import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";
import { academicSessionDoc, academicStatus, assertDateRange, cleanRequired, mustGet, paginationResult } from "./shared";

export const list = query({
  args: { status: academicStatus, paginationOpts: paginationOptsValidator }, returns: paginationResult(academicSessionDoc),
  handler: async (ctx, args) => { await requireOwner(ctx); return await ctx.db.query("academicSessions").withIndex("by_status", q => q.eq("status", args.status)).order("desc").paginate(args.paginationOpts); },
});
export const get = query({ args: { sessionId: v.id("academicSessions") }, returns: academicSessionDoc, handler: async (ctx, args) => { await requireOwner(ctx); return await mustGet(ctx, "academicSessions", args.sessionId, "Academic session"); } });

export const create = mutation({
  args: { nameBn: v.string(), nameEn: v.string(), startDate: v.string(), endDate: v.string(), status: academicStatus }, returns: v.id("academicSessions"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx); assertDateRange(args.startDate, args.endDate); const now = Date.now();
    const id = await ctx.db.insert("academicSessions", { ...args, nameBn: cleanRequired(args.nameBn, "Bangla name"), nameEn: cleanRequired(args.nameEn, "English name"), createdAt: now, updatedAt: now });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "academic_session.created", entityType: "academicSession", entityId: id, summary: "Academic session created" }); return id;
  },
});

export const update = mutation({
  args: { sessionId: v.id("academicSessions"), nameBn: v.string(), nameEn: v.string(), startDate: v.string(), endDate: v.string(), status: v.union(v.literal("planned"), v.literal("active"), v.literal("completed")) }, returns: v.null(),
  handler: async (ctx, args) => { const { account } = await requireOwner(ctx); const current = await mustGet(ctx, "academicSessions", args.sessionId, "Academic session"); if (current.status === "archived") throw new Error("Archived academic sessions cannot be edited"); assertDateRange(args.startDate, args.endDate); await ctx.db.patch("academicSessions", args.sessionId, { nameBn: cleanRequired(args.nameBn, "Bangla name"), nameEn: cleanRequired(args.nameEn, "English name"), startDate: args.startDate, endDate: args.endDate, status: args.status, updatedAt: Date.now() }); await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "academic_session.updated", entityType: "academicSession", entityId: args.sessionId, summary: "Academic session updated" }); return null; },
});

export const archive = mutation({
  args: { sessionId: v.id("academicSessions") }, returns: v.null(),
  handler: async (ctx, args) => { const { account } = await requireOwner(ctx); const current = await mustGet(ctx, "academicSessions", args.sessionId, "Academic session"); if (current.status === "archived") return null; const childCounts = await Promise.all(["draft", "active", "completed"].map(status => ctx.db.query("courses").withIndex("by_academicSessionId_and_status", q => q.eq("academicSessionId", args.sessionId).eq("status", status as "draft" | "active" | "completed")).take(1))); const batchCounts = await Promise.all(["planned", "active", "completed"].map(status => ctx.db.query("batches").withIndex("by_academicSessionId_and_status", q => q.eq("academicSessionId", args.sessionId).eq("status", status as "planned" | "active" | "completed")).take(1))); if (childCounts.some(rows => rows.length) || batchCounts.some(rows => rows.length)) throw new Error("Academic session with non-archived courses or batches cannot be archived"); await ctx.db.patch("academicSessions", args.sessionId, { status: "archived", updatedAt: Date.now() }); await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "academic_session.archived", entityType: "academicSession", entityId: args.sessionId, summary: "Academic session archived" }); return null; },
});
