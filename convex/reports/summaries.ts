import { internalAction, internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { assertDateRange, DASHBOARD_ROW_LIMIT, dhakaDayBounds } from "./shared";

async function buildDailySummary(ctx: MutationCtx, date: string) {
  assertDateRange(date, date);
  const { start, end } = dhakaDayBounds(date);
  const [students, batches, openSessions, submittedSessions, payments, overdue] = await Promise.all([
    ctx.db.query("students").withIndex("by_status_and_admissionDate", (q) => q.eq("status", "active")).take(DASHBOARD_ROW_LIMIT + 1),
    ctx.db.query("batches").withIndex("by_status", (q) => q.eq("status", "active")).take(DASHBOARD_ROW_LIMIT + 1),
    ctx.db.query("classSessions").withIndex("by_status_and_sessionDate", (q) => q.eq("status", "open").eq("sessionDate", date)).take(DASHBOARD_ROW_LIMIT + 1),
    ctx.db.query("classSessions").withIndex("by_status_and_sessionDate", (q) => q.eq("status", "submitted").eq("sessionDate", date)).take(DASHBOARD_ROW_LIMIT + 1),
    ctx.db.query("payments").withIndex("by_status_and_paidAt", (q) => q.eq("status", "posted").gte("paidAt", start).lt("paidAt", end)).take(DASHBOARD_ROW_LIMIT + 1),
    ctx.db.query("studentFinancialSummaries").withIndex("by_overdueMinor", (q) => q.gt("overdueMinor", 0)).take(DASHBOARD_ROW_LIMIT + 1),
  ]);
  const bounded = [students, batches, openSessions, submittedSessions, payments, overdue];
  if (bounded.some((rows) => rows.length > DASHBOARD_ROW_LIMIT)) {
    throw new Error(`Daily summary exceeded the ${DASHBOARD_ROW_LIMIT}-row rebuild safety limit`);
  }
  const attendance = submittedSessions.reduce(
    (total, session) => ({
      present: total.present + (session.presentCount ?? 0),
      late: total.late + (session.lateCount ?? 0),
      absent: total.absent + (session.absentCount ?? 0),
    }),
    { present: 0, late: 0, absent: 0 },
  );
  const value = {
    date,
    activeStudentCount: students.length,
    activeBatchCount: batches.length,
    scheduledSessionCount: openSessions.length + submittedSessions.length,
    submittedSessionCount: submittedSessions.length,
    presentCount: attendance.present,
    lateCount: attendance.late,
    absentCount: attendance.absent,
    paymentsCount: payments.length,
    collectedMinor: payments.reduce((sum, payment) => sum + payment.amountMinor, 0),
    overdueStudentsCount: overdue.length,
    overdueMinor: overdue.reduce((sum, summary) => sum + summary.overdueMinor, 0),
    updatedAt: Date.now(),
  };
  const existing = await ctx.db.query("dailyOperationalSummaries").withIndex("by_date", (q) => q.eq("date", date)).unique();
  if (existing) await ctx.db.patch("dailyOperationalSummaries", existing._id, value);
  else await ctx.db.insert("dailyOperationalSummaries", value);
  return value;
}

export const refreshDaily = mutation({
  args: { date: v.string() },
  returns: v.object({
    date: v.string(), activeStudentCount: v.number(), activeBatchCount: v.number(), scheduledSessionCount: v.number(), submittedSessionCount: v.number(),
    presentCount: v.number(), lateCount: v.number(), absentCount: v.number(), paymentsCount: v.number(), collectedMinor: v.number(),
    overdueStudentsCount: v.number(), overdueMinor: v.number(), updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    return await buildDailySummary(ctx, args.date);
  },
});

export const refreshDailyInternal = internalMutation({
  args: { date: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await buildDailySummary(ctx, args.date);
    return null;
  },
});

export const refreshToday = internalAction({
  args: {}, returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(Date.now());
    await ctx.runMutation(internal.reports.summaries.refreshDailyInternal, { date });
    return null;
  },
});
