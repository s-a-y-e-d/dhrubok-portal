/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
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
const createWithFirstBatch = makeFunctionReference<"mutation">(
  "academics/courses:createWithFirstBatch",
);

async function setup() {
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
    const ownerAccountId = await ctx.db.insert("portalAccounts", {
      role: "owner",
      status: "active",
      tokenIdentifier: "course-owner",
      loginEmail: "owner@example.com",
      normalizedLoginEmail: "owner@example.com",
      ownerProfileId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    const teacherId = await ctx.db.insert("teachers", {
      employeeCode: "T-COURSE",
      displayName: "Course Teacher",
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
    const subjectId = await ctx.db.insert("subjects", {
      code: "MATH",
      nameEn: "Mathematics",
      createdAt: now,
      updatedAt: now,
    });
    return { ownerAccountId, teacherId, subjectId };
  });
  return {
    t,
    owner: t.withIdentity({ tokenIdentifier: "course-owner" }),
    ...ids,
  };
}

const input = (teacherId: string, subjectId: string) => ({
  course: {
    code: "ssc_math",
    nameBn: "এসএসসি গণিত",
    nameEn: "SSC Mathematics",
    shortDescriptionBn: "সংক্ষিপ্ত বিবরণ",
    shortDescriptionEn: "Short description",
    descriptionBn: "বিস্তারিত বিবরণ",
    descriptionEn: "Detailed description",
  },
  defaults: [{ teacherId, subjectIds: [subjectId] }],
  batch: {
    code: "ssc_math_27",
    nameBn: "ব্যাচ ২০২৭",
    nameEn: "Batch 2027",
    startDate: "2027-01-01",
  },
  routine: [{
    weekday: 1,
    startMinutes: 600,
    endMinutes: 660,
    teacherId,
    subjectId,
  }],
});

describe("atomic course creation", () => {
  it("creates the root course, defaults, first batch, assignment, and routine", async () => {
    const { t, owner, teacherId, subjectId } = await setup();
    const result = await owner.mutation(
      createWithFirstBatch,
      input(teacherId, subjectId),
    );
    const graph = await t.run(async (ctx) => ({
      course: await ctx.db.get("courses", result.courseId),
      batch: await ctx.db.get("batches", result.batchId),
      defaults: await ctx.db.query("courseTeacherDefaults").collect(),
      assignments: await ctx.db.query("teacherBatchAssignments").collect(),
      schedules: await ctx.db.query("batchSchedules").collect(),
    }));

    expect(graph.course).toMatchObject({
      code: "SSC_MATH",
      slug: "ssc-math",
      status: "active",
      isPublic: false,
    });
    expect(graph.batch).toMatchObject({
      code: "SSC_MATH_27",
      startDate: "2027-01-01",
      admissionOpen: true,
      isPublic: true,
    });
    expect(graph.defaults).toHaveLength(1);
    expect(graph.assignments).toHaveLength(1);
    expect(graph.schedules).toHaveLength(1);
  });

  it("rejects overlapping rows without leaving a partial course", async () => {
    const { t, owner, teacherId, subjectId } = await setup();
    const invalid = input(teacherId, subjectId);
    invalid.routine.push({ ...invalid.routine[0], startMinutes: 630, endMinutes: 690 });
    await expect(owner.mutation(createWithFirstBatch, invalid)).rejects.toThrow(
      "overlap",
    );
    expect(await t.run((ctx) => ctx.db.query("courses").collect())).toHaveLength(0);
  });
});
