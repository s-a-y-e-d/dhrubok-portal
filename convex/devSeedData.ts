import { v } from "convex/values";
import type { GenericId } from "convex/values";
import type { TableNamesInDataModel } from "convex/server";
import { env, internalMutation, mutation } from "./_generated/server";
import type { DataModel, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

async function requireDevOwner(ctx: MutationCtx) {
  if (env.DEV_IMPERSONATION_ENABLED !== "true") throw new Error("Development test data is disabled");
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const owner = await ctx.db.query("portalAccounts").withIndex("by_tokenIdentifier", q => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!owner || owner.role !== "owner" || owner.status !== "active") throw new Error("Only an active owner can create test data");
  return owner;
}

export const seedAcademics = mutation({
  args: {},
  returns: v.object({ created: v.boolean(), courses: v.number(), batches: v.number(), enrolments: v.number() }),
  handler: async (ctx) => {
    const owner = await requireDevOwner(ctx);
    const existingCourse = await ctx.db.query("courses").withIndex("by_code", q => q.eq("code", "TEST-SSC")).unique();
    if (existingCourse) {
      return { created: false, courses: 3, batches: 6, enrolments: 65 };
    }
    const teacherAccounts = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", q => q.eq("role", "teacher").eq("status", "active")).take(12);
    const studentAccounts = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", q => q.eq("role", "student").eq("status", "active")).take(65);
    if (teacherAccounts.length < 12 || studentAccounts.length < 65) throw new Error("Create the 12 teachers and 65 students first");
    const now = Date.now();
    const previousSession = await ctx.db.query("academicSessions").withIndex("by_startDate", q => q.eq("startDate", "2026-01-01")).unique();
    const academicSessionId = previousSession?._id ?? await ctx.db.insert("academicSessions", { nameBn: "শিক্ষাবর্ষ ২০২৬", nameEn: "Academic Year 2026", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", createdAt: now, updatedAt: now });
    const subjectSpecs = [["BAN", "বাংলা", "Bangla"], ["ENG", "ইংরেজি", "English"], ["MATH", "গণিত", "Mathematics"], ["SCI", "বিজ্ঞান", "Science"], ["PHY", "পদার্থবিজ্ঞান", "Physics"], ["CHEM", "রসায়ন", "Chemistry"]] as const;
    const subjectIds: Id<"subjects">[] = [];
    for (const [code, nameBn, nameEn] of subjectSpecs) {
      const existing = await ctx.db.query("subjects").withIndex("by_code", q => q.eq("code", code)).unique();
      subjectIds.push(existing?._id ?? await ctx.db.insert("subjects", { code, nameBn, nameEn, status: "active", createdAt: now, updatedAt: now }));
    }
    const courseSpecs = [
      { code: "TEST-SSC", slug: "test-ssc-2026", nameBn: "এসএসসি প্রস্তুতি", nameEn: "SSC Preparation" },
      { code: "TEST-HSC", slug: "test-hsc-2026", nameBn: "এইচএসসি বিজ্ঞান", nameEn: "HSC Science" },
      { code: "TEST-JSC", slug: "test-junior-2026", nameBn: "জুনিয়র একাডেমিক", nameEn: "Junior Academic" },
    ];
    const courseIds: Id<"courses">[] = [];
    for (let index = 0; index < courseSpecs.length; index++) {
      const courseId = await ctx.db.insert("courses", { academicSessionId, ...courseSpecs[index], shortDescriptionBn: "নিয়মিত ক্লাস ও পরীক্ষা", shortDescriptionEn: "Regular classes and exams", descriptionBn: "পরীক্ষা প্রস্তুতির পূর্ণাঙ্গ কোর্স।", descriptionEn: "Complete academic preparation course.", status: "active", isPublic: true, publicSortOrder: index + 1, createdAt: now, updatedAt: now, createdByAccountId: owner._id, updatedByAccountId: owner._id });
      courseIds.push(courseId);
      for (let subjectIndex = 0; subjectIndex < subjectIds.length; subjectIndex++) await ctx.db.insert("courseSubjects", { courseId, subjectId: subjectIds[subjectIndex], sortOrder: subjectIndex + 1, createdAt: now });
    }
    const batchIds: Id<"batches">[] = [];
    for (let index = 0; index < 6; index++) {
      batchIds.push(await ctx.db.insert("batches", { academicSessionId, courseId: courseIds[index % 3], code: `TEST-B${index + 1}`, slug: `test-batch-${index + 1}-2026`, nameBn: `ব্যাচ ${index + 1} — ${index % 2 ? "সন্ধ্যা" : "সকাল"}`, nameEn: `Batch ${index + 1} — ${index % 2 ? "Evening" : "Morning"}`, startDate: "2026-01-10", endDate: "2026-12-15", capacity: 30, status: "active", admissionOpen: index < 4, isPublic: index < 4, publicSortOrder: index + 1, createdAt: now, updatedAt: now }));
    }
    for (let index = 0; index < teacherAccounts.length; index++) {
      const account = teacherAccounts[index]; if (account.role !== "teacher") continue; const batchId = batchIds[index % batchIds.length];
      await ctx.db.insert("teacherBatchAssignments", { teacherId: account.teacherId, batchId, subjectId: subjectIds[index % subjectIds.length], startsOn: "2026-01-10", status: "active", createdAt: now, createdByAccountId: owner._id });
      await ctx.db.insert("batchSchedules", { batchId, teacherId: account.teacherId, subjectId: subjectIds[index % subjectIds.length], weekday: 1 + index % 6, startMinutes: index % 2 ? 1020 : 480, endMinutes: index % 2 ? 1110 : 570, effectiveFrom: "2026-01-10", status: "active", createdAt: now, updatedAt: now });
    }
    const feePlanIds: Id<"feePlans">[] = [];
    for (let index = 0; index < courseIds.length; index++) feePlanIds.push(await ctx.db.insert("feePlans", { courseId: courseIds[index], nameBn: `${courseSpecs[index].nameBn} মাসিক ফি`, nameEn: `${courseSpecs[index].nameEn} monthly fees`, status: "active", defaultDueDay: 15, createdAt: now, updatedAt: now }));
    let enrolmentCount = 0;
    for (let index = 0; index < studentAccounts.length; index++) {
      const account = studentAccounts[index]; if (account.role !== "student") continue; const courseIndex = index % 3;
      await ctx.db.insert("enrolments", { studentId: account.studentId, courseId: courseIds[courseIndex], batchId: batchIds[index % batchIds.length], academicSessionId, enrolledOn: "2026-01-10", status: "active", feePlanId: feePlanIds[courseIndex], agreedMonthlyAmountMinor: (1500 + courseIndex * 500) * 100, createdAt: now, updatedAt: now, createdByAccountId: owner._id }); enrolmentCount++;
    }
    return { created: true, courses: courseIds.length, batches: batchIds.length, enrolments: enrolmentCount };
  },
});

export const seedOperations = mutation({
  args: {},
  returns: v.object({ created: v.boolean(), attendanceRecords: v.number(), charges: v.number(), payments: v.number(), results: v.number(), materials: v.number(), notices: v.number() }),
  handler: async (ctx) => {
    const owner = await requireDevOwner(ctx);
    const previousExam = await ctx.db.query("exams").withIndex("by_examNumber", q => q.eq("examNumber", "TEST-EX-1")).unique();
    if (previousExam) return { created: false, attendanceRecords: 65, charges: 65, payments: 48, results: 65, materials: 6, notices: 2 };
    const courseCodes = ["TEST-SSC", "TEST-HSC", "TEST-JSC"];
    const courseIds: Id<"courses">[] = [];
    for (const code of courseCodes) { const row = await ctx.db.query("courses").withIndex("by_code", q => q.eq("code", code)).unique(); if (!row) throw new Error("Create test academics first"); courseIds.push(row._id); }
    const batchIds: Id<"batches">[] = [];
    for (let index = 1; index <= 6; index++) { const row = await ctx.db.query("batches").withIndex("by_code", q => q.eq("code", `TEST-B${index}`)).unique(); if (!row) throw new Error("Test batch is missing"); batchIds.push(row._id); }
    const subjectCodes = ["BAN", "ENG", "MATH", "SCI", "PHY", "CHEM"];
    const subjectIds: Id<"subjects">[] = [];
    for (const code of subjectCodes) { const row = await ctx.db.query("subjects").withIndex("by_code", q => q.eq("code", code)).unique(); if (!row) throw new Error("Test subject is missing"); subjectIds.push(row._id); }
    const teacherAccounts = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", q => q.eq("role", "teacher").eq("status", "active")).take(12);
    const teacherIds = teacherAccounts.flatMap(account => account.role === "teacher" ? [account.teacherId] : []);
    const teacherAccountIds = new Map<string, Id<"portalAccounts">>(); for (const account of teacherAccounts) if (account.role === "teacher") teacherAccountIds.set(account.teacherId, account._id);
    const activeEnrolments = await ctx.db.query("enrolments").withIndex("by_status", q => q.eq("status", "active")).take(200);
    const testEnrolments = activeEnrolments.filter(row => courseIds.some(courseId => courseId === row.courseId)).slice(0, 65);
    if (teacherIds.length < 6 || testEnrolments.length < 65) throw new Error("The connected test enrolments are incomplete");
    const now = Date.now(); let attendanceRecords = 0; let charges = 0; let payments = 0; let results = 0;
    const feeItemByCourse = new Map<string, Id<"feePlanItems">>();
    for (let index = 0; index < courseIds.length; index++) {
      const plans = await ctx.db.query("feePlans").withIndex("by_courseId_and_status", q => q.eq("courseId", courseIds[index]).eq("status", "active")).take(1); const plan = plans[0]; if (!plan) throw new Error("Test fee plan is missing");
      feeItemByCourse.set(courseIds[index], await ctx.db.insert("feePlanItems", { feePlanId: plan._id, chargeType: "monthly", labelBn: "মাসিক বেতন", labelEn: "Monthly tuition", amountMinor: (1500 + index * 500) * 100, recurrence: "monthly", dueDay: 15, sortOrder: 1, status: "active", createdAt: now, updatedAt: now }));
    }
    for (let index = 0; index < testEnrolments.length; index++) {
      const enrolment = testEnrolments[index]; const courseIndex = courseIds.findIndex(id => id === enrolment.courseId); const amount = (1500 + courseIndex * 500) * 100; const paid = index % 4 === 0 ? 0 : index % 4 === 1 ? Math.floor(amount / 2) : amount;
      const chargeId = await ctx.db.insert("studentCharges", { chargeNumber: `TEST-CH-${String(index + 1).padStart(4, "0")}`, studentId: enrolment.studentId, enrolmentId: enrolment._id, feePlanItemId: feeItemByCourse.get(enrolment.courseId), type: "monthly", periodKey: "2026-07", descriptionBn: "জুলাই ২০২৬ মাসিক বেতন", descriptionEn: "July 2026 monthly tuition", originalAmountMinor: amount, discountAmountMinor: 0, netAmountMinor: amount, paidAmountMinor: paid, dueDate: "2026-07-15", status: paid === 0 ? "due" : paid < amount ? "partially_paid" : "paid", generationKey: `test:2026-07:${enrolment.studentId}`, createdAt: now, createdByAccountId: owner._id }); charges++;
      if (paid > 0) { const paymentId = await ctx.db.insert("payments", { paymentNumber: `TEST-PAY-${String(index + 1).padStart(4, "0")}`, receiptNumber: `TEST-RCP-${String(index + 1).padStart(4, "0")}`, studentId: enrolment.studentId, amountMinor: paid, allocatedAmountMinor: paid, advanceAmountMinor: 0, method: index % 3 === 0 ? "bkash" : "cash", paidAt: now - index % 12 * 86400000, status: "posted", collectedByAccountId: owner._id, createdAt: now }); await ctx.db.insert("paymentAllocations", { paymentId, chargeId, studentId: enrolment.studentId, amountMinor: paid, chargeDescriptionBnSnapshot: "জুলাই ২০২৬ মাসিক বেতন", chargeDescriptionEnSnapshot: "July 2026 monthly tuition", createdAt: now }); payments++; }
      await ctx.db.insert("studentFinancialSummaries", { studentId: enrolment.studentId, totalChargedMinor: amount, totalDiscountMinor: 0, totalPaidMinor: paid, totalVoidedMinor: 0, outstandingMinor: amount - paid, advanceCreditMinor: 0, overdueMinor: amount - paid, lastPaymentAt: paid > 0 ? now : undefined, updatedAt: now });
    }
    for (let batchIndex = 0; batchIndex < batchIds.length; batchIndex++) {
      const roster = testEnrolments.filter(row => row.batchId === batchIds[batchIndex]); const teacherId = teacherIds[batchIndex]; const teacherAccountId = teacherAccountIds.get(teacherId) ?? owner._id;
      const classSessionId = await ctx.db.insert("classSessions", { sessionKey: `test:${batchIds[batchIndex]}:2026-07-10`, batchId: batchIds[batchIndex], teacherId, subjectId: subjectIds[batchIndex], sessionDate: "2026-07-10", startsAt: Date.parse("2026-07-10T08:00:00+06:00"), endsAt: Date.parse("2026-07-10T09:30:00+06:00"), topicBn: "অধ্যায় পুনরালোচনা", topicEn: "Chapter revision", status: "submitted", submittedAt: now, submittedByAccountId: teacherAccountId, rosterCount: roster.length, presentCount: roster.filter((_, index) => index % 7 !== 0).length, lateCount: roster.filter((_, index) => index % 7 === 0 && index % 2 === 0).length, absentCount: roster.filter((_, index) => index % 7 === 0 && index % 2 !== 0).length, createdAt: now });
      for (let index = 0; index < roster.length; index++) { await ctx.db.insert("attendanceRecords", { sessionId: classSessionId, batchId: batchIds[batchIndex], studentId: roster[index].studentId, enrolmentId: roster[index]._id, status: index % 7 !== 0 ? "present" : index % 2 === 0 ? "late" : "absent", submittedAt: now, submittedByAccountId: teacherAccountId }); attendanceRecords++; }
    }
    for (let courseIndex = 0; courseIndex < courseIds.length; courseIndex++) {
      const examId = await ctx.db.insert("exams", { examNumber: `TEST-EX-${courseIndex + 1}`, courseId: courseIds[courseIndex], nameBn: "মধ্যবর্ষ পরীক্ষা ২০২৬", nameEn: "Mid-year Examination 2026", examDate: "2026-06-25", mode: "both", mcqFullMarksScaled: 3000, writtenFullMarksScaled: 7000, totalFullMarksScaled: 10000, passMarksScaled: 3300, status: "published", publicationVersion: 1, publishedAt: now, publishedByAccountId: owner._id, createdAt: now, updatedAt: now, createdByAccountId: owner._id });
      await ctx.db.insert("examSubjects", { examId, subjectId: subjectIds[courseIndex], sortOrder: 1 }); for (const batchId of batchIds.filter((_, index) => index % 3 === courseIndex)) await ctx.db.insert("examBatches", { examId, batchId }); await ctx.db.insert("examTeacherAssignments", { examId, teacherId: teacherIds[courseIndex], createdAt: now });
      const roster = testEnrolments.filter(row => row.courseId === courseIds[courseIndex]);
      for (let index = 0; index < roster.length; index++) { const absent = index % 19 === 0; const total = absent ? undefined : 4200 + index * 370 % 5200; const mcq = total === undefined ? undefined : Math.min(2900, Math.floor(total * 0.3)); const written = total === undefined ? undefined : total - (mcq ?? 0); await ctx.db.insert("examResults", { examId, courseId: courseIds[courseIndex], studentId: roster[index].studentId, enrolmentId: roster[index]._id, participation: absent ? "absent" : "present", mcqScoreScaled: mcq, writtenScoreScaled: written, totalScoreScaled: total, passed: !absent && (total ?? 0) >= 3300, meritPosition: absent ? undefined : index + 1, entryStatus: "published", publicationVersion: 1, publishedAt: now, publishedParticipation: absent ? "absent" : "present", publishedMcqScoreScaled: mcq, publishedWrittenScoreScaled: written, publishedTotalScoreScaled: total, publishedPassed: !absent && (total ?? 0) >= 3300, publishedMeritPosition: absent ? undefined : index + 1, updatedAt: now }); results++; }
    }
    for (let index = 0; index < 6; index++) await ctx.db.insert("materials", { courseId: courseIds[index % 3], batchId: batchIds[index], subjectId: subjectIds[index], titleBn: `অনুশীলনী ${index + 1}`, titleEn: `Practice sheet ${index + 1}`, descriptionBn: "ক্লাসের অনুশীলন ও বাড়ির কাজ।", descriptionEn: "Class practice and homework.", kind: "link", externalUrl: "https://example.com/test-material", visibility: "batch", status: "published", publishedAt: now, createdByAccountId: teacherAccountIds.get(teacherIds[index]) ?? owner._id, createdAt: now, updatedAt: now });
    await ctx.db.insert("notices", { titleBn: "মডেল টেস্টের সময়সূচি", titleEn: "Model test schedule", bodyBn: "আগামী সপ্তাহে মডেল টেস্ট অনুষ্ঠিত হবে।", bodyEn: "The model test will be held next week.", audienceType: "all_students", status: "published", sendSms: false, publishedAt: now, createdByAccountId: owner._id, createdAt: now, updatedAt: now });
    await ctx.db.insert("notices", { titleBn: "অভিভাবক সভা", titleEn: "Guardian meeting", bodyBn: "শনিবার অভিভাবক সভা অনুষ্ঠিত হবে।", bodyEn: "A guardian meeting will be held on Saturday.", audienceType: "course", courseId: courseIds[0], status: "published", sendSms: false, publishedAt: now, createdByAccountId: owner._id, createdAt: now, updatedAt: now });
    return { created: true, attendanceRecords, charges, payments, results, materials: 6, notices: 2 };
  },
});

const TEST_COURSE_CODES = ["TEST-SSC", "TEST-HSC", "TEST-JSC"] as const;
const TEST_BATCH_CODES = ["TEST-B1", "TEST-B2", "TEST-B3", "TEST-B4", "TEST-B5", "TEST-B6"] as const;
const TEST_EXAM_NUMBERS = ["TEST-EX-1", "TEST-EX-2", "TEST-EX-3"] as const;

/**
 * Removes only the academic graph created by seedAcademics/seedOperations.
 * This is internal so it can only be invoked from the Convex dashboard/CLI or
 * another trusted backend function. Run it with dryRun=true before deleting.
 */
export const removeMockAcademics = internalMutation({
  args: { dryRun: v.boolean() },
  returns: v.object({
    dryRun: v.boolean(),
    matched: v.number(),
    deleted: v.number(),
    academicSessionDeleted: v.boolean(),
  }),
  handler: async (ctx, { dryRun }) => {
    const courseRows = [];
    for (const code of TEST_COURSE_CODES) {
      const row = await ctx.db.query("courses").withIndex("by_code", q => q.eq("code", code)).unique();
      if (row) courseRows.push(row);
    }
    const seedSession = await ctx.db.query("academicSessions").withIndex("by_startDate", q => q.eq("startDate", "2026-01-01")).unique();
    if (seedSession && seedSession.endDate === "2026-12-31" && seedSession.nameEn === "Academic Year 2026") {
      for (const status of ["draft", "active", "completed", "archived"] as const) {
        const rows = await ctx.db.query("courses").withIndex("by_academicSessionId_and_status", q => q.eq("academicSessionId", seedSession._id).eq("status", status)).take(100);
        courseRows.push(...rows.filter(row =>
          row.createdAt === seedSession.createdAt
          && row.code.startsWith("TEST-")
          && row.descriptionEn === "Complete academic preparation course.",
        ));
      }
    }
    const uniqueCourseRows = [...new Map(courseRows.map(row => [String(row._id), row])).values()];
    courseRows.length = 0;
    courseRows.push(...uniqueCourseRows);
    const courseIds = new Set(courseRows.map(row => String(row._id)));
    const sessionIds = new Set(courseRows.map(row => String(row.academicSessionId)));

    const batchRows = [];
    for (const code of TEST_BATCH_CODES) {
      const row = await ctx.db.query("batches").withIndex("by_code", q => q.eq("code", code)).unique();
      if (row && courseIds.has(String(row.courseId))) batchRows.push(row);
    }
    for (const course of courseRows) {
      for (const status of ["active", "completed", "archived"] as const) {
        batchRows.push(...await ctx.db.query("batches").withIndex("by_courseId_and_status", q => q.eq("courseId", course._id).eq("status", status)).take(100));
      }
    }
    const uniqueBatchRows = [...new Map(batchRows.map(row => [String(row._id), row])).values()];
    batchRows.length = 0;
    batchRows.push(...uniqueBatchRows);
    const enrolmentRows = [];
    for (const course of courseRows) {
      for (const status of ["active", "completed", "withdrawn", "transferred"] as const) {
        const rows = await ctx.db.query("enrolments").withIndex("by_courseId_and_status", q => q.eq("courseId", course._id).eq("status", status)).take(200);
        enrolmentRows.push(...rows);
      }
    }
    const studentIds = new Set(enrolmentRows.map(row => String(row.studentId)));

    const examRows = [];
    for (const examNumber of TEST_EXAM_NUMBERS) {
      const row = await ctx.db.query("exams").withIndex("by_examNumber", q => q.eq("examNumber", examNumber)).unique();
      if (row && courseIds.has(String(row.courseId))) examRows.push(row);
    }

    type TableId = GenericId<TableNamesInDataModel<DataModel>>;
    const rowsToDelete: Array<{ _id: TableId }> = [];
    const add = <T extends { _id: TableId }>(rows: T[]) => rowsToDelete.push(...rows);

    for (const exam of examRows) {
      const candidates = [];
      for (const status of ["included", "excluded"] as const) {
        candidates.push(...await ctx.db.query("examCandidates").withIndex("by_examId_and_status", q => q.eq("examId", exam._id).eq("status", status)).take(200));
      }
      for (const candidate of candidates) {
        add(await ctx.db.query("examSubjectResults").withIndex("by_candidateId", q => q.eq("candidateId", candidate._id)).take(20));
      }
      const publications = [];
      for (const status of ["processing", "published", "superseded"] as const) {
        publications.push(...await ctx.db.query("examPublications").withIndex("by_examId_and_status", q => q.eq("examId", exam._id).eq("status", status)).take(20));
      }
      for (const publication of publications) {
        const publishedResults = await ctx.db.query("examPublishedResults").withIndex("by_examId_and_version", q => q.eq("examId", exam._id).eq("version", publication.version)).take(200);
        for (const result of publishedResults) {
          add(await ctx.db.query("examPublishedSubjectResults").withIndex("by_publishedResultId_and_sortOrder", q => q.eq("publishedResultId", result._id)).take(20));
        }
        add(publishedResults);
      }
      add(publications);
      add(await ctx.db.query("examAuditEvents").withIndex("by_examId_and_createdAt", q => q.eq("examId", exam._id)).take(100));
      add(await ctx.db.query("examResults").withIndex("by_examId_and_studentId", q => q.eq("examId", exam._id)).take(200));
      add(await ctx.db.query("examTeacherAssignments").withIndex("by_examId", q => q.eq("examId", exam._id)).take(50));
      add(await ctx.db.query("examBatches").withIndex("by_examId", q => q.eq("examId", exam._id)).take(20));
      add(await ctx.db.query("examSubjects").withIndex("by_examId_and_sortOrder", q => q.eq("examId", exam._id)).take(20));
      add(candidates);
      add([exam]);
    }

    for (const batch of batchRows) {
      const sessions = await ctx.db.query("classSessions").withIndex("by_batchId_and_sessionDate", q => q.eq("batchId", batch._id).eq("sessionDate", "2026-07-10")).take(20);
      for (const session of sessions.filter(row => row.sessionKey.startsWith("test:"))) {
        add(await ctx.db.query("attendanceRecords").withIndex("by_sessionId", q => q.eq("sessionId", session._id)).take(200));
        add([session]);
      }
      for (const status of ["active", "ended"] as const) add(await ctx.db.query("teacherBatchAssignments").withIndex("by_batchId_and_status", q => q.eq("batchId", batch._id).eq("status", status)).take(50));
      for (const status of ["active", "cancelled"] as const) add(await ctx.db.query("batchSchedules").withIndex("by_batchId_and_status", q => q.eq("batchId", batch._id).eq("status", status)).take(50));
    }

    for (const enrolment of enrolmentRows) {
      for (const status of ["active", "ended"] as const) add(await ctx.db.query("discountPolicies").withIndex("by_enrolmentId_and_status", q => q.eq("enrolmentId", enrolment._id).eq("status", status)).take(20));
      const charges = await ctx.db.query("studentCharges").withIndex("by_enrolmentId_and_periodKey", q => q.eq("enrolmentId", enrolment._id).eq("periodKey", "2026-07")).take(10);
      for (const charge of charges.filter(row => row.chargeNumber.startsWith("TEST-CH-"))) {
        add(await ctx.db.query("paymentAllocations").withIndex("by_chargeId", q => q.eq("chargeId", charge._id)).take(10));
        add([charge]);
      }
    }

    for (let index = 1; index <= 65; index++) {
      const paymentNumber = `TEST-PAY-${String(index).padStart(4, "0")}`;
      const payment = await ctx.db.query("payments").withIndex("by_paymentNumber", q => q.eq("paymentNumber", paymentNumber)).unique();
      if (payment && studentIds.has(String(payment.studentId))) {
        add(await ctx.db.query("paymentAllocations").withIndex("by_paymentId", q => q.eq("paymentId", payment._id)).take(10));
        add([payment]);
      }
    }

    for (const course of courseRows) {
      add(await ctx.db.query("courseOperationalSnapshots").withIndex("by_courseId", q => q.eq("courseId", course._id)).take(5));
      add(await ctx.db.query("courseSubjects").withIndex("by_courseId_and_sortOrder", q => q.eq("courseId", course._id)).take(50));
      for (const status of ["active", "archived"] as const) {
        const plans = await ctx.db.query("feePlans").withIndex("by_courseId_and_status", q => q.eq("courseId", course._id).eq("status", status)).take(20);
        for (const plan of plans) {
          add(await ctx.db.query("feePlanItems").withIndex("by_feePlanId_and_sortOrder", q => q.eq("feePlanId", plan._id)).take(50));
        }
        add(plans);
      }
      for (const status of ["draft", "published", "archived"] as const) {
        add(await ctx.db.query("materials").withIndex("by_courseId_and_status", q => q.eq("courseId", course._id).eq("status", status)).take(100));
        const notices = await ctx.db.query("notices").withIndex("by_courseId_and_status", q => q.eq("courseId", course._id).eq("status", status)).take(50);
        for (const notice of notices) add(await ctx.db.query("noticeRecipients").withIndex("by_noticeId", q => q.eq("noticeId", notice._id)).take(200));
        add(notices);
      }
    }

    const globalSeedNotices = (await ctx.db.query("notices").withIndex("by_audienceType_and_status", q => q.eq("audienceType", "all_students").eq("status", "published")).take(100))
      .filter(row => row.titleEn === "Model test schedule" && row.bodyEn === "The model test will be held next week.");
    for (const notice of globalSeedNotices) add(await ctx.db.query("noticeRecipients").withIndex("by_noticeId", q => q.eq("noticeId", notice._id)).take(200));
    add(globalSeedNotices);

    const seededStudents = (await ctx.db.query("students").withIndex("by_status_and_admissionDate", q => q.eq("status", "active")).take(200))
      .filter(row => row.normalizedLoginEmail.endsWith("@test.dhrubok.local"));
    for (const student of seededStudents) {
      let hasEnrolment = false;
      for (const status of ["active", "completed", "withdrawn", "transferred"] as const) {
        hasEnrolment ||= Boolean(await ctx.db.query("enrolments").withIndex("by_studentId_and_status", q => q.eq("studentId", student._id).eq("status", status)).first());
      }
      if (!hasEnrolment) {
        const charges = await ctx.db.query("studentCharges").withIndex("by_studentId_and_dueDate", q => q.eq("studentId", student._id)).take(50);
        for (const charge of charges) {
          add(await ctx.db.query("paymentAllocations").withIndex("by_chargeId", q => q.eq("chargeId", charge._id)).take(20));
        }
        add(charges);
        const payments = await ctx.db.query("payments").withIndex("by_studentId_and_paidAt", q => q.eq("studentId", student._id)).take(50);
        for (const payment of payments) {
          add(await ctx.db.query("paymentAllocations").withIndex("by_paymentId", q => q.eq("paymentId", payment._id)).take(20));
        }
        add(payments);
        const summary = await ctx.db.query("studentFinancialSummaries").withIndex("by_studentId", q => q.eq("studentId", student._id)).unique();
        if (summary) add([summary]);
      }
    }

    add(enrolmentRows);
    add(batchRows);
    add(courseRows);

    const uniqueRows = [...new Map(rowsToDelete.map(row => [String(row._id), row])).values()];
    if (!dryRun) {
      for (const row of uniqueRows) await ctx.db.delete(row._id);
    }

    let academicSessionDeleted = false;
    if (!dryRun) {
      for (const sessionId of sessionIds) {
        const session = await ctx.db.get(sessionId as Id<"academicSessions">);
        if (!session || session.startDate !== "2026-01-01" || session.endDate !== "2026-12-31" || session.nameEn !== "Academic Year 2026") continue;
        let hasCourse = false;
        let hasBatch = false;
        for (const status of ["draft", "active", "completed", "archived"] as const) {
          hasCourse ||= Boolean(await ctx.db.query("courses").withIndex("by_academicSessionId_and_status", q => q.eq("academicSessionId", session._id).eq("status", status)).first());
        }
        for (const status of ["active", "completed", "archived"] as const) {
          hasBatch ||= Boolean(await ctx.db.query("batches").withIndex("by_academicSessionId_and_status", q => q.eq("academicSessionId", session._id).eq("status", status)).first());
        }
        if (!hasCourse && !hasBatch) {
          await ctx.db.delete(session._id);
          academicSessionDeleted = true;
        }
      }
    }

    return { dryRun, matched: uniqueRows.length, deleted: dryRun ? 0 : uniqueRows.length, academicSessionDeleted };
  },
});
