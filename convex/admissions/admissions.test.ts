/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const discoveredModules = import.meta.glob("../**/*.ts");
const modules = Object.fromEntries(
  Object.entries(discoveredModules).map(([path, loader]) => [
    path.startsWith("./")
      ? `./admissions/${path.slice(2)}`
      : `./${path.replace(/^\.\.\//, "")}`,
    loader,
  ]),
);
const submit = makeFunctionReference<"mutation">(
  "admissions/public:submitVerified",
);
const adjustRequestedSelection = makeFunctionReference<"mutation">(
  "admissions/owner:adjustRequestedSelection",
);
const rejectApplication = makeFunctionReference<"mutation">(
  "admissions/owner:rejectApplication",
);
const acceptApplication = makeFunctionReference<"mutation">(
  "admissions/owner:acceptApplication",
);
const createDirectAdmission = makeFunctionReference<"mutation">(
  "admissions/owner:createDirectAdmission",
);
const listOpenBatches = makeFunctionReference<"query">(
  "admissions/public:listOpenBatches",
);

async function seedAdmissions(t: ReturnType<typeof convexTest>) {
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
      tokenIdentifier: "clerk|owner",
      loginEmail: "owner@example.com",
      normalizedLoginEmail: "owner@example.com",
      ownerProfileId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    const removedSession = {
      nameBn: "২০২৬",
      nameEn: "2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await ctx.db.insert("coachingSettings", {
      nameBn: "ধ্রুবক",
      nameEn: "Dhrubok",
      shortNameBn: "ধ্রুবক",
      shortNameEn: "Dhrubok",
      addressBn: "ঢাকা",
      addressEn: "Dhaka",
      phone: "8801712345678",
      email: "office@example.com",
      timezone: "Asia/Dhaka",
      currency: "BDT",
      defaultLocale: "bn",
      defaultGuardianSmsLocale: "bn",
      monthlyDueDay: 15,
      receiptPrefix: "RCP",
      studentIdPrefix: "STD",
      applicationPrefix: "APP",
      receiptFooterBn: "ধন্যবাদ",
      receiptFooterEn: "Thank you",
      smsEnabled: false,
      publicAdmissionsOpen: true,
      createdAt: now,
      updatedAt: now,
      updatedByAccountId: ownerAccountId,
    });
    const courseId = await ctx.db.insert("courses", {
      code: "SCI",
      slug: "science",
      nameBn: "বিজ্ঞান",
      nameEn: "Science",
      shortDescriptionBn: "বিজ্ঞান",
      shortDescriptionEn: "Science",
      descriptionBn: "বিজ্ঞান কোর্স",
      descriptionEn: "Science course",
      status: "active",
      isPublic: true,
      publicSortOrder: 1,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerAccountId,
      updatedByAccountId: ownerAccountId,
    });
    const openBatchId = await ctx.db.insert("batches", {
      courseId,
      code: "SCI-A",
      slug: "science-a",
      nameBn: "বিজ্ঞান এ",
      nameEn: "Science A",
      startDate: "2026-01-01",
      status: "active",
      admissionOpen: true,
      isPublic: true,
      publicSortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    const alternateBatchId = await ctx.db.insert("batches", {
      courseId,
      code: "SCI-B",
      slug: "science-b",
      nameBn: "বিজ্ঞান বি",
      nameEn: "Science B",
      startDate: "2026-01-01",
      status: "active",
      admissionOpen: true,
      isPublic: true,
      publicSortOrder: 2,
      createdAt: now,
      updatedAt: now,
    });
    const closedBatchId = await ctx.db.insert("batches", {
      courseId,
      code: "SCI-C",
      slug: "science-c",
      nameBn: "বিজ্ঞান সি",
      nameEn: "Science C",
      startDate: "2026-01-01",
      status: "active",
      admissionOpen: false,
      isPublic: true,
      publicSortOrder: 3,
      createdAt: now,
      updatedAt: now,
    });
    return {
      ownerAccountId,
      courseId,
      openBatchId,
      alternateBatchId,
      closedBatchId,
    };
  });
}

function applicationInput(
  courseId: Id<"courses">,
  batchId: Id<"batches">,
  submissionKey: string,
) {
  return {
    submissionKey,
    honeypot: "",
    locale: "en" as const,
    studentDisplayName: "Test Student",
    studentEmail: "Student@Example.com",
    studentPhone: "01712345678",
    schoolCollege: "Example School",
    currentClass: "Class 10",
    guardianName: "Test Guardian",
    guardianPhone: "01812345678",
    guardianRelationship: "Parent",
    preferredSmsLocale: "bn" as const,
    requestedCourseId: courseId,
    requestedBatchId: batchId,
  };
}

describe("admission application backend", () => {
  it("allows an owner to admit a student without an application", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAdmissions(t);
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    const result = await owner.mutation(createDirectAdmission, {
      studentNumber: "STD-2026-0099",
      admissionDate: "2026-07-12",
      studentDisplayName: "Direct Student",
      studentEmail: "direct@example.com",
      schoolCollege: "Example School",
      currentClass: "Class 9",
      guardianName: "Direct Guardian",
      guardianPhone: "01712345678",
      guardianRelationship: "Parent",
      preferredSmsLocale: "bn",
      courseId: seeded.courseId,
      batchId: seeded.openBatchId,
      agreedMonthlyAmountMinor: 100_000,
      firstBillingMonth: "2026-07",
      initialAdmissionFeeMinor: 25_000,
    });
    const state = await t.run(async (ctx) => ({
      student: await ctx.db.get("students", result.studentId),
      enrolment: await ctx.db.get("enrolments", result.enrolmentId),
      account: await ctx.db
        .query("portalAccounts")
        .withIndex("by_studentId", (q) => q.eq("studentId", result.studentId))
        .unique(),
      applications: await ctx.db.query("admissionApplications").take(1),
      collections: await ctx.db.query("feeCollections").take(10),
    }));
    expect(state.student).toMatchObject({
      displayName: "Direct Student",
      status: "active",
    });
    expect(state.enrolment).toMatchObject({
      status: "active",
      batchId: seeded.openBatchId,
    });
    expect(state.account).toMatchObject({
      status: "reserved",
      role: "student",
    });
    expect(state.applications).toHaveLength(0);
    expect(state.collections).toHaveLength(1);
    expect(result.receiptNumber).toBeTruthy();
  });

  it("does not enumerate batches under a private course", async () => {
    const t = convexTest(schema, modules);
    const data = await seedAdmissions(t);
    expect(
      await t.query(listOpenBatches, { courseId: data.courseId }),
    ).toHaveLength(2);
    await t.run((ctx) =>
      ctx.db.patch("courses", data.courseId, { isPublic: false }),
    );
    expect(await t.query(listOpenBatches, { courseId: data.courseId })).toEqual(
      [],
    );
  });
  it("rejects a closed batch", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAdmissions(t);
    await expect(
      t.mutation(
        submit,
        applicationInput(
          seeded.courseId,
          seeded.closedBatchId,
          "closed-batch-key-0001",
        ),
      ),
    ).rejects.toThrow("batch is not open");
  });

  it("returns the same reference for an exact submission-key replay", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAdmissions(t);
    const input = applicationInput(
      seeded.courseId,
      seeded.openBatchId,
      "idempotency-key-000001",
    );
    const first = await t.mutation(submit, input);
    const replay = await t.mutation(submit, input);
    expect(replay).toMatchObject({
      applicationId: first.applicationId,
      applicationNumber: first.applicationNumber,
      submittedAt: first.submittedAt,
      replayed: true,
    });
    const applications = await t.run((ctx) =>
      ctx.db.query("admissionApplications").take(10),
    );
    expect(applications).toHaveLength(1);
  });

  it("allows an owner to adjust the requested open batch", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAdmissions(t);
    const created = await t.mutation(
      submit,
      applicationInput(
        seeded.courseId,
        seeded.openBatchId,
        "adjust-batch-key-00001",
      ),
    );
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    await expect(
      owner.mutation(adjustRequestedSelection, {
        applicationId: created.applicationId,
        requestedCourseId: seeded.courseId,
        requestedBatchId: seeded.alternateBatchId,
      }),
    ).resolves.toBeNull();
    const application = await t.run((ctx) =>
      ctx.db.get("admissionApplications", created.applicationId),
    );
    expect(application).toMatchObject({
      requestedBatchId: seeded.alternateBatchId,
      status: "under_review",
    });
  });

  it("rejects an application without creating a student", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAdmissions(t);
    const created = await t.mutation(
      submit,
      applicationInput(
        seeded.courseId,
        seeded.openBatchId,
        "reject-app-key-0000001",
      ),
    );
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    await owner.mutation(rejectApplication, {
      applicationId: created.applicationId,
      reason: "Requirements not met",
    });
    const application = await t.run((ctx) =>
      ctx.db.get("admissionApplications", created.applicationId),
    );
    const students = await t.run((ctx) => ctx.db.query("students").take(10));
    expect(application).toMatchObject({
      status: "rejected",
      rejectionReason: "Requirements not met",
    });
    expect(application?.acceptedStudentId).toBeUndefined();
    expect(students).toHaveLength(0);
  });

  it("converts an accepted application atomically and idempotently", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAdmissions(t);
    const created = await t.mutation(
      submit,
      applicationInput(
        seeded.courseId,
        seeded.openBatchId,
        "accept-app-key-0000001",
      ),
    );
    const owner = t.withIdentity({
      tokenIdentifier: "clerk|owner",
      email: "owner@example.com",
      emailVerified: true,
    });
    const input = {
      applicationId: created.applicationId,
      conversionKey: "conversion-key-0000001",
      studentNumber: "STD-2026-0001",
      admissionDate: "2026-07-11",
      confirmedCourseId: seeded.courseId,
      confirmedBatchId: seeded.openBatchId,
      agreedMonthlyAmountMinor: 100_000,
      admissionFeeMinor: 50_000,
      firstBillingMonth: "2026-07",
    };
    const first = await owner.mutation(acceptApplication, input);
    const replay = await owner.mutation(acceptApplication, input);
    expect(replay).toEqual({ ...first, replayed: true });
    const state = await t.run(async (ctx) => ({
      students: await ctx.db.query("students").collect(),
      enrolments: await ctx.db.query("enrolments").collect(),
      accounts: await ctx.db
        .query("portalAccounts")
        .withIndex("by_role_and_status", (q) =>
          q.eq("role", "student").eq("status", "reserved"),
        )
        .collect(),
      collections: await ctx.db.query("feeCollections").collect(),
      application: await ctx.db.get(
        "admissionApplications",
        created.applicationId,
      ),
    }));
    expect(state.students).toHaveLength(1);
    expect(state.enrolments).toHaveLength(1);
    expect(state.accounts).toHaveLength(1);
    expect(state.collections).toHaveLength(1);
    expect(state.application).toMatchObject({
      status: "accepted",
      acceptedStudentId: first.studentId,
      conversionKey: input.conversionKey,
    });
  });
});
