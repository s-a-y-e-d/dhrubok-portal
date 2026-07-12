import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { dhakaDate } from "../model/dates";

type DbCtx = Pick<MutationCtx | QueryCtx, "db">;

export async function computeFinancialSummary(ctx: DbCtx, studentId: Id<"students">) {
  const charges = await ctx.db.query("studentCharges").withIndex("by_studentId_and_dueDate", (q) => q.eq("studentId", studentId)).take(1001);
  const payments = await ctx.db.query("payments").withIndex("by_studentId_and_paidAt", (q) => q.eq("studentId", studentId)).take(1001);
  if (charges.length > 1000 || payments.length > 1000) throw new Error("Financial summary exceeds the 1000-row safety limit; archive or migrate this student to a durable aggregate before continuing");
  const activeCharges = charges.filter((charge) => charge.status !== "voided");
  const postedPayments = payments.filter((payment) => payment.status === "posted");
  const today = dhakaDate();
  return {
    totalChargedMinor: activeCharges.reduce((sum, row) => sum + row.netAmountMinor, 0),
    totalDiscountMinor: activeCharges.reduce((sum, row) => sum + row.discountAmountMinor, 0),
    totalPaidMinor: postedPayments.reduce((sum, row) => sum + row.amountMinor, 0),
    totalVoidedMinor: payments.filter((payment) => payment.status === "voided").reduce((sum, row) => sum + row.amountMinor, 0),
    outstandingMinor: activeCharges.reduce((sum, row) => sum + Math.max(0, row.netAmountMinor - row.paidAmountMinor), 0),
    advanceCreditMinor: postedPayments.reduce((sum, row) => sum + row.advanceAmountMinor, 0),
    overdueMinor: activeCharges.filter((row) => row.dueDate < today).reduce((sum, row) => sum + Math.max(0, row.netAmountMinor - row.paidAmountMinor), 0),
    lastPaymentAt: postedPayments.length ? Math.max(...postedPayments.map((row) => row.paidAt)) : undefined,
  };
}

export async function refreshFinancialSummary(ctx: MutationCtx, studentId: Id<"students">) {
  const summary = await computeFinancialSummary(ctx, studentId);
  const existing = await ctx.db.query("studentFinancialSummaries").withIndex("by_studentId", (q) => q.eq("studentId", studentId)).unique();
  if (existing) await ctx.db.patch("studentFinancialSummaries", existing._id, { ...summary, updatedAt: Date.now() });
  else await ctx.db.insert("studentFinancialSummaries", { studentId, ...summary, updatedAt: Date.now() });
  return summary;
}
