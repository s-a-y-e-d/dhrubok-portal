/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("realistic coaching-centre scale", () => {
  it("serves summaries and bounded queues with 100 students, 50 batches, 15 teachers, and 100 SMS events", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const now = Date.now();
      const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: "Scale Owner", email: "owner@example.com", status: "active", createdAt: now, updatedAt: now });
      const ownerId = await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "scale-owner", loginEmail: "owner@example.com", normalizedLoginEmail: "owner@example.com", ownerProfileId, locale: "en", createdAt: now, updatedAt: now });
      const sessionId = await ctx.db.insert("academicSessions", { nameBn: "2026", nameEn: "2026", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", createdAt: now, updatedAt: now });
      const courseId = await ctx.db.insert("courses", { academicSessionId: sessionId, code: "SCALE", slug: "scale", nameBn: "Scale", nameEn: "Scale", shortDescriptionBn: "", shortDescriptionEn: "", descriptionBn: "", descriptionEn: "", status: "active", isPublic: false, publicSortOrder: 0, createdAt: now, updatedAt: now, createdByAccountId: ownerId, updatedByAccountId: ownerId });
      const teacherIds = [];
      for (let index = 0; index < 15; index += 1) {
        const teacherId = await ctx.db.insert("teachers", { employeeCode: `T-${index}`, displayName: `Teacher ${index}`, loginEmail: `teacher${index}@example.com`, normalizedLoginEmail: `teacher${index}@example.com`, phone: `8801710000${String(index).padStart(3, "0")}`, bioBn: "", bioEn: "", qualificationsBn: "", qualificationsEn: "", status: "active", isPublic: false, publicSortOrder: index, createdAt: now, updatedAt: now });
        teacherIds.push(teacherId);
        await ctx.db.insert("portalAccounts", { role: "teacher", status: "active", tokenIdentifier: `scale-teacher-${index}`, loginEmail: `teacher${index}@example.com`, normalizedLoginEmail: `teacher${index}@example.com`, teacherId, locale: "en", createdAt: now, updatedAt: now, createdByAccountId: ownerId });
      }
      const batchIds = [];
      for (let index = 0; index < 50; index += 1) {
        const batchId = await ctx.db.insert("batches", { academicSessionId: sessionId, courseId, code: `B-${index}`, slug: `batch-${index}`, nameBn: `Batch ${index}`, nameEn: `Batch ${index}`, capacity: 30, status: "active", admissionOpen: false, isPublic: false, publicSortOrder: index, createdAt: now, updatedAt: now });
        batchIds.push(batchId);
        await ctx.db.insert("teacherBatchAssignments", { teacherId: teacherIds[index % teacherIds.length], batchId, startsOn: "2026-01-01", status: "active", createdAt: now, createdByAccountId: ownerId });
      }
      for (let index = 0; index < 100; index += 1) {
        const studentId = await ctx.db.insert("students", { studentNumber: `ST-${String(index).padStart(4, "0")}`, displayName: `Student ${index}`, loginEmail: `student${index}@example.com`, normalizedLoginEmail: `student${index}@example.com`, schoolCollege: "Scale School", currentClass: "10", guardianName: `Guardian ${index}`, guardianPhone: `8801810000${String(index).padStart(3, "0")}`, normalizedGuardianPhone: `8801810000${String(index).padStart(3, "0")}`, guardianRelationship: "Parent", preferredSmsLocale: "en", admissionDate: "2026-01-01", status: "active", searchText: `student ${index}`, createdAt: now, updatedAt: now, createdByAccountId: ownerId, updatedByAccountId: ownerId });
        await ctx.db.insert("enrolments", { studentId, courseId, batchId: batchIds[index % batchIds.length], academicSessionId: sessionId, enrolledOn: "2026-01-01", status: "active", createdAt: now, updatedAt: now, createdByAccountId: ownerId });
        await ctx.db.insert("smsMessages", { idempotencyKey: `scale:${index}`, eventType: "due_reminder", relatedEntityType: "scale", relatedEntityId: String(index), studentId, guardianPhone: `8801810000${String(index).padStart(3, "0")}`, normalizedRecipient: `8801810000${String(index).padStart(3, "0")}`, locale: "en", body: `Scale message ${index}`, segmentEstimate: 1, status: index % 10 === 0 ? "failed" : "queued", provider: "sms_bd", attemptCount: index % 10 === 0 ? 1 : 0, nextAttemptAt: now, createdAt: now + index, updatedAt: now + index });
      }
    });
    await t.mutation(internal.reports.summaries.refreshDailyInternal, { date: "2026-07-11" });
    const owner = t.withIdentity({ tokenIdentifier: "scale-owner", emailVerified: true });
    const dashboard = await owner.query(api.reports.dashboards.owner, { date: "2026-07-11" });
    expect(dashboard).toMatchObject({ activeStudents: 100, activeBatches: 50 });
    expect(dashboard.smsFailures.value).toBe(10);
    const messages = await owner.query(api.messaging.functions.list, { paginationOpts: { numItems: 50, cursor: null } });
    expect(messages.page).toHaveLength(50);
    expect(messages.isDone).toBe(false);
    const teacher = t.withIdentity({ tokenIdentifier: "scale-teacher-0", emailVerified: true });
    const assigned = await teacher.query(api.academics.readModels.teacherAssignedBatches, {});
    expect(assigned.length).toBeGreaterThanOrEqual(3);
  }, 20_000);
});
