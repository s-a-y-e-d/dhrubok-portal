import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import { requireAccount, requireOwner, requireStudent } from "../model/auth";
import { writeAudit } from "../model/audit";
import { assertLocalDate, dhakaDate } from "../model/dates";
import { assertMinorUnits } from "../model/money";
import { optionalText, requiredText } from "../admissions/model";
import {
  assertPeriodKey,
  dueDateForPeriod,
  materializeEnrolmentMonths,
  periodFromDate,
  postCollection,
} from "./model";

const collectionTypeValidator = v.union(
  v.literal("admission"),
  v.literal("monthly"),
  v.literal("other"),
);

const collectionResultValidator = v.object({
  collectionId: v.id("feeCollections"),
  receiptNumber: v.string(),
  amountMinor: v.number(),
});

function monthLabel(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, 1));
}

function validateCollectionDate(value: string) {
  assertLocalDate(value);
  if (value > dhakaDate())
    throw new Error("Collection date cannot be in the future");
}

function paidAmountFor(record: Doc<"monthlyFeeRecords">) {
  return record.paidAmountMinor ?? (record.status === "paid" ? record.amountMinor : 0);
}

function remainingAmountFor(record: Doc<"monthlyFeeRecords">) {
  return Math.max(record.amountMinor - paidAmountFor(record), 0);
}

function isDueRecord(record: Doc<"monthlyFeeRecords">, today: string) {
  return record.dueDate <= today && remainingAmountFor(record) > 0;
}

function paymentStatus(amountMinor: number, paidAmountMinor: number) {
  if (paidAmountMinor <= 0) return "unpaid" as const;
  return paidAmountMinor >= amountMinor ? "paid" as const : "partially_paid" as const;
}

function allocateOldestDue(
  records: Doc<"monthlyFeeRecords">[],
  amountMinor: number,
  today: string,
) {
  let remaining = amountMinor;
  const allocations: Array<{ record: Doc<"monthlyFeeRecords">; amountMinor: number }> = [];
  for (const record of records
    .filter((row) => isDueRecord(row, today))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.periodKey.localeCompare(b.periodKey) || a._creationTime - b._creationTime)) {
    if (remaining <= 0) break;
    const allocatedMinor = Math.min(remaining, remainingAmountFor(record));
    allocations.push({ record, amountMinor: allocatedMinor });
    remaining -= allocatedMinor;
  }
  return { allocations, unallocatedMinor: remaining };
}

export const materializeBatch = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), throughPeriod: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertPeriodKey(args.throughPeriod);
    const page = await ctx.db
      .query("enrolments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .paginate({ numItems: 25, cursor: args.cursor });
    for (const enrolment of page.page)
      await materializeEnrolmentMonths(ctx, enrolment, args.throughPeriod);
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.fees.functions.materializeBatch,
        {
          cursor: page.continueCursor,
          throughPeriod: args.throughPeriod,
        },
      );
    return null;
  },
});

export const materializeNow = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const page = await ctx.db
      .query("enrolments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(100);
    for (const enrolment of page)
      await materializeEnrolmentMonths(
        ctx,
        enrolment,
        periodFromDate(dhakaDate()),
      );
    return null;
  },
});

export const ownerWorklist = query({
  args: {
    search: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    dueOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    collectedTodayMinor: v.number(),
    totalDueMinor: v.number(),
    studentsWithDue: v.number(),
    futurePaidMonths: v.number(),
    students: v.array(
      v.object({
        studentId: v.id("students"),
        studentNumber: v.string(),
        displayName: v.string(),
        photoUrl: v.union(v.string(), v.null()),
        guardianPhone: v.string(),
        monthlyFeeMinor: v.number(),
        dueMinor: v.number(),
        futurePaidItems: v.number(),
        dueItems: v.array(v.object({
          enrolmentId: v.id("enrolments"), periodKey: v.string(), amountMinor: v.number(),
          courseNameBn: v.string(), courseNameEn: v.string(), batchNameBn: v.string(), batchNameEn: v.string(),
        })),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const today = dhakaDate();
    const currentPeriod = periodFromDate(today);
    const enrolments = await ctx.db
      .query("enrolments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(300);
    const byStudent = new Map<string, {
      studentId: Id<"students">; studentNumber: string; displayName: string; photoUrl: string | null; guardianPhone: string;
      monthlyFeeMinor: number; dueMinor: number; futurePaidItems: number;
      dueItems: Array<{ enrolmentId: Id<"enrolments">; periodKey: string; amountMinor: number; courseNameBn: string; courseNameEn: string; batchNameBn: string; batchNameEn: string }>;
    }>();
    let totalDueMinor = 0;
    let futurePaidMonths = 0;
    for (const enrolment of enrolments) {
      if (args.courseId && enrolment.courseId !== args.courseId) continue;
      if (args.batchId && enrolment.batchId !== args.batchId) continue;
      const [student, course, batch, records] = await Promise.all([
        ctx.db.get("students", enrolment.studentId),
        ctx.db.get("courses", enrolment.courseId),
        ctx.db.get("batches", enrolment.batchId),
        ctx.db
          .query("monthlyFeeRecords")
          .withIndex("by_studentId_and_dueDate", (q) =>
            q.eq("studentId", enrolment.studentId),
          )
          .take(500),
      ]);
      if (!student || student.status !== "active" || !course || !batch)
        continue;
      const needle = args.search?.trim().toLowerCase();
      if (
        needle &&
        !`${student.displayName} ${student.studentNumber} ${student.guardianPhone}`
          .toLowerCase()
          .includes(needle)
      )
        continue;
      const scopedRecords = records.filter((record) => record.enrolmentId === enrolment._id);
      const due = scopedRecords.filter((record) => isDueRecord(record, today));
      const future = scopedRecords.filter(
        (record) =>
          record.status === "paid" && record.periodKey > currentPeriod,
      );
      if (args.dueOnly && due.length === 0) continue;
      const dueMinor = due.reduce((sum, record) => sum + remainingAmountFor(record), 0);
      totalDueMinor += dueMinor;
      futurePaidMonths += future.length;
      const existing = byStudent.get(student._id);
      const row = existing ?? { studentId: student._id, studentNumber: student.studentNumber, displayName: student.displayName, photoUrl: student.photoStorageId ? await ctx.storage.getUrl(student.photoStorageId) : null, guardianPhone: student.guardianPhone, monthlyFeeMinor: 0, dueMinor: 0, futurePaidItems: 0, dueItems: [] };
      row.monthlyFeeMinor += enrolment.agreedMonthlyAmountMinor ?? 0;
      row.dueMinor += dueMinor; row.futurePaidItems += future.length;
      row.dueItems.push(...due.map((record) => ({ enrolmentId: enrolment._id, periodKey: record.periodKey, amountMinor: remainingAmountFor(record), courseNameBn: course.nameBn, courseNameEn: course.nameEn, batchNameBn: batch.nameBn, batchNameEn: batch.nameEn })));
      byStudent.set(student._id, row);
    }
    const rows = [...byStudent.values()];
    const studentsWithDue = rows.filter((row) => row.dueMinor > 0).length;
    rows.sort(
      (a, b) =>
        b.dueMinor - a.dueMinor || a.displayName.localeCompare(b.displayName),
    );
    const collections = await ctx.db
      .query("feeCollections")
      .withIndex("by_status_and_collectedOn", (q) =>
        q.eq("status", "posted").eq("collectedOn", today),
      )
      .take(500);
    return {
      collectedTodayMinor: collections.reduce(
        (sum, row) => sum + row.amountMinor,
        0,
      ),
      totalDueMinor,
      studentsWithDue,
      futurePaidMonths,
      students: rows.slice(0, Math.min(Math.max(args.limit ?? 100, 1), 200)),
    };
  },
});

export const studentCollectionOptions = query({
  args: { studentId: v.id("students") },
  returns: v.object({
    studentId: v.id("students"),
    displayName: v.string(),
    studentNumber: v.string(),
    photoUrl: v.union(v.string(), v.null()),
    enrolments: v.array(v.object({
      enrolmentId: v.id("enrolments"), courseNameBn: v.string(), courseNameEn: v.string(), batchNameBn: v.string(), batchNameEn: v.string(),
      enrolmentStatus: v.union(v.literal("active"), v.literal("completed"), v.literal("withdrawn"), v.literal("transferred")), monthlyFeeMinor: v.number(),
      months: v.array(v.object({ periodKey: v.string(), amountMinor: v.number(), originalAmountMinor: v.number(), paidAmountMinor: v.number(), status: v.union(v.literal("due"), v.literal("partially_paid"), v.literal("future"), v.literal("paid")) })),
    })),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const [student, enrolments, records] = await Promise.all([
      ctx.db.get("students", args.studentId),
      ctx.db
        .query("enrolments")
        .withIndex("by_studentId_and_status", (q) => q.eq("studentId", args.studentId))
        .take(100),
      ctx.db
        .query("monthlyFeeRecords")
        .withIndex("by_studentId_and_dueDate", (q) =>
          q.eq("studentId", args.studentId),
        )
        .take(500),
    ]);
    if (!student) throw new Error("Student not found");
    const today = dhakaDate();
    const currentPeriod = periodFromDate(today);
    const currentYear = currentPeriod.slice(0, 4);
    const enrolmentOptions = [];
    for (const enrolment of enrolments) {
      const enrolmentRecords = records.filter((record) => record.enrolmentId === enrolment._id);
      const outstanding = enrolmentRecords.filter((record) => remainingAmountFor(record) > 0);
      if (enrolment.status !== "active" && outstanding.length === 0) continue;
      const [course, batch] = await Promise.all([ctx.db.get("courses", enrolment.courseId), ctx.db.get("batches", enrolment.batchId)]);
      if (!course || !batch) continue;
      const byPeriod = new Map(enrolmentRecords.map((record) => [record.periodKey, record]));
      const months: Array<{ periodKey: string; amountMinor: number; originalAmountMinor: number; paidAmountMinor: number; status: "due" | "partially_paid" | "future" | "paid" }> = outstanding.filter((record) => record.dueDate <= today).map((record) => ({ periodKey: record.periodKey, amountMinor: remainingAmountFor(record), originalAmountMinor: record.amountMinor, paidAmountMinor: paidAmountFor(record), status: record.status === "partially_paid" ? "partially_paid" : "due" }));
      if (enrolment.status === "active") for (let month = Number(currentPeriod.slice(5, 7)) + 1; month <= 12; month += 1) {
        const periodKey = `${currentYear}-${String(month).padStart(2, "0")}`; const record = byPeriod.get(periodKey);
        const originalAmountMinor = record?.amountMinor ?? enrolment.agreedMonthlyAmountMinor ?? 0;
        months.push({ periodKey, amountMinor: originalAmountMinor, originalAmountMinor, paidAmountMinor: record ? paidAmountFor(record) : 0, status: record?.status === "paid" ? "paid" : "future" });
      }
      enrolmentOptions.push({ enrolmentId: enrolment._id, courseNameBn: course.nameBn, courseNameEn: course.nameEn, batchNameBn: batch.nameBn, batchNameEn: batch.nameEn, enrolmentStatus: enrolment.status, monthlyFeeMinor: enrolment.agreedMonthlyAmountMinor ?? 0, months });
    }
    return {
      studentId: student._id,
      displayName: student.displayName,
      studentNumber: student.studentNumber,
      photoUrl: student.photoStorageId
        ? await ctx.storage.getUrl(student.photoStorageId)
        : null,
      enrolments: enrolmentOptions,
    };
  },
});

export const previewPartialDue = query({
  args: { studentId: v.id("students"), amountMinor: v.number() },
  returns: v.object({
    dueMinor: v.number(),
    allocatedMinor: v.number(),
    remainingAfterMinor: v.number(),
    allocations: v.array(v.object({ monthlyFeeRecordId: v.id("monthlyFeeRecords"), periodKey: v.string(), amountMinor: v.number(), remainingMinor: v.number() })),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    assertMinorUnits(args.amountMinor);
    if (args.amountMinor <= 0) throw new Error("Payment amount must be greater than zero");
    const records = await ctx.db.query("monthlyFeeRecords").withIndex("by_studentId_and_dueDate", (q) => q.eq("studentId", args.studentId)).take(500);
    const dueMinor = records.filter((record) => isDueRecord(record, dhakaDate())).reduce((sum, record) => sum + remainingAmountFor(record), 0);
    const { allocations } = allocateOldestDue(records, Math.min(args.amountMinor, dueMinor), dhakaDate());
    return {
      dueMinor,
      allocatedMinor: allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0),
      remainingAfterMinor: Math.max(dueMinor - args.amountMinor, 0),
      allocations: allocations.map(({ record, amountMinor }) => ({ monthlyFeeRecordId: record._id, periodKey: record.periodKey, amountMinor, remainingMinor: remainingAmountFor(record) - amountMinor })),
    };
  },
});

export const collectDue = mutation({
  args: { studentId: v.id("students"), collectedOn: v.string() },
  returns: collectionResultValidator,
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    validateCollectionDate(args.collectedOn);
    const today = dhakaDate();
    const records = await ctx.db.query("monthlyFeeRecords").withIndex("by_studentId_and_dueDate", (q) => q.eq("studentId", args.studentId)).take(240);
    const due = records.filter((record) => isDueRecord(record, today));
    if (!due.length) throw new Error("This student has no monthly fees due");
    const items = await Promise.all(due.map(async (record) => {
      const enrolment = record.enrolmentId ? await ctx.db.get("enrolments", record.enrolmentId) : null;
      const course = enrolment ? await ctx.db.get("courses", enrolment.courseId) : null;
      return { itemType: "monthly" as const, description: `${course ? `${course.nameEn} - ` : ""}${monthLabel(record.periodKey)} Monthly Fee`, amountMinor: remainingAmountFor(record), periodKey: record.periodKey, monthlyFeeRecordId: record._id };
    }));
    const result = await postCollection(ctx, {
      studentId: args.studentId,
      collectionType: "monthly",
      collectedOn: args.collectedOn,
      collectedByAccountId: account._id,
      items,
    });
    const now = Date.now();
    for (const record of due)
      await ctx.db.patch(record._id, { status: "paid", paidAmountMinor: record.amountMinor, collectionId: result.collectionId, paidAt: now });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "fee.collection_posted",
      entityType: "feeCollection",
      entityId: result.collectionId,
      summary: "Collected all due monthly fees",
      metadata: { amountMinor: result.amountMinor },
    });
    return result;
  },
});

export const collectPartialDue = mutation({
  args: { studentId: v.id("students"), amountMinor: v.number(), collectedOn: v.string(), note: v.optional(v.string()) },
  returns: collectionResultValidator,
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    validateCollectionDate(args.collectedOn);
    assertMinorUnits(args.amountMinor);
    if (args.amountMinor <= 0) throw new Error("Payment amount must be greater than zero");
    const today = dhakaDate();
    const records = await ctx.db.query("monthlyFeeRecords").withIndex("by_studentId_and_dueDate", (q) => q.eq("studentId", args.studentId)).take(500);
    const { allocations, unallocatedMinor } = allocateOldestDue(records, args.amountMinor, today);
    if (!allocations.length) throw new Error("This student has no monthly fees due");
    if (unallocatedMinor > 0) throw new Error("Payment amount exceeds the current due balance");
    const items = await Promise.all(allocations.map(async ({ record, amountMinor }) => {
      const course = await ctx.db.get("courses", record.courseId);
      return { itemType: "monthly" as const, description: `${course?.nameEn ?? "Monthly fee"} - ${monthLabel(record.periodKey)} payment`, amountMinor, periodKey: record.periodKey, monthlyFeeRecordId: record._id };
    }));
    const result = await postCollection(ctx, { studentId: args.studentId, collectionType: "monthly", collectedOn: args.collectedOn, note: optionalText(args.note, "Note", 500), collectedByAccountId: account._id, items });
    const now = Date.now();
    for (const { record, amountMinor } of allocations) {
      const paidAmountMinor = paidAmountFor(record) + amountMinor;
      const status = paymentStatus(record.amountMinor, paidAmountMinor);
      await ctx.db.patch(record._id, { status, paidAmountMinor, collectionId: status === "paid" ? result.collectionId : undefined, paidAt: status === "paid" ? now : undefined });
    }
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "fee.collection_posted", entityType: "feeCollection", entityId: result.collectionId, summary: "Collected partial monthly dues", metadata: { amountMinor: result.amountMinor } });
    return result;
  },
});

export const collectMonths = mutation({
  args: {
    studentId: v.id("students"),
    periodKeys: v.array(v.string()),
    collectedOn: v.string(),
    note: v.optional(v.string()),
  },
  returns: collectionResultValidator,
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    validateCollectionDate(args.collectedOn);
    const unique = [...new Set(args.periodKeys.map(assertPeriodKey))];
    if (!unique.length || unique.length > 24)
      throw new Error("Select between 1 and 24 months");
    const today = dhakaDate();
    const currentYear = periodFromDate(today).slice(0, 4);
    const enrolment = await ctx.db
      .query("enrolments")
      .withIndex("by_studentId_and_status", (q) =>
        q.eq("studentId", args.studentId).eq("status", "active"),
      )
      .first();
    if (!enrolment) throw new Error("Active enrolment not found");
    const selected = [];
    for (const periodKey of unique.sort()) {
      if (
        periodKey > periodFromDate(today) &&
        periodKey.slice(0, 4) !== currentYear
      )
        throw new Error(
          "Future fees can only be collected for the current year",
        );
      let record = (
        await ctx.db
          .query("monthlyFeeRecords")
          .withIndex("by_studentId_and_dueDate", (q) =>
            q.eq("studentId", args.studentId),
          )
          .take(240)
      ).find((row) => row.periodKey === periodKey);
      if (!record) {
        const firstBillingMonth =
          enrolment.firstBillingMonth ?? periodFromDate(enrolment.enrolledOn);
        const amountMinor = enrolment.agreedMonthlyAmountMinor ?? 0;
        if (amountMinor <= 0) throw new Error("Monthly fee is not configured");
        if (periodKey < firstBillingMonth)
          throw new Error("Month is before the first billing month");
        const id = await ctx.db.insert("monthlyFeeRecords", {
          studentId: args.studentId,
          enrolmentId: enrolment._id,
          courseId: enrolment.courseId,
          batchId: enrolment.batchId,
          periodKey,
          dueDate: dueDateForPeriod(periodKey),
          amountMinor,
          status: "unpaid",
          paidAmountMinor: 0,
          createdAt: Date.now(),
        });
        record = (await ctx.db.get("monthlyFeeRecords", id)) ?? undefined;
      }
      if (!record || remainingAmountFor(record) <= 0)
        throw new Error(`${monthLabel(periodKey)} is already paid`);
      selected.push(record);
    }
    const result = await postCollection(ctx, {
      studentId: args.studentId,
      collectionType: "monthly",
      collectedOn: args.collectedOn,
      note: optionalText(args.note, "Note", 500),
      collectedByAccountId: account._id,
      items: selected.map((record) => ({
        itemType: "monthly",
        description: `${monthLabel(record.periodKey)} Monthly Fee`,
        amountMinor: remainingAmountFor(record),
        periodKey: record.periodKey,
        monthlyFeeRecordId: record._id,
      })),
    });
    for (const record of selected)
      await ctx.db.patch(record._id, {
        status: "paid",
        paidAmountMinor: record.amountMinor,
        collectionId: result.collectionId,
        paidAt: Date.now(),
      });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "fee.collection_posted",
      entityType: "feeCollection",
      entityId: result.collectionId,
      summary: "Collected selected monthly fees",
      metadata: { amountMinor: result.amountMinor },
    });
    return result;
  },
});

export const collectOther = mutation({
  args: {
    studentId: v.id("students"),
    feeName: v.string(),
    amountMinor: v.number(),
    collectedOn: v.string(),
    note: v.optional(v.string()),
  },
  returns: collectionResultValidator,
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    validateCollectionDate(args.collectedOn);
    assertMinorUnits(args.amountMinor);
    if (args.amountMinor <= 0)
      throw new Error("Amount must be greater than zero");
    const feeName = requiredText(args.feeName, "Fee name", 120);
    const result = await postCollection(ctx, {
      studentId: args.studentId,
      collectionType: "other",
      collectedOn: args.collectedOn,
      note: optionalText(args.note, "Note", 500),
      collectedByAccountId: account._id,
      items: [
        {
          itemType: "other",
          description: feeName,
          amountMinor: args.amountMinor,
        },
      ],
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "fee.collection_posted",
      entityType: "feeCollection",
      entityId: result.collectionId,
      summary: `Collected ${feeName}`,
      metadata: { amountMinor: result.amountMinor },
    });
    return result;
  },
});

export const collectManual = mutation({
  args: {
    studentId: v.id("students"),
    selections: v.array(v.object({ enrolmentId: v.id("enrolments"), periodKey: v.string() })),
    otherFee: v.optional(v.object({ feeName: v.string(), amountMinor: v.number() })),
    collectedOn: v.string(), note: v.optional(v.string()),
  },
  returns: collectionResultValidator,
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx); validateCollectionDate(args.collectedOn);
    const unique = new Map(args.selections.map((selection) => [`${selection.enrolmentId}:${assertPeriodKey(selection.periodKey)}`, selection]));
    if (unique.size > 100) throw new Error("A collection is limited to 100 monthly fee items");
    let otherFee: { feeName: string; amountMinor: number } | undefined;
    if (args.otherFee) { assertMinorUnits(args.otherFee.amountMinor); if (args.otherFee.amountMinor <= 0) throw new Error("Other fee amount must be greater than zero"); otherFee = { feeName: requiredText(args.otherFee.feeName, "Fee name", 120), amountMinor: args.otherFee.amountMinor }; }
    if (unique.size === 0 && !otherFee) throw new Error("Select monthly fees or enter an other fee");
    const today = dhakaDate(); const currentPeriod = periodFromDate(today); const currentYear = currentPeriod.slice(0, 4);
    const records = await ctx.db.query("monthlyFeeRecords").withIndex("by_studentId_and_dueDate", q => q.eq("studentId", args.studentId)).take(500);
    const selected = [];
    for (const selection of unique.values()) {
      const enrolment = await ctx.db.get("enrolments", selection.enrolmentId);
      if (!enrolment || enrolment.studentId !== args.studentId) throw new Error("Enrolment does not belong to this student");
      if (selection.periodKey > currentPeriod && (enrolment.status !== "active" || selection.periodKey.slice(0, 4) !== currentYear)) throw new Error("Future fees are only available for active enrolments in the current year");
      let record = records.find(row => row.enrolmentId === enrolment._id && row.periodKey === selection.periodKey);
      if (!record) {
        const firstBillingMonth = enrolment.firstBillingMonth ?? periodFromDate(enrolment.enrolledOn); const amountMinor = enrolment.agreedMonthlyAmountMinor ?? 0;
        if (amountMinor <= 0) throw new Error("Monthly fee is not configured"); if (selection.periodKey < firstBillingMonth) throw new Error("Month is before the first billing month");
        const id = await ctx.db.insert("monthlyFeeRecords", { studentId: args.studentId, enrolmentId: enrolment._id, courseId: enrolment.courseId, batchId: enrolment.batchId, periodKey: selection.periodKey, dueDate: dueDateForPeriod(selection.periodKey), amountMinor, status: "unpaid", paidAmountMinor: 0, createdAt: Date.now() });
        record = (await ctx.db.get("monthlyFeeRecords", id)) ?? undefined;
      }
      if (!record || remainingAmountFor(record) <= 0) throw new Error(`${monthLabel(selection.periodKey)} is already paid`);
      const course = await ctx.db.get("courses", enrolment.courseId); if (!course) throw new Error("Course not found");
      selected.push({ record, courseName: course.nameEn });
    }
    const result = await postCollection(ctx, { studentId: args.studentId, collectionType: selected.length ? "monthly" : "other", collectedOn: args.collectedOn, note: optionalText(args.note, "Note", 500), collectedByAccountId: account._id, items: [
      ...selected.map(({ record, courseName }) => ({ itemType: "monthly" as const, description: `${courseName} - ${monthLabel(record.periodKey)} Monthly Fee`, amountMinor: remainingAmountFor(record), periodKey: record.periodKey, monthlyFeeRecordId: record._id })),
      ...(otherFee ? [{ itemType: "other" as const, description: otherFee.feeName, amountMinor: otherFee.amountMinor }] : []),
    ] });
    for (const { record } of selected) await ctx.db.patch(record._id, { status: "paid", paidAmountMinor: record.amountMinor, collectionId: result.collectionId, paidAt: Date.now() });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "fee.collection_posted", entityType: "feeCollection", entityId: result.collectionId, summary: "Collected manual student fees", metadata: { amountMinor: result.amountMinor } });
    return result;
  },
});

export const voidCollection = mutation({
  args: { collectionId: v.id("feeCollections"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const reason = requiredText(args.reason, "Void reason", 500);
    const collection = await ctx.db.get("feeCollections", args.collectionId);
    if (!collection || collection.status !== "posted")
      throw new Error("Collection cannot be voided");
    const items = await ctx.db
      .query("feeCollectionItems")
      .withIndex("by_collectionId", (q) => q.eq("collectionId", collection._id))
      .take(50);
    const now = Date.now();
    for (const item of items) {
      if (item.monthlyFeeRecordId) {
        const record = await ctx.db.get(
          "monthlyFeeRecords",
          item.monthlyFeeRecordId,
        );
        if (record) {
          const paidAmountMinor = Math.max(paidAmountFor(record) - item.amountMinor, 0);
          const status = paymentStatus(record.amountMinor, paidAmountMinor);
          await ctx.db.patch(record._id, { status, paidAmountMinor, collectionId: status === "paid" ? record.collectionId : undefined, paidAt: status === "paid" ? record.paidAt : undefined });
        }
      }
      await ctx.db.patch(item._id, { reversedAt: now });
    }
    await ctx.db.patch(collection._id, {
      status: "voided",
      voidedAt: now,
      voidedByAccountId: account._id,
      voidReason: reason,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id,
      actorRole: "owner",
      action: "fee.collection_voided",
      entityType: "feeCollection",
      entityId: collection._id,
      summary: "Voided fee collection",
      metadata: { amountMinor: collection.amountMinor },
    });
    return null;
  },
});

export const listCollections = query({
  args: {
    studentId: v.optional(v.id("students")),
    status: v.optional(v.union(v.literal("posted"), v.literal("voided"))),
    collectionType: v.optional(collectionTypeValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      collectionId: v.id("feeCollections"),
      receiptNumber: v.string(),
      studentId: v.id("students"),
      studentName: v.string(),
      studentNumber: v.string(),
      collectionType: collectionTypeValidator,
      amountMinor: v.number(),
      collectedOn: v.string(),
      status: v.union(v.literal("posted"), v.literal("voided")),
      collectedBy: v.string(),
      itemSummary: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const rows = args.studentId
      ? await ctx.db
          .query("feeCollections")
          .withIndex("by_studentId_and_collectedOn", (q) =>
            q.eq("studentId", args.studentId!),
          )
          .order("desc")
          .take(200)
      : await ctx.db
          .query("feeCollections")
          .withIndex("by_status_and_collectedOn")
          .order("desc")
          .take(200);
    const result = [];
    for (const row of rows) {
      if (
        (args.status && row.status !== args.status) ||
        (args.collectionType && row.collectionType !== args.collectionType)
      )
        continue;
      const [student, account, items] = await Promise.all([
        ctx.db.get("students", row.studentId),
        ctx.db.get("portalAccounts", row.collectedByAccountId),
        ctx.db
          .query("feeCollectionItems")
          .withIndex("by_collectionId", (q) => q.eq("collectionId", row._id))
          .take(24),
      ]);
      if (!student) continue;
      result.push({
        collectionId: row._id,
        receiptNumber: row.receiptNumber,
        studentId: row.studentId,
        studentName: student.displayName,
        studentNumber: student.studentNumber,
        collectionType: row.collectionType,
        amountMinor: row.amountMinor,
        collectedOn: row.collectedOn,
        status: row.status,
        collectedBy: account?.loginEmail ?? "Owner",
        itemSummary: items.map((item) => item.descriptionSnapshot).join(", "),
      });
    }
    return result.slice(0, Math.min(Math.max(args.limit ?? 100, 1), 200));
  },
});

export const getReceipt = query({
  args: { collectionId: v.id("feeCollections") },
  returns: v.union(
    v.null(),
    v.object({
      collectionId: v.id("feeCollections"),
      receiptNumber: v.string(),
      collectionType: collectionTypeValidator,
      amountMinor: v.number(),
      collectedOn: v.string(),
      note: v.union(v.string(), v.null()),
      status: v.union(v.literal("posted"), v.literal("voided")),
      voidReason: v.union(v.string(), v.null()),
      collectedBy: v.string(),
      studentName: v.string(),
      studentNumber: v.string(),
      courseName: v.string(),
      batchName: v.string(),
      coachingName: v.string(),
      address: v.string(),
      phone: v.string(),
      footer: v.string(),
      items: v.array(
        v.object({
          description: v.string(),
          amountMinor: v.number(),
          reversed: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    const collection = await ctx.db.get("feeCollections", args.collectionId);
    if (!collection) return null;
    if (
      account.role === "teacher" ||
      (account.role === "student" && account.studentId !== collection.studentId)
    )
      throw new Error("Unauthorized");
    const [items, settings, collector, student, enrolment] = await Promise.all([
      ctx.db
        .query("feeCollectionItems")
        .withIndex("by_collectionId", (q) =>
          q.eq("collectionId", collection._id),
        )
        .take(24),
      ctx.db.query("coachingSettings").take(1),
      ctx.db.get("portalAccounts", collection.collectedByAccountId),
      ctx.db.get("students", collection.studentId),
      ctx.db
        .query("enrolments")
        .withIndex("by_studentId_and_status", (q) =>
          q.eq("studentId", collection.studentId).eq("status", "active"),
        )
        .first(),
    ]);
    const first = items[0];
    const [course, batch] = enrolment
      ? await Promise.all([
          ctx.db.get("courses", enrolment.courseId),
          ctx.db.get("batches", enrolment.batchId),
        ])
      : [null, null];
    const coaching = settings[0];
    const fallbackDescription =
      collection.collectionType === "admission"
        ? "Admission fee"
        : collection.collectionType === "monthly"
          ? "Monthly fee"
          : "Other fee";
    return {
      collectionId: collection._id,
      receiptNumber: collection.receiptNumber,
      collectionType: collection.collectionType,
      amountMinor: collection.amountMinor,
      collectedOn: collection.collectedOn,
      note: collection.note ?? null,
      status: collection.status,
      voidReason: collection.voidReason ?? null,
      collectedBy: collector?.loginEmail ?? "Owner",
      studentName: first?.studentNameSnapshot ?? student?.displayName ?? "—",
      studentNumber:
        first?.studentNumberSnapshot ?? student?.studentNumber ?? "—",
      courseName: first?.courseNameSnapshot ?? course?.nameEn ?? "—",
      batchName: first?.batchNameSnapshot ?? batch?.nameEn ?? "—",
      coachingName: coaching?.nameEn ?? "Dhrubok",
      address: coaching?.addressEn ?? "Dhaka",
      phone: coaching?.phone ?? "—",
      footer: coaching?.receiptFooterEn ?? "Thank you",
      items: items.length
        ? items.map((item) => ({
            description: item.descriptionSnapshot,
            amountMinor: item.amountMinor,
            reversed: item.reversedAt !== undefined,
          }))
        : [
            {
              description: fallbackDescription,
              amountMinor: collection.amountMinor,
              reversed: collection.status === "voided",
            },
          ],
    };
  },
});

export const myFees = query({
  args: {},
  returns: v.object({
    dueMinor: v.number(),
    dueMonths: v.array(v.string()),
    futurePaidMonths: v.array(v.string()),
    collections: v.array(
      v.object({
        collectionId: v.id("feeCollections"),
        receiptNumber: v.string(),
        collectedOn: v.string(),
        amountMinor: v.number(),
        collectionType: collectionTypeValidator,
        status: v.union(v.literal("posted"), v.literal("voided")),
        summary: v.string(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const { student } = await requireStudent(ctx);
    const today = dhakaDate();
    const currentPeriod = periodFromDate(today);
    const records = await ctx.db
      .query("monthlyFeeRecords")
      .withIndex("by_studentId_and_dueDate", (q) =>
        q.eq("studentId", student._id),
      )
      .take(240);
    const due = records.filter((record) => isDueRecord(record, today));
    const future = records.filter(
      (record) => record.status === "paid" && record.periodKey > currentPeriod,
    );
    const rows = await ctx.db
      .query("feeCollections")
      .withIndex("by_studentId_and_collectedOn", (q) =>
        q.eq("studentId", student._id),
      )
      .order("desc")
      .take(100);
    const collections = [];
    for (const row of rows) {
      const items = await ctx.db
        .query("feeCollectionItems")
        .withIndex("by_collectionId", (q) => q.eq("collectionId", row._id))
        .take(24);
      collections.push({
        collectionId: row._id,
        receiptNumber: row.receiptNumber,
        collectedOn: row.collectedOn,
        amountMinor: row.amountMinor,
        collectionType: row.collectionType,
        status: row.status,
        summary: items.map((item) => item.descriptionSnapshot).join(", "),
      });
    }
    return {
      dueMinor: due.reduce((sum, record) => sum + remainingAmountFor(record), 0),
      dueMonths: due.map((record) => record.periodKey),
      futurePaidMonths: future.map((record) => record.periodKey),
      collections,
    };
  },
});
