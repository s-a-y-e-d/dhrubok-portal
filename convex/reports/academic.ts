import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { attendanceStatusValidator } from "../model/validators";
import { assertDateRange, localized, requireOwnerOrAssignedTeacherForBatch, requireOwnerOrStudent } from "./shared";

const pageFields = {
  isDone: v.boolean(),
  continueCursor: v.string(),
  splitCursor: v.optional(v.union(v.string(), v.null())),
  pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
};

export const batchHeader = query({
  args: { batchId: v.id("batches") },
  returns: v.object({ batchId: v.id("batches"), batchNameBn: v.string(), batchNameEn: v.string(), courseNameBn: v.string(), courseNameEn: v.string() }),
  handler: async (ctx, args) => {
    await requireOwnerOrAssignedTeacherForBatch(ctx, args.batchId);
    const batch = await ctx.db.get("batches", args.batchId);
    if (!batch) throw new Error("Batch not found");
    const course = await ctx.db.get("courses", batch.courseId);
    return { batchId: batch._id, batchNameBn: batch.nameBn, batchNameEn: batch.nameEn, courseNameBn: course?.nameBn ?? "", courseNameEn: course?.nameEn ?? "" };
  },
});

export const batchRoster = query({
  args: { batchId: v.id("batches"), status: v.union(v.literal("active"), v.literal("completed"), v.literal("withdrawn"), v.literal("transferred")), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.object({ enrolmentId: v.id("enrolments"), studentId: v.id("students"), studentNumber: v.string(), displayName: v.string(), enrolledOn: v.string(), status: v.string() })), ...pageFields }),
  handler: async (ctx, args) => {
    await requireOwnerOrAssignedTeacherForBatch(ctx, args.batchId);
    const page = await ctx.db.query("enrolments").withIndex("by_batchId_and_status", (q) => q.eq("batchId", args.batchId).eq("status", args.status)).paginate(args.paginationOpts);
    return { ...page, page: await Promise.all(page.page.map(async (enrolment) => {
      const student = await ctx.db.get("students", enrolment.studentId);
      return { enrolmentId: enrolment._id, studentId: enrolment.studentId, studentNumber: student?.studentNumber ?? "", displayName: student?.displayName ?? "", enrolledOn: enrolment.enrolledOn, status: enrolment.status };
    })) };
  },
});

export const batchAttendance = query({
  args: { batchId: v.id("batches"), fromAt: v.number(), toAt: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.object({ attendanceId: v.id("attendanceRecords"), sessionId: v.id("classSessions"), sessionDate: v.string(), studentId: v.id("students"), studentNumber: v.string(), studentName: v.string(), status: attendanceStatusValidator, submittedAt: v.number() })), ...pageFields }),
  handler: async (ctx, args) => {
    await requireOwnerOrAssignedTeacherForBatch(ctx, args.batchId);
    if (args.fromAt >= args.toAt) throw new Error("Invalid attendance range");
    const page = await ctx.db.query("attendanceRecords").withIndex("by_batchId_and_submittedAt", (q) => q.eq("batchId", args.batchId).gte("submittedAt", args.fromAt).lt("submittedAt", args.toAt)).order("desc").paginate(args.paginationOpts);
    return { ...page, page: await Promise.all(page.page.map(async (record) => {
      const [student, session] = await Promise.all([ctx.db.get("students", record.studentId), ctx.db.get("classSessions", record.sessionId)]);
      return { attendanceId: record._id, sessionId: record.sessionId, sessionDate: session?.sessionDate ?? "", studentId: record.studentId, studentNumber: student?.studentNumber ?? "", studentName: student?.displayName ?? "", status: record.status, submittedAt: record.submittedAt };
    })) };
  },
});

export const dailyAttendance = query({
  args: { date: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.object({ sessionId: v.id("classSessions"), batchId: v.id("batches"), batchName: v.string(), teacherName: v.string(), rosterCount: v.number(), presentCount: v.number(), lateCount: v.number(), absentCount: v.number(), status: v.string() })), ...pageFields }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    assertDateRange(args.date, args.date);
    const page = await ctx.db.query("classSessions").withIndex("by_status_and_sessionDate", (q) => q.eq("status", "submitted").eq("sessionDate", args.date)).paginate(args.paginationOpts);
    return { ...page, page: await Promise.all(page.page.map(async (session) => {
      const [batch, teacher] = await Promise.all([ctx.db.get("batches", session.batchId), ctx.db.get("teachers", session.teacherId)]);
      return { sessionId: session._id, batchId: session.batchId, batchName: localized(account.locale, batch?.nameBn, batch?.nameEn), teacherName: teacher?.displayName ?? "", rosterCount: session.rosterCount, presentCount: session.presentCount ?? 0, lateCount: session.lateCount ?? 0, absentCount: session.absentCount ?? 0, status: session.status };
    })) };
  },
});

export const studentAttendance = query({
  args: { studentId: v.id("students"), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.object({ attendanceId: v.id("attendanceRecords"), batchId: v.id("batches"), batchName: v.string(), sessionDate: v.string(), status: attendanceStatusValidator, submittedAt: v.number() })), ...pageFields }),
  handler: async (ctx, args) => {
    const account = await requireOwnerOrStudent(ctx, args.studentId);
    const page = await ctx.db.query("attendanceRecords").withIndex("by_studentId_and_submittedAt", (q) => q.eq("studentId", args.studentId)).order("desc").paginate(args.paginationOpts);
    return { ...page, page: await Promise.all(page.page.map(async (record) => {
      const [batch, session] = await Promise.all([ctx.db.get("batches", record.batchId), ctx.db.get("classSessions", record.sessionId)]);
      return { attendanceId: record._id, batchId: record.batchId, batchName: localized(account.locale, batch?.nameBn, batch?.nameEn), sessionDate: session?.sessionDate ?? "", status: record.status, submittedAt: record.submittedAt };
    })) };
  },
});

export const lateAbsentHistory = query({
  args: { studentId: v.id("students"), status: v.union(v.literal("late"), v.literal("absent")), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.object({ attendanceId: v.id("attendanceRecords"), batchId: v.id("batches"), batchName: v.string(), sessionDate: v.string(), status: attendanceStatusValidator, submittedAt: v.number() })), ...pageFields }),
  handler: async (ctx, args) => {
    const account = await requireOwnerOrStudent(ctx, args.studentId);
    const page = await ctx.db.query("attendanceRecords").withIndex("by_studentId_and_status", (q) => q.eq("studentId", args.studentId).eq("status", args.status)).order("desc").paginate(args.paginationOpts);
    return { ...page, page: await Promise.all(page.page.map(async (record) => {
      const [batch, session] = await Promise.all([ctx.db.get("batches", record.batchId), ctx.db.get("classSessions", record.sessionId)]);
      return { attendanceId: record._id, batchId: record.batchId, batchName: localized(account.locale, batch?.nameBn, batch?.nameEn), sessionDate: session?.sessionDate ?? "", status: record.status, submittedAt: record.submittedAt };
    })) };
  },
});
