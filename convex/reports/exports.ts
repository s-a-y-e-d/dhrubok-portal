import { v } from "convex/values";

import { query } from "../_generated/server";
import { requireAccount, requireOwner, requireTeacherExamAssignment } from "../model/auth";
import { attendanceStatusValidator } from "../model/validators";
import { boundedResult, createCsv, localeArg, localized, REPORT_ROW_LIMIT, requireOwnerOrAssignedTeacherForBatch, requireOwnerOrStudent } from "./shared";

const exportPayload = v.object({ filename: v.string(), contentType: v.literal("text/csv;charset=utf-8"), content: v.string(), rowCount: v.number(), truncated: v.boolean() });

export const collectionsCsv = query({
  args: { fromAt: v.number(), toAt: v.number(), locale: localeArg },
  returns: exportPayload,
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.fromAt >= args.toAt) throw new Error("Invalid collection range");
    const source = await ctx.db.query("payments").withIndex("by_status_and_paidAt", (q) => q.eq("status", "posted").gte("paidAt", args.fromAt).lt("paidAt", args.toAt)).take(REPORT_ROW_LIMIT + 1);
    const { rows, truncated } = boundedResult(source);
    const header = args.locale === "bn" ? ["রসিদ", "শিক্ষার্থী নম্বর", "শিক্ষার্থীর নাম", "পরিমাণ (পয়সা)", "পদ্ধতি", "পরিশোধের সময়"] : ["Receipt", "Student number", "Student name", "Amount (minor)", "Method", "Paid at"];
    const body = [];
    for (const payment of rows) {
      const student = await ctx.db.get("students", payment.studentId);
      body.push([payment.receiptNumber, student?.studentNumber ?? "", student?.displayName ?? "", payment.amountMinor, payment.method, new Date(payment.paidAt).toISOString()]);
    }
    return { filename: `collections-${args.fromAt}-${args.toAt}-${args.locale}.csv`, contentType: "text/csv;charset=utf-8" as const, content: createCsv([header, ...body]), rowCount: rows.length, truncated };
  },
});

export const duesCsv = query({
  args: { locale: localeArg },
  returns: exportPayload,
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const source = await ctx.db.query("studentFinancialSummaries").withIndex("by_outstandingMinor", (q) => q.gt("outstandingMinor", 0)).order("desc").take(REPORT_ROW_LIMIT + 1);
    const { rows, truncated } = boundedResult(source);
    const header = args.locale === "bn" ? ["শিক্ষার্থী নম্বর", "শিক্ষার্থীর নাম", "অভিভাবকের ফোন", "বকেয়া", "সময়োত্তীর্ণ", "অগ্রিম"] : ["Student number", "Student name", "Guardian phone", "Outstanding", "Overdue", "Advance"];
    const body = [];
    for (const summary of rows) {
      const student = await ctx.db.get("students", summary.studentId);
      body.push([student?.studentNumber ?? "", student?.displayName ?? "", student?.guardianPhone ?? "", summary.outstandingMinor, summary.overdueMinor, summary.advanceCreditMinor]);
    }
    return { filename: `dues-${args.locale}.csv`, contentType: "text/csv;charset=utf-8" as const, content: createCsv([header, ...body]), rowCount: rows.length, truncated };
  },
});

export const attendanceCsv = query({
  args: { batchId: v.id("batches"), fromAt: v.number(), toAt: v.number(), status: v.optional(attendanceStatusValidator), locale: localeArg },
  returns: exportPayload,
  handler: async (ctx, args) => {
    await requireOwnerOrAssignedTeacherForBatch(ctx, args.batchId);
    if (args.fromAt >= args.toAt) throw new Error("Invalid attendance range");
    const source = await ctx.db.query("attendanceRecords").withIndex("by_batchId_and_submittedAt", (q) => q.eq("batchId", args.batchId).gte("submittedAt", args.fromAt).lt("submittedAt", args.toAt)).take(REPORT_ROW_LIMIT + 1);
    const statusRows = args.status ? source.filter((record) => record.status === args.status) : source;
    const truncated = source.length > REPORT_ROW_LIMIT;
    const rows = statusRows.slice(0, REPORT_ROW_LIMIT);
    const header = args.locale === "bn" ? ["তারিখ", "শিক্ষার্থী নম্বর", "শিক্ষার্থীর নাম", "অবস্থা"] : ["Date", "Student number", "Student name", "Status"];
    const body = [];
    for (const record of rows) {
      const [student, session] = await Promise.all([ctx.db.get("students", record.studentId), ctx.db.get("classSessions", record.sessionId)]);
      body.push([session?.sessionDate ?? "", student?.studentNumber ?? "", student?.displayName ?? "", record.status]);
    }
    return { filename: `attendance-${args.batchId}-${args.locale}.csv`, contentType: "text/csv;charset=utf-8" as const, content: createCsv([header, ...body]), rowCount: rows.length, truncated };
  },
});

export const examResultsCsv = query({
  args: { examId: v.id("exams"), locale: localeArg },
  returns: exportPayload,
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    let assignedBatchId = null;
    if (account.role === "owner") await requireOwner(ctx);
    else if (account.role === "teacher") assignedBatchId = (await requireTeacherExamAssignment(ctx, args.examId)).assignment.batchId ?? null;
    else throw new Error("Unauthorized");
    const source = await ctx.db.query("examResults").withIndex("by_examId_and_entryStatus_and_totalScoreScaled", (q) => q.eq("examId", args.examId).eq("entryStatus", "published")).order("desc").take(REPORT_ROW_LIMIT + 1);
    const scoped = assignedBatchId == null ? source : (await Promise.all(source.map(async (result) => ({ result, enrolment: await ctx.db.get("enrolments", result.enrolmentId) })))).filter(({ enrolment }) => enrolment?.batchId === assignedBatchId).map(({ result }) => result);
    const { rows, truncated } = boundedResult(scoped);
    const header = args.locale === "bn" ? ["মেধাক্রম", "শিক্ষার্থী নম্বর", "শিক্ষার্থীর নাম", "মোট নম্বর (স্কেল)", "ফলাফল"] : ["Merit", "Student number", "Student name", "Total score (scaled)", "Result"];
    const body = [];
    for (const result of rows) {
      const student = await ctx.db.get("students", result.studentId);
      body.push([result.meritPosition ?? "", student?.studentNumber ?? "", student?.displayName ?? "", result.totalScoreScaled ?? "", result.passed == null ? "" : result.passed ? (args.locale === "bn" ? "উত্তীর্ণ" : "Pass") : (args.locale === "bn" ? "অনুত্তীর্ণ" : "Fail")]);
    }
    return { filename: `exam-results-${args.examId}-${args.locale}.csv`, contentType: "text/csv;charset=utf-8" as const, content: createCsv([header, ...body]), rowCount: rows.length, truncated };
  },
});

export const studentStatementCsv = query({
  args: { studentId: v.id("students"), locale: localeArg },
  returns: exportPayload,
  handler: async (ctx, args) => {
    await requireOwnerOrStudent(ctx, args.studentId);
    const student = await ctx.db.get("students", args.studentId);
    if (!student) throw new Error("Student not found");
    const source = await ctx.db.query("studentCharges").withIndex("by_studentId_and_dueDate", (q) => q.eq("studentId", args.studentId)).order("desc").take(REPORT_ROW_LIMIT + 1);
    const { rows, truncated } = boundedResult(source);
    const header = args.locale === "bn" ? ["চার্জ নম্বর", "বিবরণ", "নিট পরিমাণ", "পরিশোধিত", "নির্ধারিত তারিখ", "অবস্থা"] : ["Charge number", "Description", "Net amount", "Paid", "Due date", "Status"];
    const body = rows.map((charge) => [charge.chargeNumber, localized(args.locale, charge.descriptionBn, charge.descriptionEn), charge.netAmountMinor, charge.paidAmountMinor, charge.dueDate, charge.status]);
    return { filename: `statement-${student.studentNumber}-${args.locale}.csv`, contentType: "text/csv;charset=utf-8" as const, content: createCsv([header, ...body]), rowCount: rows.length, truncated };
  },
});
