/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";

const discoveredModules = import.meta.glob("../**/*.ts");
const modules = Object.fromEntries(
  Object.entries(discoveredModules).map(([path, loader]) => [
    path.startsWith("./") ? `./exams/${path.slice(2)}` : `./${path.slice(3)}`,
    loader,
  ]),
);
const createExam = makeFunctionReference<"mutation">("exams/functions:create");
const saveResult = makeFunctionReference<"mutation">(
  "exams/functions:saveResult",
);
const markResultReady = makeFunctionReference<"mutation">(
  "exams/functions:markResultReady",
);
const submitForOwnerReview = makeFunctionReference<"mutation">(
  "exams/functions:submitForOwnerReview",
);
const publish = makeFunctionReference<"mutation">("exams/functions:publish");
const reopen = makeFunctionReference<"mutation">("exams/functions:reopen");
const myPublishedResults = makeFunctionReference<"query">(
  "exams/functions:myPublishedResults",
);

async function fixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
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
      tokenIdentifier: "owner",
      loginEmail: "owner@example.com",
      normalizedLoginEmail: "owner@example.com",
      ownerProfileId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    const removedSession = ({
      nameBn: "2026",
      nameEn: "2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const courseId = await ctx.db.insert("courses", {
      code: "SSC",
      slug: "ssc",
      nameBn: "SSC",
      nameEn: "SSC",
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
      code: "MATH",
      nameEn: "Math",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("courseSubjects", {
      courseId,
      subjectId,
      sortOrder: 0,
      createdAt: now,
    });
    const teacherId = await ctx.db.insert("teachers", {
      employeeCode: "T1",
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
      tokenIdentifier: "teacher",
      loginEmail: "teacher@example.com",
      normalizedLoginEmail: "teacher@example.com",
      teacherId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    const batchIds = [];
    const students = [];
    for (let batchIndex = 0; batchIndex < 2; batchIndex += 1) {
      const batchId = await ctx.db.insert("batches", {
        courseId,
        code: `B${batchIndex + 1}`,
        slug: `b${batchIndex + 1}`,
        nameBn: `Batch ${batchIndex + 1}`,
        nameEn: `Batch ${batchIndex + 1}`,
        startDate: "2026-01-01",
        status: "active",
        admissionOpen: true,
        isPublic: true,
        publicSortOrder: batchIndex,
        createdAt: now,
        updatedAt: now,
      });
      batchIds.push(batchId);
      for (let offset = 0; offset < 2; offset += 1) {
        const index = batchIndex * 2 + offset;
        const studentId = await ctx.db.insert("students", {
          studentNumber: `S${index + 1}`,
          displayName: `Student ${index + 1}`,
          loginEmail: `student${index + 1}@example.com`,
          normalizedLoginEmail: `student${index + 1}@example.com`,
          schoolCollege: "School",
          currentClass: "10",
          guardianName: "Guardian",
          guardianPhone: `0170000000${index}`,
          normalizedGuardianPhone: `880170000000${index}`,
          guardianRelationship: "Parent",
          preferredSmsLocale: "en",
          admissionDate: "2026-01-01",
          status: "active",
          searchText: `student ${index + 1}`,
          createdAt: now,
          updatedAt: now,
          createdByAccountId: ownerAccountId,
          updatedByAccountId: ownerAccountId,
        });
        await ctx.db.insert("portalAccounts", {
          role: "student",
          status: "active",
          tokenIdentifier: `student-${index + 1}`,
          loginEmail: `student${index + 1}@example.com`,
          normalizedLoginEmail: `student${index + 1}@example.com`,
          studentId,
          locale: "en",
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("enrolments", {
          studentId,
          courseId,
          batchId,
          enrolledOn: "2026-01-01",
          status: "active",
          createdAt: now,
          updatedAt: now,
          createdByAccountId: ownerAccountId,
        });
        students.push(studentId);
      }
    }
    return { courseId, subjectId, teacherId, batchIds, students };
  });
}

async function makeExam(t: ReturnType<typeof convexTest>) {
  const data = await fixture(t);
  const owner = t.withIdentity({
    tokenIdentifier: "owner",
    emailVerified: true,
  });
  const examId = await owner.mutation(createExam, {
    courseId: data.courseId,
    nameBn: "Final",
    nameEn: "Final",
    examDate: "2026-07-11",
    mode: "both",
    mcqFullMarksScaled: 4000,
    writtenFullMarksScaled: 6000,
    totalFullMarksScaled: 10000,
    passMarksScaled: 5000,
    subjectIds: [data.subjectId],
    batchIds: data.batchIds,
    teacherAssignments: [{ teacherId: data.teacherId }],
  });
  return {
    ...data,
    examId,
    owner,
    teacher: t.withIdentity({
      tokenIdentifier: "teacher",
      emailVerified: true,
    }),
  };
}

describe("exam publication workflow", () => {
  it("computes totals, ranks across selected batches, hides drafts, and suppresses exam SMS", async () => {
    const t = convexTest(schema, modules);
    const data = await makeExam(t);
    const before = await t
      .withIdentity({ tokenIdentifier: "student-1" })
      .query(myPublishedResults, {
        paginationOpts: { numItems: 10, cursor: null },
      });
    expect(before.page).toEqual([]);
    const scores = [
      [3500, 5500],
      [3000, 5000],
      [3000, 5000],
      [2500, 4500],
    ];
    for (let index = 0; index < data.students.length; index += 1) {
      const [mcqScoreScaled, writtenScoreScaled] = scores[index];
      const calculated = await data.teacher.mutation(saveResult, {
        examId: data.examId,
        studentId: data.students[index],
        participation: "present",
        mcqScoreScaled,
        writtenScoreScaled,
      });
      expect(calculated.totalScoreScaled).toBe(
        mcqScoreScaled + writtenScoreScaled,
      );
      await data.teacher.mutation(markResultReady, {
        examId: data.examId,
        studentId: data.students[index],
      });
    }
    await data.owner.mutation(submitForOwnerReview, { examId: data.examId });
    await expect(
      data.teacher.mutation(publish, { examId: data.examId }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      data.owner.mutation(publish, { examId: data.examId }),
    ).resolves.toEqual({ publicationVersion: 1, recipientCount: 0 });
    const rows = await t.run((ctx) =>
      ctx.db
        .query("examResults")
        .withIndex("by_examId_and_totalScoreScaled", (q) =>
          q.eq("examId", data.examId),
        )
        .take(10),
    );
    const ranks = rows
      .sort((a, b) => (b.totalScoreScaled ?? 0) - (a.totalScoreScaled ?? 0))
      .map((row) => row.meritPosition);
    expect(ranks).toEqual([1, 2, 2, 4]);
    const messages = await t.run((ctx) => ctx.db.query("smsMessages").take(10));
    expect(messages).toHaveLength(0);
    const after = await t
      .withIdentity({ tokenIdentifier: "student-1" })
      .query(myPublishedResults, {
        paginationOpts: { numItems: 10, cursor: null },
      });
    expect(after.page).toHaveLength(1);
    expect(after.page[0]).toMatchObject({
      publicationVersion: 1,
      meritPosition: 1,
    });
    expect(after.page[0]).not.toHaveProperty("enteredByAccountId");
  });

  it("rejects invalid marks and an unresolved roster", async () => {
    const t = convexTest(schema, modules);
    const data = await makeExam(t);
    await expect(
      data.teacher.mutation(saveResult, {
        examId: data.examId,
        studentId: data.students[0],
        participation: "present",
        mcqScoreScaled: 4001,
        writtenScoreScaled: 1000,
      }),
    ).rejects.toThrow("MCQ score cannot exceed full marks");
    await expect(
      data.owner.mutation(submitForOwnerReview, { examId: data.examId }),
    ).rejects.toThrow("Every roster result must be complete and ready");
  });

  it("increments publication version without sending correction SMS", async () => {
    const t = convexTest(schema, modules);
    const data = await makeExam(t);
    for (const studentId of data.students) {
      await data.teacher.mutation(saveResult, {
        examId: data.examId,
        studentId,
        participation: "present",
        mcqScoreScaled: 3000,
        writtenScoreScaled: 4000,
      });
      await data.teacher.mutation(markResultReady, {
        examId: data.examId,
        studentId,
      });
    }
    await data.owner.mutation(submitForOwnerReview, { examId: data.examId });
    await data.owner.mutation(publish, { examId: data.examId });
    await data.owner.mutation(reopen, {
      examId: data.examId,
      reason: "Correction required",
    });
    const whileReopened = await t
      .withIdentity({ tokenIdentifier: "student-1" })
      .query(myPublishedResults, {
        paginationOpts: { numItems: 10, cursor: null },
      });
    expect(whileReopened.page[0]).toMatchObject({
      publicationVersion: 1,
      totalScoreScaled: 7000,
    });
    for (const [index, studentId] of data.students.entries()) {
      if (index === 0)
        await data.teacher.mutation(saveResult, {
          examId: data.examId,
          studentId,
          participation: "present",
          mcqScoreScaled: 3500,
          writtenScoreScaled: 4000,
        });
      await data.teacher.mutation(markResultReady, {
        examId: data.examId,
        studentId,
      });
    }
    await data.owner.mutation(submitForOwnerReview, { examId: data.examId });
    await expect(
      data.owner.mutation(publish, { examId: data.examId }),
    ).resolves.toEqual({ publicationVersion: 2, recipientCount: 0 });
    const messages = await t.run((ctx) => ctx.db.query("smsMessages").take(20));
    expect(messages).toHaveLength(0);
  });
});
