import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner, requireOwnerForFinancialMutation } from "../model/auth";
import { assertLocalDate, dhakaDate } from "../model/dates";
import { assertMinorUnits } from "../model/money";
import { nextIdentifier } from "../model/identifiers";
import { writeAudit } from "../model/audit";
import { refreshFinancialSummary } from "./model";
import { paymentMethodValidator } from "../model/validators";

export const activateAgreement = mutation({
  args: {
    enrolmentId: v.id("enrolments"),
    feePlanId: v.id("feePlans"),
    effectiveFrom: v.string(),
    effectiveTo: v.optional(v.string()),
    agreedMonthlyAmountMinor: v.optional(v.number()),
    agreedCourseAmountMinor: v.optional(v.number()),
    installmentRule: v.optional(v.string()),
    reason: v.string(),
  },
  returns: v.id("studentFeeAgreements"),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    assertLocalDate(args.effectiveFrom);
    if (args.effectiveTo) assertLocalDate(args.effectiveTo);
    if (args.effectiveTo && args.effectiveTo < args.effectiveFrom)
      throw new Error("Agreement end cannot precede its start");
    if (args.agreedMonthlyAmountMinor !== undefined)
      assertMinorUnits(args.agreedMonthlyAmountMinor);
    if (args.agreedCourseAmountMinor !== undefined)
      assertMinorUnits(args.agreedCourseAmountMinor);
    if (!args.reason.trim()) throw new Error("Agreement reason is required");
    const [enrolment, plan] = await Promise.all([
      ctx.db.get("enrolments", args.enrolmentId),
      ctx.db.get("feePlans", args.feePlanId),
    ]);
    if (!enrolment || !plan) throw new Error("Enrolment or fee plan not found");
    if (plan.courseId && plan.courseId !== enrolment.courseId)
      throw new Error("Fee plan is incompatible with enrolment");
    if (plan.batchId && plan.batchId !== enrolment.batchId)
      throw new Error("Fee plan is incompatible with batch");
    const current = await ctx.db
      .query("studentFeeAgreements")
      .withIndex("by_enrolmentId_and_status", (q) =>
        q.eq("enrolmentId", enrolment._id).eq("status", "active"),
      )
      .unique();
    const number = await nextIdentifier(
      ctx,
      "fee_agreement",
      "AGR",
      Number(args.effectiveFrom.slice(0, 4)),
    );
    const now = Date.now();
    const id = await ctx.db.insert("studentFeeAgreements", {
      agreementNumber: number,
      studentId: enrolment.studentId,
      enrolmentId: enrolment._id,
      feePlanId: plan._id,
      effectiveFrom: args.effectiveFrom,
      effectiveTo: args.effectiveTo,
      status: "active",
      agreedMonthlyAmountMinor: args.agreedMonthlyAmountMinor,
      agreedCourseAmountMinor: args.agreedCourseAmountMinor,
      installmentRule: args.installmentRule?.trim() || undefined,
      reason: args.reason.trim(),
      approvedByAccountId: account._id,
      createdAt: now,
      supersedesAgreementId: current?._id,
    });
    if (current)
      await ctx.db.patch("studentFeeAgreements", current._id, {
        status: "superseded",
        effectiveTo: args.effectiveFrom,
      });
    await ctx.db.patch("enrolments", enrolment._id, {
      feePlanId: plan._id,
      agreedMonthlyAmountMinor: args.agreedMonthlyAmountMinor,
      agreedCourseAmountMinor: args.agreedCourseAmountMinor,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "fee_agreement.activated",
      entityType: "studentFeeAgreement",
      entityId: id,
      summary: "Student fee agreement activated",
    });
    return id;
  },
});

export const postAdjustment = mutation({
  args: {
    studentId: v.id("students"),
    chargeId: v.optional(v.id("studentCharges")),
    paymentId: v.optional(v.id("payments")),
    type: v.union(
      v.literal("waiver"),
      v.literal("credit_note"),
      v.literal("refund"),
      v.literal("write_off"),
    ),
    amountMinor: v.number(),
    method: v.optional(paymentMethodValidator),
    externalReference: v.optional(v.string()),
    reason: v.string(),
  },
  returns: v.id("financeAdjustments"),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    assertMinorUnits(args.amountMinor);
    if (args.amountMinor <= 0)
      throw new Error("Adjustment amount must be positive");
    if (!args.reason.trim()) throw new Error("Adjustment reason is required");
    const number = await nextIdentifier(
      ctx,
      "finance_adjustment",
      "ADJ",
      new Date().getUTCFullYear(),
    );
    const now = Date.now();
    if (args.type === "credit_note") {
      const adjustmentId = await ctx.db.insert("financeAdjustments", {
        adjustmentNumber: number,
        studentId: args.studentId,
        chargeId: args.chargeId,
        type: args.type,
        amountMinor: args.amountMinor,
        reason: args.reason.trim(),
        status: "posted",
        postedAt: now,
        postedByAccountId: account._id,
        createdAt: now,
        createdByAccountId: account._id,
      });
      const creditId = await ctx.db.insert("studentCredits", {
        studentId: args.studentId,
        sourceAdjustmentId: adjustmentId,
        originalAmountMinor: args.amountMinor,
        remainingAmountMinor: args.amountMinor,
        status: "available",
        createdAt: now,
      });
      if (args.chargeId) {
        const charge = await ctx.db.get("studentCharges", args.chargeId);
        if (
          !charge ||
          charge.studentId !== args.studentId ||
          charge.status === "voided"
        )
          throw new Error("Adjustable charge not found");
        const applied = Math.min(
          args.amountMinor,
          Math.max(0, charge.netAmountMinor - charge.paidAmountMinor),
        );
        if (applied > 0) {
          await ctx.db.insert("financeCreditAllocations", {
            creditId,
            adjustmentId,
            studentId: args.studentId,
            chargeId: charge._id,
            amountMinor: applied,
            createdAt: now,
          });
          const paidAmountMinor = charge.paidAmountMinor + applied;
          await ctx.db.patch("studentCharges", charge._id, {
            paidAmountMinor,
            status:
              paidAmountMinor >= charge.netAmountMinor
                ? "paid"
                : "partially_paid",
            settledAt:
              paidAmountMinor >= charge.netAmountMinor ? now : undefined,
          });
          await ctx.db.patch("studentCredits", creditId, {
            remainingAmountMinor: args.amountMinor - applied,
            status: applied === args.amountMinor ? "applied" : "available",
          });
        }
      }
      await refreshFinancialSummary(ctx, args.studentId);
      await writeAudit(ctx, {
        actorAccountId: account._id,
        actorRole: "owner",
        action: "finance_adjustment.posted",
        entityType: "financeAdjustment",
        entityId: adjustmentId,
        summary: "Finance credit note posted",
        metadata: { type: args.type, amountMinor: args.amountMinor },
      });
      return adjustmentId;
    }
    if (args.type === "refund") {
      if (!args.paymentId) throw new Error("Refund requires a payment");
      const payment = await ctx.db.get("payments", args.paymentId);
      if (
        !payment ||
        payment.studentId !== args.studentId ||
        payment.status !== "posted"
      )
        throw new Error("Refundable payment not found");
      const available =
        payment.amountMinor - (payment.refundedAmountMinor ?? 0);
      if (args.amountMinor > available)
        throw new Error("Refund exceeds refundable payment value");
      const adjustmentId = await ctx.db.insert("financeAdjustments", {
        adjustmentNumber: number,
        studentId: args.studentId,
        paymentId: payment._id,
        type: "refund",
        amountMinor: args.amountMinor,
        method: args.method,
        externalReference: args.externalReference?.trim() || undefined,
        reason: args.reason.trim(),
        status: "posted",
        postedAt: now,
        postedByAccountId: account._id,
        createdAt: now,
        createdByAccountId: account._id,
      });
      let remaining = args.amountMinor;
      const refundAdvanceAmountMinor = Math.min(
        remaining,
        payment.advanceAmountMinor,
      );
      remaining -= refundAdvanceAmountMinor;
      const allocations = await ctx.db
        .query("paymentAllocations")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", payment._id))
        .order("desc")
        .take(500);
      let reversedAllocationMinor = 0;
      for (const allocation of allocations) {
        if (remaining === 0) break;
        if (allocation.reversedAt) continue;
        const reversedMinor = Math.min(remaining, allocation.amountMinor);
        const charge = await ctx.db.get("studentCharges", allocation.chargeId);
        if (!charge) throw new Error("Allocated charge not found");
        const paidAmountMinor = Math.max(
          0,
          charge.paidAmountMinor - reversedMinor,
        );
        await ctx.db.patch("studentCharges", charge._id, {
          paidAmountMinor,
          status:
            paidAmountMinor === 0
              ? charge.dueDate <= dhakaDate()
                ? "due"
                : "upcoming"
              : "partially_paid",
          settledAt: undefined,
        });
        if (reversedMinor === allocation.amountMinor) {
          await ctx.db.patch("paymentAllocations", allocation._id, {
            reversedAt: now,
            refundAdjustmentId: adjustmentId,
          });
        } else {
          await ctx.db.patch("paymentAllocations", allocation._id, {
            amountMinor: allocation.amountMinor - reversedMinor,
          });
          await ctx.db.insert("paymentAllocations", {
            paymentId: allocation.paymentId,
            chargeId: allocation.chargeId,
            studentId: allocation.studentId,
            amountMinor: reversedMinor,
            chargeDescriptionBnSnapshot:
              allocation.chargeDescriptionBnSnapshot,
            chargeDescriptionEnSnapshot:
              allocation.chargeDescriptionEnSnapshot,
            createdAt: now,
            reversedAt: now,
            refundAdjustmentId: adjustmentId,
          });
        }
        remaining -= reversedMinor;
        reversedAllocationMinor += reversedMinor;
      }
      if (remaining !== 0)
        throw new Error("Refund exceeds currently reversible payment value");
      await ctx.db.patch("payments", payment._id, {
        refundedAmountMinor:
          (payment.refundedAmountMinor ?? 0) + args.amountMinor,
        advanceAmountMinor:
          payment.advanceAmountMinor - refundAdvanceAmountMinor,
        allocatedAmountMinor:
          payment.allocatedAmountMinor - reversedAllocationMinor,
        reconciliationStatus: "exception",
      });
      await ctx.db.patch("financeAdjustments", adjustmentId, {
        refundAdvanceAmountMinor,
      });
      await refreshFinancialSummary(ctx, args.studentId);
      await writeAudit(ctx, {
        actorAccountId: account._id,
        actorRole: "owner",
        action: "finance_adjustment.posted",
        entityType: "financeAdjustment",
        entityId: adjustmentId,
        summary: "Payment refund posted and allocations reversed",
        metadata: { type: args.type, amountMinor: args.amountMinor },
      });
      return adjustmentId;
    } else {
      if (!args.chargeId) throw new Error(`${args.type} requires a charge`);
      const charge = await ctx.db.get("studentCharges", args.chargeId);
      if (
        !charge ||
        charge.studentId !== args.studentId ||
        charge.status === "voided"
      )
        throw new Error("Adjustable charge not found");
      const balance = Math.max(
        0,
        charge.netAmountMinor - charge.paidAmountMinor,
      );
      if (args.amountMinor > balance)
        throw new Error("Adjustment exceeds outstanding charge balance");
      const netAmountMinor = charge.netAmountMinor - args.amountMinor;
      await ctx.db.patch("studentCharges", charge._id, {
        netAmountMinor,
        status:
          netAmountMinor === charge.paidAmountMinor
            ? args.type === "waiver"
              ? "waived"
              : "paid"
            : charge.paidAmountMinor > 0
              ? "partially_paid"
              : charge.status,
        settledAt: netAmountMinor === charge.paidAmountMinor ? now : undefined,
      });
    }
    const id = await ctx.db.insert("financeAdjustments", {
      adjustmentNumber: number,
      studentId: args.studentId,
      chargeId: args.chargeId,
      paymentId: args.paymentId,
      type: args.type,
      amountMinor: args.amountMinor,
      method: args.method,
      externalReference: args.externalReference?.trim() || undefined,
      reason: args.reason.trim(),
      status: "posted",
      postedAt: now,
      postedByAccountId: account._id,
      createdAt: now,
      createdByAccountId: account._id,
    });
    await refreshFinancialSummary(ctx, args.studentId);
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "finance_adjustment.posted",
      entityType: "financeAdjustment",
      entityId: id,
      summary: "Finance adjustment posted",
      metadata: { type: args.type, amountMinor: args.amountMinor },
    });
    return id;
  },
});

export const voidAdjustment = mutation({
  args: { adjustmentId: v.id("financeAdjustments"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    const adjustment = await ctx.db.get(
      "financeAdjustments",
      args.adjustmentId,
    );
    if (!adjustment || adjustment.status !== "posted")
      throw new Error("Posted adjustment not found");
    if (!args.reason.trim()) throw new Error("Void reason is required");
    if (adjustment.type === "credit_note") {
      const credit = await ctx.db
        .query("studentCredits")
        .withIndex("by_sourceAdjustmentId", (q) =>
          q.eq("sourceAdjustmentId", adjustment._id),
        )
        .unique();
      if (!credit) throw new Error("Original credit not found");
      const allocations = await ctx.db
        .query("financeCreditAllocations")
        .withIndex("by_creditId", (q) => q.eq("creditId", credit._id))
        .take(100);
      for (const allocation of allocations.filter((row) => !row.reversedAt)) {
        const charge = await ctx.db.get("studentCharges", allocation.chargeId);
        if (!charge) throw new Error("Credited charge not found");
        const paidAmountMinor = Math.max(
          0,
          charge.paidAmountMinor - allocation.amountMinor,
        );
        await ctx.db.patch("studentCharges", charge._id, {
          paidAmountMinor,
          status:
            paidAmountMinor >= charge.netAmountMinor
              ? "paid"
              : paidAmountMinor > 0
                ? "partially_paid"
                : charge.dueDate <= dhakaDate()
                  ? "due"
                  : "upcoming",
          settledAt:
            paidAmountMinor >= charge.netAmountMinor
              ? charge.settledAt
              : undefined,
        });
        await ctx.db.patch("financeCreditAllocations", allocation._id, {
          reversedAt: Date.now(),
        });
      }
      await ctx.db.patch("studentCredits", credit._id, {
        status: "voided",
        remainingAmountMinor: 0,
        voidedAt: Date.now(),
      });
    } else if (adjustment.type === "refund") {
      const payment = adjustment.paymentId
        ? await ctx.db.get("payments", adjustment.paymentId)
        : null;
      if (!payment || payment.status !== "posted")
        throw new Error("Posted original payment not found");
      const reversals = await ctx.db
        .query("paymentAllocations")
        .withIndex("by_refundAdjustmentId", (q) =>
          q.eq("refundAdjustmentId", adjustment._id),
        )
        .take(500);
      let restoredAllocationMinor = 0;
      for (const reversal of reversals) {
        const charge = await ctx.db.get("studentCharges", reversal.chargeId);
        if (!charge) throw new Error("Refunded charge not found");
        const paidAmountMinor = charge.paidAmountMinor + reversal.amountMinor;
        await ctx.db.patch("studentCharges", charge._id, {
          paidAmountMinor,
          status:
            paidAmountMinor >= charge.netAmountMinor
              ? "paid"
              : "partially_paid",
          settledAt: paidAmountMinor >= charge.netAmountMinor ? Date.now() : undefined,
        });
        await ctx.db.patch("paymentAllocations", reversal._id, {
          reversedAt: undefined,
          refundAdjustmentId: undefined,
        });
        restoredAllocationMinor += reversal.amountMinor;
      }
      await ctx.db.patch("payments", payment._id, {
        refundedAmountMinor: Math.max(
          0,
          (payment.refundedAmountMinor ?? 0) - adjustment.amountMinor,
        ),
        advanceAmountMinor:
          payment.advanceAmountMinor +
          (adjustment.refundAdvanceAmountMinor ?? 0),
        allocatedAmountMinor:
          payment.allocatedAmountMinor + restoredAllocationMinor,
      });
    } else {
      const charge = adjustment.chargeId
        ? await ctx.db.get("studentCharges", adjustment.chargeId)
        : null;
      if (!charge) throw new Error("Original charge not found");
      const netAmountMinor = charge.netAmountMinor + adjustment.amountMinor;
      await ctx.db.patch("studentCharges", charge._id, {
        netAmountMinor,
        status:
          charge.paidAmountMinor >= netAmountMinor
            ? "paid"
            : charge.paidAmountMinor > 0
              ? "partially_paid"
              : charge.dueDate <= dhakaDate()
                ? "due"
                : "upcoming",
        settledAt: undefined,
      });
    }
    const now = Date.now();
    await ctx.db.patch("financeAdjustments", adjustment._id, {
      status: "voided",
      voidedAt: now,
      voidedByAccountId: account._id,
      voidReason: args.reason.trim(),
    });
    await refreshFinancialSummary(ctx, adjustment.studentId);
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "finance_adjustment.voided",
      entityType: "financeAdjustment",
      entityId: adjustment._id,
      summary: "Finance adjustment voided",
    });
    return null;
  },
});

export const openDrawer = mutation({
  args: { openingFloatMinor: v.number() },
  returns: v.id("cashDrawerSessions"),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    assertMinorUnits(args.openingFloatMinor);
    let drawer = await ctx.db
      .query("cashDrawers")
      .withIndex("by_code", (q) => q.eq("code", "main"))
      .unique();
    const now = Date.now();
    if (!drawer) {
      const id = await ctx.db.insert("cashDrawers", {
        code: "main",
        nameBn: "প্রধান ক্যাশ",
        nameEn: "Main cash",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      drawer = (await ctx.db.get("cashDrawers", id))!;
    }
    const open = await ctx.db
      .query("cashDrawerSessions")
      .withIndex("by_status_and_businessDate", (q) => q.eq("status", "open"))
      .first();
    if (open) throw new Error("A cash drawer session is already open");
    const existingToday = await ctx.db
      .query("cashDrawerSessions")
      .withIndex("by_drawerId_and_businessDate", (q) =>
        q.eq("drawerId", drawer._id).eq("businessDate", dhakaDate()),
      )
      .order("desc")
      .first();
    if (existingToday)
      throw new Error(
        "Today's drawer session already exists; reopen the closed session instead",
      );
    const id = await ctx.db.insert("cashDrawerSessions", {
      drawerId: drawer._id,
      businessDate: dhakaDate(),
      status: "open",
      openingFloatMinor: args.openingFloatMinor,
      expectedCashMinor: args.openingFloatMinor,
      openedByAccountId: account._id,
      openedAt: now,
    });
    return id;
  },
});

export const closeDrawer = mutation({
  args: {
    sessionId: v.id("cashDrawerSessions"),
    countedCashMinor: v.number(),
    note: v.optional(v.string()),
    confirmed: v.boolean(),
  },
  returns: v.object({
    expectedCashMinor: v.number(),
    varianceMinor: v.number(),
  }),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    if (!args.confirmed)
      throw new Error("Drawer close confirmation is required");
    assertMinorUnits(args.countedCashMinor);
    const session = await ctx.db.get("cashDrawerSessions", args.sessionId);
    if (!session || session.status !== "open")
      throw new Error("Open drawer session not found");
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_cashDrawerSessionId_and_paidAt", (q) =>
        q.eq("cashDrawerSessionId", session._id),
      )
      .take(500);
    const expected =
      session.openingFloatMinor +
      payments
        .filter((p) => p.status === "posted" && p.method === "cash")
        .reduce(
          (sum, p) => sum + p.amountMinor - (p.refundedAmountMinor ?? 0),
          0,
        );
    const variance = args.countedCashMinor - expected;
    if (variance !== 0 && !args.note?.trim())
      throw new Error("A variance reason is required");
    const now = Date.now();
    await ctx.db.patch("cashDrawerSessions", session._id, {
      status: "closed",
      expectedCashMinor: expected,
      countedCashMinor: args.countedCashMinor,
      varianceMinor: variance,
      closedByAccountId: account._id,
      closedAt: now,
      closeNote: args.note?.trim() || undefined,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "cash_drawer.closed",
      entityType: "cashDrawerSession",
      entityId: session._id,
      summary: "Cash drawer closed",
      metadata: { expectedCashMinor: expected, varianceMinor: variance },
    });
    return { expectedCashMinor: expected, varianceMinor: variance };
  },
});

export const reopenDrawer = mutation({
  args: {
    sessionId: v.id("cashDrawerSessions"),
    reason: v.string(),
    confirmed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    if (!args.confirmed)
      throw new Error("Drawer reopen confirmation is required");
    if (!args.reason.trim()) throw new Error("Reopen reason is required");
    const session = await ctx.db.get("cashDrawerSessions", args.sessionId);
    if (!session || session.status !== "closed")
      throw new Error("Closed drawer session not found");
    const anotherOpen = await ctx.db
      .query("cashDrawerSessions")
      .withIndex("by_status_and_businessDate", (q) => q.eq("status", "open"))
      .first();
    if (anotherOpen) throw new Error("Another drawer session is already open");
    const now = Date.now();
    await ctx.db.patch("cashDrawerSessions", session._id, {
      status: "open",
      countedCashMinor: undefined,
      varianceMinor: undefined,
      closedByAccountId: undefined,
      closedAt: undefined,
      closeNote: undefined,
      reopenedByAccountId: account._id,
      reopenedAt: now,
      reopenReason: args.reason.trim(),
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "cash_drawer.reopened",
      entityType: "cashDrawerSession",
      entityId: session._id,
      summary: "Cash drawer reopened",
      metadata: { businessDate: session.businessDate },
    });
    return null;
  },
});

export const currentDrawer = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.db
      .query("cashDrawerSessions")
      .withIndex("by_status_and_businessDate", (q) => q.eq("status", "open"))
      .first();
  },
});

export const todayDrawer = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.db
      .query("cashDrawerSessions")
      .withIndex("by_businessDate", (q) => q.eq("businessDate", dhakaDate()))
      .order("desc")
      .first();
  },
});
