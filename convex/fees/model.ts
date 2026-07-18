import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { nextIdentifier } from "../model/identifiers";
import { assertMinorUnits } from "../model/money";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function assertPeriodKey(value: string) {
  if (!PERIOD_RE.test(value)) throw new Error("Month must use YYYY-MM");
  return value;
}

export function periodFromDate(date: string) {
  return date.slice(0, 7);
}

export function dueDateForPeriod(periodKey: string) {
  return `${assertPeriodKey(periodKey)}-01`;
}

export function nextPeriod(periodKey: string) {
  assertPeriodKey(periodKey);
  const [year, month] = periodKey.split("-").map(Number);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function periodsBetween(from: string, through: string) {
  assertPeriodKey(from);
  assertPeriodKey(through);
  if (from > through) return [];
  const result: string[] = [];
  let cursor = from;
  while (cursor <= through) {
    result.push(cursor);
    if (result.length > 240) throw new Error("Billing range is too large");
    cursor = nextPeriod(cursor);
  }
  return result;
}

export async function materializeEnrolmentMonths(
  ctx: MutationCtx,
  enrolment: Doc<"enrolments">,
  throughPeriod: string,
) {
  const monthlyAmount = enrolment.agreedMonthlyAmountMinor ?? 0;
  const firstBillingMonth =
    enrolment.firstBillingMonth ?? periodFromDate(enrolment.enrolledOn);
  assertMinorUnits(monthlyAmount, "agreedMonthlyAmountMinor");
  if (monthlyAmount <= 0)
    throw new Error("Monthly fee must be greater than zero");
  const finalPeriod = enrolment.endedOn
    ? periodFromDate(enrolment.endedOn) < throughPeriod
      ? periodFromDate(enrolment.endedOn)
      : throughPeriod
    : throughPeriod;
  let created = 0;
  for (const periodKey of periodsBetween(firstBillingMonth, finalPeriod)) {
    const existing = await ctx.db
      .query("monthlyFeeRecords")
      .withIndex("by_enrolmentId_and_periodKey", (q) =>
        q.eq("enrolmentId", enrolment._id).eq("periodKey", periodKey),
      )
      .unique();
    if (existing) continue;
    await ctx.db.insert("monthlyFeeRecords", {
      studentId: enrolment.studentId,
      enrolmentId: enrolment._id,
      courseId: enrolment.courseId,
      batchId: enrolment.batchId,
      periodKey,
      dueDate: dueDateForPeriod(periodKey),
      amountMinor: monthlyAmount,
      status: "unpaid",
      createdAt: Date.now(),
    });
    created += 1;
  }
  return created;
}

type CollectionItemInput = {
  itemType: "admission" | "monthly" | "other";
  description: string;
  amountMinor: number;
  periodKey?: string;
  monthlyFeeRecordId?: Id<"monthlyFeeRecords">;
  enrolmentId?: Id<"enrolments">;
};

export async function postCollection(
  ctx: MutationCtx,
  args: {
    studentId: Id<"students">;
    collectionType: "admission" | "monthly" | "other";
    collectedOn: string;
    note?: string;
    collectedByAccountId: Id<"portalAccounts">;
    items: CollectionItemInput[];
  },
) {
  if (args.items.length === 0 || args.items.length > 24)
    throw new Error("A collection must contain between 1 and 24 items");
  const student = await ctx.db.get("students", args.studentId);
  if (!student) throw new Error("Student not found");
  const defaultEnrolment = await ctx.db
    .query("enrolments")
    .withIndex("by_studentId_and_status", (q) =>
      q.eq("studentId", student._id).eq("status", "active"),
    )
    .first();
  const amountMinor = args.items.reduce((sum, item) => {
    assertMinorUnits(item.amountMinor);
    if (item.amountMinor <= 0)
      throw new Error("Collection items must be positive");
    return sum + item.amountMinor;
  }, 0);
  const year = Number(args.collectedOn.slice(0, 4));
  const settings = (await ctx.db.query("coachingSettings").take(1))[0];
  const receiptPrefix = settings?.receiptPrefix?.trim() || "RCPT";
  const receiptNumber = await nextIdentifier(
    ctx,
    "receipt",
    receiptPrefix,
    year,
  );
  const createdAt = Date.now();
  const collectionId = await ctx.db.insert("feeCollections", {
    receiptNumber,
    studentId: student._id,
    collectionType: args.collectionType,
    amountMinor,
    collectedOn: args.collectedOn,
    note: args.note,
    status: "posted",
    collectedByAccountId: args.collectedByAccountId,
    createdAt,
  });
  for (const item of args.items) {
    const monthlyFeeRecord = item.monthlyFeeRecordId
      ? await ctx.db.get("monthlyFeeRecords", item.monthlyFeeRecordId)
      : null;
    if (monthlyFeeRecord && monthlyFeeRecord.studentId !== student._id)
      throw new Error("Collection item does not belong to this student");
    const enrolment = item.enrolmentId
      ? await ctx.db.get("enrolments", item.enrolmentId)
      : monthlyFeeRecord
        ? await ctx.db.get("enrolments", monthlyFeeRecord.enrolmentId)
        : defaultEnrolment;
    if (item.enrolmentId && (!enrolment || enrolment.studentId !== student._id))
      throw new Error("Collection item enrolment does not belong to this student");
    const courseId = monthlyFeeRecord?.courseId ?? enrolment?.courseId;
    const batchId = monthlyFeeRecord?.batchId ?? enrolment?.batchId;
    const [course, batch] = await Promise.all([
      courseId ? ctx.db.get("courses", courseId) : null,
      batchId ? ctx.db.get("batches", batchId) : null,
    ]);
    await ctx.db.insert("feeCollectionItems", {
      collectionId,
      studentId: student._id,
      monthlyFeeRecordId: item.monthlyFeeRecordId,
      itemType: item.itemType,
      descriptionSnapshot: item.description,
      periodKey: item.periodKey,
      amountMinor: item.amountMinor,
      studentNameSnapshot: student.displayName,
      studentNumberSnapshot: student.studentNumber,
      courseNameSnapshot: course?.nameEn ?? "—",
      batchNameSnapshot: batch?.nameEn ?? "—",
      createdAt,
    });
  }
  return { collectionId, receiptNumber, amountMinor };
}
