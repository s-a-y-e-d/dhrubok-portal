import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { query } from "../_generated/server";
import { paymentMethodValidator } from "../model/validators";
import { requireOwner } from "../model/auth";
import { requireOwnerOrStudent } from "./shared";

const pageFields = {
  isDone: v.boolean(),
  continueCursor: v.string(),
  splitCursor: v.optional(v.union(v.string(), v.null())),
  pageStatus: v.optional(
    v.union(
      v.literal("SplitRecommended"),
      v.literal("SplitRequired"),
      v.null(),
    ),
  ),
};

export const collections = query({
  args: {
    fromAt: v.number(),
    toAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        paymentId: v.id("payments"),
        paymentNumber: v.string(),
        receiptNumber: v.string(),
        studentId: v.id("students"),
        studentNumber: v.string(),
        studentName: v.string(),
        amountMinor: v.number(),
        method: paymentMethodValidator,
        paidAt: v.number(),
        collectedByAccountId: v.id("portalAccounts"),
      }),
    ),
    ...pageFields,
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (
      !Number.isFinite(args.fromAt) ||
      !Number.isFinite(args.toAt) ||
      args.fromAt >= args.toAt
    )
      throw new Error("Invalid collection range");
    const page = await ctx.db
      .query("payments")
      .withIndex("by_status_and_paidAt", (q) =>
        q
          .eq("status", "posted")
          .gte("paidAt", args.fromAt)
          .lt("paidAt", args.toAt),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (payment) => {
          const student = await ctx.db.get("students", payment.studentId);
          return {
            paymentId: payment._id,
            paymentNumber: payment.paymentNumber,
            receiptNumber: payment.receiptNumber,
            studentId: payment.studentId,
            studentNumber: student?.studentNumber ?? "",
            studentName: student?.displayName ?? "",
            amountMinor: payment.amountMinor,
            method: payment.method,
            paidAt: payment.paidAt,
            collectedByAccountId: payment.collectedByAccountId,
          };
        }),
      ),
    };
  },
});

export const paymentMethodBreakdown = query({
  args: { fromAt: v.number(), toAt: v.number() },
  returns: v.object({
    rows: v.array(
      v.object({
        method: paymentMethodValidator,
        paymentCount: v.number(),
        collectedMinor: v.number(),
      }),
    ),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.fromAt >= args.toAt) throw new Error("Invalid collection range");
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_status_and_paidAt", (q) =>
        q
          .eq("status", "posted")
          .gte("paidAt", args.fromAt)
          .lt("paidAt", args.toAt),
      )
      .take(1001);
    const totals = new Map<
      string,
      {
        method: (typeof payments)[number]["method"];
        paymentCount: number;
        collectedMinor: number;
      }
    >();
    for (const payment of payments.slice(0, 1000)) {
      const current = totals.get(payment.method) ?? {
        method: payment.method,
        paymentCount: 0,
        collectedMinor: 0,
      };
      current.paymentCount += 1;
      current.collectedMinor += payment.amountMinor;
      totals.set(payment.method, current);
    }
    return { rows: [...totals.values()], truncated: payments.length > 1000 };
  },
});

export const dues = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        studentId: v.id("students"),
        studentNumber: v.string(),
        studentName: v.string(),
        guardianPhone: v.string(),
        outstandingMinor: v.number(),
        overdueMinor: v.number(),
        advanceCreditMinor: v.number(),
        oldestUnpaidDueDate: v.union(v.string(), v.null()),
      }),
    ),
    ...pageFields,
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const page = await ctx.db
      .query("studentFinancialSummaries")
      .withIndex("by_outstandingMinor", (q) => q.gt("outstandingMinor", 0))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (summary) => {
          const [student, charges] = await Promise.all([
            ctx.db.get("students", summary.studentId),
            ctx.db
              .query("studentCharges")
              .withIndex("by_studentId_and_dueDate", (q) =>
                q.eq("studentId", summary.studentId),
              )
              .take(1000),
          ]);
          const unpaid = charges.find(
            (charge) =>
              !["paid", "waived", "voided"].includes(charge.status) &&
              charge.netAmountMinor > charge.paidAmountMinor,
          );
          return {
            studentId: summary.studentId,
            studentNumber: student?.studentNumber ?? "",
            studentName: student?.displayName ?? "",
            guardianPhone: student?.guardianPhone ?? "",
            outstandingMinor: summary.outstandingMinor,
            overdueMinor: summary.overdueMinor,
            advanceCreditMinor: summary.advanceCreditMinor,
            oldestUnpaidDueDate: unpaid?.dueDate ?? null,
          };
        }),
      ),
    };
  },
});

export const discounts = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        discountPolicyId: v.id("discountPolicies"),
        studentId: v.union(v.id("students"), v.null()),
        studentName: v.string(),
        kind: v.string(),
        valueMinor: v.union(v.number(), v.null()),
        percentageBasisPoints: v.union(v.number(), v.null()),
        reason: v.string(),
        startsOn: v.string(),
        endsOn: v.union(v.string(), v.null()),
        status: v.string(),
      }),
    ),
    ...pageFields,
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const page = await ctx.db
      .query("discountPolicies")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (policy) => {
          const student = policy.studentId
            ? await ctx.db.get("students", policy.studentId)
            : null;
          return {
            discountPolicyId: policy._id,
            studentId: policy.studentId ?? null,
            studentName: student?.displayName ?? "",
            kind: policy.kind,
            valueMinor: policy.valueMinor ?? null,
            percentageBasisPoints: policy.percentageBasisPoints ?? null,
            reason: policy.reason,
            startsOn: policy.startsOn,
            endsOn: policy.endsOn ?? null,
            status: policy.status,
          };
        }),
      ),
    };
  },
});

export const advances = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        studentId: v.id("students"),
        studentNumber: v.string(),
        studentName: v.string(),
        advanceCreditMinor: v.number(),
        updatedAt: v.number(),
      }),
    ),
    ...pageFields,
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const page = await ctx.db
      .query("studentFinancialSummaries")
      .order("desc")
      .paginate(args.paginationOpts);
    const advances = page.page.filter(
      (summary) => summary.advanceCreditMinor > 0,
    );
    return {
      ...page,
      page: await Promise.all(
        advances.map(async (summary) => {
          const student = await ctx.db.get("students", summary.studentId);
          return {
            studentId: summary.studentId,
            studentNumber: student?.studentNumber ?? "",
            studentName: student?.displayName ?? "",
            advanceCreditMinor: summary.advanceCreditMinor,
            updatedAt: summary.updatedAt,
          };
        }),
      ),
    };
  },
});

export const voidedPayments = query({
  args: {
    fromAt: v.number(),
    toAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        paymentId: v.id("payments"),
        paymentNumber: v.string(),
        receiptNumber: v.string(),
        studentId: v.id("students"),
        studentName: v.string(),
        amountMinor: v.number(),
        paidAt: v.number(),
        voidedAt: v.union(v.number(), v.null()),
        voidReason: v.string(),
      }),
    ),
    ...pageFields,
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.fromAt >= args.toAt) throw new Error("Invalid payment range");
    const page = await ctx.db
      .query("payments")
      .withIndex("by_status_and_paidAt", (q) =>
        q
          .eq("status", "voided")
          .gte("paidAt", args.fromAt)
          .lt("paidAt", args.toAt),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (payment) => ({
          paymentId: payment._id,
          paymentNumber: payment.paymentNumber,
          receiptNumber: payment.receiptNumber,
          studentId: payment.studentId,
          studentName:
            (await ctx.db.get("students", payment.studentId))?.displayName ??
            "",
          amountMinor: payment.amountMinor,
          paidAt: payment.paidAt,
          voidedAt: payment.voidedAt ?? null,
          voidReason: payment.voidReason ?? "",
        })),
      ),
    };
  },
});

export const studentStatement = query({
  args: {
    studentId: v.id("students"),
    chargeLimit: v.number(),
    paymentLimit: v.number(),
  },
  returns: v.object({
    student: v.object({
      studentNumber: v.string(),
      displayName: v.string(),
      guardianName: v.string(),
    }),
    summary: v.object({
      totalChargedMinor: v.number(),
      totalDiscountMinor: v.number(),
      totalPaidMinor: v.number(),
      outstandingMinor: v.number(),
      overdueMinor: v.number(),
      advanceCreditMinor: v.number(),
    }),
    charges: v.array(
      v.object({
        chargeNumber: v.string(),
        descriptionBn: v.string(),
        descriptionEn: v.string(),
        netAmountMinor: v.number(),
        paidAmountMinor: v.number(),
        dueDate: v.string(),
        status: v.string(),
      }),
    ),
    payments: v.array(
      v.object({
        receiptNumber: v.string(),
        amountMinor: v.number(),
        method: paymentMethodValidator,
        paidAt: v.number(),
        status: v.string(),
      }),
    ),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireOwnerOrStudent(ctx, args.studentId);
    if (
      !Number.isInteger(args.chargeLimit) ||
      !Number.isInteger(args.paymentLimit) ||
      args.chargeLimit < 1 ||
      args.paymentLimit < 1 ||
      args.chargeLimit > 500 ||
      args.paymentLimit > 500
    )
      throw new Error("Statement limits must be between 1 and 500");
    const [student, summary, charges, payments] = await Promise.all([
      ctx.db.get("students", args.studentId),
      ctx.db
        .query("studentFinancialSummaries")
        .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
        .unique(),
      ctx.db
        .query("studentCharges")
        .withIndex("by_studentId_and_dueDate", (q) =>
          q.eq("studentId", args.studentId),
        )
        .order("desc")
        .take(args.chargeLimit + 1),
      ctx.db
        .query("payments")
        .withIndex("by_studentId_and_paidAt", (q) =>
          q.eq("studentId", args.studentId),
        )
        .order("desc")
        .take(args.paymentLimit + 1),
    ]);
    if (!student) throw new Error("Student not found");
    return {
      student: {
        studentNumber: student.studentNumber,
        displayName: student.displayName,
        guardianName: student.guardianName,
      },
      summary: {
        totalChargedMinor: summary?.totalChargedMinor ?? 0,
        totalDiscountMinor: summary?.totalDiscountMinor ?? 0,
        totalPaidMinor: summary?.totalPaidMinor ?? 0,
        outstandingMinor: summary?.outstandingMinor ?? 0,
        overdueMinor: summary?.overdueMinor ?? 0,
        advanceCreditMinor: summary?.advanceCreditMinor ?? 0,
      },
      charges: charges
        .slice(0, args.chargeLimit)
        .map((charge) => ({
          chargeNumber: charge.chargeNumber,
          descriptionBn: charge.descriptionBn,
          descriptionEn: charge.descriptionEn,
          netAmountMinor: charge.netAmountMinor,
          paidAmountMinor: charge.paidAmountMinor,
          dueDate: charge.dueDate,
          status: charge.status,
        })),
      payments: payments
        .slice(0, args.paymentLimit)
        .map((payment) => ({
          receiptNumber: payment.receiptNumber,
          amountMinor: payment.amountMinor,
          method: payment.method,
          paidAt: payment.paidAt,
          status: payment.status,
        })),
      truncated:
        charges.length > args.chargeLimit ||
        payments.length > args.paymentLimit,
    };
  },
});

export const studentLedger = query({
  args: { studentId: v.id("students"), limit: v.number() },
  handler: async (ctx, args) => {
    await requireOwnerOrStudent(ctx, args.studentId);
    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 300)
      throw new Error("Ledger limit must be between 1 and 300");
    const [summary, charges, payments, adjustments, agreements] =
      await Promise.all([
        ctx.db
          .query("studentFinancialSummaries")
          .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
          .unique(),
        ctx.db
          .query("studentCharges")
          .withIndex("by_studentId_and_dueDate", (q) =>
            q.eq("studentId", args.studentId),
          )
          .order("desc")
          .take(args.limit + 1),
        ctx.db
          .query("payments")
          .withIndex("by_studentId_and_paidAt", (q) =>
            q.eq("studentId", args.studentId),
          )
          .order("desc")
          .take(args.limit + 1),
        ctx.db
          .query("financeAdjustments")
          .withIndex("by_studentId_and_createdAt", (q) =>
            q.eq("studentId", args.studentId),
          )
          .order("desc")
          .take(args.limit + 1),
        ctx.db
          .query("studentFeeAgreements")
          .withIndex("by_studentId_and_effectiveFrom", (q) =>
            q.eq("studentId", args.studentId),
          )
          .order("desc")
          .take(20),
      ]);
    const paymentRows = await Promise.all(
      payments.slice(0, args.limit).map(async (payment) => ({
        kind: "payment" as const,
        id: payment._id,
        date: payment.paidAt,
        reference: payment.receiptNumber,
        amountMinor: payment.amountMinor,
        status: payment.status,
        method: payment.method,
        allocations: (
          await ctx.db
            .query("paymentAllocations")
            .withIndex("by_paymentId", (q) => q.eq("paymentId", payment._id))
            .take(100)
        )
          .filter((row) => !row.reversedAt)
          .map((row) => ({
            amountMinor: row.amountMinor,
            descriptionBn: row.chargeDescriptionBnSnapshot,
            descriptionEn: row.chargeDescriptionEnSnapshot,
          })),
        advanceMinor: payment.advanceAmountMinor,
        refundedMinor: payment.refundedAmountMinor ?? 0,
      })),
    );
    const timeline = [
      ...charges
        .slice(0, args.limit)
        .map((charge) => ({
          kind: "charge" as const,
          id: charge._id,
          date: Date.parse(`${charge.dueDate}T00:00:00+06:00`),
          reference: charge.chargeNumber,
          amountMinor: charge.netAmountMinor,
          status: charge.status,
          descriptionBn: charge.descriptionBn,
          descriptionEn: charge.descriptionEn,
          paidMinor: charge.paidAmountMinor,
          discountMinor: charge.discountAmountMinor,
        })),
      ...paymentRows,
      ...adjustments
        .slice(0, args.limit)
        .map((adjustment) => ({
          kind: "adjustment" as const,
          id: adjustment._id,
          date: adjustment.postedAt ?? adjustment.createdAt,
          reference: adjustment.adjustmentNumber,
          amountMinor: adjustment.amountMinor,
          status: adjustment.status,
          adjustmentType: adjustment.type,
          reason: adjustment.reason,
        })),
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, args.limit);
    return {
      summary,
      agreements,
      timeline,
      truncated:
        charges.length > args.limit ||
        payments.length > args.limit ||
        adjustments.length > args.limit,
    };
  },
});
