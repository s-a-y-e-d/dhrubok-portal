import { v } from "convex/values";
import { env, mutation } from "./_generated/server";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const DEMO_PREFIX = "DEMO-";
const DAY = 86_400_000;

async function requireDevOwner(ctx: MutationCtx) {
  if (env.DEV_IMPERSONATION_ENABLED !== "true") throw new Error("Development test data is disabled");
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const owner = await ctx.db.query("portalAccounts").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!owner || owner.role !== "owner" || owner.status !== "active") throw new Error("Only an active owner can create test data");
  return owner;
}

async function demoCourses(ctx: MutationCtx) {
  return await ctx.db.query("courses").withIndex("by_code", (q) => q.eq("code", "DEMO-SSC-SCI")).unique();
}

/** Creates the stable academic spine used by every development demo workflow. */
export const seedAcademics = mutation({
  args: {},
  returns: v.object({ created: v.boolean(), courses: v.number(), batches: v.number(), enrolments: v.number() }),
  handler: async (ctx) => {
    const owner = await requireDevOwner(ctx);
    const existing = await demoCourses(ctx);
    if (existing) {
      const batches = await ctx.db.query("batches").withIndex("by_courseId_and_status", (q) => q.eq("courseId", existing._id).eq("status", "active")).take(20);
      return { created: false, courses: 4, batches: batches.length * 4, enrolments: 0 };
    }
    const now = Date.now();
    const subjects = ["Bangla", "English", "Mathematics", "Physics", "Chemistry", "Biology", "ICT", "Accounting"];
    const subjectIds: Id<"subjects">[] = [];
    for (const nameEn of subjects) {
      subjectIds.push(await ctx.db.insert("subjects", { code: `${DEMO_PREFIX}${nameEn.slice(0, 3).toUpperCase()}`, nameEn, createdAt: now, updatedAt: now }));
    }
    const specs = [
      ["SSC-SCI", "SSC Science 2026", "এসএসসি বিজ্ঞান ২০২৬", [0, 1, 2, 3, 4, 5]],
      ["HSC-SCI", "HSC Science 2026", "এইচএসসি বিজ্ঞান ২০২৬", [1, 2, 3, 4, 5, 6]],
      ["HSC-COM", "HSC Commerce 2026", "এইচএসসি বাণিজ্য ২০২৬", [0, 1, 2, 6, 7]],
      ["ADM", "University Admission 2026", "বিশ্ববিদ্যালয় ভর্তি ২০২৬", [1, 2, 3, 4, 5]],
    ] as const;
    for (const [index, [codeSuffix, nameEn, nameBn, subjectIndexes]] of specs.entries()) {
      const courseId = await ctx.db.insert("courses", {
        code: `${DEMO_PREFIX}${codeSuffix}`, slug: `demo-${codeSuffix.toLowerCase()}`, nameEn, nameBn,
        searchText: `${nameEn} ${nameBn} ${codeSuffix}`.toLowerCase(), shortDescriptionEn: "A realistic development demonstration course.", shortDescriptionBn: "উন্নয়ন পরীক্ষার জন্য বাস্তবসম্মত ডেমো কোর্স।",
        descriptionEn: "Demo data for admissions, academics, attendance, finance, exams, and notices.", descriptionBn: "ভর্তি, একাডেমিক, উপস্থিতি, ফাইন্যান্স, পরীক্ষা ও নোটিশের ডেমো ডেটা।",
        status: "active", isPublic: true, publicSortOrder: index + 1, createdAt: now, updatedAt: now, createdByAccountId: owner._id, updatedByAccountId: owner._id,
      });
      for (const [sortOrder, subjectIndex] of subjectIndexes.entries()) await ctx.db.insert("courseSubjects", { courseId, subjectId: subjectIds[subjectIndex], sortOrder, createdAt: now });
      for (let number = 1; number <= 2; number += 1) await ctx.db.insert("batches", {
        courseId, code: `${DEMO_PREFIX}${codeSuffix}-${number}`, slug: `demo-${codeSuffix.toLowerCase()}-${number}`,
        nameEn: `${nameEn} — ${number === 1 ? "Morning" : "Evening"}`, nameBn: `${nameBn} — ${number === 1 ? "সকাল" : "বিকাল"}`,
        startDate: "2026-01-01", status: "active", admissionOpen: number === 1, isPublic: true, publicSortOrder: index * 2 + number, createdAt: now, updatedAt: now,
      });
    }
    return { created: true, courses: specs.length, batches: 8, enrolments: 0 };
  },
});

export const seedOperations = mutation({
  args: {},
  returns: v.object({ created: v.boolean(), attendanceRecords: v.number(), charges: v.number(), payments: v.number(), results: v.number(), notices: v.number() }),
  handler: async (ctx) => {
    const owner = await requireDevOwner(ctx);
    const marker = await ctx.db.query("exams").withIndex("by_examNumber", (q) => q.eq("examNumber", "DEMO-EX-2026-01")).unique();
    if (marker) return { created: false, attendanceRecords: 0, charges: 0, payments: 0, results: 0, notices: 0 };
    const now = Date.now();
    const courses = (await Promise.all(["DEMO-SSC-SCI", "DEMO-HSC-SCI", "DEMO-HSC-COM", "DEMO-ADM"].map((code) => ctx.db.query("courses").withIndex("by_code", (q) => q.eq("code", code)).unique()))).filter((course): course is Doc<"courses"> => course !== null);
    if (courses.length !== 4) throw new Error("Create demo academics before operations");
    const batches = (await Promise.all(courses.map(async (course) => await ctx.db.query("batches").withIndex("by_courseId_and_status", (q) => q.eq("courseId", course._id).eq("status", "active")).take(10)))).flat();
    const teacherAccounts = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", (q) => q.eq("role", "teacher").eq("status", "active")).take(30);
    const studentAccounts = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", (q) => q.eq("role", "student").eq("status", "active")).take(100);
    const teachers = teacherAccounts.filter((row): row is Extract<Doc<"portalAccounts">, { role: "teacher" }> => row.loginEmail.endsWith("@test.dhrubok.local") && row.role === "teacher");
    const students = studentAccounts.filter((row): row is Extract<Doc<"portalAccounts">, { role: "student" }> => row.loginEmail.endsWith("@test.dhrubok.local") && row.role === "student");
    if (teachers.length < 8 || students.length < 60) throw new Error("Create demo personas before operations");
    const subjectRows = await ctx.db.query("subjects").take(20);
    for (const [index, batch] of batches.entries()) {
      const teacher = teachers[index % teachers.length];
      if (teacher.role !== "teacher") continue;
      const subjectId = subjectRows[index % subjectRows.length]?._id;
      await ctx.db.insert("teacherBatchAssignments", { teacherId: teacher.teacherId, batchId: batch._id, subjectId, startsOn: "2026-01-01", status: "active", createdAt: now, createdByAccountId: owner._id });
      await ctx.db.insert("batchSchedules", { batchId: batch._id, teacherId: teacher.teacherId, subjectId, weekday: (index + 1) % 6, startMinutes: index % 2 ? 1020 : 600, endMinutes: index % 2 ? 1140 : 720, effectiveFrom: "2026-01-01", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("batchSchedules", { batchId: batch._id, teacherId: teachers[(index + 3) % teachers.length].teacherId, subjectId: subjectRows[(index + 2) % subjectRows.length]?._id, weekday: (index + 3) % 6, startMinutes: index % 2 ? 900 : 780, endMinutes: index % 2 ? 1020 : 900, effectiveFrom: "2026-01-01", status: "active", createdAt: now, updatedAt: now });
    }
    const enrolments: Array<{ student: Doc<"portalAccounts"> & { role: "student" }; row: Id<"enrolments">; batch: Doc<"batches"> }> = [];
    for (const [index, account] of students.entries()) {
      if (account.role !== "student") continue;
      const batch = batches[index % batches.length]; const course = courses.find((item) => item._id === batch.courseId)!;
      const row = await ctx.db.insert("enrolments", { studentId: account.studentId, courseId: course._id, batchId: batch._id, enrolledOn: "2026-01-05", status: index % 23 === 0 ? "completed" : "active", agreedMonthlyAmountMinor: 250_000 + (index % 3) * 50_000, firstBillingMonth: "2026-01", createdAt: now, updatedAt: now, createdByAccountId: owner._id });
      enrolments.push({ student: account, row, batch });
    }
    let attendanceRecords = 0, charges = 0, payments = 0;
    for (const [batchIndex, batch] of batches.entries()) {
      const roster = enrolments.filter((row) => row.batch._id === batch._id && row.student.role === "student").slice(0, 12);
      const teacher = teachers[batchIndex % teachers.length]; if (teacher.role !== "teacher") continue;
      const sessionDate = `2026-07-${String(14 + (batchIndex % 6)).padStart(2, "0")}`;
      const sessionId = await ctx.db.insert("classSessions", { sessionKey: `${DEMO_PREFIX}SESSION-${batchIndex}`, batchId: batch._id, teacherId: teacher.teacherId, subjectId: subjectRows[batchIndex % subjectRows.length]?._id, sessionDate, startsAt: now - (8 - batchIndex) * DAY, endsAt: now - (8 - batchIndex) * DAY + 7_200_000, status: "submitted", submittedAt: now - (8 - batchIndex) * DAY, submittedByAccountId: owner._id, rosterCount: roster.length, presentCount: roster.filter((_, i) => i % 10 !== 0 && i % 7 !== 0).length, lateCount: roster.filter((_, i) => i % 7 === 0).length, absentCount: roster.filter((_, i) => i % 10 === 0).length, createdAt: now - (8 - batchIndex) * DAY, updatedAt: now });
      for (const [i, enrolment] of roster.entries()) { const status = i % 10 === 0 ? "absent" : i % 7 === 0 ? "late" : "present"; await ctx.db.insert("attendanceRecords", { sessionId, batchId: batch._id, studentId: enrolment.student.studentId, enrolmentId: enrolment.row, status, submittedAt: now - (8 - batchIndex) * DAY, submittedByAccountId: owner._id }); attendanceRecords++; }
    }
    for (const [index, enrolment] of enrolments.entries()) {
      const student = await ctx.db.get("students", enrolment.student.studentId); if (!student) continue;
      let outstanding = 0, totalCharged = 0, totalPaid = 0;
      for (const [month, dueDate] of [["2026-06", "2026-06-01"], ["2026-07", "2026-07-01"], ["2026-08", "2026-08-01"]] as const) {
        const amount = 250_000 + (index % 3) * 50_000; const paid = month === "2026-06" || (month === "2026-07" && index % 3 === 0); const partial = month === "2026-07" && index % 5 === 0;
        const paidAmount = paid ? amount : partial ? Math.floor(amount / 2) : 0;
        const chargeId = await ctx.db.insert("studentCharges", { chargeNumber: `${DEMO_PREFIX}CH-${index + 1}-${month}`, studentId: student._id, enrolmentId: enrolment.row, courseId: enrolment.batch.courseId, batchId: enrolment.batch._id, type: "monthly", periodKey: month, descriptionEn: `${month} monthly tuition`, descriptionBn: `${month} মাসিক বেতন`, originalAmountMinor: amount, discountAmountMinor: 0, netAmountMinor: amount, paidAmountMinor: paidAmount, dueDate, status: paid ? "paid" : partial ? "partially_paid" : month === "2026-08" ? "upcoming" : "due", generationKey: `${DEMO_PREFIX}${index}-${month}`, createdAt: now, createdByAccountId: owner._id, settledAt: paid ? now - DAY : undefined });
        charges++; totalCharged += amount; totalPaid += paidAmount; outstanding += amount - paidAmount;
        await ctx.db.insert("monthlyFeeRecords", { studentId: student._id, enrolmentId: enrolment.row, courseId: enrolment.batch.courseId, batchId: enrolment.batch._id, periodKey: month, dueDate, amountMinor: amount, status: paid ? "paid" : "unpaid", createdAt: now, paidAt: paid ? now - DAY : undefined });
        if (paidAmount) { const paymentId = await ctx.db.insert("payments", { paymentNumber: `${DEMO_PREFIX}PAY-${index + 1}-${month}`, receiptNumber: `${DEMO_PREFIX}RCT-${index + 1}-${month}`, studentId: student._id, amountMinor: paidAmount, allocatedAmountMinor: paidAmount, advanceAmountMinor: 0, method: index % 2 ? "cash" : "bank_transfer", paidAt: now - DAY, status: "posted", collectedByAccountId: owner._id, createdAt: now - DAY }); await ctx.db.insert("paymentAllocations", { paymentId, chargeId, studentId: student._id, amountMinor: paidAmount, chargeDescriptionBnSnapshot: `${month} মাসিক বেতন`, chargeDescriptionEnSnapshot: `${month} monthly tuition`, createdAt: now - DAY }); payments++; }
      }
      await ctx.db.insert("studentFinancialSummaries", { studentId: student._id, totalChargedMinor: totalCharged, totalDiscountMinor: 0, totalPaidMinor: totalPaid, totalVoidedMinor: 0, outstandingMinor: outstanding, advanceCreditMinor: 0, overdueMinor: index % 4 ? outstanding : 0, currentMinor: 0, overdue1To15Minor: outstanding, overdue16To30Minor: 0, overdue31To60Minor: 0, overdue61To90Minor: 0, overdueOver90Minor: 0, oldestUnpaidDueDate: outstanding ? "2026-07-01" : undefined, updatedAt: now });
    }
    const published = await ctx.db.insert("exams", { examNumber: "DEMO-EX-2026-01", courseId: courses[0]._id, batchId: batches[0]._id, nameEn: "SSC Science Monthly Assessment", nameBn: "এসএসসি বিজ্ঞান মাসিক মূল্যায়ন", examDate: "2026-07-10", mode: "both", mcqFullMarksScaled: 4_000, writtenFullMarksScaled: 6_000, totalFullMarksScaled: 10_000, passMarksScaled: 4_000, status: "published", publicationVersion: 1, publishedAt: now - 10 * DAY, publishedByAccountId: owner._id, createdAt: now - 15 * DAY, updatedAt: now, createdByAccountId: owner._id });
    const examRoster = enrolments.filter((row) => row.batch._id === batches[0]._id).slice(0, 12);
    for (const [i, enrolment] of examRoster.entries()) { const score = 9500 - i * 420; const passed = score >= 4000; await ctx.db.insert("examResults", { examId: published, courseId: courses[0]._id, studentId: enrolment.student.studentId, enrolmentId: enrolment.row, participation: i === 10 ? "absent" : "present", mcqScoreScaled: i === 10 ? undefined : Math.round(score * .4), writtenScoreScaled: i === 10 ? undefined : Math.round(score * .6), totalScoreScaled: i === 10 ? 0 : score, passed: i === 10 ? false : passed, meritPosition: i === 10 ? undefined : i + 1, entryStatus: "published", enteredByAccountId: owner._id, enteredAt: now - 12 * DAY, publicationVersion: 1, publishedAt: now - 10 * DAY, publishedParticipation: i === 10 ? "absent" : "present", publishedMcqScoreScaled: i === 10 ? undefined : Math.round(score * .4), publishedWrittenScoreScaled: i === 10 ? undefined : Math.round(score * .6), publishedTotalScoreScaled: i === 10 ? 0 : score, publishedPassed: i === 10 ? false : passed, publishedMeritPosition: i === 10 ? undefined : i + 1, updatedAt: now }); }
    const noticeId = await ctx.db.insert("notices", { titleEn: "Demo: July progress meeting", titleBn: "ডেমো: জুলাই অগ্রগতি সভা", bodyEn: "Parents are invited to the July progress meeting this Saturday at 4:00 PM.", bodyBn: "অভিভাবকদের জুলাই অগ্রগতি সভায় শনিবার বিকাল ৪টায় আমন্ত্রণ জানানো হচ্ছে।", audienceType: "all_students", status: "published", sendSms: false, publishedAt: now - 2 * DAY, createdByAccountId: owner._id, createdAt: now - 2 * DAY, updatedAt: now - 2 * DAY });
    for (const enrolment of enrolments) await ctx.db.insert("noticeRecipients", { noticeId, studentId: enrolment.student.studentId, readAt: undefined });
    for (const [index, status] of (["new", "under_review", "accepted", "rejected"] as const).entries()) {
      const displayName = ["Aarav Khan", "Mim Sultana", "Rafi Ahmed", "Nadia Islam"][index];
      await ctx.db.insert("admissionApplications", { applicationNumber: `${DEMO_PREFIX}APP-${index + 1}`, submittedAt: now - (index + 1) * DAY, locale: "en", studentDisplayName: displayName, studentNameEn: displayName, studentEmail: `applicant${index + 1}@demo.dhrubok.local`, normalizedStudentEmail: `applicant${index + 1}@demo.dhrubok.local`, studentPhone: `01940${String(400001 + index).slice(-6)}`, schoolCollege: "Dhrubok Partner College", currentClass: index < 2 ? "10" : "12", guardianName: `Parent of ${displayName}`, guardianPhone: `01840${String(400001 + index).slice(-6)}`, normalizedGuardianPhone: `01840${String(400001 + index).slice(-6)}`, guardianRelationship: "Father", motherName: `Mother of ${displayName}`, motherPhone: `01841${String(400001 + index).slice(-6)}`, preferredSmsLocale: "en", requestedCourseId: courses[index % courses.length]._id, requestedBatchId: batches[(index * 2) % batches.length]._id, status, reviewedByAccountId: status === "new" ? undefined : owner._id, reviewedAt: status === "new" ? undefined : now - index * DAY, rejectionReason: status === "rejected" ? "Requested batch is full." : undefined, createdAt: now - (index + 1) * DAY, updatedAt: now - index * DAY, submissionKey: `${DEMO_PREFIX}APPLICATION-${index + 1}` });
    }
    for (const enrolment of enrolments.slice(0, 20)) { const student = await ctx.db.get("students", enrolment.student.studentId); if (!student) continue; await ctx.db.insert("smsMessages", { idempotencyKey: `${DEMO_PREFIX}SMS-${student._id}`, eventType: "payment_posted", relatedEntityType: "demo", relatedEntityId: enrolment.row, studentId: student._id, guardianPhone: student.guardianPhone, normalizedRecipient: student.normalizedGuardianPhone, locale: "en", body: "Dhrubok demo: payment received. This is a simulated development message.", segmentEstimate: 1, status: "delivered", provider: "sms_bd", providerStatus: "demo-delivered", attemptCount: 0, createdAt: now - DAY, updatedAt: now - DAY, deliveredAt: now - DAY }); }
    await ctx.db.insert("dailyOperationalSummaries", { date: "2026-07-22", activeStudentCount: enrolments.length, activeBatchCount: batches.length, scheduledSessionCount: 3, submittedSessionCount: 2, presentCount: attendanceRecords - Math.floor(attendanceRecords / 10), lateCount: Math.floor(attendanceRecords / 7), absentCount: Math.floor(attendanceRecords / 10), paymentsCount: payments, collectedMinor: payments * 250_000, overdueStudentsCount: Math.floor(enrolments.length / 2), overdueMinor: Math.floor(enrolments.length / 2) * 250_000, activeOutstandingMinor: Math.floor(enrolments.length / 2) * 250_000, updatedAt: now });
    return { created: true, attendanceRecords, charges, payments, results: examRoster.length, notices: 1 };
  },
});

/** Removes only derived records created by this seed; accounts and academic setup remain. */
export const resetDemoOperations = mutation({
  args: {},
  returns: v.object({ removed: v.number() }),
  handler: async (ctx) => {
    await requireDevOwner(ctx);
    let removed = 0;
    const remove = async <T extends keyof DataModel>(rows: Doc<T>[]) => {
      for (const row of rows) { await ctx.db.delete(row._id); removed += 1; }
    };
    const marker = await ctx.db.query("exams").withIndex("by_examNumber", (q) => q.eq("examNumber", "DEMO-EX-2026-01")).unique();
    if (marker) {
      await remove(await ctx.db.query("examResults").withIndex("by_examId_and_totalScoreScaled", (q) => q.eq("examId", marker._id)).take(500));
      await remove(await ctx.db.query("examSubjects").withIndex("by_examId_and_sortOrder", (q) => q.eq("examId", marker._id)).take(100));
      await remove(await ctx.db.query("examBatches").withIndex("by_examId", (q) => q.eq("examId", marker._id)).take(100));
      await remove(await ctx.db.query("examTeacherAssignments").withIndex("by_examId", (q) => q.eq("examId", marker._id)).take(100));
      await ctx.db.delete(marker._id); removed += 1;
    }
    const demoCourses = (await Promise.all(["DEMO-SSC-SCI", "DEMO-HSC-SCI", "DEMO-HSC-COM", "DEMO-ADM"].map((code) => ctx.db.query("courses").withIndex("by_code", (q) => q.eq("code", code)).unique()))).filter((course): course is Doc<"courses"> => course !== null);
    const demoBatches = (await Promise.all(demoCourses.map((course) => ctx.db.query("batches").withIndex("by_courseId_and_status", (q) => q.eq("courseId", course._id).eq("status", "active")).take(20)))).flat();
    const enrolments = (await Promise.all(demoBatches.map((batch) => ctx.db.query("enrolments").withIndex("by_batchId_and_status", (q) => q.eq("batchId", batch._id).eq("status", "active")).take(200)))).flat();
    const allDemoSessions = (await Promise.all(demoBatches.map((batch) => ctx.db.query("classSessions").withIndex("by_batchId_and_sessionDate", (q) => q.eq("batchId", batch._id)).take(100)))).flat().filter((row) => row.sessionKey.startsWith(DEMO_PREFIX));
    for (const session of allDemoSessions) { await remove(await ctx.db.query("attendanceRecords").withIndex("by_sessionId", (q) => q.eq("sessionId", session._id)).take(200)); await ctx.db.delete(session._id); removed += 1; }
    for (const enrolment of enrolments) {
      await remove(await ctx.db.query("monthlyFeeRecords").withIndex("by_enrolmentId_and_periodKey", (q) => q.eq("enrolmentId", enrolment._id)).take(20));
      const summary = await ctx.db.query("studentFinancialSummaries").withIndex("by_studentId", (q) => q.eq("studentId", enrolment.studentId)).unique();
      if (summary) { await ctx.db.delete(summary._id); removed += 1; }
      await ctx.db.delete(enrolment._id); removed += 1;
    }
    for (const batch of demoBatches) {
      await remove(await ctx.db.query("teacherBatchAssignments").withIndex("by_batchId_and_status", (q) => q.eq("batchId", batch._id).eq("status", "active")).take(100));
      await remove(await ctx.db.query("batchSchedules").withIndex("by_batchId_and_status", (q) => q.eq("batchId", batch._id).eq("status", "active")).take(100));
    }
    await remove((await ctx.db.query("studentCharges").take(1_000)).filter((row) => row.chargeNumber.startsWith(DEMO_PREFIX)));
    const demoPayments = (await ctx.db.query("payments").take(1_000)).filter((row) => row.paymentNumber.startsWith(DEMO_PREFIX));
    for (const payment of demoPayments) { await remove(await ctx.db.query("paymentAllocations").withIndex("by_paymentId", (q) => q.eq("paymentId", payment._id)).take(100)); await ctx.db.delete(payment._id); removed += 1; }
    await remove((await ctx.db.query("smsMessages").take(1_000)).filter((row) => row.idempotencyKey.startsWith(DEMO_PREFIX)));
    const notices = (await ctx.db.query("notices").take(200)).filter((row) => row.titleEn.startsWith("Demo: "));
    for (const notice of notices) { await remove(await ctx.db.query("noticeRecipients").withIndex("by_noticeId", (q) => q.eq("noticeId", notice._id)).take(500)); await ctx.db.delete(notice._id); removed += 1; }
    await remove((await ctx.db.query("admissionApplications").take(100)).filter((row) => row.submissionKey.startsWith(DEMO_PREFIX)));
    await remove((await ctx.db.query("dailyOperationalSummaries").withIndex("by_date", (q) => q.eq("date", "2026-07-22")).take(5)));
    return { removed };
  },
});
