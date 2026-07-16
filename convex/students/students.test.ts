/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";

const discoveredModules = import.meta.glob("../**/*.ts");
const modules = Object.fromEntries(
  Object.entries(discoveredModules).map(([path, loader]) => [
    path.startsWith("./") ? `./students/${path.slice(2)}` : `./${path.replace(/^\.\.\//, "")}`,
    loader,
  ]),
);
const updateMyProfile = makeFunctionReference<"mutation">("students/self:updateMyProfile");
const requestSensitiveChange = makeFunctionReference<"mutation">("students/self:requestSensitiveChange");
const transferEnrolment = makeFunctionReference<"mutation">("students/owner:transferEnrolment");

async function seedStudent(t: ReturnType<typeof convexTest>) {
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
    const studentId = await ctx.db.insert("students", {
      studentNumber: "STD-2026-000001",
      displayName: "Test Student",
      loginEmail: "student@example.com",
      normalizedLoginEmail: "student@example.com",
      phone: "8801712345678",
      schoolCollege: "Example School",
      currentClass: "Class 10",
      guardianName: "Test Guardian",
      guardianPhone: "8801812345678",
      normalizedGuardianPhone: "8801812345678",
      guardianRelationship: "Parent",
      preferredSmsLocale: "bn",
      admissionDate: "2026-07-11",
      status: "active",
      searchText: "std-2026-000001 test student student@example.com example school test guardian 8801812345678",
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerAccountId,
      updatedByAccountId: ownerAccountId,
    });
    const studentAccountId = await ctx.db.insert("portalAccounts", {
      role: "student",
      status: "active",
      tokenIdentifier: "clerk|student",
      loginEmail: "student@example.com",
      normalizedLoginEmail: "student@example.com",
      studentId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerAccountId,
    });
    return { studentId, studentAccountId };
  });
}

describe("student profile permissions", () => {
  it("allows permitted direct fields but rejects direct guardian phone and login email fields", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedStudent(t);
    const student = t.withIdentity({ tokenIdentifier: "clerk|student", email: "student@example.com", emailVerified: true });
    await expect(student.mutation(updateMyProfile, { address: "New address", currentClass: "Class 11" })).resolves.toBeNull();
    await expect(student.mutation(updateMyProfile, { guardianPhone: "01912345678" })).rejects.toThrow();
    await expect(student.mutation(updateMyProfile, { loginEmail: "other@example.com" })).rejects.toThrow();
    const profile = await t.run((ctx) => ctx.db.get("students", seeded.studentId));
    expect(profile).toMatchObject({
      address: "New address",
      currentClass: "Class 11",
      guardianPhone: "8801812345678",
      loginEmail: "student@example.com",
    });
  });

  it("routes sensitive changes into a pending request without changing the profile", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedStudent(t);
    const student = t.withIdentity({ tokenIdentifier: "clerk|student", email: "student@example.com", emailVerified: true });
    const requestId = await student.mutation(requestSensitiveChange, {
      fieldKey: "guardianPhone",
      requestedValue: "01912345678",
      reason: "Guardian changed number",
    });
    const [profile, request] = await t.run(async (ctx) => Promise.all([
      ctx.db.get("students", seeded.studentId),
      ctx.db.get("studentProfileChangeRequests", requestId),
    ]));
    expect(profile?.guardianPhone).toBe("8801812345678");
    expect(request).toMatchObject({
      studentId: seeded.studentId,
      fieldKey: "guardianPhone",
      requestedValue: "8801912345678",
      status: "pending",
    });
  });
});

describe("student enrolment management", () => {
  it("transfers the current enrolment and creates one new active enrolment", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedStudent(t);
    const ids = await t.run(async (ctx) => {
      const owner = await ctx.db.query("portalAccounts").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", "clerk|owner")).unique();
      if (!owner) throw new Error("Owner missing");
      const now = Date.now();
      const courseFields = { shortDescriptionBn: "সংক্ষিপ্ত", shortDescriptionEn: "Short", descriptionBn: "বিবরণ", descriptionEn: "Description", status: "active" as const, isPublic: false, publicSortOrder: 0, createdAt: now, updatedAt: now, createdByAccountId: owner._id, updatedByAccountId: owner._id };
      const firstCourseId = await ctx.db.insert("courses", { code: "C-1", slug: "course-1", nameBn: "কোর্স ১", nameEn: "Course 1", ...courseFields });
      const secondCourseId = await ctx.db.insert("courses", { code: "C-2", slug: "course-2", nameBn: "কোর্স ২", nameEn: "Course 2", ...courseFields });
      const batchFields = { startDate: "2026-07-01", status: "active" as const, admissionOpen: true, isPublic: false, publicSortOrder: 0, createdAt: now, updatedAt: now };
      const firstBatchId = await ctx.db.insert("batches", { courseId: firstCourseId, code: "B-1", slug: "batch-1", nameBn: "ব্যাচ ১", nameEn: "Batch 1", ...batchFields });
      const secondBatchId = await ctx.db.insert("batches", { courseId: secondCourseId, code: "B-2", slug: "batch-2", nameBn: "ব্যাচ ২", nameEn: "Batch 2", ...batchFields });
      const oldEnrolmentId = await ctx.db.insert("enrolments", { studentId: seeded.studentId, courseId: firstCourseId, batchId: firstBatchId, enrolledOn: "2026-07-11", status: "active", agreedMonthlyAmountMinor: 75_000, createdAt: now, updatedAt: now, createdByAccountId: owner._id });
      return { secondCourseId, secondBatchId, oldEnrolmentId };
    });
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", email: "owner@example.com", emailVerified: true });
    const newEnrolmentId = await owner.mutation(transferEnrolment, { studentId: seeded.studentId, courseId: ids.secondCourseId, batchId: ids.secondBatchId, agreedMonthlyAmountMinor: 90_000, effectiveDate: "2026-07-16" });
    const [oldEnrolment, newEnrolment] = await t.run(async (ctx) => Promise.all([ctx.db.get("enrolments", ids.oldEnrolmentId), ctx.db.get("enrolments", newEnrolmentId)]));
    expect(oldEnrolment).toMatchObject({ status: "transferred", endedOn: "2026-07-16" });
    expect(newEnrolment).toMatchObject({ status: "active", courseId: ids.secondCourseId, batchId: ids.secondBatchId, agreedMonthlyAmountMinor: 90_000, enrolledOn: "2026-07-16" });
  });
});
