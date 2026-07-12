/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

const modules = Object.fromEntries([
  ...Object.entries(import.meta.glob("../**/*.ts")).map(([path, loader]) => [`./${path.replace(/^\.\.\//, "")}`, loader]),
  ...Object.entries(import.meta.glob("./*.ts")).map(([path, loader]) => [`./finance/${path.slice(2)}`, loader]),
]);

async function fixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: "Owner", email: "owner@example.com", status: "active", createdAt: now, updatedAt: now });
    const ownerAccountId = await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "clerk|owner", loginEmail: "owner@example.com", normalizedLoginEmail: "owner@example.com", ownerProfileId, locale: "en", createdAt: now, updatedAt: now });
    const academicSessionId = await ctx.db.insert("academicSessions", { nameBn: "2026", nameEn: "2026", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", createdAt: now, updatedAt: now });
    const courseId = await ctx.db.insert("courses", { academicSessionId, code: "HSC", slug: "hsc", nameBn: "HSC", nameEn: "HSC", shortDescriptionBn: "", shortDescriptionEn: "", descriptionBn: "", descriptionEn: "", status: "active", isPublic: true, publicSortOrder: 1, createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId, updatedByAccountId: ownerAccountId });
    const batchId = await ctx.db.insert("batches", { academicSessionId, courseId, code: "B1", slug: "b1", nameBn: "Batch", nameEn: "Batch", status: "active", admissionOpen: true, isPublic: true, publicSortOrder: 1, createdAt: now, updatedAt: now });
    const studentId = await ctx.db.insert("students", { studentNumber: "ST-1", displayName: "Student", loginEmail: "student@example.com", normalizedLoginEmail: "student@example.com", schoolCollege: "School", currentClass: "10", guardianName: "Guardian", guardianPhone: "8801712345678", normalizedGuardianPhone: "8801712345678", guardianRelationship: "Parent", preferredSmsLocale: "en", admissionDate: "2026-01-01", status: "active", searchText: "student", createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId, updatedByAccountId: ownerAccountId });
    await ctx.db.insert("portalAccounts", { role: "student", status: "active", tokenIdentifier: "clerk|student", loginEmail: "student@example.com", normalizedLoginEmail: "student@example.com", studentId, locale: "en", createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId });
    const feePlanId = await ctx.db.insert("feePlans", { courseId, batchId, nameBn: "Monthly", nameEn: "Monthly", status: "active", defaultDueDay: 15, createdAt: now, updatedAt: now });
    const feePlanItemId = await ctx.db.insert("feePlanItems", { feePlanId, chargeType: "monthly", labelBn: "Tuition", labelEn: "Tuition", amountMinor: 100_000, recurrence: "monthly", sortOrder: 1, status: "active", createdAt: now, updatedAt: now });
    const enrolmentId = await ctx.db.insert("enrolments", { studentId, courseId, batchId, academicSessionId, enrolledOn: "2026-01-01", status: "active", feePlanId, createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId });
    return { ownerAccountId, studentId, enrolmentId, feePlanId, feePlanItemId, courseId, batchId };
  });
}

describe("finance invariants", () => {
  it("generates each monthly charge once using the configured due day", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    await t.mutation(internal.finance.functions.generateMonthlyBatch, { periodKey: "2026-07", cursor: null });
    await t.mutation(internal.finance.functions.generateMonthlyBatch, { periodKey: "2026-07", cursor: null });
    const charges = await t.run((ctx) => ctx.db.query("studentCharges").withIndex("by_generationKey", (q) => q.eq("generationKey", `monthly:${data.enrolmentId}:${data.feePlanItemId}:2026-07`)).collect());
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({ dueDate: "2026-07-15", originalAmountMinor: 100_000, netAmountMinor: 100_000 });
  });

  it("handles partial allocation, advance credit, future application, and void reversal", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", email: "owner@example.com", emailVerified: true });
    const chargeId = await owner.mutation(api.finance.functions.createCustomCharge, { studentId: data.studentId, type: "custom", descriptionBn: "Fee", descriptionEn: "Fee", amountMinor: 100_000, dueDate: "2026-01-15", generationKey: "custom:test" });
    const payment = await owner.mutation(api.finance.functions.collectPayment, { studentId: data.studentId, amountMinor: 120_000, allocations: [{ chargeId, amountMinor: 40_000 }], method: "cash", paidAt: Date.now() });
    expect(payment.advanceAmountMinor).toBe(80_000);
    const futureChargeId = await owner.mutation(api.finance.functions.createCustomCharge, { studentId: data.studentId, type: "custom", descriptionBn: "Future", descriptionEn: "Future", amountMinor: 50_000, dueDate: "2026-12-15", generationKey: "custom:future" });
    let state = await t.run(async (ctx) => ({ first: await ctx.db.get("studentCharges", chargeId), future: await ctx.db.get("studentCharges", futureChargeId), payment: await ctx.db.get("payments", payment.paymentId) }));
    expect(state.first?.paidAmountMinor).toBe(40_000);
    expect(state.future).toMatchObject({ paidAmountMinor: 50_000, status: "paid" });
    expect(state.payment).toMatchObject({ allocatedAmountMinor: 90_000, advanceAmountMinor: 30_000 });
    await owner.mutation(api.finance.functions.voidPayment, { paymentId: payment.paymentId, reason: "Entry mistake" });
    state = await t.run(async (ctx) => ({ first: await ctx.db.get("studentCharges", chargeId), future: await ctx.db.get("studentCharges", futureChargeId), payment: await ctx.db.get("payments", payment.paymentId) }));
    expect(state.payment?.status).toBe("voided");
    expect(state.first?.paidAmountMinor).toBe(0);
    expect(state.future?.paidAmountMinor).toBe(0);
    const reconciliation = await owner.query(api.finance.functions.reconciliation, { studentId: data.studentId });
    expect(reconciliation.differenceMinor).toBe(0);
  });

  it("keeps financial reconciliation owner-only", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const student = t.withIdentity({ tokenIdentifier: "clerk|student", email: "student@example.com", emailVerified: true });
    await expect(student.query(api.finance.functions.reconciliation, { studentId: data.studentId })).rejects.toThrow("Unauthorized");
  });

  it("lists fee plans and safely assigns a compatible plan", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", email: "owner@example.com", emailVerified: true });
    const plans = await owner.query(api.finance.functions.listFeePlans, {});
    expect(plans).toHaveLength(1);
    expect(plans[0].items).toHaveLength(1);
    await owner.mutation(api.finance.functions.assignFeePlan, { enrolmentId: data.enrolmentId, feePlanId: data.feePlanId, agreedMonthlyAmountMinor: 85_000 });
    const enrolment = await t.run((ctx) => ctx.db.get("enrolments", data.enrolmentId));
    expect(enrolment).toMatchObject({ feePlanId: data.feePlanId, agreedMonthlyAmountMinor: 85_000 });
  });
});
