/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { ageingForBalance } from "./model";

const modules = Object.fromEntries([
  ...Object.entries(import.meta.glob("../**/*.ts")).map(([path, loader]) => [
    `./${path.replace(/^\.\.\//, "")}`,
    loader,
  ]),
  ...Object.entries(import.meta.glob("./*.ts")).map(([path, loader]) => [
    `./finance/${path.slice(2)}`,
    loader,
  ]),
]);

async function fixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", {
      displayName: "Owner",
      email: "owner@example.com",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const ownerAccountId = await ctx.db.insert("portalAccounts", {
      role: "owner",
      status: "active",
      tokenIdentifier: "clerk|owner",
      loginEmail: "owner@example.com",
      normalizedLoginEmail: "owner@example.com",
      ownerProfileId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    const academicSessionId = await ctx.db.insert("academicSessions", {
      nameBn: "2026",
      nameEn: "2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const courseId = await ctx.db.insert("courses", {
      academicSessionId,
      code: "HSC",
      slug: "hsc",
      nameBn: "HSC",
      nameEn: "HSC",
      shortDescriptionBn: "",
      shortDescriptionEn: "",
      descriptionBn: "",
      descriptionEn: "",
      status: "active",
      isPublic: true,
      publicSortOrder: 1,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerAccountId,
      updatedByAccountId: ownerAccountId,
    });
    const batchId = await ctx.db.insert("batches", {
      academicSessionId,
      courseId,
      code: "B1",
      slug: "b1",
      nameBn: "Batch",
      nameEn: "Batch",
      status: "active",
      admissionOpen: true,
      isPublic: true,
      publicSortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    const studentId = await ctx.db.insert("students", {
      studentNumber: "ST-1",
      displayName: "Student",
      loginEmail: "student@example.com",
      normalizedLoginEmail: "student@example.com",
      schoolCollege: "School",
      currentClass: "10",
      guardianName: "Father",
      guardianPhone: "8801712345678",
      normalizedGuardianPhone: "8801712345678",
      guardianRelationship: "father",
      motherName: "Mother",
      motherPhone: "8801812345678",
      smsRecipient: "both",
      preferredSmsLocale: "en",
      admissionDate: "2026-01-01",
      status: "active",
      searchText: "student",
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerAccountId,
      updatedByAccountId: ownerAccountId,
    });
    await ctx.db.insert("portalAccounts", {
      role: "student",
      status: "active",
      tokenIdentifier: "clerk|student",
      loginEmail: "student@example.com",
      normalizedLoginEmail: "student@example.com",
      studentId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerAccountId,
    });
    const feePlanId = await ctx.db.insert("feePlans", {
      courseId,
      batchId,
      nameBn: "Monthly",
      nameEn: "Monthly",
      status: "active",
      defaultDueDay: 15,
      createdAt: now,
      updatedAt: now,
    });
    const feePlanItemId = await ctx.db.insert("feePlanItems", {
      feePlanId,
      chargeType: "monthly",
      labelBn: "Tuition",
      labelEn: "Tuition",
      amountMinor: 100_000,
      recurrence: "monthly",
      sortOrder: 1,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const enrolmentId = await ctx.db.insert("enrolments", {
      studentId,
      courseId,
      batchId,
      academicSessionId,
      enrolledOn: "2026-01-01",
      status: "active",
      feePlanId,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerAccountId,
    });
    return {
      ownerAccountId,
      studentId,
      enrolmentId,
      feePlanId,
      feePlanItemId,
      academicSessionId,
      courseId,
      batchId,
    };
  });
}

describe("finance invariants", () => {
  it("uses the fixed ageing boundaries without timezone drift", () => {
    const today = "2026-07-13";
    expect(ageingForBalance("2026-07-13", 100, today).currentMinor).toBe(100);
    expect(ageingForBalance("2026-07-12", 100, today).overdue1To15Minor).toBe(
      100,
    );
    expect(ageingForBalance("2026-06-28", 100, today).overdue1To15Minor).toBe(
      100,
    );
    expect(ageingForBalance("2026-06-27", 100, today).overdue16To30Minor).toBe(
      100,
    );
    expect(ageingForBalance("2026-06-13", 100, today).overdue16To30Minor).toBe(
      100,
    );
    expect(ageingForBalance("2026-06-12", 100, today).overdue31To60Minor).toBe(
      100,
    );
    expect(ageingForBalance("2026-05-14", 100, today).overdue31To60Minor).toBe(
      100,
    );
    expect(ageingForBalance("2026-05-13", 100, today).overdue61To90Minor).toBe(
      100,
    );
    expect(ageingForBalance("2026-04-14", 100, today).overdue61To90Minor).toBe(
      100,
    );
    expect(ageingForBalance("2026-04-13", 100, today).overdueOver90Minor).toBe(
      100,
    );
  });
  it("generates each monthly charge once using the configured due day", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    await t.mutation(internal.finance.functions.generateMonthlyBatch, {
      periodKey: "2026-07",
      cursor: null,
    });
    await t.mutation(internal.finance.functions.generateMonthlyBatch, {
      periodKey: "2026-07",
      cursor: null,
    });
    const charges = await t.run((ctx) =>
      ctx.db
        .query("studentCharges")
        .withIndex("by_generationKey", (q) =>
          q.eq(
            "generationKey",
            `monthly:${data.enrolmentId}:${data.feePlanItemId}:2026-07`,
          ),
        )
        .collect(),
    );
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({
      dueDate: "2026-07-15",
      originalAmountMinor: 100_000,
      netAmountMinor: 100_000,
    });
  });

  it("handles partial allocation, advance credit, future application, and void reversal", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    const chargeId = await owner.mutation(
      api.finance.functions.createCustomCharge,
      {
        studentId: data.studentId,
        type: "custom",
        descriptionBn: "Fee",
        descriptionEn: "Fee",
        amountMinor: 100_000,
        dueDate: "2026-01-15",
        generationKey: "custom:test",
      },
    );
    const payment = await owner.mutation(api.finance.functions.collectPayment, {
      studentId: data.studentId,
      amountMinor: 120_000,
      allocations: [{ chargeId, amountMinor: 40_000 }],
      method: "cash",
      paidAt: Date.now(),
    });
    expect(payment.advanceAmountMinor).toBe(80_000);
    const paymentMessages = await t.run((ctx) =>
      ctx.db
        .query("smsMessages")
        .withIndex("by_studentId_and_createdAt", (q) =>
          q.eq("studentId", data.studentId),
        )
        .collect(),
    );
    expect(
      paymentMessages.map((message) => message.normalizedRecipient).sort(),
    ).toEqual(["8801712345678", "8801812345678"]);
    const futureChargeId = await owner.mutation(
      api.finance.functions.createCustomCharge,
      {
        studentId: data.studentId,
        type: "custom",
        descriptionBn: "Future",
        descriptionEn: "Future",
        amountMinor: 50_000,
        dueDate: "2026-12-15",
        generationKey: "custom:future",
      },
    );
    let state = await t.run(async (ctx) => ({
      first: await ctx.db.get("studentCharges", chargeId),
      future: await ctx.db.get("studentCharges", futureChargeId),
      payment: await ctx.db.get("payments", payment.paymentId),
    }));
    expect(state.first?.paidAmountMinor).toBe(40_000);
    expect(state.future).toMatchObject({
      paidAmountMinor: 50_000,
      status: "paid",
    });
    expect(state.payment).toMatchObject({
      allocatedAmountMinor: 90_000,
      advanceAmountMinor: 30_000,
    });
    await owner.mutation(api.finance.functions.voidPayment, {
      paymentId: payment.paymentId,
      reason: "Entry mistake",
    });
    state = await t.run(async (ctx) => ({
      first: await ctx.db.get("studentCharges", chargeId),
      future: await ctx.db.get("studentCharges", futureChargeId),
      payment: await ctx.db.get("payments", payment.paymentId),
    }));
    expect(state.payment?.status).toBe("voided");
    expect(state.first?.paidAmountMinor).toBe(0);
    expect(state.future?.paidAmountMinor).toBe(0);
    const reconciliation = await owner.query(
      api.finance.functions.reconciliation,
      { studentId: data.studentId },
    );
    expect(reconciliation.differenceMinor).toBe(0);
  });

  it("keeps financial reconciliation owner-only", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const student = t.withIdentity({
      tokenIdentifier: "clerk|student",
      email: "student@example.com",
      emailVerified: true,
    });
    await expect(
      student.query(api.finance.functions.reconciliation, {
        studentId: data.studentId,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("reverses allocations and advance credit for refunds and restores them when voided", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    const chargeId = await owner.mutation(
      api.finance.functions.createCustomCharge,
      {
        studentId: data.studentId,
        type: "custom",
        descriptionBn: "Refund target",
        descriptionEn: "Refund target",
        amountMinor: 100_000,
        dueDate: "2026-01-15",
        generationKey: "custom:refund",
      },
    );
    const payment = await owner.mutation(api.finance.functions.collectPayment, {
      studentId: data.studentId,
      amountMinor: 120_000,
      allocations: [{ chargeId, amountMinor: 100_000 }],
      method: "cash",
      paidAt: Date.now(),
    });
    const adjustmentId = await owner.mutation(
      api.finance.operations.postAdjustment,
      {
        studentId: data.studentId,
        paymentId: payment.paymentId,
        type: "refund",
        amountMinor: 70_000,
        method: "cash",
        reason: "Partial refund",
      },
    );
    let state = await t.run(async (ctx) => ({
      charge: await ctx.db.get("studentCharges", chargeId),
      payment: await ctx.db.get("payments", payment.paymentId),
      summary: await ctx.db
        .query("studentFinancialSummaries")
        .withIndex("by_studentId", (q) => q.eq("studentId", data.studentId))
        .unique(),
    }));
    expect(state.charge).toMatchObject({
      paidAmountMinor: 50_000,
      status: "partially_paid",
    });
    expect(state.payment).toMatchObject({
      refundedAmountMinor: 70_000,
      allocatedAmountMinor: 50_000,
      advanceAmountMinor: 0,
    });
    expect(state.summary).toMatchObject({
      totalPaidMinor: 50_000,
      outstandingMinor: 50_000,
      advanceCreditMinor: 0,
    });
    await owner.mutation(api.finance.operations.voidAdjustment, {
      adjustmentId,
      reason: "Refund entered in error",
    });
    state = await t.run(async (ctx) => ({
      charge: await ctx.db.get("studentCharges", chargeId),
      payment: await ctx.db.get("payments", payment.paymentId),
      summary: await ctx.db
        .query("studentFinancialSummaries")
        .withIndex("by_studentId", (q) => q.eq("studentId", data.studentId))
        .unique(),
    }));
    expect(state.charge).toMatchObject({ paidAmountMinor: 100_000, status: "paid" });
    expect(state.payment).toMatchObject({
      refundedAmountMinor: 0,
      allocatedAmountMinor: 100_000,
      advanceAmountMinor: 20_000,
    });
    expect(state.summary).toMatchObject({
      totalPaidMinor: 120_000,
      outstandingMinor: 0,
      advanceCreditMinor: 20_000,
    });
  });

  it("lists fee plans and safely assigns a compatible plan", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    const plans = await owner.query(api.finance.functions.listFeePlans, {});
    expect(plans).toHaveLength(1);
    expect(plans[0].items).toHaveLength(1);
    await owner.mutation(api.finance.functions.assignFeePlan, {
      enrolmentId: data.enrolmentId,
      feePlanId: data.feePlanId,
      agreedMonthlyAmountMinor: 85_000,
    });
    const enrolment = await t.run((ctx) =>
      ctx.db.get("enrolments", data.enrolmentId),
    );
    expect(enrolment).toMatchObject({
      feePlanId: data.feePlanId,
      agreedMonthlyAmountMinor: 85_000,
    });
  });

  it("previews imports and commits each valid row idempotently", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    const batchId = await owner.mutation(api.finance.imports.previewBatch, {
      fileName: "payments.csv",
      fileHash: "hash-1",
      sendSms: false,
      rows: [
        {
          studentNumber: "ST-1",
          amountMinor: 50_000,
          method: "cash",
          paidAt: Date.now(),
        },
        {
          studentNumber: "MISSING",
          amountMinor: 10_000,
          method: "cash",
          paidAt: Date.now(),
        },
      ],
    });
    const preview = await owner.query(api.finance.imports.getBatch, {
      batchId,
    });
    expect(preview?.batch).toMatchObject({
      validRows: 1,
      invalidRows: 1,
      status: "previewed",
    });
    expect(
      await owner.mutation(api.finance.imports.commitBatch, {
        batchId,
        confirmed: true,
      }),
    ).toEqual({ committed: 0, skipped: 0 });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await owner.mutation(api.finance.imports.commitBatch, {
        batchId,
        confirmed: true,
      }),
    ).toEqual({ committed: 0, skipped: 1 });
    const payments = await t.run((ctx) =>
      ctx.db
        .query("payments")
        .withIndex("by_studentId_and_paidAt", (q) =>
          q.eq("studentId", data.studentId),
        )
        .collect(),
    );
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      amountMinor: 50_000,
      importRowId: expect.any(String),
    });
    vi.useRealTimers();
  });

  it("terminates import batches when a previewed student is no longer available", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await fixture(t);
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    const batchId = await owner.mutation(api.finance.imports.previewBatch, {
      fileName: "stale.csv",
      fileHash: "hash-stale",
      sendSms: false,
      rows: [
        {
          studentNumber: "ST-1",
          amountMinor: 50_000,
          method: "cash",
          paidAt: Date.now(),
        },
      ],
    });
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("paymentImportRows")
        .withIndex("by_batchId_and_rowNumber", (q) => q.eq("batchId", batchId))
        .unique();
      if (!row) throw new Error("Import row not found");
      await ctx.db.patch(row._id, { matchedStudentId: undefined });
    });
    await owner.mutation(api.finance.imports.commitBatch, {
      batchId,
      confirmed: true,
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const result = await owner.query(api.finance.imports.getBatch, { batchId });
    expect(result?.batch).toMatchObject({ status: "completed", committedRows: 0 });
    expect(result?.rows[0]).toMatchObject({ status: "skipped" });
    vi.useRealTimers();
  });

  it("keeps credit notes reusable and reverses their allocations atomically", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    const adjustmentId = await owner.mutation(
      api.finance.operations.postAdjustment,
      {
        studentId: data.studentId,
        type: "credit_note",
        amountMinor: 120_000,
        reason: "Service credit",
      },
    );
    const chargeId = await owner.mutation(
      api.finance.functions.createCustomCharge,
      {
        studentId: data.studentId,
        enrolmentId: data.enrolmentId,
        type: "custom",
        descriptionBn: "Credit target",
        descriptionEn: "Credit target",
        amountMinor: 100_000,
        dueDate: "2026-01-15",
        generationKey: "credit-target",
      },
    );
    let state = await t.run(async (ctx) => ({
      charge: await ctx.db.get("studentCharges", chargeId),
      summary: await ctx.db
        .query("studentFinancialSummaries")
        .withIndex("by_studentId", (q) => q.eq("studentId", data.studentId))
        .unique(),
    }));
    expect(state.charge).toMatchObject({
      paidAmountMinor: 100_000,
      status: "paid",
    });
    expect(state.summary?.advanceCreditMinor).toBe(20_000);
    await owner.mutation(api.finance.operations.voidAdjustment, {
      adjustmentId,
      reason: "Credit entered in error",
    });
    state = await t.run(async (ctx) => ({
      charge: await ctx.db.get("studentCharges", chargeId),
      summary: await ctx.db
        .query("studentFinancialSummaries")
        .withIndex("by_studentId", (q) => q.eq("studentId", data.studentId))
        .unique(),
    }));
    expect(state.charge).toMatchObject({ paidAmountMinor: 0, status: "due" });
    expect(state.summary?.advanceCreditMinor).toBe(0);
  });

  it("uses the agreement effective on a generated charge due date", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    const agreementId = await owner.mutation(
      api.finance.operations.activateAgreement,
      {
        enrolmentId: data.enrolmentId,
        feePlanId: data.feePlanId,
        effectiveFrom: "2026-07-01",
        agreedMonthlyAmountMinor: 85_000,
        reason: "Approved concession",
      },
    );
    await t.mutation(internal.finance.functions.generateMonthlyBatch, {
      periodKey: "2026-07",
      cursor: null,
    });
    const charge = await t.run((ctx) =>
      ctx.db
        .query("studentCharges")
        .withIndex("by_generationKey", (q) =>
          q.eq(
            "generationKey",
            `monthly:${data.enrolmentId}:${data.feePlanItemId}:2026-07`,
          ),
        )
        .unique(),
    );
    expect(charge).toMatchObject({ originalAmountMinor: 85_000, agreementId });
  });

  it("closes and explicitly reopens the daily cash drawer", async () => {
    const t = convexTest(schema, modules);
    await fixture(t);
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    const sessionId = await owner.mutation(api.finance.operations.openDrawer, {
      openingFloatMinor: 10_000,
    });
    expect(
      await owner.mutation(api.finance.operations.closeDrawer, {
        sessionId,
        countedCashMinor: 10_000,
        confirmed: true,
      }),
    ).toEqual({ expectedCashMinor: 10_000, varianceMinor: 0 });
    await expect(
      owner.mutation(api.finance.operations.openDrawer, {
        openingFloatMinor: 0,
      }),
    ).rejects.toThrow("reopen");
    await owner.mutation(api.finance.operations.reopenDrawer, {
      sessionId,
      reason: "Late cash receipt",
      confirmed: true,
    });
    const session = await t.run((ctx) =>
      ctx.db.get("cashDrawerSessions", sessionId),
    );
    expect(session).toMatchObject({
      status: "open",
      reopenReason: "Late cash receipt",
    });
  });

  it("aggregates course campaign dues by student and filters ageing buckets", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    const second = await t.run(async (ctx) => {
      const now = Date.now();
      const batchId = await ctx.db.insert("batches", {
        academicSessionId: data.academicSessionId,
        courseId: data.courseId,
        code: "B2",
        slug: "b2",
        nameBn: "Batch 2",
        nameEn: "Batch 2",
        status: "active",
        admissionOpen: true,
        isPublic: true,
        publicSortOrder: 2,
        createdAt: now,
        updatedAt: now,
      });
      const enrolmentId = await ctx.db.insert("enrolments", {
        studentId: data.studentId,
        courseId: data.courseId,
        batchId,
        academicSessionId: data.academicSessionId,
        enrolledOn: "2026-01-01",
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdByAccountId: data.ownerAccountId,
      });
      return { batchId, enrolmentId };
    });
    await owner.mutation(api.finance.functions.createCustomCharge, {
      studentId: data.studentId,
      enrolmentId: data.enrolmentId,
      type: "custom",
      descriptionBn: "Recent",
      descriptionEn: "Recent",
      amountMinor: 10_000,
      dueDate: "2026-07-01",
      generationKey: "campaign-recent",
    });
    await owner.mutation(api.finance.functions.createCustomCharge, {
      studentId: data.studentId,
      enrolmentId: second.enrolmentId,
      type: "custom",
      descriptionBn: "Older",
      descriptionEn: "Older",
      amountMinor: 20_000,
      dueDate: "2026-06-01",
      generationKey: "campaign-older",
    });
    const campaignId = await owner.mutation(
      api.finance.campaigns.createPreview,
      {
        scopeType: "course",
        courseId: data.courseId,
        ageingBuckets: ["31_60"],
        localeMode: "en",
      },
    );
    const detail = await owner.query(api.finance.campaigns.getCampaign, {
      campaignId,
    });
    expect(detail?.campaign).toMatchObject({
      resolvedStudentCount: 1,
      eligibleRecipientCount: 1,
    });
    expect(detail?.recipients).toHaveLength(1);
    expect(detail?.recipients[0]).toMatchObject({
      studentId: data.studentId,
      overdueMinorSnapshot: 20_000,
    });
  });
});
