/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { createCsv, csvCell } from "./shared";

const discoveredModules = import.meta.glob("../**/*.ts");
const modules = Object.fromEntries(Object.entries(discoveredModules).map(([path, loader]) => [path.startsWith("./") ? `./reports/${path.slice(2)}` : `./${path.slice(3)}`, loader]));

const refreshDaily = makeFunctionReference<"mutation">("reports/summaries:refreshDaily");
const ownerDashboard = makeFunctionReference<"query">("reports/dashboards:owner");
const teacherDashboard = makeFunctionReference<"query">("reports/dashboards:teacher");
const studentDashboard = makeFunctionReference<"query">("reports/dashboards:student");
const collections = makeFunctionReference<"query">("reports/finance:collections");
const collectionsCsv = makeFunctionReference<"query">("reports/exports:collectionsCsv");
const studentStatement = makeFunctionReference<"query">("reports/finance:studentStatement");
const resultSheet = makeFunctionReference<"query">("reports/exams:resultSheet");
const publishedResult = makeFunctionReference<"query">("reports/exams:publishedResult");

type Fixture = {
  ownerToken: string;
  teacherToken: string;
  studentOneToken: string;
  studentTwoToken: string;
  studentOneId: Id<"students">;
  studentTwoId: Id<"students">;
  ownerAccountId: Id<"portalAccounts">;
  teacherOneId: Id<"teachers">;
  courseId: Id<"courses">;
  batchOneId: Id<"batches">;
  batchTwoId: Id<"batches">;
  enrolmentOneId: Id<"enrolments">;
  enrolmentTwoId: Id<"enrolments">;
};

async function seed(t: ReturnType<typeof convexTest>): Promise<Fixture> {
  return await t.run(async (ctx) => {
    const now = Date.parse("2026-07-11T06:00:00+06:00");
    const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: "Owner", email: "owner@example.com", status: "active", createdAt: now, updatedAt: now });
    const ownerAccountId = await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "reports-owner", loginEmail: "owner@example.com", normalizedLoginEmail: "owner@example.com", ownerProfileId, locale: "en", createdAt: now, updatedAt: now });
    const courseId = await ctx.db.insert("courses", { code: "SSC", slug: "ssc", nameBn: "এসএসসি", nameEn: "SSC", shortDescriptionBn: "", shortDescriptionEn: "", descriptionBn: "", descriptionEn: "", status: "active", isPublic: true, publicSortOrder: 1, createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId, updatedByAccountId: ownerAccountId });
    const teacherOneId = await ctx.db.insert("teachers", { employeeCode: "T1", displayName: "Teacher One", loginEmail: "teacher@example.com", normalizedLoginEmail: "teacher@example.com", phone: "8801711111111", bioBn: "", bioEn: "", qualificationsBn: "", qualificationsEn: "", status: "active", isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now });
    const teacherTwoId = await ctx.db.insert("teachers", { employeeCode: "T2", displayName: "Teacher Two", loginEmail: "other-teacher@example.com", normalizedLoginEmail: "other-teacher@example.com", phone: "8801722222222", bioBn: "", bioEn: "", qualificationsBn: "", qualificationsEn: "", status: "active", isPublic: false, publicSortOrder: 2, createdAt: now, updatedAt: now });
    await ctx.db.insert("portalAccounts", { role: "teacher", status: "active", tokenIdentifier: "reports-teacher", loginEmail: "teacher@example.com", normalizedLoginEmail: "teacher@example.com", teacherId: teacherOneId, locale: "en", createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId });
    const batchOneId = await ctx.db.insert("batches", { courseId, code: "B1", slug: "b1", nameBn: "ব্যাচ এক", nameEn: "Batch One", startDate: "2026-01-01", status: "active", admissionOpen: true, isPublic: true, publicSortOrder: 1, createdAt: now, updatedAt: now });
    const batchTwoId = await ctx.db.insert("batches", { courseId, code: "B2", slug: "b2", nameBn: "ব্যাচ দুই", nameEn: "Batch Two", startDate: "2026-01-01", status: "active", admissionOpen: true, isPublic: true, publicSortOrder: 2, createdAt: now, updatedAt: now });
    await ctx.db.insert("teacherBatchAssignments", { teacherId: teacherOneId, batchId: batchOneId, startsOn: "2026-01-01", status: "active", createdAt: now, createdByAccountId: ownerAccountId });

    const createStudent = async (number: string, token: string, batchId: Id<"batches">) => {
      const studentId = await ctx.db.insert("students", { studentNumber: number, displayName: number === "S1" ? "রিমা, আক্তার" : "Foreign Student", loginEmail: `${number.toLowerCase()}@example.com`, normalizedLoginEmail: `${number.toLowerCase()}@example.com`, schoolCollege: "School", currentClass: "10", guardianName: "Guardian", guardianPhone: "8801712345678", normalizedGuardianPhone: "8801712345678", guardianRelationship: "Parent", preferredSmsLocale: "bn", admissionDate: "2026-01-01", status: "active", searchText: number, createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId, updatedByAccountId: ownerAccountId });
      const enrolmentId = await ctx.db.insert("enrolments", { studentId, courseId, batchId, enrolledOn: "2026-01-01", status: "active", createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId });
      await ctx.db.insert("portalAccounts", { role: "student", status: "active", tokenIdentifier: token, loginEmail: `${number.toLowerCase()}@example.com`, normalizedLoginEmail: `${number.toLowerCase()}@example.com`, studentId, locale: "bn", createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId });
      return { studentId, enrolmentId };
    };
    const one = await createStudent("S1", "reports-student-one", batchOneId);
    const two = await createStudent("S2", "reports-student-two", batchTwoId);
    await ctx.db.insert("students", { studentNumber: "S3", displayName: "Inactive", loginEmail: "s3@example.com", normalizedLoginEmail: "s3@example.com", schoolCollege: "School", currentClass: "10", guardianName: "Guardian", guardianPhone: "8801799999999", normalizedGuardianPhone: "8801799999999", guardianRelationship: "Parent", preferredSmsLocale: "en", admissionDate: "2026-01-01", status: "archived", searchText: "inactive", createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId, updatedByAccountId: ownerAccountId });
    const sessionOneId = await ctx.db.insert("classSessions", { sessionKey: "one", batchId: batchOneId, teacherId: teacherOneId, sessionDate: "2026-07-11", startsAt: now, endsAt: now + 3_600_000, status: "submitted", submittedAt: now, submittedByAccountId: ownerAccountId, rosterCount: 1, presentCount: 1, lateCount: 0, absentCount: 0, createdAt: now });
    await ctx.db.insert("attendanceRecords", { sessionId: sessionOneId, batchId: batchOneId, studentId: one.studentId, enrolmentId: one.enrolmentId, status: "present", submittedAt: now, submittedByAccountId: ownerAccountId });
    await ctx.db.insert("classSessions", { sessionKey: "two", batchId: batchTwoId, teacherId: teacherTwoId, sessionDate: "2026-07-11", startsAt: now, endsAt: now + 3_600_000, status: "open", rosterCount: 1, createdAt: now });
    await ctx.db.insert("payments", { paymentNumber: "P1", receiptNumber: "R\"1", studentId: one.studentId, amountMinor: 12500, allocatedAmountMinor: 12500, advanceAmountMinor: 0, method: "cash", paidAt: now, status: "posted", collectedByAccountId: ownerAccountId, createdAt: now });
    await ctx.db.insert("payments", { paymentNumber: "P2", receiptNumber: "R2", studentId: two.studentId, amountMinor: 5000, allocatedAmountMinor: 5000, advanceAmountMinor: 0, method: "cash", paidAt: now, status: "voided", collectedByAccountId: ownerAccountId, createdAt: now, voidedAt: now, voidedByAccountId: ownerAccountId, voidReason: "Correction" });
    await ctx.db.insert("studentFinancialSummaries", { studentId: one.studentId, totalChargedMinor: 20000, totalDiscountMinor: 0, totalPaidMinor: 12500, totalVoidedMinor: 0, outstandingMinor: 7500, advanceCreditMinor: 0, overdueMinor: 7500, lastPaymentAt: now, updatedAt: now });
    return { ownerToken: "reports-owner", teacherToken: "reports-teacher", studentOneToken: "reports-student-one", studentTwoToken: "reports-student-two", studentOneId: one.studentId, studentTwoId: two.studentId, ownerAccountId, teacherOneId, courseId, batchOneId, batchTwoId, enrolmentOneId: one.enrolmentId, enrolmentTwoId: two.enrolmentId };
  });
}

describe("reporting summaries and authorization", () => {
  it("returns the latest posted payment and newest notice first", async () => {
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const base = Date.parse("2026-07-11T06:00:00+06:00");
    await t.run(async (ctx) => {
      await ctx.db.insert("payments", {
        paymentNumber: "P-VOID-NEWER", receiptNumber: "R-VOID-NEWER", studentId: data.studentOneId,
        amountMinor: 99900, allocatedAmountMinor: 0, advanceAmountMinor: 99900, method: "cash",
        paidAt: base + 2_000, status: "voided", collectedByAccountId: data.ownerAccountId,
        voidedAt: base + 3_000, voidedByAccountId: data.ownerAccountId, voidReason: "Correction", createdAt: base + 2_000,
      });
      for (const [suffix, publishedAt] of [["old", base + 1_000], ["new", base + 4_000]] as const) {
        const noticeId = await ctx.db.insert("notices", {
          audienceType: "all_students", titleBn: suffix, titleEn: suffix, bodyBn: suffix, bodyEn: suffix,
          status: "published", sendSms: false, publishedAt, createdAt: publishedAt, updatedAt: publishedAt,
          createdByAccountId: data.ownerAccountId,
        });
        await ctx.db.insert("noticeRecipients", { noticeId, studentId: data.studentOneId });
      }
    });

    const dashboard = await t.withIdentity({ tokenIdentifier: data.studentOneToken }).query(studentDashboard, {});
    expect(dashboard.lastPayment).toMatchObject({ amountMinor: 12500 });
    expect(dashboard.recentNotices.map((notice: { title: string }) => notice.title)).toEqual(["new", "old"]);
  });

  it("shows current active student and batch counts before the daily summary runs", async () => {
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const dashboard = await t.withIdentity({ tokenIdentifier: data.ownerToken }).query(ownerDashboard, { date: "2026-07-11" });
    expect(dashboard).toMatchObject({ activeStudents: 2, activeBatches: 2, summaryUpdatedAt: null });
  });

  it("rebuilds exact dashboard totals from bounded source data", async () => {
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const owner = t.withIdentity({ tokenIdentifier: data.ownerToken });
    const summary = await owner.mutation(refreshDaily, { date: "2026-07-11" });
    expect(summary).toMatchObject({ activeStudentCount: 2, activeBatchCount: 2, scheduledSessionCount: 2, submittedSessionCount: 1, presentCount: 1, paymentsCount: 1, collectedMinor: 12500, overdueStudentsCount: 1, overdueMinor: 7500 });
    const dashboard = await owner.query(ownerDashboard, { date: "2026-07-11" });
    expect(dashboard).toMatchObject({ activeStudents: 2, todayCollectionsMinor: 12500, monthCollectionsMinor: 12500, attendancePending: 1, overdueMinor: 7500 });
  });

  it("keeps teacher and student reports within their own scope", async () => {
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const teacher = await t.withIdentity({ tokenIdentifier: data.teacherToken }).query(teacherDashboard, { date: "2026-07-11" });
    expect(teacher.assignedBatchCount).toBe(1);
    expect(teacher.todaySessions).toHaveLength(1);
    expect(teacher.todaySessions[0].batchName).toBe("Batch One");
    await expect(t.withIdentity({ tokenIdentifier: data.studentOneToken }).query(studentStatement, { studentId: data.studentTwoId, chargeLimit: 10, paymentLimit: 10 })).rejects.toThrow("Unauthorized");
  });

  it("does not leak another batch's materials or exam results", async () => {
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const examId = await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("materials", { courseId: data.courseId, batchId: data.batchTwoId, titleBn: "গোপন", titleEn: "Foreign batch only", descriptionBn: "", descriptionEn: "", kind: "text", visibility: "batch", status: "published", publishedAt: now, createdByAccountId: data.ownerAccountId, createdAt: now, updatedAt: now });
      const examId = await ctx.db.insert("exams", { examNumber: "E1", courseId: data.courseId, nameBn: "পরীক্ষা", nameEn: "Exam", examDate: "2026-07-10", mode: "written", writtenFullMarksScaled: 10000, totalFullMarksScaled: 10000, passMarksScaled: 3300, status: "published", publicationVersion: 1, publishedAt: now, publishedByAccountId: data.ownerAccountId, createdAt: now, updatedAt: now, createdByAccountId: data.ownerAccountId });
      await ctx.db.insert("examTeacherAssignments", { examId, teacherId: data.teacherOneId, batchId: data.batchOneId, createdAt: now });
      for (const [studentId, enrolmentId, score, merit] of [[data.studentOneId, data.enrolmentOneId, 9000, 1], [data.studentTwoId, data.enrolmentTwoId, 8000, 2]] as const) {
        await ctx.db.insert("examResults", { examId, courseId: data.courseId, studentId, enrolmentId, participation: "present", writtenScoreScaled: score, totalScoreScaled: score, passed: true, meritPosition: merit, entryStatus: "published", publicationVersion: 1, publishedAt: now, publishedParticipation: "present", publishedWrittenScoreScaled: score, publishedTotalScoreScaled: score, publishedPassed: true, publishedMeritPosition: merit, updatedAt: now });
      }
      return examId;
    });
    const student = await t.withIdentity({ tokenIdentifier: data.studentOneToken }).query(studentDashboard, {});
    expect(student.recentMaterials).toEqual([]);
    const results = await t.withIdentity({ tokenIdentifier: data.teacherToken }).query(resultSheet, { examId, entryStatus: "published", paginationOpts: { numItems: 10, cursor: null } });
    expect(results.page.map((row: { studentId: Id<"students"> }) => row.studentId)).toEqual([data.studentOneId]);
    expect(results.page[0].totalScoreScaled).toBe(9000);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("examResults").withIndex("by_examId_and_studentId", (q) => q.eq("examId", examId).eq("studentId", data.studentOneId)).unique();
      await ctx.db.patch(row!._id, { entryStatus: "draft", totalScoreScaled: 100, writtenScoreScaled: 100, passed: false, meritPosition: undefined });
    });
    const stable = await t.withIdentity({ tokenIdentifier: data.studentOneToken }).query(publishedResult, { examId });
    expect(stable?.result).toMatchObject({ totalScoreScaled: 9000, passed: true, meritPosition: 1, publicationVersion: 1 });
    const reopenedSheet = await t.withIdentity({ tokenIdentifier: data.teacherToken }).query(resultSheet, { examId, entryStatus: "published", paginationOpts: { numItems: 10, cursor: null } });
    expect(reopenedSheet.page[0]).toMatchObject({ totalScoreScaled: 9000, passed: true, meritPosition: 1 });
    await expect(t.withIdentity({ tokenIdentifier: data.studentTwoToken }).query(publishedResult, { examId, studentId: data.studentOneId })).rejects.toThrow("Unauthorized");
  });
});

describe("paginated and CSV report payloads", () => {
  it("paginates collection rows and excludes voided payments", async () => {
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const page = await t.withIdentity({ tokenIdentifier: data.ownerToken }).query(collections, { fromAt: Date.parse("2026-07-11T00:00:00+06:00"), toAt: Date.parse("2026-07-12T00:00:00+06:00"), paginationOpts: { numItems: 1, cursor: null } });
    expect(page.page).toHaveLength(1);
    expect(page.page[0]).toMatchObject({ receiptNumber: "R\"1", amountMinor: 12500 });
  });

  it("quotes commas, quotes and newlines while preserving Unicode and Bangla", async () => {
    expect(csvCell('a,"b"\nnext')).toBe('"a,""b""\nnext"');
    expect(createCsv([["নাম", "Value"], ["রিমা, আক্তার", 'say "hi"']])).toBe('\uFEFFনাম,Value\r\n"রিমা, আক্তার","say ""hi"""\r\n');
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const payload = await t.withIdentity({ tokenIdentifier: data.ownerToken }).query(collectionsCsv, { fromAt: Date.parse("2026-07-11T00:00:00+06:00"), toAt: Date.parse("2026-07-12T00:00:00+06:00"), locale: "bn" });
    expect(payload.content).toContain("রসিদ");
    expect(payload.content).toContain('"R""1"');
    expect(payload.content).toContain('"রিমা, আক্তার"');
    expect(payload).toMatchObject({ rowCount: 1, truncated: false });
  });
});
