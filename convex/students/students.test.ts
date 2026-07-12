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
