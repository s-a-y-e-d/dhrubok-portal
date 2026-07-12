import { query } from "../_generated/server";
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { requireOwner, requireStudent, requireTeacher } from "../model/auth";
import { assertLocalDate } from "../model/dates";
import { DASHBOARD_ROW_LIMIT, localized } from "./shared";

const countValidator = v.object({ value: v.number(), capped: v.boolean() });
const boundedCount = (length: number) => ({ value: Math.min(length, DASHBOARD_ROW_LIMIT), capped: length > DASHBOARD_ROW_LIMIT });

export const owner = query({
  args: { date: v.string() },
  returns: v.object({
    date: v.string(), summaryUpdatedAt: v.union(v.number(), v.null()), activeStudents: v.number(), activeBatches: v.number(),
    todayCollectionsMinor: v.number(), monthCollectionsMinor: v.number(), monthSummaryDays: v.number(), overdueMinor: v.number(), overdueStudents: v.number(),
    todaySessions: v.number(), attendancePending: v.number(), resultsAwaitingReview: countValidator, smsFailures: countValidator,
    providerBalanceMinor: v.union(v.number(), v.null()), providerStatus: v.union(v.string(), v.null()), newApplications: countValidator,
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    assertLocalDate(args.date);
    const monthStart = `${args.date.slice(0, 7)}-01`;
    const [summary, month, activeStudents, activeBatches, reviewResults, smsFailures, providerRows, applications] = await Promise.all([
      ctx.db.query("dailyOperationalSummaries").withIndex("by_date", (q) => q.eq("date", args.date)).unique(),
      ctx.db.query("dailyOperationalSummaries").withIndex("by_date", (q) => q.gte("date", monthStart).lte("date", args.date)).take(31),
      ctx.db.query("students").withIndex("by_status_and_admissionDate", (q) => q.eq("status", "active")).take(DASHBOARD_ROW_LIMIT),
      ctx.db.query("batches").withIndex("by_status", (q) => q.eq("status", "active")).take(DASHBOARD_ROW_LIMIT),
      ctx.db.query("exams").withIndex("by_status_and_examDate", (q) => q.eq("status", "ready_for_review")).take(DASHBOARD_ROW_LIMIT + 1),
      ctx.db.query("smsMessages").withIndex("by_status_and_nextAttemptAt", (q) => q.eq("status", "failed")).take(DASHBOARD_ROW_LIMIT + 1),
      ctx.db.query("smsProviderSnapshots").withIndex("by_checkedAt").order("desc").take(1),
      ctx.db.query("admissionApplications").withIndex("by_status_and_submittedAt", (q) => q.eq("status", "new")).take(DASHBOARD_ROW_LIMIT + 1),
    ]);
    const provider = providerRows[0];
    return {
      date: args.date,
      summaryUpdatedAt: summary?.updatedAt ?? null,
      activeStudents: activeStudents.length,
      activeBatches: activeBatches.length,
      todayCollectionsMinor: summary?.collectedMinor ?? 0,
      monthCollectionsMinor: month.reduce((sum, row) => sum + row.collectedMinor, 0),
      monthSummaryDays: month.length,
      overdueMinor: summary?.overdueMinor ?? 0,
      overdueStudents: summary?.overdueStudentsCount ?? 0,
      todaySessions: summary?.scheduledSessionCount ?? 0,
      attendancePending: summary ? Math.max(0, summary.scheduledSessionCount - summary.submittedSessionCount) : 0,
      resultsAwaitingReview: boundedCount(reviewResults.length),
      smsFailures: boundedCount(smsFailures.length),
      providerBalanceMinor: provider?.balanceMinor ?? null,
      providerStatus: provider?.providerStatus ?? null,
      newApplications: boundedCount(applications.length),
    };
  },
});

const sessionCardValidator = v.object({ sessionId: v.id("classSessions"), batchId: v.id("batches"), batchName: v.string(), startsAt: v.number(), endsAt: v.number(), status: v.string() });
const examCardValidator = v.object({ examId: v.id("exams"), examName: v.string(), status: v.string(), enteredCount: v.number(), totalCandidates: v.number() });
const contentCardValidator = v.object({ id: v.string(), kind: v.union(v.literal("material"), v.literal("notice")), title: v.string(), publishedAt: v.number() });

export const teacher = query({
  args: { date: v.string() },
  returns: v.object({ assignedBatchCount: v.number(), todaySessions: v.array(sessionCardValidator), attendancePending: v.number(), assignedExams: v.array(examCardValidator), recentContent: v.array(contentCardValidator) }),
  handler: async (ctx, args) => {
    const { account, teacher: teacherDoc } = await requireTeacher(ctx);
    assertLocalDate(args.date);
    const [assignments, sessions, examAssignments, materials, noticeCandidates] = await Promise.all([
      ctx.db.query("teacherBatchAssignments").withIndex("by_teacherId_and_status", (q) => q.eq("teacherId", teacherDoc._id).eq("status", "active")).take(100),
      ctx.db.query("classSessions").withIndex("by_teacherId_and_sessionDate", (q) => q.eq("teacherId", teacherDoc._id).eq("sessionDate", args.date)).take(100),
      ctx.db.query("examTeacherAssignments").withIndex("by_teacherId", (q) => q.eq("teacherId", teacherDoc._id)).take(50),
      ctx.db.query("materials").withIndex("by_createdByAccountId_and_status", (q) => q.eq("createdByAccountId", account._id).eq("status", "published")).order("desc").take(10),
      ctx.db.query("notices").withIndex("by_createdByAccountId_and_status", (q) => q.eq("createdByAccountId", account._id).eq("status", "published")).order("desc").take(10),
    ]);
    const todaySessions = await Promise.all(sessions.map(async (session) => {
      const batch = await ctx.db.get("batches", session.batchId);
      return { sessionId: session._id, batchId: session.batchId, batchName: localized(account.locale, batch?.nameBn, batch?.nameEn), startsAt: session.startsAt, endsAt: session.endsAt, status: session.status };
    }));
    const assignedExams = [];
    for (const assignment of examAssignments.slice(0, 20)) {
      const exam = await ctx.db.get("exams", assignment.examId);
      if (!exam || exam.status === "archived") continue;
      const examCandidates = await ctx.db.query("examResults").withIndex("by_examId_and_entryStatus", (q) => q.eq("examId", exam._id)).take(DASHBOARD_ROW_LIMIT);
      const candidates = assignment.batchId ? (await Promise.all(examCandidates.map(async (result) => ({ result, enrolment: await ctx.db.get("enrolments", result.enrolmentId) })))).filter(({ enrolment }) => enrolment?.batchId === assignment.batchId).map(({ result }) => result) : examCandidates;
      assignedExams.push({
        examId: exam._id,
        examName: localized(account.locale, exam.nameBn, exam.nameEn),
        status: exam.status,
        enteredCount: candidates.filter((result) => result.entryStatus !== "missing").length,
        totalCandidates: candidates.length,
      });
    }
    const noticeCards = noticeCandidates
      .filter((notice) => notice.publishedAt != null)
      .slice(0, 10)
      .map((notice) => ({ id: notice._id as string, kind: "notice" as const, title: localized(account.locale, notice.titleBn, notice.titleEn), publishedAt: notice.publishedAt! }));
    const content = [
      ...materials.filter((material) => material.publishedAt != null).map((material) => ({ id: material._id as string, kind: "material" as const, title: localized(account.locale, material.titleBn, material.titleEn), publishedAt: material.publishedAt! })),
      ...noticeCards,
    ].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 10);
    return {
      assignedBatchCount: new Set(assignments.map((assignment) => assignment.batchId)).size,
      todaySessions,
      attendancePending: sessions.filter((session) => session.status === "open").length,
      assignedExams,
      recentContent: content,
    };
  },
});

function addLocalDays(date: string, days: number) {
  const timestamp = Date.parse(`${date}T12:00:00+06:00`) + days * 86_400_000;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp);
}

const nextClassValidator = v.union(v.object({ batchId: v.id("batches"), batchName: v.string(), subjectName: v.string(), date: v.string(), weekday: v.number(), startMinutes: v.number(), endMinutes: v.number(), room: v.string() }), v.null());

export const student = query({
  args: {},
  returns: v.object({
    nextClass: nextClassValidator, attendancePercentage: v.union(v.number(), v.null()), attendanceSampleCapped: v.boolean(), latestAttendance: v.union(v.object({ status: v.string(), submittedAt: v.number() }), v.null()),
    outstandingMinor: v.number(), overdueMinor: v.number(), advanceCreditMinor: v.number(), latestResult: v.union(v.object({ examId: v.id("exams"), examName: v.string(), totalScoreScaled: v.union(v.number(), v.null()), passed: v.union(v.boolean(), v.null()), meritPosition: v.union(v.number(), v.null()), publishedAt: v.number() }), v.null()),
    unreadNotices: v.number(), unreadNoticesCapped: v.boolean(), recentMaterials: v.array(v.object({ materialId: v.id("materials"), title: v.string(), publishedAt: v.number() })),
  }),
  handler: async (ctx) => {
    const { account, student: studentDoc } = await requireStudent(ctx);
    const [enrolments, attendance, financial, resultRows, recipientRows] = await Promise.all([
      ctx.db.query("enrolments").withIndex("by_studentId_and_status", (q) => q.eq("studentId", studentDoc._id).eq("status", "active")).take(50),
      ctx.db.query("attendanceRecords").withIndex("by_studentId_and_submittedAt", (q) => q.eq("studentId", studentDoc._id)).order("desc").take(DASHBOARD_ROW_LIMIT + 1),
      ctx.db.query("studentFinancialSummaries").withIndex("by_studentId", (q) => q.eq("studentId", studentDoc._id)).unique(),
      ctx.db.query("examResults").withIndex("by_studentId_and_publishedAt", (q) => q.eq("studentId", studentDoc._id)).order("desc").take(1),
      ctx.db.query("noticeRecipients").withIndex("by_studentId_and_readAt", (q) => q.eq("studentId", studentDoc._id)).take(101),
    ]);
    const batchIds = new Set(enrolments.map((enrolment) => enrolment.batchId));
    const schedules: Array<{ schedule: Doc<"batchSchedules">; batch: Doc<"batches">; subject: Doc<"subjects"> | null }> = [];
    for (const batchId of batchIds) {
      const [batch, rows] = await Promise.all([
        ctx.db.get("batches", batchId),
        ctx.db.query("batchSchedules").withIndex("by_batchId_and_status", (q) => q.eq("batchId", batchId).eq("status", "active")).take(50),
      ]);
      if (!batch) continue;
      for (const schedule of rows) schedules.push({ schedule, batch, subject: schedule.subjectId ? await ctx.db.get("subjects", schedule.subjectId) : null });
    }
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const timeParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const nowMinutes = Number(timeParts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(timeParts.find((part) => part.type === "minute")?.value ?? 0);
    const candidates = schedules.flatMap((row) => {
      for (let offset = 0; offset < 7; offset += 1) {
        const date = addLocalDays(today, offset);
        const weekday = new Date(`${date}T12:00:00+06:00`).getUTCDay();
        if (weekday !== row.schedule.weekday || date < row.schedule.effectiveFrom || (row.schedule.effectiveUntil != null && date > row.schedule.effectiveUntil)) continue;
        if (offset === 0 && row.schedule.startMinutes <= nowMinutes) continue;
        return [{ ...row, date, offset }];
      }
      return [];
    }).sort((a, b) => a.offset - b.offset || a.schedule.startMinutes - b.schedule.startMinutes);
    const next = candidates[0];
    const usedAttendance = attendance.slice(0, DASHBOARD_ROW_LIMIT);
    const attended = usedAttendance.filter((record) => record.status !== "absent").length;
    const latestResult = resultRows[0];
    const exam = latestResult ? await ctx.db.get("exams", latestResult.examId) : null;
    const materialMap = new Map<string, Doc<"materials">>();
    for (const enrolment of enrolments) {
      const [courseMaterials, batchMaterials] = await Promise.all([
        ctx.db.query("materials").withIndex("by_courseId_and_status", (q) => q.eq("courseId", enrolment.courseId).eq("status", "published")).order("desc").take(20),
        ctx.db.query("materials").withIndex("by_batchId_and_status", (q) => q.eq("batchId", enrolment.batchId).eq("status", "published")).order("desc").take(20),
      ]);
      for (const material of courseMaterials.filter((row) => row.visibility === "course")) materialMap.set(material._id, material);
      for (const material of batchMaterials) materialMap.set(material._id, material);
    }
    const recentMaterials = [...materialMap.values()].filter((material) => material.publishedAt != null).sort((a, b) => b.publishedAt! - a.publishedAt!).slice(0, 10)
      .map((material) => ({ materialId: material._id, title: localized(account.locale, material.titleBn, material.titleEn), publishedAt: material.publishedAt! }));
    const unread = [];
    for (const recipient of recipientRows.slice(0, 100)) {
      if (recipient.readAt != null) continue;
      const notice = await ctx.db.get("notices", recipient.noticeId);
      if (notice?.status === "published") unread.push(recipient);
    }
    return {
      nextClass: next ? { batchId: next.batch._id, batchName: localized(account.locale, next.batch.nameBn, next.batch.nameEn), subjectName: localized(account.locale, next.subject?.nameBn, next.subject?.nameEn), date: next.date, weekday: next.schedule.weekday, startMinutes: next.schedule.startMinutes, endMinutes: next.schedule.endMinutes, room: localized(account.locale, next.schedule.roomBn ?? next.batch.roomBn, next.schedule.roomEn ?? next.batch.roomEn) } : null,
      attendancePercentage: usedAttendance.length ? Math.round((attended / usedAttendance.length) * 10_000) / 100 : null,
      attendanceSampleCapped: attendance.length > DASHBOARD_ROW_LIMIT,
      latestAttendance: usedAttendance[0] ? { status: usedAttendance[0].status, submittedAt: usedAttendance[0].submittedAt } : null,
      outstandingMinor: financial?.outstandingMinor ?? 0,
      overdueMinor: financial?.overdueMinor ?? 0,
      advanceCreditMinor: financial?.advanceCreditMinor ?? 0,
      latestResult: latestResult?.publishedAt != null && exam ? { examId: exam._id, examName: localized(account.locale, exam.nameBn, exam.nameEn), totalScoreScaled: latestResult.totalScoreScaled ?? null, passed: latestResult.passed ?? null, meritPosition: latestResult.meritPosition ?? null, publishedAt: latestResult.publishedAt } : null,
      unreadNotices: unread.length,
      unreadNoticesCapped: recipientRows.length > 100,
      recentMaterials,
    };
  },
});
