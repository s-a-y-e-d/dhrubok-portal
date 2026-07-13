import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  paymentMethodValidator,
  chargeTypeValidator,
  paginationResultFields,
} from "../model/validators";
import {
  requireAccount,
  requireOwner,
  requireOwnerForFinancialMutation,
  requireStudentOwnsRecord,
} from "../model/auth";
import { assertLocalDate, dhakaDate, dueDateForMonth } from "../model/dates";
import { assertMinorUnits, percentageDiscount } from "../model/money";
import { nextIdentifier } from "../model/identifiers";
import { writeAudit } from "../model/audit";
import { enqueueSms } from "../messaging/model";
import { computeFinancialSummary, refreshFinancialSummary } from "./model";

export const listFeePlans = query({
  args: {},
  returns: v.array(
    v.object({
      feePlanId: v.id("feePlans"),
      courseId: v.optional(v.id("courses")),
      batchId: v.optional(v.id("batches")),
      nameBn: v.string(),
      nameEn: v.string(),
      defaultDueDay: v.optional(v.number()),
      status: v.string(),
      items: v.array(
        v.object({
          feePlanItemId: v.id("feePlanItems"),
          chargeType: chargeTypeValidator,
          labelBn: v.string(),
          labelEn: v.string(),
          amountMinor: v.number(),
          recurrence: v.union(v.literal("once"), v.literal("monthly")),
          dueDay: v.optional(v.number()),
          sortOrder: v.number(),
          status: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const plans = await ctx.db
      .query("feePlans")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(200);
    const result = [];
    for (const plan of plans) {
      const items = await ctx.db
        .query("feePlanItems")
        .withIndex("by_feePlanId_and_sortOrder", (q) =>
          q.eq("feePlanId", plan._id),
        )
        .take(100);
      result.push({
        feePlanId: plan._id,
        courseId: plan.courseId,
        batchId: plan.batchId,
        nameBn: plan.nameBn,
        nameEn: plan.nameEn,
        defaultDueDay: plan.defaultDueDay,
        status: plan.status,
        items: items.map((item) => ({
          feePlanItemId: item._id,
          chargeType: item.chargeType,
          labelBn: item.labelBn,
          labelEn: item.labelEn,
          amountMinor: item.amountMinor,
          recurrence: item.recurrence,
          dueDay: item.dueDay,
          sortOrder: item.sortOrder,
          status: item.status,
        })),
      });
    }
    return result;
  },
});

export const createFeePlan = mutation({
  args: {
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    nameBn: v.string(),
    nameEn: v.string(),
    defaultDueDay: v.optional(v.number()),
  },
  returns: v.id("feePlans"),
  handler: async (ctx, args) => {
    await requireOwnerForFinancialMutation(ctx);
    if (
      args.defaultDueDay !== undefined &&
      (!Number.isInteger(args.defaultDueDay) ||
        args.defaultDueDay < 1 ||
        args.defaultDueDay > 28)
    )
      throw new Error("Due day must be between 1 and 28");
    if (!args.courseId && !args.batchId)
      throw new Error("Fee plan must belong to a course or batch");
    const now = Date.now();
    return await ctx.db.insert("feePlans", {
      ...args,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addFeePlanItem = mutation({
  args: {
    feePlanId: v.id("feePlans"),
    chargeType: chargeTypeValidator,
    labelBn: v.string(),
    labelEn: v.string(),
    amountMinor: v.number(),
    recurrence: v.union(v.literal("once"), v.literal("monthly")),
    dueDay: v.optional(v.number()),
    sortOrder: v.number(),
  },
  returns: v.id("feePlanItems"),
  handler: async (ctx, args) => {
    await requireOwnerForFinancialMutation(ctx);
    assertMinorUnits(args.amountMinor);
    if (
      args.dueDay !== undefined &&
      (!Number.isInteger(args.dueDay) || args.dueDay < 1 || args.dueDay > 28)
    )
      throw new Error("Due day must be between 1 and 28");
    const plan = await ctx.db.get("feePlans", args.feePlanId);
    if (!plan || plan.status !== "active")
      throw new Error("Fee plan is not active");
    const now = Date.now();
    return await ctx.db.insert("feePlanItems", {
      ...args,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addDiscount = mutation({
  args: {
    studentId: v.optional(v.id("students")),
    enrolmentId: v.optional(v.id("enrolments")),
    feePlanItemId: v.optional(v.id("feePlanItems")),
    kind: v.union(v.literal("fixed"), v.literal("percentage")),
    valueMinor: v.optional(v.number()),
    percentageBasisPoints: v.optional(v.number()),
    reason: v.string(),
    startsOn: v.string(),
    endsOn: v.optional(v.string()),
  },
  returns: v.id("discountPolicies"),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    if (!args.studentId && !args.enrolmentId)
      throw new Error("Discount must target a student or enrolment");
    assertLocalDate(args.startsOn);
    if (args.endsOn) assertLocalDate(args.endsOn);
    if (args.kind === "fixed")
      assertMinorUnits(args.valueMinor ?? -1, "valueMinor");
    if (args.kind === "percentage")
      percentageDiscount(100, args.percentageBasisPoints ?? -1);
    return await ctx.db.insert("discountPolicies", {
      ...args,
      status: "active",
      approvedByAccountId: account._id,
      createdAt: Date.now(),
    });
  },
});

export const assignFeePlan = mutation({
  args: {
    enrolmentId: v.id("enrolments"),
    feePlanId: v.id("feePlans"),
    agreedMonthlyAmountMinor: v.optional(v.number()),
    agreedCourseAmountMinor: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    const [enrolment, plan] = await Promise.all([
      ctx.db.get("enrolments", args.enrolmentId),
      ctx.db.get("feePlans", args.feePlanId),
    ]);
    if (!enrolment || enrolment.status !== "active")
      throw new Error("Active enrolment not found");
    if (!plan || plan.status !== "active")
      throw new Error("Active fee plan not found");
    if (plan.batchId && plan.batchId !== enrolment.batchId)
      throw new Error("Fee plan does not belong to this batch");
    if (plan.courseId && plan.courseId !== enrolment.courseId)
      throw new Error("Fee plan does not belong to this course");
    if (args.agreedMonthlyAmountMinor !== undefined)
      assertMinorUnits(
        args.agreedMonthlyAmountMinor,
        "agreedMonthlyAmountMinor",
      );
    if (args.agreedCourseAmountMinor !== undefined)
      assertMinorUnits(args.agreedCourseAmountMinor, "agreedCourseAmountMinor");
    await ctx.db.patch("enrolments", enrolment._id, {
      feePlanId: plan._id,
      agreedMonthlyAmountMinor: args.agreedMonthlyAmountMinor,
      agreedCourseAmountMinor: args.agreedCourseAmountMinor,
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "finance.fee_plan_assigned",
      entityType: "enrolment",
      entityId: enrolment._id,
      summary: "Assigned fee plan to enrolment",
      metadata: { feePlanId: plan._id },
    });
    return null;
  },
});

async function discountForItem(
  ctx: import("../_generated/server").MutationCtx,
  enrolmentId: import("../_generated/dataModel").Id<"enrolments">,
  studentId: import("../_generated/dataModel").Id<"students">,
  itemId: import("../_generated/dataModel").Id<"feePlanItems">,
  amountMinor: number,
  dueDate: string,
) {
  const byEnrolment = await ctx.db
    .query("discountPolicies")
    .withIndex("by_enrolmentId_and_status", (q) =>
      q.eq("enrolmentId", enrolmentId).eq("status", "active"),
    )
    .take(20);
  const byStudent = await ctx.db
    .query("discountPolicies")
    .withIndex("by_studentId_and_status", (q) =>
      q.eq("studentId", studentId).eq("status", "active"),
    )
    .take(20);
  const matches = [...byEnrolment, ...byStudent].filter(
    (policy, index, all) =>
      all.findIndex((other) => other._id === policy._id) === index &&
      (!policy.feePlanItemId || policy.feePlanItemId === itemId) &&
      policy.startsOn <= dueDate &&
      (!policy.endsOn || policy.endsOn >= dueDate),
  );
  return Math.min(
    amountMinor,
    matches.reduce(
      (sum, policy) =>
        sum +
        (policy.kind === "fixed"
          ? (policy.valueMinor ?? 0)
          : percentageDiscount(amountMinor, policy.percentageBasisPoints ?? 0)),
      0,
    ),
  );
}

async function applyAdvanceToCharge(
  ctx: import("../_generated/server").MutationCtx,
  chargeId: import("../_generated/dataModel").Id<"studentCharges">,
) {
  const charge = await ctx.db.get("studentCharges", chargeId);
  if (!charge) return;
  let remaining = charge.netAmountMinor - charge.paidAmountMinor;
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_studentId_and_paidAt", (q) =>
      q.eq("studentId", charge.studentId),
    )
    .take(500);
  for (const payment of payments) {
    if (remaining <= 0) break;
    if (payment.status !== "posted" || payment.advanceAmountMinor <= 0)
      continue;
    const applied = Math.min(remaining, payment.advanceAmountMinor);
    await ctx.db.insert("paymentAllocations", {
      paymentId: payment._id,
      chargeId: charge._id,
      studentId: charge.studentId,
      amountMinor: applied,
      chargeDescriptionBnSnapshot: charge.descriptionBn,
      chargeDescriptionEnSnapshot: charge.descriptionEn,
      createdAt: Date.now(),
    });
    await ctx.db.patch("payments", payment._id, {
      allocatedAmountMinor: payment.allocatedAmountMinor + applied,
      advanceAmountMinor: payment.advanceAmountMinor - applied,
    });
    remaining -= applied;
  }
  const paidAmountMinor = charge.netAmountMinor - remaining;
  await ctx.db.patch("studentCharges", charge._id, {
    paidAmountMinor,
    status:
      remaining === 0
        ? "paid"
        : paidAmountMinor > 0
          ? "partially_paid"
          : charge.status,
  });
}

export const generateMonthlyBatch = internalMutation({
  args: { periodKey: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const settings = (await ctx.db.query("coachingSettings").take(1))[0];
    const dueDefault = settings?.monthlyDueDay ?? 15;
    const page = await ctx.db
      .query("enrolments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .paginate({ numItems: 25, cursor: args.cursor });
    const yearScope = Number(args.periodKey.slice(0, 4));
    for (const enrolment of page.page) {
      if (!enrolment.feePlanId) continue;
      const plan = await ctx.db.get("feePlans", enrolment.feePlanId);
      if (!plan || plan.status !== "active") continue;
      const items = await ctx.db
        .query("feePlanItems")
        .withIndex("by_feePlanId_and_status", (q) =>
          q.eq("feePlanId", plan._id).eq("status", "active"),
        )
        .take(100);
      for (const item of items.filter((row) => row.recurrence === "monthly")) {
        const generationKey = `monthly:${enrolment._id}:${item._id}:${args.periodKey}`;
        if (
          await ctx.db
            .query("studentCharges")
            .withIndex("by_generationKey", (q) =>
              q.eq("generationKey", generationKey),
            )
            .unique()
        )
          continue;
        const originalAmountMinor =
          enrolment.agreedMonthlyAmountMinor ?? item.amountMinor;
        assertMinorUnits(originalAmountMinor);
        const dueDate = dueDateForMonth(
          args.periodKey,
          item.dueDay ?? plan.defaultDueDay ?? dueDefault,
        );
        const discountAmountMinor = await discountForItem(
          ctx,
          enrolment._id,
          enrolment.studentId,
          item._id,
          originalAmountMinor,
          dueDate,
        );
        const netAmountMinor = originalAmountMinor - discountAmountMinor;
        const chargeNumber = await nextIdentifier(
          ctx,
          "charge",
          "CHG",
          yearScope,
        );
        const chargeId = await ctx.db.insert("studentCharges", {
          chargeNumber,
          studentId: enrolment.studentId,
          enrolmentId: enrolment._id,
          feePlanItemId: item._id,
          type: item.chargeType,
          periodKey: args.periodKey,
          descriptionBn: item.labelBn,
          descriptionEn: item.labelEn,
          originalAmountMinor,
          discountAmountMinor,
          netAmountMinor,
          paidAmountMinor: 0,
          dueDate,
          status: dueDate <= dhakaDate() ? "due" : "upcoming",
          generationKey,
          createdAt: Date.now(),
        });
        await applyAdvanceToCharge(ctx, chargeId);
      }
      await refreshFinancialSummary(ctx, enrolment.studentId);
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.finance.functions.generateMonthlyBatch,
        { periodKey: args.periodKey, cursor: page.continueCursor },
      );
    return null;
  },
});

export const generateMonthly = mutation({
  args: { periodKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwnerForFinancialMutation(ctx);
    if (!/^\d{4}-\d{2}$/.test(args.periodKey))
      throw new Error("Period must use YYYY-MM");
    await ctx.scheduler.runAfter(
      0,
      internal.finance.functions.generateMonthlyBatch,
      { periodKey: args.periodKey, cursor: null },
    );
    return null;
  },
});

export const createCustomCharge = mutation({
  args: {
    studentId: v.id("students"),
    enrolmentId: v.optional(v.id("enrolments")),
    type: chargeTypeValidator,
    descriptionBn: v.string(),
    descriptionEn: v.string(),
    amountMinor: v.number(),
    dueDate: v.string(),
    generationKey: v.string(),
  },
  returns: v.id("studentCharges"),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    assertMinorUnits(args.amountMinor);
    assertLocalDate(args.dueDate);
    const student = await ctx.db.get("students", args.studentId);
    if (!student) throw new Error("Student not found");
    const duplicate = await ctx.db
      .query("studentCharges")
      .withIndex("by_generationKey", (q) =>
        q.eq("generationKey", args.generationKey),
      )
      .unique();
    if (duplicate) return duplicate._id;
    const year = Number(args.dueDate.slice(0, 4));
    const chargeNumber = await nextIdentifier(ctx, "charge", "CHG", year);
    const chargeId = await ctx.db.insert("studentCharges", {
      chargeNumber,
      studentId: args.studentId,
      enrolmentId: args.enrolmentId,
      type: args.type,
      descriptionBn: args.descriptionBn,
      descriptionEn: args.descriptionEn,
      originalAmountMinor: args.amountMinor,
      discountAmountMinor: 0,
      netAmountMinor: args.amountMinor,
      paidAmountMinor: 0,
      dueDate: args.dueDate,
      generationKey: args.generationKey,
      status: args.dueDate <= dhakaDate() ? "due" : "upcoming",
      createdAt: Date.now(),
      createdByAccountId: account._id,
    });
    await applyAdvanceToCharge(ctx, chargeId);
    await refreshFinancialSummary(ctx, args.studentId);
    return chargeId;
  },
});

export const collectPayment = mutation({
  args: {
    studentId: v.id("students"),
    amountMinor: v.number(),
    allocations: v.array(
      v.object({ chargeId: v.id("studentCharges"), amountMinor: v.number() }),
    ),
    method: paymentMethodValidator,
    externalReference: v.optional(v.string()),
    paidAt: v.number(),
    note: v.optional(v.string()),
  },
  returns: v.object({
    paymentId: v.id("payments"),
    paymentNumber: v.string(),
    receiptNumber: v.string(),
    advanceAmountMinor: v.number(),
    smsQueued: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    assertMinorUnits(args.amountMinor);
    if (args.amountMinor === 0)
      throw new Error("Payment amount must be greater than zero");
    if (args.allocations.length > 100) throw new Error("Too many allocations");
    const student = await ctx.db.get("students", args.studentId);
    if (!student) throw new Error("Student not found");
    let allocatedAmountMinor = 0;
    const checked = [];
    const seen = new Set<string>();
    for (const allocation of args.allocations) {
      assertMinorUnits(allocation.amountMinor);
      if (allocation.amountMinor === 0 || seen.has(allocation.chargeId))
        throw new Error("Invalid duplicate or zero allocation");
      seen.add(allocation.chargeId);
      const charge = await ctx.db.get("studentCharges", allocation.chargeId);
      if (
        !charge ||
        charge.studentId !== args.studentId ||
        charge.status === "voided"
      )
        throw new Error("Invalid charge allocation");
      if (
        allocation.amountMinor >
        charge.netAmountMinor - charge.paidAmountMinor
      )
        throw new Error("Allocation exceeds remaining charge balance");
      allocatedAmountMinor += allocation.amountMinor;
      checked.push({ allocation, charge });
    }
    if (allocatedAmountMinor > args.amountMinor)
      throw new Error("Allocations exceed payment amount");
    const advanceAmountMinor = args.amountMinor - allocatedAmountMinor;
    const year = new Date(args.paidAt).getUTCFullYear();
    const paymentNumber = await nextIdentifier(ctx, "payment", "PAY", year);
    const receiptNumber = await nextIdentifier(ctx, "receipt", "RCPT", year);
    const paymentId = await ctx.db.insert("payments", {
      paymentNumber,
      receiptNumber,
      studentId: args.studentId,
      amountMinor: args.amountMinor,
      allocatedAmountMinor,
      advanceAmountMinor,
      method: args.method,
      externalReference: args.externalReference,
      paidAt: args.paidAt,
      note: args.note,
      status: "posted",
      collectedByAccountId: account._id,
      createdAt: Date.now(),
    });
    for (const { allocation, charge } of checked) {
      await ctx.db.insert("paymentAllocations", {
        paymentId,
        chargeId: charge._id,
        studentId: args.studentId,
        amountMinor: allocation.amountMinor,
        chargeDescriptionBnSnapshot: charge.descriptionBn,
        chargeDescriptionEnSnapshot: charge.descriptionEn,
        createdAt: Date.now(),
      });
      const paidAmountMinor = charge.paidAmountMinor + allocation.amountMinor;
      await ctx.db.patch("studentCharges", charge._id, {
        paidAmountMinor,
        status:
          paidAmountMinor === charge.netAmountMinor ? "paid" : "partially_paid",
      });
    }
    await refreshFinancialSummary(ctx, args.studentId);
    const today = dhakaDate();
    if (dhakaDate(args.paidAt) === today) {
      const dailySummary = await ctx.db
        .query("dailyOperationalSummaries")
        .withIndex("by_date", (q) => q.eq("date", today))
        .unique();
      if (dailySummary) {
        await ctx.db.patch(dailySummary._id, {
          collectedMinor: dailySummary.collectedMinor + args.amountMinor,
          paymentsCount: dailySummary.paymentsCount + 1,
          updatedAt: Date.now(),
        });
      }
    }
    const settings = (await ctx.db.query("coachingSettings").take(1))[0];
    const isBn = student.preferredSmsLocale === "bn";
    const brand = isBn
      ? settings?.shortNameBn || "ধ্রুবক"
      : settings?.shortNameEn || "Dhrubok";
    const body = isBn
      ? `${brand}: ${student.displayName}-এর ৳ ${(args.amountMinor / 100).toFixed(2)} পেমেন্ট গ্রহণ করা হয়েছে। রশিদ: ${receiptNumber}`
      : `${brand}: Payment of BDT ${(args.amountMinor / 100).toFixed(2)} received for ${student.displayName}. Receipt: ${receiptNumber}`;
    await enqueueSms(ctx, {
      idempotencyKey: `payment:${paymentId}:confirmation`,
      eventType: "payment_posted",
      relatedEntityType: "payment",
      relatedEntityId: paymentId,
      studentId: student._id,
      guardianPhone: student.guardianPhone,
      locale: student.preferredSmsLocale,
      body,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "payment.posted",
      entityType: "payment",
      entityId: paymentId,
      summary: "Manual payment posted",
      metadata: {
        amountMinor: args.amountMinor,
        allocatedAmountMinor,
        advanceAmountMinor,
      },
    });
    return {
      paymentId,
      paymentNumber,
      receiptNumber,
      advanceAmountMinor,
      smsQueued: true,
    };
  },
});

export const voidPayment = mutation({
  args: { paymentId: v.id("payments"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    if (!args.reason.trim()) throw new Error("Void reason is required");
    const payment = await ctx.db.get("payments", args.paymentId);
    if (!payment || payment.status !== "posted")
      throw new Error("Payment cannot be voided");
    const allocations = await ctx.db
      .query("paymentAllocations")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", payment._id))
      .take(500);
    for (const allocation of allocations) {
      if (allocation.reversedAt) continue;
      const charge = await ctx.db.get("studentCharges", allocation.chargeId);
      if (charge) {
        const paidAmountMinor = Math.max(
          0,
          charge.paidAmountMinor - allocation.amountMinor,
        );
        await ctx.db.patch("studentCharges", charge._id, {
          paidAmountMinor,
          status:
            paidAmountMinor === 0
              ? charge.dueDate <= dhakaDate()
                ? "due"
                : "upcoming"
              : "partially_paid",
        });
      }
      await ctx.db.patch("paymentAllocations", allocation._id, {
        reversedAt: Date.now(),
      });
    }
    await ctx.db.patch("payments", payment._id, {
      status: "voided",
      voidedAt: Date.now(),
      voidedByAccountId: account._id,
      voidReason: args.reason.trim(),
    });
    await refreshFinancialSummary(ctx, payment.studentId);
    const today = dhakaDate();
    if (dhakaDate(payment.paidAt) === today) {
      const dailySummary = await ctx.db
        .query("dailyOperationalSummaries")
        .withIndex("by_date", (q) => q.eq("date", today))
        .unique();
      if (dailySummary) {
        await ctx.db.patch(dailySummary._id, {
          collectedMinor: Math.max(
            0,
            dailySummary.collectedMinor - payment.amountMinor,
          ),
          paymentsCount: Math.max(0, dailySummary.paymentsCount - 1),
          updatedAt: Date.now(),
        });
      }
    }
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "payment.voided",
      entityType: "payment",
      entityId: payment._id,
      summary: "Payment voided and allocations reversed",
      metadata: { amountMinor: payment.amountMinor },
    });
    return null;
  },
});

export const listCharges = query({
  args: {
    studentId: v.id("students"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        chargeId: v.id("studentCharges"),
        chargeNumber: v.string(),
        description: v.string(),
        netAmountMinor: v.number(),
        paidAmountMinor: v.number(),
        dueDate: v.string(),
        status: v.string(),
      }),
    ),
    ...paginationResultFields,
  }),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    if (account.role === "teacher") throw new Error("Unauthorized");
    if (account.role === "student")
      await requireStudentOwnsRecord(ctx, args.studentId);
    const page = await ctx.db
      .query("studentCharges")
      .withIndex("by_studentId_and_dueDate", (q) =>
        q.eq("studentId", args.studentId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: page.page.map((row) => ({
        chargeId: row._id,
        chargeNumber: row.chargeNumber,
        description:
          account.locale === "bn" ? row.descriptionBn : row.descriptionEn,
        netAmountMinor: row.netAmountMinor,
        paidAmountMinor: row.paidAmountMinor,
        dueDate: row.dueDate,
        status: row.status,
      })),
    };
  },
});

export const listPayments = query({
  args: {
    studentId: v.id("students"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        paymentId: v.id("payments"),
        paymentNumber: v.string(),
        receiptNumber: v.string(),
        amountMinor: v.number(),
        advanceAmountMinor: v.number(),
        method: paymentMethodValidator,
        paidAt: v.number(),
        status: v.string(),
      }),
    ),
    ...paginationResultFields,
  }),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    if (account.role === "teacher") throw new Error("Unauthorized");
    if (account.role === "student")
      await requireStudentOwnsRecord(ctx, args.studentId);
    const page = await ctx.db
      .query("payments")
      .withIndex("by_studentId_and_paidAt", (q) =>
        q.eq("studentId", args.studentId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: page.page.map((row) => ({
        paymentId: row._id,
        paymentNumber: row.paymentNumber,
        receiptNumber: row.receiptNumber,
        amountMinor: row.amountMinor,
        advanceAmountMinor: row.advanceAmountMinor,
        method: row.method,
        paidAt: row.paidAt,
        status: row.status,
      })),
    };
  },
});

export const getReceipt = query({
  args: { paymentId: v.id("payments") },
  returns: v.union(
    v.object({
      paymentId: v.id("payments"),
      paymentNumber: v.string(),
      receiptNumber: v.string(),
      studentId: v.id("students"),
      studentNumber: v.string(),
      studentName: v.string(),
      guardianName: v.string(),
      amountMinor: v.number(),
      advanceAmountMinor: v.number(),
      method: paymentMethodValidator,
      externalReference: v.union(v.string(), v.null()),
      paidAt: v.number(),
      note: v.union(v.string(), v.null()),
      status: v.string(),
      allocations: v.array(
        v.object({
          descriptionBn: v.string(),
          descriptionEn: v.string(),
          amountMinor: v.number(),
          reversed: v.boolean(),
        }),
      ),
      coachingNameBn: v.string(),
      coachingNameEn: v.string(),
      addressBn: v.string(),
      addressEn: v.string(),
      phone: v.string(),
      footerBn: v.string(),
      footerEn: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    if (account.role === "teacher") throw new Error("Unauthorized");
    const payment = await ctx.db.get("payments", args.paymentId);
    if (!payment) return null;
    if (account.role === "student")
      await requireStudentOwnsRecord(ctx, payment.studentId);
    const [student, allocations, settings] = await Promise.all([
      ctx.db.get("students", payment.studentId),
      ctx.db
        .query("paymentAllocations")
        .withIndex("by_paymentId", (q) => q.eq("paymentId", payment._id))
        .take(200),
      ctx.db.query("coachingSettings").take(1),
    ]);
    if (!student || !settings[0]) throw new Error("Receipt data is incomplete");
    return {
      paymentId: payment._id,
      paymentNumber: payment.paymentNumber,
      receiptNumber: payment.receiptNumber,
      studentId: student._id,
      studentNumber: student.studentNumber,
      studentName: student.displayName,
      guardianName: student.guardianName,
      amountMinor: payment.amountMinor,
      advanceAmountMinor: payment.advanceAmountMinor,
      method: payment.method,
      externalReference: payment.externalReference ?? null,
      paidAt: payment.paidAt,
      note: payment.note ?? null,
      status: payment.status,
      allocations: allocations.map((row) => ({
        descriptionBn: row.chargeDescriptionBnSnapshot,
        descriptionEn: row.chargeDescriptionEnSnapshot,
        amountMinor: row.amountMinor,
        reversed: row.reversedAt !== undefined,
      })),
      coachingNameBn: settings[0].nameBn,
      coachingNameEn: settings[0].nameEn,
      addressBn: settings[0].addressBn,
      addressEn: settings[0].addressEn,
      phone: settings[0].phone,
      footerBn: settings[0].receiptFooterBn,
      footerEn: settings[0].receiptFooterEn,
    };
  },
});

export const reconciliation = query({
  args: { studentId: v.id("students") },
  returns: v.object({
    expectedOutstandingMinor: v.number(),
    storedOutstandingMinor: v.number(),
    differenceMinor: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const expected = await computeFinancialSummary(ctx, args.studentId);
    const stored = await ctx.db
      .query("studentFinancialSummaries")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .unique();
    const storedOutstandingMinor = stored?.outstandingMinor ?? 0;
    return {
      expectedOutstandingMinor: expected.outstandingMinor,
      storedOutstandingMinor,
      differenceMinor: storedOutstandingMinor - expected.outstandingMinor,
    };
  },
});

export const duePreview = query({
  args: {},
  returns: v.array(
    v.object({
      studentId: v.id("students"),
      displayName: v.string(),
      overdueMinor: v.number(),
      guardianPhone: v.string(),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const summaries = await ctx.db
      .query("studentFinancialSummaries")
      .withIndex("by_overdueMinor", (q) => q.gt("overdueMinor", 0))
      .order("desc")
      .take(100);
    const result = [];
    for (const summary of summaries) {
      const student = await ctx.db.get("students", summary.studentId);
      if (student)
        result.push({
          studentId: student._id,
          displayName: student.displayName,
          overdueMinor: summary.overdueMinor,
          guardianPhone: student.guardianPhone,
        });
    }
    return result;
  },
});

export const sendDueReminders = mutation({
  args: { studentIds: v.array(v.id("students")) },
  returns: v.object({ queued: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    if (args.studentIds.length > 100)
      throw new Error("A due reminder campaign is limited to 100 students");
    const campaignKey = `${dhakaDate()}:${Date.now()}`;
    let queued = 0,
      skipped = 0;
    for (const studentId of new Set(args.studentIds)) {
      const [student, summary] = await Promise.all([
        ctx.db.get("students", studentId),
        ctx.db
          .query("studentFinancialSummaries")
          .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
          .unique(),
      ]);
      if (!student || !summary || summary.overdueMinor <= 0) {
        skipped += 1;
        continue;
      }
      const isBn = student.preferredSmsLocale === "bn";
      const body = isBn
        ? `ধ্রুবক: ${student.displayName}-এর বকেয়া ৳ ${(summary.overdueMinor / 100).toFixed(2)}। অনুগ্রহ করে অফিসে যোগাযোগ করুন।`
        : `Dhrubok: ${student.displayName} has overdue fees of BDT ${(summary.overdueMinor / 100).toFixed(2)}. Please contact the office.`;
      await enqueueSms(ctx, {
        idempotencyKey: `due:${campaignKey}:${student._id}`,
        eventType: "due_reminder",
        relatedEntityType: "dueCampaign",
        relatedEntityId: campaignKey,
        studentId: student._id,
        guardianPhone: student.guardianPhone,
        locale: student.preferredSmsLocale,
        body,
      });
      queued += 1;
    }
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "due_reminders.queued",
      entityType: "dueCampaign",
      entityId: campaignKey,
      summary: "Due reminder campaign queued",
      metadata: { queued, skipped },
    });
    return { queued, skipped };
  },
});

export const getStudentSummary = query({
  args: { studentId: v.id("students") },
  returns: v.union(
    v.object({
      studentId: v.id("students"),
      totalChargedMinor: v.number(),
      totalDiscountMinor: v.number(),
      totalPaidMinor: v.number(),
      totalVoidedMinor: v.number(),
      outstandingMinor: v.number(),
      advanceCreditMinor: v.number(),
      overdueMinor: v.number(),
      lastPaymentAt: v.optional(v.number()),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    if (account.role === "teacher") throw new Error("Unauthorized");
    if (account.role === "student")
      await requireStudentOwnsRecord(ctx, args.studentId);
    const summary = await ctx.db
      .query("studentFinancialSummaries")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .unique();
    if (!summary) return null;
    return {
      studentId: summary.studentId,
      totalChargedMinor: summary.totalChargedMinor,
      totalDiscountMinor: summary.totalDiscountMinor,
      totalPaidMinor: summary.totalPaidMinor,
      totalVoidedMinor: summary.totalVoidedMinor,
      outstandingMinor: summary.outstandingMinor,
      advanceCreditMinor: summary.advanceCreditMinor,
      overdueMinor: summary.overdueMinor,
      lastPaymentAt: summary.lastPaymentAt,
      updatedAt: summary.updatedAt,
    };
  },
});
