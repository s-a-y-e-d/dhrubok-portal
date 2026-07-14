import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { attendanceStatusValidator, paginationResultFields } from "../model/validators";
import { requireAccount, requireOwnerOrAssignedTeacher, requireStudent } from "../model/auth";
import { assertLocalDate } from "../model/dates";
import { writeAudit } from "../model/audit";
import { enqueueSms } from "../messaging/model";

const sessionSummary = v.object({
  sessionId: v.id("classSessions"), batchId: v.id("batches"), teacherId: v.id("teachers"), sessionDate: v.string(),
  startsAt: v.number(), endsAt: v.number(), status: v.union(v.literal("open"), v.literal("submitted"), v.literal("cancelled")),
  rosterCount: v.number(), presentCount: v.union(v.number(), v.null()), lateCount: v.union(v.number(), v.null()), absentCount: v.union(v.number(), v.null()),
});

async function eligibleEnrolments(ctx: Pick<MutationCtx | QueryCtx, "db">, batchId: Id<"batches">, sessionDate: string) {
  const rows = await ctx.db.query("enrolments").withIndex("by_batchId_and_status", (q) => q.eq("batchId", batchId)).take(500);
  return rows.filter((row) => row.enrolledOn <= sessionDate && (!row.endedOn || row.endedOn >= sessionDate));
}

export const createSession = mutation({
  args: { batchId: v.id("batches"), teacherId: v.id("teachers"), subjectId: v.optional(v.id("subjects")), scheduleId: v.optional(v.id("batchSchedules")), sessionDate: v.string(), startsAt: v.number(), endsAt: v.number() },
  returns: v.id("classSessions"),
  handler: async (ctx, args) => {
    assertLocalDate(args.sessionDate);
    if (!Number.isSafeInteger(args.startsAt) || !Number.isSafeInteger(args.endsAt) || args.endsAt <= args.startsAt) throw new Error("Invalid session time");
    const { account } = await requireOwnerOrAssignedTeacher(ctx, args.batchId);
    const batch = await ctx.db.get("batches", args.batchId);
    if (!batch || batch.status !== "active") throw new Error("Batch is not active");
    if (account.role === "teacher" && account.teacherId !== args.teacherId) throw new Error("Unauthorized");
    const teacher = await ctx.db.get("teachers", args.teacherId);
    if (!teacher || teacher.status !== "active") throw new Error("Teacher is not active");
    if (args.scheduleId) {
      const schedule = await ctx.db.get("batchSchedules", args.scheduleId);
      if (!schedule || schedule.status !== "active") throw new Error("Schedule is not active");
      if (schedule.batchId !== args.batchId || schedule.teacherId !== args.teacherId || schedule.subjectId !== args.subjectId) throw new Error("Schedule does not match the session scope");
      if (args.sessionDate < schedule.effectiveFrom || (schedule.effectiveUntil && args.sessionDate > schedule.effectiveUntil)) throw new Error("Schedule is not effective on this date");
      const weekday = new Date(`${args.sessionDate}T12:00:00+06:00`).getUTCDay();
      const dhakaMinutes = (timestamp: number) => {
        const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(timestamp);
        return Number(parts.find((part) => part.type === "hour")?.value ?? -1) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? -1);
      };
      const dhakaDate = (timestamp: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp);
      if (weekday !== schedule.weekday || dhakaDate(args.startsAt) !== args.sessionDate || dhakaDate(args.endsAt) !== args.sessionDate || dhakaMinutes(args.startsAt) !== schedule.startMinutes || dhakaMinutes(args.endsAt) !== schedule.endMinutes) throw new Error("Session date or time does not match the schedule");
    }
    const sessionKey = args.scheduleId ? `schedule:${args.scheduleId}:${args.sessionDate}` : `batch:${args.batchId}:${args.startsAt}`;
    const duplicate = await ctx.db.query("classSessions").withIndex("by_sessionKey", (q) => q.eq("sessionKey", sessionKey)).unique();
    if (duplicate) return duplicate._id;
    const roster = await eligibleEnrolments(ctx, args.batchId, args.sessionDate);
    return await ctx.db.insert("classSessions", { ...args, sessionKey, status: "open", rosterCount: roster.length, createdAt: Date.now() });
  },
});

export const getRoster = query({
  args: { sessionId: v.id("classSessions") },
  returns: v.union(v.object({ session: sessionSummary, students: v.array(v.object({ studentId: v.id("students"), studentNumber: v.string(), displayName: v.string(), status: v.union(attendanceStatusValidator, v.null()) })) }), v.null()),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("classSessions", args.sessionId);
    if (!session) return null;
    await requireOwnerOrAssignedTeacher(ctx, session.batchId);
    const enrolments = await eligibleEnrolments(ctx, session.batchId, session.sessionDate);
    const existing = await ctx.db.query("attendanceRecords").withIndex("by_sessionId", (q) => q.eq("sessionId", session._id)).take(500);
    const statusByStudent = new Map(existing.map((row) => [row.studentId, row.status]));
    const students = [];
    for (const enrolment of enrolments) {
      const student = await ctx.db.get("students", enrolment.studentId);
      if (student) students.push({ studentId: student._id, studentNumber: student.studentNumber, displayName: student.displayName, status: statusByStudent.get(student._id) ?? null });
    }
    students.sort((a, b) => a.studentNumber.localeCompare(b.studentNumber));
    return { session: { sessionId: session._id, batchId: session.batchId, teacherId: session.teacherId, sessionDate: session.sessionDate, startsAt: session.startsAt, endsAt: session.endsAt, status: session.status, rosterCount: session.rosterCount, presentCount: session.presentCount ?? null, lateCount: session.lateCount ?? null, absentCount: session.absentCount ?? null }, students };
  },
});

export const submit = mutation({
  args: { sessionId: v.id("classSessions"), records: v.array(v.object({ studentId: v.id("students"), status: attendanceStatusValidator })) },
  returns: v.object({ presentCount: v.number(), lateCount: v.number(), absentCount: v.number(), smsQueued: v.number() }),
  handler: async (ctx, args) => {
    if (args.records.length > 500) throw new Error("Attendance roster is too large");
    const session = await ctx.db.get("classSessions", args.sessionId);
    if (!session) throw new Error("Session not found");
    const { account } = await requireOwnerOrAssignedTeacher(ctx, session.batchId);
    if (session.status !== "open") throw new Error("Attendance already submitted");
    const enrolments = await eligibleEnrolments(ctx, session.batchId, session.sessionDate);
    const enrolmentByStudent = new Map(enrolments.map((row) => [row.studentId, row]));
    if (args.records.length !== enrolments.length) throw new Error("Every eligible student must be marked exactly once");
    const seen = new Set<string>();
    for (const record of args.records) {
      if (seen.has(record.studentId)) throw new Error("Duplicate student in attendance");
      seen.add(record.studentId);
      if (!enrolmentByStudent.has(record.studentId)) throw new Error("Student is not eligible for this session");
    }
    const now = Date.now();
    let presentCount = 0, lateCount = 0, absentCount = 0, smsQueued = 0;
    const settings = (await ctx.db.query("coachingSettings").take(1))[0];
    const brandBn = settings?.shortNameBn || "ধ্রুবক";
    const brandEn = settings?.shortNameEn || "Dhrubok";
    for (const record of args.records) {
      const enrolment = enrolmentByStudent.get(record.studentId)!;
      await ctx.db.insert("attendanceRecords", { sessionId: session._id, batchId: session.batchId, studentId: record.studentId, enrolmentId: enrolment._id, status: record.status, submittedAt: now, submittedByAccountId: account._id });
      if (record.status === "present") presentCount += 1;
      if (record.status === "late") lateCount += 1;
      if (record.status === "absent") absentCount += 1;
      if (record.status !== "present") {
        const student = await ctx.db.get("students", record.studentId);
        if (student) {
          const isBn = student.preferredSmsLocale === "bn";
          const state = record.status === "late" ? (isBn ? "বিলম্বিত" : "late") : (isBn ? "অনুপস্থিত" : "absent");
          const body = isBn ? `${brandBn}: ${student.displayName} ${session.sessionDate} তারিখের ক্লাসে ${state} ছিল।` : `${brandEn}: ${student.displayName} was ${state} for class on ${session.sessionDate}.`;
          await enqueueSms(ctx, { idempotencyKey: `attendance:${session._id}:${student._id}:${record.status}`, eventType: record.status === "late" ? "attendance_late" : "attendance_absent", relatedEntityType: "classSession", relatedEntityId: session._id, studentId: student._id, guardianPhone: student.guardianPhone, locale: student.preferredSmsLocale, body });
          smsQueued += 1;
        }
      }
    }
    await ctx.db.patch("classSessions", session._id, { status: "submitted", submittedAt: now, submittedByAccountId: account._id, rosterCount: enrolments.length, presentCount, lateCount, absentCount });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: account.role, action: "attendance.submitted", entityType: "classSession", entityId: session._id, summary: "Attendance submitted permanently", metadata: { presentCount, lateCount, absentCount } });
    return { presentCount, lateCount, absentCount, smsQueued };
  },
});

export const listMySessions = query({
  args: { sessionDate: v.string() }, returns: v.array(sessionSummary),
  handler: async (ctx, args) => {
    assertLocalDate(args.sessionDate);
    const account = await requireAccount(ctx);
    const rows = account.role === "teacher"
      ? await ctx.db.query("classSessions").withIndex("by_teacherId_and_sessionDate", (q) => q.eq("teacherId", account.teacherId).eq("sessionDate", args.sessionDate)).take(100)
      : account.role === "owner"
        ? await ctx.db.query("classSessions").withIndex("by_status_and_sessionDate", (q) => q.eq("status", "open").eq("sessionDate", args.sessionDate)).take(100)
        : [];
    if (account.role === "student") throw new Error("Unauthorized");
    return rows.map((session) => ({ sessionId: session._id, batchId: session.batchId, teacherId: session.teacherId, sessionDate: session.sessionDate, startsAt: session.startsAt, endsAt: session.endsAt, status: session.status, rosterCount: session.rosterCount, presentCount: session.presentCount ?? null, lateCount: session.lateCount ?? null, absentCount: session.absentCount ?? null }));
  },
});

export const myHistory = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.object({ recordId: v.id("attendanceRecords"), sessionId: v.id("classSessions"), status: attendanceStatusValidator, submittedAt: v.number() })), ...paginationResultFields }),
  handler: async (ctx, args) => {
    const { student } = await requireStudent(ctx);
    const result = await ctx.db.query("attendanceRecords").withIndex("by_studentId_and_submittedAt", (q) => q.eq("studentId", student._id)).order("desc").paginate(args.paginationOpts);
    return { ...result, page: result.page.map((row) => ({ recordId: row._id, sessionId: row.sessionId, status: row.status, submittedAt: row.submittedAt })) };
  },
});
