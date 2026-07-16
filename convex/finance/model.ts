import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { dhakaDate } from "../model/dates";

type DbCtx = Pick<MutationCtx | QueryCtx, "db">;

export const FINANCE_SUMMARY_VERSION = 2;

function localDateDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function ageingForBalance(
  dueDate: string,
  balanceMinor: number,
  today = dhakaDate(),
) {
  const daysOverdue = localDateDay(today) - localDateDay(dueDate);
  return {
    currentMinor: daysOverdue <= 0 ? balanceMinor : 0,
    overdue1To15Minor: daysOverdue >= 1 && daysOverdue <= 15 ? balanceMinor : 0,
    overdue16To30Minor:
      daysOverdue >= 16 && daysOverdue <= 30 ? balanceMinor : 0,
    overdue31To60Minor:
      daysOverdue >= 31 && daysOverdue <= 60 ? balanceMinor : 0,
    overdue61To90Minor:
      daysOverdue >= 61 && daysOverdue <= 90 ? balanceMinor : 0,
    overdueOver90Minor: daysOverdue >= 91 ? balanceMinor : 0,
  };
}

export async function computeFinancialSummary(
  ctx: DbCtx,
  studentId: Id<"students">,
) {
  const charges = await ctx.db
    .query("studentCharges")
    .withIndex("by_studentId_and_dueDate", (q) => q.eq("studentId", studentId))
    .take(1001);
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_studentId_and_paidAt", (q) => q.eq("studentId", studentId))
    .take(1001);
  const credits = await ctx.db
    .query("studentCredits")
    .withIndex("by_studentId_and_status", (q) => q.eq("studentId", studentId))
    .take(1001);
  if (charges.length > 1000 || payments.length > 1000 || credits.length > 1000)
    throw new Error(
      "Financial summary exceeds the 1000-row safety limit; archive or migrate this student to a durable aggregate before continuing",
    );
  const activeCharges = charges.filter((charge) => charge.status !== "voided");
  const postedPayments = payments.filter(
    (payment) => payment.status === "posted",
  );
  const today = dhakaDate();
  const unpaidCharges = activeCharges.filter(
    (row) => row.netAmountMinor > row.paidAmountMinor,
  );
  const ageing = unpaidCharges.reduce(
    (totals, row) => {
      const bucket = ageingForBalance(
        row.dueDate,
        row.netAmountMinor - row.paidAmountMinor,
        today,
      );
      for (const key of Object.keys(bucket) as Array<keyof typeof bucket>)
        totals[key] += bucket[key];
      return totals;
    },
    {
      currentMinor: 0,
      overdue1To15Minor: 0,
      overdue16To30Minor: 0,
      overdue31To60Minor: 0,
      overdue61To90Minor: 0,
      overdueOver90Minor: 0,
    },
  );
  return {
    totalChargedMinor: activeCharges.reduce(
      (sum, row) => sum + row.netAmountMinor,
      0,
    ),
    totalDiscountMinor: activeCharges.reduce(
      (sum, row) => sum + row.discountAmountMinor,
      0,
    ),
    totalPaidMinor: postedPayments.reduce(
      (sum, row) =>
        sum + row.amountMinor - (row.refundedAmountMinor ?? 0),
      0,
    ),
    totalVoidedMinor: payments
      .filter((payment) => payment.status === "voided")
      .reduce((sum, row) => sum + row.amountMinor, 0),
    outstandingMinor: activeCharges.reduce(
      (sum, row) => sum + Math.max(0, row.netAmountMinor - row.paidAmountMinor),
      0,
    ),
    advanceCreditMinor:
      postedPayments.reduce((sum, row) => sum + row.advanceAmountMinor, 0) +
      credits
        .filter((row) => row.status === "available")
        .reduce((sum, row) => sum + row.remainingAmountMinor, 0),
    overdueMinor: activeCharges
      .filter((row) => row.dueDate < today)
      .reduce(
        (sum, row) =>
          sum + Math.max(0, row.netAmountMinor - row.paidAmountMinor),
        0,
      ),
    ...ageing,
    oldestUnpaidDueDate: unpaidCharges.length
      ? unpaidCharges.reduce(
          (oldest, row) => (row.dueDate < oldest ? row.dueDate : oldest),
          unpaidCharges[0].dueDate,
        )
      : undefined,
    summaryVersion: FINANCE_SUMMARY_VERSION,
    lastPaymentAt: postedPayments.length
      ? Math.max(...postedPayments.map((row) => row.paidAt))
      : undefined,
  };
}

export async function refreshReceivableScopeSummaries(
  ctx: MutationCtx,
  studentId: Id<"students">,
) {
  const charges = await ctx.db
    .query("studentCharges")
    .withIndex("by_studentId_and_dueDate", (q) => q.eq("studentId", studentId))
    .take(1001);
  if (charges.length > 1000)
    throw new Error(
      "Scoped summary exceeds the 1000-row migration safety limit",
    );
  const enrolmentIds = [
    ...new Set(
      charges.map((row) => row.enrolmentId).filter((id) => id !== undefined),
    ),
  ];
  const existing = await ctx.db
    .query("receivableScopeSummaries")
    .withIndex("by_studentId_and_enrolmentId", (q) =>
      q.eq("studentId", studentId),
    )
    .take(100);
  const now = Date.now();
  for (const enrolmentId of enrolmentIds) {
    const scoped = charges.filter(
      (row) => row.enrolmentId === enrolmentId && row.status !== "voided",
    );
    const first = scoped[0];
    if (!first) continue;
    const balances = scoped
      .map((row) => ({
        row,
        balance: Math.max(0, row.netAmountMinor - row.paidAmountMinor),
      }))
      .filter(({ balance }) => balance > 0);
    const ageing = balances.reduce(
      (total, item) => {
        const bucket = ageingForBalance(item.row.dueDate, item.balance);
        for (const key of Object.keys(bucket) as Array<keyof typeof bucket>)
          total[key] += bucket[key];
        return total;
      },
      {
        currentMinor: 0,
        overdue1To15Minor: 0,
        overdue16To30Minor: 0,
        overdue31To60Minor: 0,
        overdue61To90Minor: 0,
        overdueOver90Minor: 0,
      },
    );
    const value = {
      studentId,
      enrolmentId,
      courseId: first.courseId,
      batchId: first.batchId,
      outstandingMinor: balances.reduce((sum, item) => sum + item.balance, 0),
      overdueMinor:
        ageing.overdue1To15Minor +
        ageing.overdue16To30Minor +
        ageing.overdue31To60Minor +
        ageing.overdue61To90Minor +
        ageing.overdueOver90Minor,
      ...ageing,
      oldestUnpaidDueDate: balances.length
        ? balances.reduce(
            (date, item) => (item.row.dueDate < date ? item.row.dueDate : date),
            balances[0].row.dueDate,
          )
        : undefined,
      updatedAt: now,
      summaryVersion: FINANCE_SUMMARY_VERSION,
    };
    const row = existing.find((item) => item.enrolmentId === enrolmentId);
    if (row) await ctx.db.patch("receivableScopeSummaries", row._id, value);
    else await ctx.db.insert("receivableScopeSummaries", value);
  }
}

export async function refreshFinancialSummary(
  ctx: MutationCtx,
  studentId: Id<"students">,
) {
  const summary = await computeFinancialSummary(ctx, studentId);
  const existing = await ctx.db
    .query("studentFinancialSummaries")
    .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
    .unique();

  const diffOutstanding =
    summary.outstandingMinor - (existing?.outstandingMinor ?? 0);
  const diffOverdue = summary.overdueMinor - (existing?.overdueMinor ?? 0);

  let diffOverdueCount = 0;
  const wasOverdue = (existing?.overdueMinor ?? 0) > 0;
  const isOverdue = summary.overdueMinor > 0;
  if (wasOverdue !== isOverdue) {
    diffOverdueCount = isOverdue ? 1 : -1;
  }

  if (existing)
    await ctx.db.patch("studentFinancialSummaries", existing._id, {
      ...summary,
      updatedAt: Date.now(),
    });
  else
    await ctx.db.insert("studentFinancialSummaries", {
      studentId,
      ...summary,
      updatedAt: Date.now(),
    });
  await refreshReceivableScopeSummaries(ctx, studentId);

  const student = await ctx.db.get("students", studentId);
  if (student?.status === "active") {
    const today = dhakaDate();
    const dailySummary = await ctx.db
      .query("dailyOperationalSummaries")
      .withIndex("by_date", (q) => q.eq("date", today))
      .unique();
    if (dailySummary) {
      await ctx.db.patch("dailyOperationalSummaries", dailySummary._id, {
        overdueMinor: Math.max(0, dailySummary.overdueMinor + diffOverdue),
        overdueStudentsCount: Math.max(
          0,
          dailySummary.overdueStudentsCount + diffOverdueCount,
        ),
        activeOutstandingMinor: Math.max(
          0,
          (dailySummary.activeOutstandingMinor ?? 0) + diffOutstanding,
        ),
        updatedAt: Date.now(),
      });
    }
  }

  return summary;
}
