/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = Object.fromEntries([
  ...Object.entries(import.meta.glob("../**/*.ts")).map(([path, loader]) => [`./${path.replace(/^\.\.\//, "")}`, loader]),
  ...Object.entries(import.meta.glob("./*.ts")).map(([path, loader]) => [`./attendance/${path.slice(2)}`, loader]),
]);

async function fixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: "Owner", email: "owner@example.com", status: "active", createdAt: now, updatedAt: now });
    const ownerAccountId = await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "clerk|owner", loginEmail: "owner@example.com", normalizedLoginEmail: "owner@example.com", ownerProfileId, locale: "en", createdAt: now, updatedAt: now });
    const courseId = await ctx.db.insert("courses", { code: "HSC", slug: "hsc", nameBn: "এইচএসসি", nameEn: "HSC", shortDescriptionBn: "", shortDescriptionEn: "", descriptionBn: "", descriptionEn: "", status: "active", isPublic: true, publicSortOrder: 1, createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId, updatedByAccountId: ownerAccountId });
    const teacherId = await ctx.db.insert("teachers", { employeeCode: "T1", displayName: "Teacher", loginEmail: "teacher@example.com", normalizedLoginEmail: "teacher@example.com", phone: "8801711111111", bioBn: "", bioEn: "", qualificationsBn: "", qualificationsEn: "", status: "active", isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now });
    await ctx.db.insert("portalAccounts", { role: "teacher", status: "active", tokenIdentifier: "clerk|teacher", loginEmail: "teacher@example.com", normalizedLoginEmail: "teacher@example.com", teacherId, locale: "en", createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId });
    const batchId = await ctx.db.insert("batches", { courseId, code: "B1", slug: "b1", nameBn: "ব্যাচ ১", nameEn: "Batch 1", startDate: "2026-01-01", status: "active", admissionOpen: true, isPublic: true, publicSortOrder: 1, createdAt: now, updatedAt: now });
    const studentIds = [];
    for (const [index, status] of ["present", "absent"].entries()) {
      const studentId = await ctx.db.insert("students", { studentNumber: `ST${index + 1}`, displayName: `Student ${index + 1}`, loginEmail: `student${index + 1}@example.com`, normalizedLoginEmail: `student${index + 1}@example.com`, schoolCollege: "School", currentClass: "10", guardianName: "Guardian", guardianPhone: `880171234567${index}`, normalizedGuardianPhone: `880171234567${index}`, guardianRelationship: "Parent", preferredSmsLocale: "en", admissionDate: "2026-01-01", status: "active", searchText: `student ${index + 1}`, createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId, updatedByAccountId: ownerAccountId });
      const enrolmentId = await ctx.db.insert("enrolments", { studentId, courseId, batchId, enrolledOn: "2026-01-01", status: "active", createdAt: now, updatedAt: now, createdByAccountId: ownerAccountId });
      studentIds.push({ studentId, enrolmentId, status: status as "present" | "absent" });
    }
    const sessionId = await ctx.db.insert("classSessions", { sessionKey: "test-session", batchId, teacherId, sessionDate: "2026-07-11", startsAt: now, endsAt: now + 3_600_000, status: "open", rosterCount: 2, createdAt: now });
    return { ownerAccountId, teacherId, batchId, studentIds, sessionId };
  });
}

describe("immutable attendance submission", () => {
  it("lists scheduled and submitted classes for owners and excludes cancelled classes", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    await t.run(async (ctx) => {
      const base = (await ctx.db.get("classSessions", data.sessionId))!;
      const { _id: _baseId, _creationTime: _baseCreationTime, ...baseFields } = base;
      for (const [suffix, status] of [["scheduled", "scheduled"], ["submitted", "submitted"], ["cancelled", "cancelled"]] as const) {
        await ctx.db.insert("classSessions", { ...baseFields, sessionKey: `test-${suffix}`, status });
      }
    });
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", emailVerified: true });
    const sessions = await owner.query(api.attendance.functions.listMySessions, { sessionDate: "2026-07-11" });
    expect(sessions.map((session) => session.status).sort()).toEqual(["open", "scheduled", "submitted"]);
  });

  it("lets an owner open today's scheduled class and snapshots its roster count", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    await t.run((ctx) => ctx.db.patch("classSessions", data.sessionId, { sessionDate: today, status: "scheduled", rosterCount: 0 }));
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", emailVerified: true });
    await expect(owner.mutation(api.attendance.functions.openSession, { sessionId: data.sessionId })).resolves.toBeNull();
    const session = await t.run((ctx) => ctx.db.get("classSessions", data.sessionId));
    expect(session).toMatchObject({ status: "open", rosterCount: 2 });
  });

  it("requires every eligible student exactly once and queues only absent/late SMS", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", email: "owner@example.com", emailVerified: true });
    await expect(owner.mutation(api.attendance.functions.submit, { sessionId: data.sessionId, records: [{ studentId: data.studentIds[0].studentId, status: "present" }] })).rejects.toThrow("Every eligible student");
    await expect(owner.mutation(api.attendance.functions.submit, { sessionId: data.sessionId, records: data.studentIds.map(({ studentId, status }) => ({ studentId, status })) })).resolves.toEqual({ presentCount: 1, lateCount: 0, absentCount: 1, smsQueued: 1 });
    const messages = await t.run((ctx) => ctx.db.query("smsMessages").take(10));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ eventType: "attendance_absent", status: "queued" });
    await expect(owner.mutation(api.attendance.functions.submit, { sessionId: data.sessionId, records: data.studentIds.map(({ studentId, status }) => ({ studentId, status })) })).rejects.toThrow("Attendance already submitted");
  });

  it("rejects duplicate students", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", emailVerified: true });
    await expect(owner.mutation(api.attendance.functions.submit, { sessionId: data.sessionId, records: [
      { studentId: data.studentIds[0].studentId, status: "present" }, { studentId: data.studentIds[0].studentId, status: "absent" },
    ] })).rejects.toThrow("Duplicate student");
  });

  it("rejects an unassigned teacher", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const teacher = t.withIdentity({ tokenIdentifier: "clerk|teacher", emailVerified: true });
    await expect(teacher.mutation(api.attendance.functions.createSession, { batchId: data.batchId, teacherId: data.teacherId, sessionDate: "2026-07-12", startsAt: 1, endsAt: 2 })).rejects.toThrow("Unauthorized");
  });

  it("rejects a schedule from a different batch", async () => {
    const t = convexTest(schema, modules);
    const data = await fixture(t);
    const foreignScheduleId = await t.run(async (ctx) => {
      const now = Date.now();
      const batch = await ctx.db.get("batches", data.batchId);
      const foreignBatchId = await ctx.db.insert("batches", { courseId: batch!.courseId, code: "B2", slug: "b2", nameBn: "ব্যাচ ২", nameEn: "Batch 2", startDate: "2026-01-01", status: "active", admissionOpen: true, isPublic: true, publicSortOrder: 2, createdAt: now, updatedAt: now });
      return await ctx.db.insert("batchSchedules", { batchId: foreignBatchId, teacherId: data.teacherId, weekday: 6, startMinutes: 600, endMinutes: 660, effectiveFrom: "2026-01-01", status: "active", createdAt: now, updatedAt: now });
    });
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", emailVerified: true });
    await expect(owner.mutation(api.attendance.functions.createSession, { batchId: data.batchId, teacherId: data.teacherId, scheduleId: foreignScheduleId, sessionDate: "2026-07-11", startsAt: Date.parse("2026-07-11T10:00:00+06:00"), endsAt: Date.parse("2026-07-11T11:00:00+06:00") })).rejects.toThrow("Schedule does not match");
  });
});
