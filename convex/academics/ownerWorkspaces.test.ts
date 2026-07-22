/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

const discoveredModules = import.meta.glob("../**/*.ts");
const modules = Object.fromEntries(
  Object.entries(discoveredModules).map(([path, loader]) => [
    path.startsWith("./")
      ? `./academics/${path.slice(2)}`
      : `./${path.replace(/^\.\.\//, "")}`,
    loader,
  ]),
);

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", {
      displayName: "Owner",
      email: "owner@example.com",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const ownerId = await ctx.db.insert("portalAccounts", {
      role: "owner",
      status: "active",
      tokenIdentifier: "owner-workspaces",
      loginEmail: "owner@example.com",
      normalizedLoginEmail: "owner@example.com",
      ownerProfileId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    const teacherId = await ctx.db.insert("teachers", {
      employeeCode: "T1",
      displayName: "Teacher One",
      loginEmail: "teacher@example.com",
      normalizedLoginEmail: "teacher@example.com",
      phone: "01700000000",
      bioBn: "",
      bioEn: "",
      qualificationsBn: "",
      qualificationsEn: "",
      status: "active",
      isPublic: false,
      publicSortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("portalAccounts", {
      role: "teacher",
      status: "reserved",
      loginEmail: "teacher@example.com",
      normalizedLoginEmail: "teacher@example.com",
      teacherId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerId,
    });
    const subjectId = await ctx.db.insert("subjects", {
      code: "MATH",
      nameEn: "Mathematics",
      createdAt: now,
      updatedAt: now,
    });
    const courseId = await ctx.db.insert("courses", {
      code: "SSC",
      slug: "ssc",
      nameBn: "এসএসসি",
      nameEn: "SSC",
      shortDescriptionBn: "সংক্ষিপ্ত",
      shortDescriptionEn: "Short",
      descriptionBn: "বিস্তারিত",
      descriptionEn: "Details",
      status: "active",
      isPublic: false,
      publicSortOrder: 0,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerId,
      updatedByAccountId: ownerId,
    });
    await ctx.db.insert("courseSubjects", {
      courseId,
      subjectId,
      sortOrder: 0,
      createdAt: now,
    });
    await ctx.db.insert("courseTeacherDefaults", {
      courseId,
      subjectId,
      teacherId,
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdByAccountId: ownerId,
      updatedByAccountId: ownerId,
    });
    return { courseId, teacherId, subjectId };
  });
  return {
    t,
    owner: t.withIdentity({ tokenIdentifier: "owner-workspaces" }),
    ...ids,
  };
}

describe("owner batch and teacher workspaces", () => {
  it("creates a complete batch atomically from course defaults", async () => {
    const { t, owner, courseId, teacherId, subjectId } = await fixture();
    const batchId = await owner.mutation(
      api.academics.batchWorkspace.createWithRoutine,
      {
        courseId,
        code: "SSC-27",
        nameBn: "ব্যাচ ২০২৭",
        nameEn: "Batch 2027",
        startDate: "2027-01-01",
        routine: [
          {
            weekday: 1,
            startMinutes: 600,
            endMinutes: 660,
            teacherId,
            subjectId,
          },
        ],
      },
    );
    const graph = await t.run(async (ctx) => ({
      batch: await ctx.db.get("batches", batchId),
      assignments: await ctx.db
        .query("teacherBatchAssignments")
        .withIndex("by_batchId_and_status", (q) =>
          q.eq("batchId", batchId).eq("status", "active"),
        )
        .take(10),
      schedules: await ctx.db
        .query("batchSchedules")
        .withIndex("by_batchId_and_status", (q) =>
          q.eq("batchId", batchId).eq("status", "active"),
        )
        .take(10),
    }));
    expect(graph.batch).toMatchObject({
      status: "active",
      admissionOpen: true,
      isPublic: true,
    });
    expect(graph.assignments).toHaveLength(1);
    expect(graph.schedules).toHaveLength(1);
  });

  it("blocks teacher deactivation while active batch work remains", async () => {
    const { owner, courseId, teacherId, subjectId } = await fixture();
    await owner.mutation(api.academics.batchWorkspace.createWithRoutine, {
      courseId,
      code: "SSC-28",
      nameBn: "ব্যাচ ২০২৮",
      nameEn: "Batch 2028",
      startDate: "2028-01-01",
      routine: [
        {
          weekday: 2,
          startMinutes: 600,
          endMinutes: 660,
          teacherId,
          subjectId,
        },
      ],
    });
    await expect(
      owner.mutation(api.academics.teacherWorkspace.setActiveState, {
        teacherId,
        active: false,
      }),
    ).rejects.toThrow("Resolve active batch assignments");
  });

  it("updates batch details and replaces the future routine atomically", async () => {
    const { t, owner, courseId, teacherId, subjectId } = await fixture();
    const batchId = await owner.mutation(
      api.academics.batchWorkspace.createWithRoutine,
      {
        courseId,
        code: "SSC-29",
        nameBn: "ব্যাচ ২০২৯",
        nameEn: "Batch 2029",
        startDate: "2029-01-01",
        routine: [
          {
            weekday: 1,
            startMinutes: 600,
            endMinutes: 660,
            teacherId,
            subjectId,
          },
        ],
      },
    );
    await owner.mutation(api.academics.batchWorkspace.updateWithRoutine, {
      batchId,
      code: "SSC-29-A",
      nameBn: "সকাল ব্যাচ ২০২৯",
      nameEn: "Morning Batch 2029",
      startDate: "2029-01-01",
      effectiveFrom: "2029-02-01",
      admissionOpen: false,
      isPublic: false,
      routine: [
        {
          weekday: 3,
          startMinutes: 720,
          endMinutes: 780,
          teacherId,
          subjectId,
        },
      ],
    });
    const graph = await t.run(async (ctx) => ({
      batch: await ctx.db.get("batches", batchId),
      activeSchedules: await ctx.db
        .query("batchSchedules")
        .withIndex("by_batchId_and_status", (q) =>
          q.eq("batchId", batchId).eq("status", "active"),
        )
        .take(10),
      cancelledSchedules: await ctx.db
        .query("batchSchedules")
        .withIndex("by_batchId_and_status", (q) =>
          q.eq("batchId", batchId).eq("status", "cancelled"),
        )
        .take(10),
    }));
    expect(graph.batch).toMatchObject({
      code: "SSC-29-A",
      nameEn: "Morning Batch 2029",
      admissionOpen: false,
      isPublic: false,
    });
    expect(graph.activeSchedules).toHaveLength(1);
    expect(graph.activeSchedules[0]).toMatchObject({
      weekday: 3,
      startMinutes: 720,
      effectiveFrom: "2029-02-01",
    });
    expect(graph.cancelledSchedules).toHaveLength(1);
    expect(graph.cancelledSchedules[0]).toMatchObject({
      effectiveUntil: "2029-01-31",
    });
  });
});

describe("owner schedule workspace", () => {
  it("creates, validates, reschedules, and cancels one extra class", async () => {
    const { t, owner, courseId, teacherId, subjectId } = await fixture();
    const batchId = await owner.mutation(
      api.academics.batchWorkspace.createWithRoutine,
      {
        courseId,
        code: "SCHEDULE-1",
        nameBn: "সময়সূচি ব্যাচ",
        nameEn: "Schedule Batch",
        startDate: "2026-01-01",
        routine: [
          {
            weekday: 6,
            startMinutes: 600,
            endMinutes: 660,
            teacherId,
            subjectId,
          },
        ],
      },
    );
    const firstId = await owner.mutation(
      api.academics.scheduleWorkspace.createExtra,
      {
        batchId,
        teacherId,
        subjectId,
        sessionDate: "2027-01-10",
        startsAt: Date.parse("2027-01-10T10:00:00+06:00"),
        endsAt: Date.parse("2027-01-10T11:00:00+06:00"),
        reason: "Revision",
      },
    );
    const noSubjectId = await owner.mutation(
      api.academics.scheduleWorkspace.createExtra,
      {
        batchId,
        teacherId,
        sessionDate: "2027-01-12",
        startsAt: Date.parse("2027-01-12T10:00:00+06:00"),
        endsAt: Date.parse("2027-01-12T11:00:00+06:00"),
      },
    );
    const noSubjectRow = await t.run(
      async (ctx) => await ctx.db.get("classSessions", noSubjectId),
    );
    expect(noSubjectRow?.subjectId).toBeUndefined();
    await expect(
      owner.mutation(api.academics.scheduleWorkspace.createExtra, {
        batchId,
        teacherId,
        subjectId,
        sessionDate: "2027-01-10",
        startsAt: Date.parse("2027-01-10T10:30:00+06:00"),
        endsAt: Date.parse("2027-01-10T11:30:00+06:00"),
      }),
    ).rejects.toThrow("CLASS_CONFLICT");
    await owner.mutation(api.academics.scheduleWorkspace.reschedule, {
      sessionId: firstId,
      sessionDate: "2027-01-11",
      startsAt: Date.parse("2027-01-11T12:00:00+06:00"),
      endsAt: Date.parse("2027-01-11T13:00:00+06:00"),
    });
    await owner.mutation(api.academics.scheduleWorkspace.cancel, {
      sessionId: firstId,
      reason: "Owner cancelled",
    });
    const row = await t.run(
      async (ctx) => await ctx.db.get("classSessions", firstId),
    );
    expect(row).toMatchObject({
      occurrenceType: "extra",
      sessionDate: "2027-01-11",
      status: "cancelled",
      cancellationType: "manual",
      changeReason: "Owner cancelled",
    });
    await expect(
      owner.mutation(api.academics.scheduleWorkspace.restore, {
        sessionId: firstId,
      }),
    ).rejects.toThrow("cannot be restored");
  });

  it("materializes eight weeks and restores a generated occurrence", async () => {
    const { t, owner, courseId, teacherId, subjectId } = await fixture();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(Date.now());
    const batchId = await owner.mutation(
      api.academics.batchWorkspace.createWithRoutine,
      {
        courseId,
        code: "SCHEDULE-2",
        nameBn: "রুটিন ব্যাচ",
        nameEn: "Routine Batch",
        startDate: today,
        routine: [
          {
            weekday: 6,
            startMinutes: 600,
            endMinutes: 660,
            teacherId,
            subjectId,
          },
        ],
      },
    );
    const schedule = await t.run(async (ctx) =>
      ctx.db
        .query("batchSchedules")
        .withIndex("by_batchId_and_status", (q) =>
          q.eq("batchId", batchId).eq("status", "active"),
        )
        .unique(),
    );
    expect(schedule).not.toBeNull();
    await t.mutation(
      internal.academics.classOccurrenceMaterializer.materializeSchedules,
      { scheduleIds: [schedule!._id] },
    );
    const occurrences = await t.run(async (ctx) =>
      ctx.db
        .query("classSessions")
        .withIndex("by_scheduleId_and_sessionDate", (q) =>
          q.eq("scheduleId", schedule!._id),
        )
        .take(20),
    );
    expect(occurrences).toHaveLength(8);
    const first = occurrences.find((row) => row.startsAt > Date.now())!;
    await t.run(async (ctx) =>
      ctx.db.patch("classSessions", first._id, {
        status: "cancelled",
        cancellationType: "manual",
      }),
    );
    await owner.mutation(api.academics.scheduleWorkspace.restore, {
      sessionId: first._id,
    });
    const restored = await t.run(async (ctx) =>
      ctx.db.get("classSessions", first._id),
    );
    expect(restored).toMatchObject({
      status: "scheduled",
      isOneOffOverride: false,
      sessionDate: first.originalSessionDate,
    });

    const attendanceSessionId = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("classSessions", {
        sessionKey: `attendance-test:${batchId}:${now}`,
        batchId,
        teacherId,
        subjectId,
        sessionDate: today,
        startsAt: now + 60_000,
        endsAt: now + 3_660_000,
        status: "scheduled",
        occurrenceType: "extra",
        rosterCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    });
    await owner.mutation(api.academics.scheduleWorkspace.openAttendance, {
      sessionId: attendanceSessionId,
    });
    const attendanceSession = await t.run(async (ctx) =>
      ctx.db.get("classSessions", attendanceSessionId),
    );
    expect(attendanceSession).toMatchObject({
      status: "open",
      rosterCount: 0,
    });
  });
});
