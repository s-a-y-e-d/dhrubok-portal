import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireOwner, requireOwnerForFinancialMutation } from "../model/auth";
import { assertLocalDate, dhakaDate } from "../model/dates";
import { assertMinorUnits } from "../model/money";
import { writeAudit } from "../model/audit";
import { refreshFinancialSummary } from "./model";

export const refreshAgeingBatch = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("students")
      .withIndex("by_status_and_admissionDate", (q) => q.eq("status", "active"))
      .paginate({ numItems: 20, cursor: args.cursor });
    for (const student of page.page)
      await refreshFinancialSummary(ctx, student._id);
    const openPromises = await ctx.db
      .query("paymentPromises")
      .withIndex("by_status_and_promisedOn", (q) =>
        q.eq("status", "open").lt("promisedOn", dhakaDate()),
      )
      .take(100);
    for (const promise of openPromises)
      await ctx.db.patch("paymentPromises", promise._id, {
        status: "missed",
        resolvedAt: Date.now(),
      });
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.finance.receivables.refreshAgeingBatch,
        { cursor: page.continueCursor },
      );
    else
      await ctx.scheduler.runAfter(
        0,
        internal.finance.receivables.finalizeDailyRefresh,
        {},
      );
    return null;
  },
});

export const finalizeDailyRefresh = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const date = dhakaDate();
    const fromAt = Date.parse(`${date}T00:00:00+06:00`);
    const toAt = fromAt + 86_400_000;
    const [summaries, payments, adjustments, closings] = await Promise.all([
      ctx.db
        .query("studentFinancialSummaries")
        .withIndex("by_outstandingMinor")
        .take(1000),
      ctx.db
        .query("payments")
        .withIndex("by_status_and_paidAt", (q) =>
          q.eq("status", "posted").gte("paidAt", fromAt).lt("paidAt", toAt),
        )
        .take(1000),
      ctx.db
        .query("financeAdjustments")
        .withIndex("by_status_and_postedAt", (q) =>
          q.eq("status", "posted").gte("postedAt", fromAt).lt("postedAt", toAt),
        )
        .take(1000),
      ctx.db
        .query("cashDrawerSessions")
        .withIndex("by_businessDate", (q) => q.eq("businessDate", date))
        .take(20),
    ]);
    const value = {
      date,
      collectedMinor: payments.reduce((sum, row) => sum + row.amountMinor, 0),
      paymentCount: payments.length,
      refundedMinor: payments.reduce(
        (sum, row) => sum + (row.refundedAmountMinor ?? 0),
        0,
      ),
      outstandingMinor: summaries.reduce(
        (sum, row) => sum + row.outstandingMinor,
        0,
      ),
      overdueMinor: summaries.reduce((sum, row) => sum + row.overdueMinor, 0),
      overdueStudentsCount: summaries.filter((row) => row.overdueMinor > 0)
        .length,
      adjustmentMinor: adjustments.reduce(
        (sum, row) => sum + row.amountMinor,
        0,
      ),
      cashVarianceMinor: closings.reduce(
        (sum, row) => sum + (row.varianceMinor ?? 0),
        0,
      ),
      updatedAt: Date.now(),
    };
    const existing = await ctx.db
      .query("financeDailySnapshots")
      .withIndex("by_date", (q) => q.eq("date", date))
      .unique();
    if (existing)
      await ctx.db.patch("financeDailySnapshots", existing._id, value);
    else
      await ctx.db.insert("financeDailySnapshots", {
        ...value,
        createdAt: Date.now(),
      });
    const state = await ctx.db
      .query("financeOperationalState")
      .withIndex("by_key", (q) => q.eq("key", "finance"))
      .unique();
    const stateValue = {
      key: "finance" as const,
      lastReceivableRefreshAt: Date.now(),
      lastReceivableRefreshDate: date,
      summaryDriftCount: 0,
      summaryDriftMinor: 0,
      lastSnapshotAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (state)
      await ctx.db.patch("financeOperationalState", state._id, stateValue);
    else await ctx.db.insert("financeOperationalState", stateValue);
    return null;
  },
});

export const startDailyRefresh = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(
      0,
      internal.finance.receivables.refreshAgeingBatch,
      { cursor: null },
    );
    return null;
  },
});

export const backfillChargeScopes = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("studentCharges")
      .paginate({ numItems: 50, cursor: args.cursor });
    for (const charge of page.page)
      if (
        charge.enrolmentId &&
        (!charge.courseId || !charge.batchId || !charge.academicSessionId)
      ) {
        const enrolment = await ctx.db.get("enrolments", charge.enrolmentId);
        if (enrolment)
          await ctx.db.patch("studentCharges", charge._id, {
            courseId: enrolment.courseId,
            batchId: enrolment.batchId,
            academicSessionId: enrolment.academicSessionId,
          });
      }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.finance.receivables.backfillChargeScopes,
        { cursor: page.continueCursor },
      );
    return null;
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const allSummaries = await ctx.db
      .query("studentFinancialSummaries")
      .withIndex("by_outstandingMinor", (q) => q.gt("outstandingMinor", 0))
      .order("desc")
      .take(500);
    const summaries = allSummaries.filter((row) => row.overdueMinor > 0);
    const todayStart = new Date(`${dhakaDate()}T00:00:00+06:00`).getTime();
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_status_and_paidAt", (q) =>
        q.eq("status", "posted").gte("paidAt", todayStart),
      )
      .take(500);
    return {
      collectedTodayMinor: payments.reduce(
        (sum, row) => sum + row.amountMinor,
        0,
      ),
      paymentsToday: payments.length,
      overdueStudents: summaries.length,
      overdueMinor: summaries.reduce((sum, row) => sum + row.overdueMinor, 0),
      ageing: {
        currentMinor: allSummaries.reduce(
          (sum, row) =>
            sum + Math.max(0, row.outstandingMinor - row.overdueMinor),
          0,
        ),
        oneTo15Minor: summaries.reduce(
          (s, r) => s + (r.overdue1To15Minor ?? 0),
          0,
        ),
        sixteenTo30Minor: summaries.reduce(
          (s, r) => s + (r.overdue16To30Minor ?? 0),
          0,
        ),
        thirtyOneTo60Minor: summaries.reduce(
          (s, r) => s + (r.overdue31To60Minor ?? 0),
          0,
        ),
        sixtyOneTo90Minor: summaries.reduce(
          (s, r) => s + (r.overdue61To90Minor ?? 0),
          0,
        ),
        over90Minor: summaries.reduce(
          (s, r) => s + (r.overdueOver90Minor ?? 0),
          0,
        ),
      },
    };
  },
});

export const filterOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(100);
    const batches = await ctx.db
      .query("batches")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(200);
    return {
      courses: courses.map((row) => ({
        id: row._id,
        nameBn: row.nameBn,
        nameEn: row.nameEn,
      })),
      batches: batches.map((row) => ({
        id: row._id,
        courseId: row.courseId,
        nameBn: row.nameBn,
        nameEn: row.nameEn,
      })),
    };
  },
});

export const operationalStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const [state, sms, drawer, imports, campaigns, snapshots] =
      await Promise.all([
        ctx.db
          .query("financeOperationalState")
          .withIndex("by_key", (q) => q.eq("key", "finance"))
          .unique(),
        ctx.db
          .query("smsProviderSnapshots")
          .withIndex("by_checkedAt")
          .order("desc")
          .first(),
        ctx.db
          .query("cashDrawerSessions")
          .withIndex("by_status_and_businessDate", (q) =>
            q.eq("status", "open"),
          )
          .first(),
        ctx.db
          .query("paymentImportBatches")
          .withIndex("by_status_and_createdAt", (q) =>
            q.eq("status", "committing"),
          )
          .take(20),
        ctx.db
          .query("dueReminderCampaigns")
          .withIndex("by_status_and_createdAt", (q) => q.eq("status", "queued"))
          .take(20),
        ctx.db
          .query("financeDailySnapshots")
          .withIndex("by_date")
          .order("desc")
          .take(31),
      ]);
    const settings = (await ctx.db.query("coachingSettings").take(1))[0];
    return {
      state,
      smsProvider: {
        enabled: settings?.smsEnabled ?? true,
        checkedAt: sms?.checkedAt,
        status: sms?.providerStatus ?? "unknown",
        balanceMinor: sms?.balanceMinor,
      },
      openDrawer: drawer,
      activeImportCount: imports.length,
      activeCampaignCount: campaigns.length,
      snapshots,
    };
  },
});

export const worklist = query({
  args: {
    paginationOpts: paginationOptsValidator,
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const page = args.batchId
      ? await ctx.db
          .query("receivableScopeSummaries")
          .withIndex("by_batchId_and_overdueMinor", (q) =>
            q.eq("batchId", args.batchId).gt("overdueMinor", 0),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : args.courseId
        ? await ctx.db
            .query("receivableScopeSummaries")
            .withIndex("by_courseId_and_overdueMinor", (q) =>
              q.eq("courseId", args.courseId).gt("overdueMinor", 0),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("studentFinancialSummaries")
            .withIndex("by_overdueMinor", (q) => q.gt("overdueMinor", 0))
            .order("desc")
            .paginate(args.paginationOpts);
    const rows = await Promise.all(
      page.page.map(async (summary) => {
        const student = await ctx.db.get("students", summary.studentId);
        return {
          ...summary,
          displayName: student?.displayName ?? "",
          studentNumber: student?.studentNumber ?? "",
        };
      }),
    );
    return { ...page, page: rows };
  },
});

export const createPromise = mutation({
  args: {
    studentId: v.id("students"),
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    promisedAmountMinor: v.optional(v.number()),
    promisedOn: v.string(),
    note: v.string(),
  },
  returns: v.id("paymentPromises"),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    assertLocalDate(args.promisedOn);
    if (args.promisedAmountMinor !== undefined)
      assertMinorUnits(args.promisedAmountMinor);
    if (!args.note.trim()) throw new Error("Promise note is required");
    const student = await ctx.db.get("students", args.studentId);
    if (!student) throw new Error("Student not found");
    const id = await ctx.db.insert("paymentPromises", {
      ...args,
      note: args.note.trim(),
      status: "open",
      createdByAccountId: account._id,
      createdAt: Date.now(),
    });
    const summary = await ctx.db
      .query("studentFinancialSummaries")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .unique();
    if (summary)
      await ctx.db.patch("studentFinancialSummaries", summary._id, {
        nextPromiseDate: args.promisedOn,
      });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "payment_promise.created",
      entityType: "paymentPromise",
      entityId: id,
      summary: "Payment promise recorded",
    });
    return id;
  },
});
