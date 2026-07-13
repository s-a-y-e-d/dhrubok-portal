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
    activeOutstandingMinor: v.number(), todayPaymentsCount: v.number(),
    recentPayments: v.array(
      v.object({
        paymentId: v.id("payments"),
        paymentNumber: v.string(),
        studentName: v.string(),
        studentNumber: v.string(),
        amountMinor: v.number(),
        paidAt: v.number(),
      })
    ),
    todaySessionsDetail: v.array(
      v.object({
        sessionId: v.id("classSessions"),
        batchId: v.id("batches"),
        batchName: v.string(),
        teacherName: v.string(),
        subjectName: v.string(),
        startsAt: v.number(),
        endsAt: v.number(),
        status: v.string(),
        rosterCount: v.number(),
        presentCount: v.number(),
        lateCount: v.number(),
        absentCount: v.number(),
      })
    ),
    recentActivities: v.array(
      v.object({
        logId: v.id("auditLogs"),
        actorName: v.string(),
        actorRole: v.string(),
        action: v.string(),
        summary: v.string(),
        occurredAt: v.number(),
        metadata: v.any(),
      })
    ),
    unlinkedTeachersCount: v.number(),
    batchesWithoutTeacherCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
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

    const recentPayments = await ctx.db
      .query("payments")
      .withIndex("by_status_and_paidAt", (q) => q.eq("status", "posted"))
      .order("desc")
      .take(5);
    const recentPaymentsDetails = [];
    for (const payment of recentPayments) {
      const student = await ctx.db.get("students", payment.studentId);
      recentPaymentsDetails.push({
        paymentId: payment._id,
        paymentNumber: payment.paymentNumber,
        studentName: student?.displayName ?? "Unknown",
        studentNumber: student?.studentNumber ?? "Unknown",
        amountMinor: payment.amountMinor,
        paidAt: payment.paidAt,
      });
    }

    const [openSessions, submittedSessions] = await Promise.all([
      ctx.db.query("classSessions").withIndex("by_status_and_sessionDate", (q) => q.eq("status", "open").eq("sessionDate", args.date)).take(100),
      ctx.db.query("classSessions").withIndex("by_status_and_sessionDate", (q) => q.eq("status", "submitted").eq("sessionDate", args.date)).take(100),
    ]);
    const sessions = [...openSessions, ...submittedSessions].sort((a, b) => a.startsAt - b.startsAt);
    const todaySessionsDetail = [];
    for (const session of sessions) {
      const [batch, teacher, subject] = await Promise.all([
        ctx.db.get("batches", session.batchId),
        ctx.db.get("teachers", session.teacherId),
        session.subjectId ? ctx.db.get("subjects", session.subjectId) : null,
      ]);
      todaySessionsDetail.push({
        sessionId: session._id,
        batchId: session.batchId,
        batchName: batch ? localized(account.locale, batch.nameBn, batch.nameEn) : "—",
        teacherName: teacher?.displayName ?? "—",
        subjectName: subject ? localized(account.locale, subject.nameBn, subject.nameEn) : "—",
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        status: session.status,
        rosterCount: session.rosterCount,
        presentCount: session.presentCount ?? 0,
        lateCount: session.lateCount ?? 0,
        absentCount: session.absentCount ?? 0,
      });
    }

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_occurredAt")
      .order("desc")
      .take(20);
    const recentActivities = [];
    for (const log of logs) {
      let actorName = "System";
      if (log.actorAccountId) {
        const act = await ctx.db.get("portalAccounts", log.actorAccountId);
        if (act) {
          if (act.role === "owner") {
            const profile = await ctx.db.get("ownerProfiles", act.ownerProfileId);
            actorName = profile?.displayName ?? "Owner";
          } else if (act.role === "teacher") {
            const teacherDoc = await ctx.db.get("teachers", act.teacherId);
            actorName = teacherDoc?.displayName ?? "Teacher";
          } else if (act.role === "student") {
            const studentDoc = await ctx.db.get("students", act.studentId);
            actorName = studentDoc?.displayName ?? "Student";
          }
        }
      }
      recentActivities.push({
        logId: log._id,
        actorName,
        actorRole: log.actorRole ?? "system",
        action: log.action,
        summary: log.summary,
        occurredAt: log.occurredAt,
        metadata: log.metadata ?? {},
      });
    }

    const activeTeachers = await ctx.db.query("teachers").withIndex("by_status", (q) => q.eq("status", "active")).take(100);
    let unlinkedTeachersCount = 0;
    for (const teacher of activeTeachers) {
      const act = await ctx.db.query("portalAccounts").withIndex("by_teacherId", (q) => q.eq("teacherId", teacher._id)).unique();
      if (!act) {
        unlinkedTeachersCount++;
      }
    }

    const activeBatchesList = await ctx.db.query("batches").withIndex("by_status", (q) => q.eq("status", "active")).take(100);
    let batchesWithoutTeacherCount = 0;
    for (const batch of activeBatchesList) {
      const assignments = await ctx.db.query("teacherBatchAssignments").withIndex("by_batchId_and_status", (q) => q.eq("batchId", batch._id).eq("status", "active")).take(1);
      if (assignments.length === 0) {
        batchesWithoutTeacherCount++;
      }
    }

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
      activeOutstandingMinor: summary?.activeOutstandingMinor ?? 0,
      todayPaymentsCount: summary?.paymentsCount ?? 0,
      recentPayments: recentPaymentsDetails,
      todaySessionsDetail,
      recentActivities,
      unlinkedTeachersCount,
      batchesWithoutTeacherCount,
    };
  },
});

const sessionCardValidator = v.object({
  sessionId: v.id("classSessions"),
  batchId: v.id("batches"),
  batchName: v.string(),
  startsAt: v.number(),
  endsAt: v.number(),
  status: v.string(),
  subjectName: v.string(),
  room: v.string(),
  rosterCount: v.number(),
});

const examCardValidator = v.object({
  examId: v.id("exams"),
  examName: v.string(),
  status: v.string(),
  completedCount: v.number(),
  totalCandidates: v.number(),
  batchName: v.union(v.string(), v.null()),
  subjectName: v.union(v.string(), v.null()),
  examDate: v.string(),
  mode: v.string(),
});

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
      const subject = session.subjectId ? await ctx.db.get("subjects", session.subjectId) : null;
      return {
        sessionId: session._id,
        batchId: session.batchId,
        batchName: localized(account.locale, batch?.nameBn, batch?.nameEn),
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        status: session.status,
        subjectName: subject ? localized(account.locale, subject.nameBn, subject.nameEn) : "—",
        room: localized(account.locale, session.roomBn ?? batch?.roomBn ?? "", session.roomEn ?? batch?.roomEn ?? ""),
        rosterCount: session.rosterCount,
      };
    }));
    const assignedExams = [];
    for (const assignment of examAssignments.slice(0, 20)) {
      const exam = await ctx.db.get("exams", assignment.examId);
      if (!exam || exam.status === "archived") continue;
      const examCandidates = await ctx.db.query("examResults").withIndex("by_examId_and_entryStatus", (q) => q.eq("examId", exam._id)).take(DASHBOARD_ROW_LIMIT);
      const candidates = assignment.batchId ? (await Promise.all(examCandidates.map(async (result) => ({ result, enrolment: await ctx.db.get("enrolments", result.enrolmentId) })))).filter(({ enrolment }) => enrolment?.batchId === assignment.batchId).map(({ result }) => result) : examCandidates;

      const completedCount = candidates.filter((result) => result.entryStatus === "ready" || result.entryStatus === "published").length;
      const [batch, examSubdocs] = await Promise.all([
        assignment.batchId ? ctx.db.get("batches", assignment.batchId) : null,
        ctx.db.query("examSubjects").withIndex("by_examId_and_sortOrder", (q) => q.eq("examId", exam._id)).take(100),
      ]);
      const subjects = await Promise.all(examSubdocs.map(es => ctx.db.get("subjects", es.subjectId)));
      const subjectName = subjects.map(s => s ? localized(account.locale, s.nameBn, s.nameEn) : "").filter(Boolean).join(", ") || null;

      assignedExams.push({
        examId: exam._id,
        examName: localized(account.locale, exam.nameBn, exam.nameEn),
        status: exam.status,
        completedCount,
        totalCandidates: candidates.length,
        batchName: batch ? localized(account.locale, batch.nameBn, batch.nameEn) : null,
        subjectName,
        examDate: exam.examDate,
        mode: exam.mode,
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

const nextClassValidator = v.union(v.object({ batchId: v.id("batches"), batchName: v.string(), subjectName: v.string(), teacherName: v.string(), date: v.string(), weekday: v.number(), startMinutes: v.number(), endMinutes: v.number(), room: v.string() }), v.null());

export const student = query({
  args: {},
  returns: v.object({
    nextClass: nextClassValidator, attendancePercentage: v.union(v.number(), v.null()), attendanceSampleCapped: v.boolean(), latestAttendance: v.union(v.object({ status: v.string(), submittedAt: v.number() }), v.null()),
    outstandingMinor: v.number(), overdueMinor: v.number(), advanceCreditMinor: v.number(), latestResult: v.union(v.object({ examId: v.id("exams"), examName: v.string(), totalScoreScaled: v.union(v.number(), v.null()), passed: v.union(v.boolean(), v.null()), meritPosition: v.union(v.number(), v.null()), publishedAt: v.number() }), v.null()),
    unreadNotices: v.number(), unreadNoticesCapped: v.boolean(), recentMaterials: v.array(v.object({ materialId: v.id("materials"), title: v.string(), publishedAt: v.number() })),
    recentNotices: v.array(
      v.object({
        noticeId: v.id("notices"),
        title: v.string(),
        body: v.string(),
        publishedAt: v.number(),
        readAt: v.union(v.number(), v.null()),
      })
    ),
    thisWeekClasses: v.array(
      v.object({
        batchId: v.id("batches"),
        batchName: v.string(),
        subjectName: v.string(),
        teacherName: v.string(),
        date: v.string(),
        weekday: v.number(),
        startMinutes: v.number(),
        endMinutes: v.number(),
        room: v.string(),
      })
    ),
    recentResults: v.array(
      v.object({
        examId: v.id("exams"),
        examName: v.string(),
        totalScoreScaled: v.union(v.number(), v.null()),
        passed: v.union(v.boolean(), v.null()),
        meritPosition: v.union(v.number(), v.null()),
        publishedAt: v.number(),
      })
    ),
    lastPayment: v.union(v.object({ amountMinor: v.number(), paidAt: v.number() }), v.null()),
    nextDueDate: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const { account, student: studentDoc } = await requireStudent(ctx);
    const [enrolments, attendance, financial, resultRows, recipientRows] = await Promise.all([
      ctx.db.query("enrolments").withIndex("by_studentId_and_status", (q) => q.eq("studentId", studentDoc._id).eq("status", "active")).take(50),
      ctx.db.query("attendanceRecords").withIndex("by_studentId_and_submittedAt", (q) => q.eq("studentId", studentDoc._id)).order("desc").take(DASHBOARD_ROW_LIMIT + 1),
      ctx.db.query("studentFinancialSummaries").withIndex("by_studentId", (q) => q.eq("studentId", studentDoc._id)).unique(),
      ctx.db.query("examResults").withIndex("by_studentId_and_publishedAt", (q) => q.eq("studentId", studentDoc._id)).order("desc").take(3),
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
    let nextClassDetail = null;
    if (next) {
      const teacher = await ctx.db.get("teachers", next.schedule.teacherId);
      nextClassDetail = {
        batchId: next.batch._id,
        batchName: localized(account.locale, next.batch.nameBn, next.batch.nameEn),
        subjectName: localized(account.locale, next.subject?.nameBn, next.subject?.nameEn),
        teacherName: teacher?.displayName ?? "—",
        date: next.date,
        weekday: next.schedule.weekday,
        startMinutes: next.schedule.startMinutes,
        endMinutes: next.schedule.endMinutes,
        room: localized(account.locale, next.schedule.roomBn ?? next.batch.roomBn, next.schedule.roomEn ?? next.batch.roomEn),
      };
    }
    const thisWeekClasses = [];
    for (const cand of candidates) {
      const teacher = await ctx.db.get("teachers", cand.schedule.teacherId);
      thisWeekClasses.push({
        batchId: cand.batch._id,
        batchName: localized(account.locale, cand.batch.nameBn, cand.batch.nameEn),
        subjectName: localized(account.locale, cand.subject?.nameBn, cand.subject?.nameEn),
        teacherName: teacher?.displayName ?? "—",
        date: cand.date,
        weekday: cand.schedule.weekday,
        startMinutes: cand.schedule.startMinutes,
        endMinutes: cand.schedule.endMinutes,
        room: localized(account.locale, cand.schedule.roomBn ?? cand.batch.roomBn, cand.schedule.roomEn ?? cand.batch.roomEn),
      });
    }
    const usedAttendance = attendance.slice(0, DASHBOARD_ROW_LIMIT);
    const attended = usedAttendance.filter((record) => record.status !== "absent").length;
    const latestResultRow = resultRows[0];
    const latestResultExam = latestResultRow ? await ctx.db.get("exams", latestResultRow.examId) : null;
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
    const recentNotices = [];
    for (const recipient of recipientRows.slice(0, 100)) {
      const notice = await ctx.db.get("notices", recipient.noticeId);
      if (notice?.status === "published") {
        if (recipient.readAt == null) unread.push(recipient);
        recentNotices.push({
          noticeId: notice._id,
          title: localized(account.locale, notice.titleBn, notice.titleEn),
          body: localized(account.locale, notice.bodyBn, notice.bodyEn),
          publishedAt: notice.publishedAt ?? notice.createdAt,
          readAt: recipient.readAt ?? null,
        });
      }
    }
    recentNotices.sort((a, b) => b.publishedAt - a.publishedAt);
    const recentResults = [];
    for (const res of resultRows) {
      if (res.publishedAt != null) {
        const exam = await ctx.db.get("exams", res.examId);
        if (exam) {
          recentResults.push({
            examId: exam._id,
            examName: localized(account.locale, exam.nameBn, exam.nameEn),
            totalScoreScaled: res.totalScoreScaled ?? null,
            passed: res.passed ?? null,
            meritPosition: res.meritPosition ?? null,
            publishedAt: res.publishedAt,
          });
        }
      }
    }
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_studentId_and_paidAt", (q) => q.eq("studentId", studentDoc._id))
      .order("desc")
      .take(20);
    const postedPayment = payments.find((payment) => payment.status === "posted");
    const lastPayment = postedPayment ? { amountMinor: postedPayment.amountMinor, paidAt: postedPayment.paidAt } : null;

    const charges = await ctx.db
      .query("studentCharges")
      .withIndex("by_studentId_and_dueDate", (q) => q.eq("studentId", studentDoc._id))
      .take(100);
    const unpaidCharges = charges.filter((c) => c.status !== "paid" && c.status !== "voided").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const nextDueDate = unpaidCharges[0]?.dueDate ?? null;

    return {
      nextClass: nextClassDetail,
      attendancePercentage: usedAttendance.length ? Math.round((attended / usedAttendance.length) * 10_000) / 100 : null,
      attendanceSampleCapped: attendance.length > DASHBOARD_ROW_LIMIT,
      latestAttendance: usedAttendance[0] ? { status: usedAttendance[0].status, submittedAt: usedAttendance[0].submittedAt } : null,
      outstandingMinor: financial?.outstandingMinor ?? 0,
      overdueMinor: financial?.overdueMinor ?? 0,
      advanceCreditMinor: financial?.advanceCreditMinor ?? 0,
      latestResult: latestResultRow?.publishedAt != null && latestResultExam ? { examId: latestResultExam._id, examName: localized(account.locale, latestResultExam.nameBn, latestResultExam.nameEn), totalScoreScaled: latestResultRow.totalScoreScaled ?? null, passed: latestResultRow.passed ?? null, meritPosition: latestResultRow.meritPosition ?? null, publishedAt: latestResultRow.publishedAt } : null,
      unreadNotices: unread.length,
      unreadNoticesCapped: recipientRows.length > 100,
      recentMaterials,
      recentNotices,
      thisWeekClasses,
      recentResults,
      lastPayment,
      nextDueDate,
    };
  },
});
