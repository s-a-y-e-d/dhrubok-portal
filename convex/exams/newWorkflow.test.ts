/// <reference types="vite/client" />
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import schema from "../schema";
import type { Id } from "../_generated/dataModel";

const discoveredModules = import.meta.glob("../**/*.ts");
const modules = Object.fromEntries(
  Object.entries(discoveredModules).map(([path, loader]) => [
    path.startsWith("./") ? `./exams/${path.slice(2)}` : `./${path.slice(3)}`,
    loader,
  ]),
);
const createDraft = makeFunctionReference<"mutation">(
  "exams/exams:createDraft",
);
const updateDraft = makeFunctionReference<"mutation">(
  "exams/exams:updateDraft",
);
const freezeRoster = makeFunctionReference<"mutation">(
  "exams/audience:freezeRoster",
);
const configureSubjects = makeFunctionReference<"mutation">(
  "exams/subjects:configure",
);
const configureAssignments = makeFunctionReference<"mutation">(
  "exams/assignments:configure",
);
const openMarksEntry = makeFunctionReference<"mutation">(
  "exams/assignments:openMarksEntry",
);
const saveDraft = makeFunctionReference<"mutation">("exams/marks:saveDraft");
const submitAssignment = makeFunctionReference<"mutation">(
  "exams/marks:submitAssignment",
);
const markReady = makeFunctionReference<"mutation">(
  "exams/review:markReadyForPublication",
);
const publish = makeFunctionReference<"mutation">("exams/publication:publish");
const reopen = makeFunctionReference<"mutation">("exams/publication:reopen");
const publicationHistory = makeFunctionReference<"query">(
  "exams/publication:history",
);
const publicationPreview = makeFunctionReference<"query">(
  "exams/publication:preview",
);
const detailMine = makeFunctionReference<"query">(
  "exams/studentResults:detailMine",
);
const audiencePreview = makeFunctionReference<"query">(
  "exams/audience:preview",
);
const listCandidates = makeFunctionReference<"query">(
  "exams/audience:listCandidates",
);
const entryGrid = makeFunctionReference<"query">("exams/marks:entryGrid");

it("preserves required exam fields when partially updating a draft", async () => {
  const t = convexTest(schema, modules);
  const data = await seedMultiBatch(t);
  const owner = t.withIdentity({ tokenIdentifier: "owner-multi" });
  const examId = await owner.mutation(createDraft, {
    courseId: data.courseId,
    nameBn: "মাসিক পরীক্ষা",
    nameEn: "Monthly exam",
    examDate: "2026-07-14",
    examType: "monthly",
    audienceMode: "single_batch",
  });

  await owner.mutation(updateDraft, {
    examId,
    setupDraftJson: JSON.stringify({ step: 5 }),
  });

  const exam = await t.run((ctx) => ctx.db.get("exams", examId));
  expect(exam).toMatchObject({
    courseId: data.courseId,
    nameBn: "মাসিক পরীক্ষা",
    nameEn: "Monthly exam",
    examDate: "2026-07-14",
    setupDraftJson: JSON.stringify({ step: 5 }),
  });
});

async function seedMultiBatch(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const ownerProfileId = await ctx.db.insert("ownerProfiles", {
      displayName: "Owner",
      email: "owner-multi@example.com",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const ownerAccountId = await ctx.db.insert("portalAccounts", {
      role: "owner",
      status: "active",
      tokenIdentifier: "owner-multi",
      loginEmail: "owner-multi@example.com",
      normalizedLoginEmail: "owner-multi@example.com",
      ownerProfileId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    const academicSessionId = await ctx.db.insert("academicSessions", {
      nameBn: "২০২৬",
      nameEn: "2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const courseId = await ctx.db.insert("courses", {
      academicSessionId,
      code: "MULTI",
      slug: "multi",
      nameBn: "বহু ব্যাচ কোর্স",
      nameEn: "Multi batch course",
      shortDescriptionBn: "",
      shortDescriptionEn: "",
      descriptionBn: "",
      descriptionEn: "",
      status: "active",
      isPublic: true,
      publicSortOrder: 1,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerAccountId,
      updatedByAccountId: ownerAccountId,
    });
    const subjectId = await ctx.db.insert("subjects", {
      code: "ENG",
      nameBn: "ইংরেজি",
      nameEn: "English",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("courseSubjects", {
      courseId,
      subjectId,
      sortOrder: 1,
      createdAt: now,
    });
    const batchIds = [];
    for (let index = 0; index < 2; index++) {
      batchIds.push(
        await ctx.db.insert("batches", {
          academicSessionId,
          courseId,
          code: `MB${index}`,
          slug: `mb-${index}`,
          nameBn: `ব্যাচ ${index + 1}`,
          nameEn: `Batch ${index + 1}`,
          status: "active",
          admissionOpen: true,
          isPublic: true,
          publicSortOrder: index,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
    const teacherId = await ctx.db.insert("teachers", {
      employeeCode: "TM",
      displayName: "Multi Teacher",
      loginEmail: "teacher-multi@example.com",
      normalizedLoginEmail: "teacher-multi@example.com",
      phone: "01700000000",
      bioBn: "",
      bioEn: "",
      qualificationsBn: "",
      qualificationsEn: "",
      status: "active",
      isPublic: false,
      publicSortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("portalAccounts", {
      role: "teacher",
      status: "active",
      tokenIdentifier: "teacher-multi",
      loginEmail: "teacher-multi@example.com",
      normalizedLoginEmail: "teacher-multi@example.com",
      teacherId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    const studentIds = [];
    for (let index = 0; index < 4; index++) {
      const studentId = await ctx.db.insert("students", {
        studentNumber: `MS${index}`,
        displayName: `Multi Student ${index}`,
        loginEmail: `ms${index}@example.com`,
        normalizedLoginEmail: `ms${index}@example.com`,
        schoolCollege: "School",
        currentClass: "10",
        guardianName: "Father",
        guardianPhone: `0171000000${index}`,
        normalizedGuardianPhone: `880171000000${index}`,
        guardianRelationship: "Father",
        motherName: "Mother",
        motherPhone: `0181000000${index}`,
        smsRecipient: "father",
        preferredSmsLocale: "en",
        admissionDate: "2026-01-01",
        status: "active",
        searchText: `multi student ${index}`,
        createdAt: now,
        updatedAt: now,
        createdByAccountId: ownerAccountId,
        updatedByAccountId: ownerAccountId,
      });
      await ctx.db.insert("portalAccounts", {
        role: "student",
        status: "active",
        tokenIdentifier: `student-multi-${index}`,
        loginEmail: `ms${index}@example.com`,
        normalizedLoginEmail: `ms${index}@example.com`,
        studentId,
        locale: "en",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("enrolments", {
        studentId,
        courseId,
        batchId: batchIds[index < 2 ? 0 : 1],
        academicSessionId,
        enrolledOn: "2026-01-01",
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdByAccountId: ownerAccountId,
      });
      studentIds.push(studentId);
    }
    return {
      ownerAccountId,
      academicSessionId,
      courseId,
      subjectId,
      batchIds,
      teacherId,
      studentIds,
    };
  });
}

it("runs the frozen subject-level workflow through immutable publication", async () => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const data = await t.run(async (ctx) => {
    const ownerProfileId = await ctx.db.insert("ownerProfiles", {
      displayName: "Owner",
      email: "owner@example.com",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const ownerAccountId = await ctx.db.insert("portalAccounts", {
      role: "owner",
      status: "active",
      tokenIdentifier: "owner-v2",
      loginEmail: "owner@example.com",
      normalizedLoginEmail: "owner@example.com",
      ownerProfileId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    const sessionId = await ctx.db.insert("academicSessions", {
      nameBn: "২০২৬",
      nameEn: "2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const courseId = await ctx.db.insert("courses", {
      academicSessionId: sessionId,
      code: "C",
      slug: "c",
      nameBn: "কোর্স",
      nameEn: "Course",
      shortDescriptionBn: "",
      shortDescriptionEn: "",
      descriptionBn: "",
      descriptionEn: "",
      status: "active",
      isPublic: true,
      publicSortOrder: 1,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerAccountId,
      updatedByAccountId: ownerAccountId,
    });
    const subjectId = await ctx.db.insert("subjects", {
      code: "M",
      nameBn: "গণিত",
      nameEn: "Math",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("courseSubjects", {
      courseId,
      subjectId,
      sortOrder: 1,
      createdAt: now,
    });
    const batchId = await ctx.db.insert("batches", {
      academicSessionId: sessionId,
      courseId,
      code: "B",
      slug: "b",
      nameBn: "ব্যাচ",
      nameEn: "Batch",
      status: "active",
      admissionOpen: true,
      isPublic: true,
      publicSortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    const teacherId = await ctx.db.insert("teachers", {
      employeeCode: "T",
      displayName: "Teacher",
      loginEmail: "teacher@example.com",
      normalizedLoginEmail: "teacher@example.com",
      phone: "01700000000",
      bioBn: "",
      bioEn: "",
      qualificationsBn: "",
      qualificationsEn: "",
      status: "active",
      isPublic: false,
      publicSortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("portalAccounts", {
      role: "teacher",
      status: "active",
      tokenIdentifier: "teacher-v2",
      loginEmail: "teacher@example.com",
      normalizedLoginEmail: "teacher@example.com",
      teacherId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    const studentIds = [];
    for (let index = 0; index < 2; index++) {
      const studentId = await ctx.db.insert("students", {
        studentNumber: `S${index}`,
        displayName: `Student ${index}`,
        loginEmail: `s${index}@example.com`,
        normalizedLoginEmail: `s${index}@example.com`,
        schoolCollege: "School",
        currentClass: "10",
        guardianName: "Father",
        guardianPhone: "01711111111",
        normalizedGuardianPhone: "8801711111111",
        guardianRelationship: "Father",
        motherName: "Mother",
        motherPhone: index === 0 ? "01711111111" : "01822222222",
        smsRecipient: "both",
        preferredSmsLocale: "en",
        admissionDate: "2026-01-01",
        status: "active",
        searchText: `student ${index}`,
        createdAt: now,
        updatedAt: now,
        createdByAccountId: ownerAccountId,
        updatedByAccountId: ownerAccountId,
      });
      await ctx.db.insert("portalAccounts", {
        role: "student",
        status: "active",
        tokenIdentifier: `student-v2-${index}`,
        loginEmail: `s${index}@example.com`,
        normalizedLoginEmail: `s${index}@example.com`,
        studentId,
        locale: "en",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("enrolments", {
        studentId,
        courseId,
        batchId,
        academicSessionId: sessionId,
        enrolledOn: "2026-01-01",
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdByAccountId: ownerAccountId,
      });
      studentIds.push(studentId);
    }
    return { courseId, subjectId, batchId, teacherId, studentIds };
  });
  const owner = t.withIdentity({ tokenIdentifier: "owner-v2" });
  const teacher = t.withIdentity({ tokenIdentifier: "teacher-v2" });
  const examId = await owner.mutation(createDraft, {
    courseId: data.courseId,
    nameBn: "মাসিক",
    nameEn: "Monthly",
    examDate: "2026-07-12",
    examType: "monthly",
    audienceMode: "single_batch",
  });
  await owner.mutation(freezeRoster, {
    examId,
    batchIds: [data.batchId],
    exclusions: [],
  });
  const [examSubjectId] = await owner.mutation(configureSubjects, {
    examId,
    subjects: [
      {
        subjectId: data.subjectId,
        mode: "both",
        mcqFullMarksScaled: 4000,
        writtenFullMarksScaled: 6000,
        totalFullMarksScaled: 10000,
        passMarksScaled: 5000,
        mcqPassMarksScaled: 1500,
        writtenPassMarksScaled: 2000,
        isRequired: true,
        sortOrder: 1,
      },
    ],
  });
  await owner.mutation(configureAssignments, {
    examId,
    assignments: [
      { examSubjectId, teacherId: data.teacherId, batchId: data.batchId },
    ],
  });
  await owner.mutation(openMarksEntry, { examId });
  const assignment = await t.run((ctx) =>
    ctx.db
      .query("examTeacherAssignments")
      .withIndex("by_examId", (q) => q.eq("examId", examId))
      .unique(),
  );
  const rows = await t.run((ctx) =>
    ctx.db
      .query("examSubjectResults")
      .withIndex("by_examId_and_studentId", (q) => q.eq("examId", examId))
      .take(10),
  );
  await teacher.mutation(saveDraft, {
    assignmentId: assignment!._id,
    rows: rows.map((row, index) => ({
      subjectResultId: row._id,
      participation: "present",
      mcqScoreScaled: 2000 + index * 100,
      writtenScoreScaled: 4000,
    })),
  });
  await teacher.mutation(submitAssignment, { assignmentId: assignment!._id });
  await owner.mutation(markReady, { examId });
  await expect(
    teacher.mutation(publish, { examId, acknowledged: true }),
  ).rejects.toThrow("Unauthorized");
  expect(
    await t
      .withIdentity({ tokenIdentifier: "student-v2-0" })
      .query(detailMine, { examId }),
  ).toBeNull();
  expect(await owner.query(publicationPreview, { examId })).toMatchObject({
    candidateCount: 2,
    recipientCount: 3,
    officialPopulation: 2,
  });
  expect(
    await owner.mutation(publish, { examId, acknowledged: true }),
  ).toMatchObject({ publicationVersion: 1, resultCount: 2, recipientCount: 3 });
  const mine = await t
    .withIdentity({ tokenIdentifier: "student-v2-0" })
    .query(detailMine, { examId });
  expect(mine.result).toMatchObject({
    grandTotalScaled: 6000,
    officialMeritPosition: 2,
    officialMeritPopulation: 2,
  });
  expect(mine.subjects).toHaveLength(1);
  const messages = await t.run((ctx) => ctx.db.query("smsMessages").take(10));
  expect(messages).toHaveLength(3);
  expect(new Set(messages.map((row) => row.normalizedRecipient)).size).toBe(2);

  await expect(owner.mutation(reopen, { examId, reason: "" })).rejects.toThrow(
    "reason",
  );
  await owner.mutation(reopen, { examId, reason: "Correct checked script" });
  expect(
    await t
      .withIdentity({ tokenIdentifier: "student-v2-0" })
      .query(detailMine, { examId }),
  ).toMatchObject({ result: { version: 1, grandTotalScaled: 6000 } });
  await teacher.mutation(saveDraft, {
    assignmentId: assignment!._id,
    rows: rows.map((row, index) => ({
      subjectResultId: row._id,
      participation: "present",
      mcqScoreScaled: 3000 + index * 100,
      writtenScoreScaled: 4000,
    })),
  });
  await teacher.mutation(submitAssignment, { assignmentId: assignment!._id });
  await owner.mutation(markReady, { examId });
  expect(
    await owner.mutation(publish, { examId, acknowledged: true }),
  ).toMatchObject({ publicationVersion: 2, resultCount: 2, recipientCount: 3 });
  const corrected = await t
    .withIdentity({ tokenIdentifier: "student-v2-0" })
    .query(detailMine, { examId });
  expect(corrected.result).toMatchObject({
    version: 2,
    grandTotalScaled: 7000,
  });
  const history = await owner.query(publicationHistory, { examId });
  expect(
    history.publications.map((row: { version: number; status: string }) => [
      row.version,
      row.status,
    ]),
  ).toEqual([
    [2, "published"],
    [1, "superseded"],
  ]);
  const correctedMessages = await t.run((ctx) =>
    ctx.db.query("smsMessages").take(20),
  );
  expect(correctedMessages).toHaveLength(6);
  expect(
    correctedMessages.filter((row) => row.eventType === "result_corrected"),
  ).toHaveLength(3);
  expect(new Set(correctedMessages.map((row) => row.idempotencyKey)).size).toBe(
    6,
  );
});

it("freezes selected batches and publishes overall plus per-batch merit", async () => {
  const t = convexTest(schema, modules);
  const data = await seedMultiBatch(t);
  const owner = t.withIdentity({ tokenIdentifier: "owner-multi" });
  const teacher = t.withIdentity({ tokenIdentifier: "teacher-multi" });
  const examId = await owner.mutation(createDraft, {
    courseId: data.courseId,
    nameBn: "নির্বাচিত ব্যাচ পরীক্ষা",
    nameEn: "Selected batches exam",
    examDate: "2026-07-13",
    examType: "term",
    audienceMode: "selected_batches",
    meritMode: "official_and_batch",
  });
  expect(
    await owner.query(audiencePreview, {
      examId,
      batchIds: data.batchIds,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).toMatchObject({ candidateCount: 4, duplicateStudents: [] });
  await owner.mutation(freezeRoster, {
    examId,
    batchIds: data.batchIds,
    exclusions: [],
  });
  const [examSubjectId] = await owner.mutation(configureSubjects, {
    examId,
    subjects: [
      {
        subjectId: data.subjectId,
        mode: "written",
        writtenFullMarksScaled: 10000,
        totalFullMarksScaled: 10000,
        passMarksScaled: 6000,
        isRequired: true,
        sortOrder: 1,
      },
    ],
  });
  await owner.mutation(configureAssignments, {
    examId,
    assignments: [{ examSubjectId, teacherId: data.teacherId }],
  });
  await owner.mutation(openMarksEntry, { examId });
  const assignment = await t.run((ctx) =>
    ctx.db
      .query("examTeacherAssignments")
      .withIndex("by_examId", (q) => q.eq("examId", examId))
      .unique(),
  );
  const rows = await t.run((ctx) =>
    ctx.db
      .query("examSubjectResults")
      .withIndex("by_examId_and_studentId", (q) => q.eq("examId", examId))
      .take(10),
  );
  const scores = new Map(
    data.studentIds.map((id, index) => [id, [9000, 8000, 9000, 5000][index]]),
  );
  await teacher.mutation(saveDraft, {
    assignmentId: assignment!._id,
    rows: rows.map((row) => ({
      subjectResultId: row._id,
      participation: "present",
      writtenScoreScaled: scores.get(row.studentId),
    })),
  });
  await teacher.mutation(submitAssignment, { assignmentId: assignment!._id });
  await owner.mutation(markReady, { examId });
  await t.run((ctx) =>
    ctx.db.patch("students", data.studentIds[3], { guardianPhone: "invalid" }),
  );
  expect(await owner.query(publicationPreview, { examId })).toMatchObject({
    candidateCount: 4,
    passCount: 3,
    failCount: 1,
    officialPopulation: 3,
    officialMeritScope: "selected_batches",
    recipientCount: 3,
  });
  expect(
    await owner.mutation(publish, { examId, acknowledged: true }),
  ).toMatchObject({ recipientCount: 3 });
  const results = await t.run((ctx) =>
    ctx.db
      .query("examPublishedResults")
      .withIndex("by_examId_and_version", (q) =>
        q.eq("examId", examId).eq("version", 1),
      )
      .take(10),
  );
  const byStudent = new Map(results.map((row) => [row.studentId, row]));
  expect(byStudent.get(data.studentIds[0])).toMatchObject({
    officialMeritPosition: 1,
    officialMeritPopulation: 3,
    batchMeritPosition: 1,
    batchMeritPopulation: 2,
  });
  expect(byStudent.get(data.studentIds[1])).toMatchObject({
    officialMeritPosition: 3,
    officialMeritPopulation: 3,
    batchMeritPosition: 2,
    batchMeritPopulation: 2,
  });
  expect(byStudent.get(data.studentIds[2])).toMatchObject({
    officialMeritPosition: 1,
    officialMeritPopulation: 3,
    batchMeritPosition: 1,
    batchMeritPopulation: 1,
  });
  expect(
    byStudent.get(data.studentIds[3])?.officialMeritPosition,
  ).toBeUndefined();
});

it("freezes all active course batches and ignores later enrolments", async () => {
  const t = convexTest(schema, modules);
  const data = await seedMultiBatch(t);
  const owner = t.withIdentity({ tokenIdentifier: "owner-multi" });
  const examId = await owner.mutation(createDraft, {
    courseId: data.courseId,
    nameBn: "সব ব্যাচ পরীক্ষা",
    nameEn: "All batches exam",
    examDate: "2026-07-13",
    examType: "final",
    audienceMode: "all_course_batches",
  });
  expect(
    await owner.query(audiencePreview, {
      examId,
      batchIds: [],
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).toMatchObject({ candidateCount: 4 });
  await owner.mutation(freezeRoster, { examId, batchIds: [], exclusions: [] });
  await t.run(async (ctx) => {
    const now = Date.now();
    const lateStudentId = await ctx.db.insert("students", {
      studentNumber: "LATE",
      displayName: "Later Student",
      loginEmail: "later@example.com",
      normalizedLoginEmail: "later@example.com",
      schoolCollege: "School",
      currentClass: "10",
      guardianName: "Father",
      guardianPhone: "01719999999",
      normalizedGuardianPhone: "8801719999999",
      guardianRelationship: "Father",
      motherName: "Mother",
      motherPhone: "01819999999",
      smsRecipient: "father",
      preferredSmsLocale: "en",
      admissionDate: "2026-07-13",
      status: "active",
      searchText: "later student",
      createdAt: now,
      updatedAt: now,
      createdByAccountId: data.ownerAccountId,
      updatedByAccountId: data.ownerAccountId,
    });
    await ctx.db.insert("enrolments", {
      studentId: lateStudentId,
      courseId: data.courseId,
      batchId: data.batchIds[0],
      academicSessionId: data.academicSessionId,
      enrolledOn: "2026-07-13",
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdByAccountId: data.ownerAccountId,
    });
  });
  const frozen = await owner.query(listCandidates, {
    examId,
    status: "included",
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(frozen.page).toHaveLength(4);
});

it("blocks duplicate roster enrolments and cross-teacher marks access", async () => {
  const t = convexTest(schema, modules);
  const data = await seedMultiBatch(t);
  const owner = t.withIdentity({ tokenIdentifier: "owner-multi" });
  const duplicateExamId = await owner.mutation(createDraft, {
    courseId: data.courseId,
    nameBn: "ডুপ্লিকেট পরীক্ষা",
    nameEn: "Duplicate exam",
    examDate: "2026-07-13",
    examType: "other",
    audienceMode: "selected_batches",
  });
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("enrolments", {
      studentId: data.studentIds[0],
      courseId: data.courseId,
      batchId: data.batchIds[1],
      academicSessionId: data.academicSessionId,
      enrolledOn: "2026-07-13",
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdByAccountId: data.ownerAccountId,
    });
  });
  const preview = await owner.query(audiencePreview, {
    examId: duplicateExamId,
    batchIds: data.batchIds,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(preview.duplicateStudents).toHaveLength(1);
  await expect(
    owner.mutation(freezeRoster, {
      examId: duplicateExamId,
      batchIds: data.batchIds,
      exclusions: [],
    }),
  ).rejects.toThrow("Duplicate");

  const otherTeacher = t.withIdentity({ tokenIdentifier: "teacher-other" });
  await t.run(async (ctx) => {
    const now = Date.now();
    const teacherId = await ctx.db.insert("teachers", {
      employeeCode: "OTHER",
      displayName: "Other Teacher",
      loginEmail: "teacher-other@example.com",
      normalizedLoginEmail: "teacher-other@example.com",
      phone: "01709999999",
      bioBn: "",
      bioEn: "",
      qualificationsBn: "",
      qualificationsEn: "",
      status: "active",
      isPublic: false,
      publicSortOrder: 2,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("portalAccounts", {
      role: "teacher",
      status: "active",
      tokenIdentifier: "teacher-other",
      loginEmail: "teacher-other@example.com",
      normalizedLoginEmail: "teacher-other@example.com",
      teacherId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
  });
  const validExamId = await owner.mutation(createDraft, {
    courseId: data.courseId,
    nameBn: "অধিকার পরীক্ষা",
    nameEn: "Access exam",
    examDate: "2026-07-14",
    examType: "other",
    audienceMode: "single_batch",
  });
  await owner.mutation(freezeRoster, {
    examId: validExamId,
    batchIds: [data.batchIds[0]],
    exclusions: [],
  });
  const [examSubjectId] = await owner.mutation(configureSubjects, {
    examId: validExamId,
    subjects: [
      {
        subjectId: data.subjectId,
        mode: "written",
        writtenFullMarksScaled: 10000,
        totalFullMarksScaled: 10000,
        passMarksScaled: 4000,
        isRequired: true,
        sortOrder: 1,
      },
    ],
  });
  await owner.mutation(configureAssignments, {
    examId: validExamId,
    assignments: [
      { examSubjectId, teacherId: data.teacherId, batchId: data.batchIds[0] },
    ],
  });
  await owner.mutation(openMarksEntry, { examId: validExamId });
  const assignment = await t.run((ctx) =>
    ctx.db
      .query("examTeacherAssignments")
      .withIndex("by_examId", (q) => q.eq("examId", validExamId))
      .unique(),
  );
  await expect(
    otherTeacher.query(entryGrid, {
      assignmentId: assignment!._id,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    otherTeacher.mutation(configureSubjects, {
      examId: validExamId,
      subjects: [],
    }),
  ).rejects.toThrow("Unauthorized");
});

it("initializes cohorts over one thousand subject rows in bounded jobs", async () => {
  vi.useFakeTimers();
  try {
    const t = convexTest(schema, modules);
    const data = await seedMultiBatch(t);
    const extraSubjectIds = await t.run(async (ctx) => {
      const now = Date.now();
      const ids = [];
      for (let subjectIndex = 1; subjectIndex <= 2; subjectIndex++) {
        const subjectId = await ctx.db.insert("subjects", {
          code: `EX${subjectIndex}`,
          nameBn: `বিষয় ${subjectIndex}`,
          nameEn: `Subject ${subjectIndex}`,
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("courseSubjects", {
          courseId: data.courseId,
          subjectId,
          sortOrder: subjectIndex + 1,
          createdAt: now,
        });
        ids.push(subjectId);
      }
      for (let index = 4; index < 334; index++) {
        const studentId = await ctx.db.insert("students", {
          studentNumber: `L${index}`,
          displayName: `Large Student ${index}`,
          loginEmail: `large${index}@example.com`,
          normalizedLoginEmail: `large${index}@example.com`,
          schoolCollege: "School",
          currentClass: "10",
          guardianName: "Father",
          guardianPhone: `017${String(index).padStart(8, "0")}`,
          normalizedGuardianPhone: `88017${String(index).padStart(8, "0")}`,
          guardianRelationship: "Father",
          motherName: "Mother",
          motherPhone: `018${String(index).padStart(8, "0")}`,
          smsRecipient: "father",
          preferredSmsLocale: "en",
          admissionDate: "2026-01-01",
          status: "active",
          searchText: `large student ${index}`,
          createdAt: now,
          updatedAt: now,
          createdByAccountId: data.ownerAccountId,
          updatedByAccountId: data.ownerAccountId,
        });
        await ctx.db.insert("enrolments", {
          studentId,
          courseId: data.courseId,
          batchId: data.batchIds[index % 2],
          academicSessionId: data.academicSessionId,
          enrolledOn: "2026-01-01",
          status: "active",
          createdAt: now,
          updatedAt: now,
          createdByAccountId: data.ownerAccountId,
        });
      }
      return ids;
    });
    const owner = t.withIdentity({ tokenIdentifier: "owner-multi" });
    const examId = await owner.mutation(createDraft, {
      courseId: data.courseId,
      nameBn: "বড় পরীক্ষা",
      nameEn: "Large exam",
      examDate: "2026-07-15",
      examType: "final",
      audienceMode: "all_course_batches",
    });
    await owner.mutation(freezeRoster, {
      examId,
      batchIds: [],
      exclusions: [],
    });
    const subjectIds = [data.subjectId, ...extraSubjectIds];
    const examSubjectIds = await owner.mutation(configureSubjects, {
      examId,
      subjects: subjectIds.map((subjectId, index) => ({
        subjectId,
        mode: "written" as const,
        writtenFullMarksScaled: 10000,
        totalFullMarksScaled: 10000,
        passMarksScaled: 4000,
        isRequired: true,
        sortOrder: index + 1,
      })),
    });
    await owner.mutation(configureAssignments, {
      examId,
      assignments: examSubjectIds.map((examSubjectId: Id<"examSubjects">) => ({
        examSubjectId,
        teacherId: data.teacherId,
      })),
    });
    expect(await owner.mutation(openMarksEntry, { examId })).toEqual({
      resultRowCount: 1002,
      initializing: true,
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const reconciled = await t.run(async (ctx) => ({
      exam: await ctx.db.get("exams", examId),
      count: (
        await ctx.db
          .query("examSubjectResults")
          .withIndex("by_examId_and_studentId", (q) => q.eq("examId", examId))
          .take(1100)
      ).length,
    }));
    expect(reconciled.exam?.status).toBe("marks_entry");
    expect(reconciled.count).toBe(1002);
    const teacher = t.withIdentity({ tokenIdentifier: "teacher-multi" });
    const assignments = await t.run((ctx) =>
      ctx.db
        .query("examTeacherAssignments")
        .withIndex("by_examId", (q) => q.eq("examId", examId))
        .take(10),
    );
    for (const assignment of assignments) {
      const rows = await t.run((ctx) =>
        ctx.db
          .query("examSubjectResults")
          .withIndex("by_examSubjectId_and_entryStatus", (q) =>
            q.eq("examSubjectId", assignment.examSubjectId!),
          )
          .take(400),
      );
      for (let offset = 0; offset < rows.length; offset += 50)
        await teacher.mutation(saveDraft, {
          assignmentId: assignment._id,
          rows: rows.slice(offset, offset + 50).map((row) => ({
            subjectResultId: row._id,
            participation: "present" as const,
            writtenScoreScaled: 5000,
          })),
        });
      await teacher.mutation(submitAssignment, {
        assignmentId: assignment._id,
      });
    }
    await owner.mutation(markReady, { examId });
    expect(
      await owner.mutation(publish, { examId, acknowledged: true }),
    ).toMatchObject({
      publicationVersion: 1,
      resultCount: 334,
      processing: true,
    });
    expect(
      await t
        .withIdentity({ tokenIdentifier: "student-multi-0" })
        .query(detailMine, { examId }),
    ).toBeNull();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const published = await t.run(async (ctx) => ({
      exam: await ctx.db.get("exams", examId),
      results: await ctx.db
        .query("examPublishedResults")
        .withIndex("by_examId_and_version", (q) =>
          q.eq("examId", examId).eq("version", 1),
        )
        .take(400),
    }));
    expect(published.exam?.status).toBe("published");
    expect(published.results).toHaveLength(334);
  } finally {
    vi.useRealTimers();
  }
}, 20_000);
