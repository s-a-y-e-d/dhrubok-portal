/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";

const discoveredModules = import.meta.glob("../**/*.ts");
const modules = Object.fromEntries(Object.entries(discoveredModules).map(([path, loader]) => [path.startsWith("./") ? `./academics/${path.slice(2)}` : `./${path.slice(3)}`, loader]));
const createCourse = makeFunctionReference<"mutation">("academics/courses:create");
const createBatch = makeFunctionReference<"mutation">("academics/batches:create");
const createAssignment = makeFunctionReference<"mutation">("academics/assignments:create");
const teacherAssignedBatches = makeFunctionReference<"query">("academics/readModels:teacherAssignedBatches");
const listPublicCourses = makeFunctionReference<"query">("academics/public:listCourses");
const listPublicTeachers = makeFunctionReference<"query">("academics/public:listTeachers");

const addSubject = makeFunctionReference<"mutation">("academics/courses:addSubject");
const removeSubject = makeFunctionReference<"mutation">("academics/courses:removeSubject");
const getTeacher = makeFunctionReference<"query">("academics/teachers:get");

async function seedOwner(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const profileId = await ctx.db.insert("ownerProfiles", { displayName: "Owner", email: "owner@example.com", status: "active", createdAt: now, updatedAt: now });
    return await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "owner-token", loginEmail: "owner@example.com", normalizedLoginEmail: "owner@example.com", ownerProfileId: profileId, locale: "en", createdAt: now, updatedAt: now });
  });
}

async function seedSession(t: ReturnType<typeof convexTest>, status: "active" | "archived" = "active") {
  return await t.run(ctx => ctx.db.insert("academicSessions", { nameBn: "২০২৬", nameEn: "2026", startDate: "2026-01-01", endDate: "2026-12-31", status, createdAt: 1, updatedAt: 1 }));
}

const courseInput = (academicSessionId: string, code: string, slug: string) => ({ academicSessionId, code, slug, nameBn: "কোর্স", nameEn: "Course", shortDescriptionBn: "সংক্ষিপ্ত", shortDescriptionEn: "Short", descriptionBn: "বর্ণনা", descriptionEn: "Description", status: "active", isPublic: true, publicSortOrder: 1 });

describe("academic owner invariants", () => {
  it("rejects duplicate normalized course and batch codes", async () => {
    const t = convexTest(schema, modules); await seedOwner(t); const sessionId = await seedSession(t); const owner = t.withIdentity({ tokenIdentifier: "owner-token" });
    const courseId = await owner.mutation(createCourse, courseInput(sessionId, "ssc-26", "ssc-26"));
    await expect(owner.mutation(createCourse, courseInput(sessionId, "SSC-26", "other-course"))).rejects.toThrow("Course code already exists");
    const batch = { academicSessionId: sessionId, courseId, code: "batch-a", slug: "batch-a", nameBn: "ব্যাচ", nameEn: "Batch", status: "active", admissionOpen: true, isPublic: true, publicSortOrder: 1 };
    await owner.mutation(createBatch, batch);
    await expect(owner.mutation(createBatch, { ...batch, code: "BATCH-A", slug: "batch-b" })).rejects.toThrow("Batch code already exists");
  });

  it("rejects active assignments to archived batches", async () => {
    const t = convexTest(schema, modules); const ownerAccountId = await seedOwner(t); const sessionId = await seedSession(t); const owner = t.withIdentity({ tokenIdentifier: "owner-token" });
    const courseId = await owner.mutation(createCourse, courseInput(sessionId, "COURSE-1", "course-1"));
    const ids = await t.run(async (ctx) => { const now = Date.now(); const teacherId = await ctx.db.insert("teachers", { employeeCode: "T-1", displayName: "Teacher", loginEmail: "teacher@example.com", normalizedLoginEmail: "teacher@example.com", phone: "01700000000", bioBn: "", bioEn: "", qualificationsBn: "", qualificationsEn: "", status: "active", isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now }); const batchId = await ctx.db.insert("batches", { academicSessionId: sessionId, courseId, code: "ARCHIVED", slug: "archived", nameBn: "পুরোনো", nameEn: "Archived", status: "archived", admissionOpen: false, isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now }); return { teacherId, batchId, ownerAccountId }; });
    await expect(owner.mutation(createAssignment, { teacherId: ids.teacherId, batchId: ids.batchId, startsOn: "2026-01-01" })).rejects.toThrow("Archived or completed batches");
  });
});

describe("role-scoped and public academic reads", () => {
  it("shows a teacher only their assigned batches", async () => {
    const t = convexTest(schema, modules); const sessionId = await seedSession(t);
    await t.run(async (ctx) => {
      const now = Date.now();
      const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: "Seeder", email: "seed@example.com", status: "active", createdAt: now, updatedAt: now });
      const ownerId = await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "seed", loginEmail: "seed@example.com", normalizedLoginEmail: "seed@example.com", ownerProfileId, locale: "en", createdAt: now, updatedAt: now });
      const courseId = await ctx.db.insert("courses", { academicSessionId: sessionId, code: "C-1", slug: "c-1", nameBn: "কোর্স", nameEn: "Course", shortDescriptionBn: "", shortDescriptionEn: "", descriptionBn: "", descriptionEn: "", status: "active", isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now, createdByAccountId: ownerId, updatedByAccountId: ownerId });
      const teacher1 = await ctx.db.insert("teachers", { employeeCode: "T-1", displayName: "One", loginEmail: "one@example.com", normalizedLoginEmail: "one@example.com", phone: "1", bioBn: "", bioEn: "", qualificationsBn: "", qualificationsEn: "", status: "active", isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now });
      const teacher2 = await ctx.db.insert("teachers", { employeeCode: "T-2", displayName: "Two", loginEmail: "two@example.com", normalizedLoginEmail: "two@example.com", phone: "2", bioBn: "", bioEn: "", qualificationsBn: "", qualificationsEn: "", status: "active", isPublic: false, publicSortOrder: 2, createdAt: now, updatedAt: now });
      const batch1 = await ctx.db.insert("batches", { academicSessionId: sessionId, courseId, code: "B-1", slug: "b-1", nameBn: "এক", nameEn: "One", status: "active", admissionOpen: false, isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now });
      const batch2 = await ctx.db.insert("batches", { academicSessionId: sessionId, courseId, code: "B-2", slug: "b-2", nameBn: "দুই", nameEn: "Two", status: "active", admissionOpen: false, isPublic: false, publicSortOrder: 2, createdAt: now, updatedAt: now });
      await ctx.db.insert("portalAccounts", { role: "teacher", status: "active", tokenIdentifier: "teacher-one", loginEmail: "one@example.com", normalizedLoginEmail: "one@example.com", teacherId: teacher1, locale: "en", createdAt: now, updatedAt: now });
      await ctx.db.insert("teacherBatchAssignments", { teacherId: teacher1, batchId: batch1, startsOn: "2026-01-01", status: "active", createdAt: now, createdByAccountId: ownerId });
      await ctx.db.insert("teacherBatchAssignments", { teacherId: teacher2, batchId: batch2, startsOn: "2026-01-01", status: "active", createdAt: now, createdByAccountId: ownerId });
    });
    const visible = await t.withIdentity({ tokenIdentifier: "teacher-one" }).query(teacherAssignedBatches, {}); expect(visible).toHaveLength(1); expect(visible[0].code).toBe("B-1");
  });

  it("public projections include only active public records and omit private fields", async () => {
    const t = convexTest(schema, modules); const sessionId = await seedSession(t); await t.run(async (ctx) => { const now = Date.now(); const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: "Owner", email: "public-owner@example.com", status: "active", createdAt: now, updatedAt: now }); const ownerId = await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "public-seed", loginEmail: "public-owner@example.com", normalizedLoginEmail: "public-owner@example.com", ownerProfileId, locale: "en", createdAt: now, updatedAt: now }); const base = { academicSessionId: sessionId, nameBn: "কোর্স", nameEn: "Course", shortDescriptionBn: "", shortDescriptionEn: "", descriptionBn: "", descriptionEn: "", publicSortOrder: 1, createdAt: now, updatedAt: now, createdByAccountId: ownerId, updatedByAccountId: ownerId }; await ctx.db.insert("courses", { ...base, code: "PUBLIC", slug: "public", status: "active", isPublic: true }); await ctx.db.insert("courses", { ...base, code: "DRAFT", slug: "draft", status: "draft", isPublic: true }); const teacherBase = { displayName: "Public Teacher", loginEmail: "private@example.com", normalizedLoginEmail: "private@example.com", phone: "01700000000", bioBn: "জীবনী", bioEn: "Bio", qualificationsBn: "যোগ্যতা", qualificationsEn: "Qualifications", isPublic: true, publicSortOrder: 1, createdAt: now, updatedAt: now }; await ctx.db.insert("teachers", { ...teacherBase, employeeCode: "VISIBLE", status: "active" }); await ctx.db.insert("teachers", { ...teacherBase, employeeCode: "HIDDEN", loginEmail: "hidden@example.com", normalizedLoginEmail: "hidden@example.com", status: "inactive" }); });
    const courses = await t.query(listPublicCourses, {}); const teachers = await t.query(listPublicTeachers, {}); expect(courses).toHaveLength(1); expect(courses[0]).not.toHaveProperty("createdByAccountId"); expect(teachers).toHaveLength(1); expect(teachers[0]).not.toHaveProperty("loginEmail"); expect(teachers[0]).not.toHaveProperty("phone");
  });
});

describe("subject unlinking and teacher status details", () => {
  it("validates subject unlinking rules and returns account status for teachers", async () => {
    const t = convexTest(schema, modules);
    await seedOwner(t);
    const sessionId = await seedSession(t);
    const owner = t.withIdentity({ tokenIdentifier: "owner-token" });

    // Seed course, batch, subject, and link
    const { courseId, batchId, subjectId, linkId, teacherId } = await t.run(async (ctx) => {
      const now = Date.now();
      const ownerAcc = (await ctx.db.query("portalAccounts").first())!;
      const ownerId = ownerAcc._id;
      const cId = await ctx.db.insert("courses", {
        academicSessionId: sessionId,
        code: "C-1",
        slug: "c-1",
        nameBn: "কোর্স",
        nameEn: "Course",
        shortDescriptionBn: "",
        shortDescriptionEn: "",
        descriptionBn: "",
        descriptionEn: "",
        status: "active",
        isPublic: false,
        publicSortOrder: 1,
        createdAt: now,
        updatedAt: now,
        createdByAccountId: ownerId,
        updatedByAccountId: ownerId,
      });
      const bId = await ctx.db.insert("batches", {
        academicSessionId: sessionId,
        courseId: cId,
        code: "B-1",
        slug: "b-1",
        nameBn: "ব্যাচ",
        nameEn: "Batch",
        status: "active",
        admissionOpen: false,
        isPublic: false,
        publicSortOrder: 1,
        createdAt: now,
        updatedAt: now,
      });
      const sId = await ctx.db.insert("subjects", {
        code: "SUB-1",
        nameBn: "বিষয়",
        nameEn: "Subject",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const lId = await ctx.db.insert("courseSubjects", {
        courseId: cId,
        subjectId: sId,
        sortOrder: 1,
        createdAt: now,
      });
      const tId = await ctx.db.insert("teachers", {
        employeeCode: "TEACH-1",
        displayName: "Teacher One",
        loginEmail: "t1@example.com",
        normalizedLoginEmail: "t1@example.com",
        phone: "01711111111",
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
        status: "reserved",
        loginEmail: "t1@example.com",
        normalizedLoginEmail: "t1@example.com",
        teacherId: tId,
        locale: "en",
        createdAt: now,
        updatedAt: now,
      });
      return { courseId: cId, batchId: bId, subjectId: sId, linkId: lId, teacherId: tId };
    });

    // 1. Initially unlinking is allowed because there are no assignments/schedules
    // We won't remove it yet, just test validation with a dry run if needed, but since removeSubject deletes it:
    // Let's create an active assignment first to block it.
    const assignmentId = await t.run(async (ctx) => {
      const ownerAcc = (await ctx.db.query("portalAccounts").first())!;
      return await ctx.db.insert("teacherBatchAssignments", {
        teacherId,
        batchId,
        subjectId,
        startsOn: "2026-01-01",
        status: "active",
        createdAt: Date.now(),
        createdByAccountId: ownerAcc._id,
      });
    });

    // Unlinking must fail now
    await expect(owner.mutation(removeSubject, { courseSubjectId: linkId })).rejects.toThrow("Cannot unlink subject because active assignments or routines exist");

    // 2. End the assignment, unlinking should succeed
    await t.run(async (ctx) => {
      await ctx.db.patch("teacherBatchAssignments", assignmentId, { status: "ended" });
    });
    // Check that we can unlink successfully now
    await owner.mutation(removeSubject, { courseSubjectId: linkId });

    // Verify it is deleted
    const subjectsList = await owner.query(makeFunctionReference<"query">("academics/courses:listSubjects"), { courseId });
    expect(subjectsList).toHaveLength(0);

    // 3. Test that active assignment in ANOTHER course does not block unlinking for this course
    // Re-link the subject to course 1
    const newLinkId = await t.run(async (ctx) => {
      return await ctx.db.insert("courseSubjects", {
        courseId,
        subjectId,
        sortOrder: 1,
        createdAt: Date.now(),
      });
    });

    // Create Course 2 and Batch 2
    const { course2Id, batch2Id } = await t.run(async (ctx) => {
      const now = Date.now();
      const ownerAcc = (await ctx.db.query("portalAccounts").first())!;
      const ownerId = ownerAcc._id;
      const c2 = await ctx.db.insert("courses", {
        academicSessionId: sessionId,
        code: "C-2",
        slug: "c-2",
        nameBn: "কোর্স ২",
        nameEn: "Course 2",
        shortDescriptionBn: "",
        shortDescriptionEn: "",
        descriptionBn: "",
        descriptionEn: "",
        status: "active",
        isPublic: false,
        publicSortOrder: 2,
        createdAt: now,
        updatedAt: now,
        createdByAccountId: ownerId,
        updatedByAccountId: ownerId,
      });
      const b2 = await ctx.db.insert("batches", {
        academicSessionId: sessionId,
        courseId: c2,
        code: "B-2",
        slug: "b-2",
        nameBn: "ব্যাচ ২",
        nameEn: "Batch 2",
        status: "active",
        admissionOpen: false,
        isPublic: false,
        publicSortOrder: 2,
        createdAt: now,
        updatedAt: now,
      });
      // Link the same subject to Course 2
      await ctx.db.insert("courseSubjects", {
        courseId: c2,
        subjectId,
        sortOrder: 1,
        createdAt: now,
      });
      // Create an active assignment in Batch 2 for that subject
      await ctx.db.insert("teacherBatchAssignments", {
        teacherId,
        batchId: b2,
        subjectId,
        startsOn: "2026-01-01",
        status: "active",
        createdAt: now,
        createdByAccountId: ownerId,
      });
      return { course2Id: c2, batch2Id: b2 };
    });

    // Unlinking the subject from Course 1 should succeed even though Course 2 has an active assignment for this subject
    await owner.mutation(removeSubject, { courseSubjectId: newLinkId });

    // 4. Test teachers.get returns teacher details and account status
    const result = await owner.query(getTeacher, { teacherId });
    expect(result.teacher.displayName).toBe("Teacher One");
    expect(result.accountStatus).toBe("reserved");
  });
});
