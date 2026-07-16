/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
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
      nameBn: "গণিত",
      nameEn: "Mathematics",
      status: "active",
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
});
