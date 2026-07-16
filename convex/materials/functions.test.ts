/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { MAX_MATERIAL_BYTES, validateFileMetadata } from "./shared";

const discoveredModules = import.meta.glob("../**/*.ts");
const modules = Object.fromEntries(Object.entries(discoveredModules).map(([path, loader]) => [path.startsWith("./") ? `./materials/${path.slice(2)}` : `./${path.slice(3)}`, loader]));
const createMaterial = makeFunctionReference<"mutation">("materials/functions:create");
const archiveMaterial = makeFunctionReference<"mutation">("materials/functions:archive");
const listForStudent = makeFunctionReference<"query">("materials/functions:listForStudent");
const getDownloadUrl = makeFunctionReference<"query">("materials/functions:getDownloadUrl");

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: "Owner", email: "owner@example.com", status: "active", createdAt: now, updatedAt: now });
    const ownerId = await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "owner", loginEmail: "owner@example.com", normalizedLoginEmail: "owner@example.com", ownerProfileId, locale: "en", createdAt: now, updatedAt: now });
    const courseId = await ctx.db.insert("courses", { code: "C1", slug: "c1", nameBn: "কোর্স", nameEn: "Course", shortDescriptionBn: "", shortDescriptionEn: "", descriptionBn: "", descriptionEn: "", status: "active", isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now, createdByAccountId: ownerId, updatedByAccountId: ownerId });
    const batchA = await ctx.db.insert("batches", { courseId, code: "A", slug: "a", nameBn: "ক", nameEn: "A", startDate: "2026-01-01", status: "active", admissionOpen: false, isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now });
    const batchB = await ctx.db.insert("batches", { courseId, code: "B", slug: "b", nameBn: "খ", nameEn: "B", startDate: "2026-01-01", status: "active", admissionOpen: false, isPublic: false, publicSortOrder: 2, createdAt: now, updatedAt: now });
    const teacherId = await ctx.db.insert("teachers", { employeeCode: "T1", displayName: "Teacher", loginEmail: "teacher@example.com", normalizedLoginEmail: "teacher@example.com", phone: "01700000000", bioBn: "", bioEn: "", qualificationsBn: "", qualificationsEn: "", status: "active", isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now });
    await ctx.db.insert("portalAccounts", { role: "teacher", status: "active", tokenIdentifier: "teacher", loginEmail: "teacher@example.com", normalizedLoginEmail: "teacher@example.com", teacherId, locale: "en", createdAt: now, updatedAt: now, createdByAccountId: ownerId });
    await ctx.db.insert("teacherBatchAssignments", { teacherId, batchId: batchA, startsOn: "2026-01-01", status: "active", createdAt: now, createdByAccountId: ownerId });
    const studentIds = [];
    for (const [index, batchId] of [batchA, batchB].entries()) {
      const studentId = await ctx.db.insert("students", { studentNumber: `S${index}`, displayName: `Student ${index}`, loginEmail: `s${index}@example.com`, normalizedLoginEmail: `s${index}@example.com`, schoolCollege: "School", currentClass: "10", guardianName: "Guardian", guardianPhone: `880171234567${index}`, normalizedGuardianPhone: `880171234567${index}`, guardianRelationship: "Parent", preferredSmsLocale: "en", admissionDate: "2026-01-01", status: "active", searchText: `student ${index}`, createdAt: now, updatedAt: now, createdByAccountId: ownerId, updatedByAccountId: ownerId });
      await ctx.db.insert("portalAccounts", { role: "student", status: "active", tokenIdentifier: `student-${index}`, loginEmail: `s${index}@example.com`, normalizedLoginEmail: `s${index}@example.com`, studentId, locale: "en", createdAt: now, updatedAt: now, createdByAccountId: ownerId });
      await ctx.db.insert("enrolments", { studentId, courseId, batchId, enrolledOn: "2026-01-01", status: "active", createdAt: now, updatedAt: now, createdByAccountId: ownerId });
      studentIds.push(studentId);
    }
    const storageId = await ctx.storage.store(new Blob(["private material"], { type: "application/pdf" }));
    return { courseId, batchA, batchB, studentIds, storageId };
  });
}

const linkInput = (courseId: string, batchId: string) => ({
  courseId, batchId, titleBn: "পাঠ", titleEn: "Lesson", descriptionBn: "বিবরণ", descriptionEn: "Description", kind: "link", externalUrl: "https://example.com/lesson", visibility: "batch", publish: true,
});

describe("learning material authorization", () => {
  it("validates material filename, size, and content type together", () => {
    expect(() => validateFileMetadata("lesson.pdf", MAX_MATERIAL_BYTES, "application/pdf")).not.toThrow();
    expect(() => validateFileMetadata("lesson.exe", 10, "application/octet-stream")).toThrow("extension");
    expect(() => validateFileMetadata("lesson.pdf", 10, "image/png")).toThrow("does not match");
    expect(() => validateFileMetadata("lesson.pdf", MAX_MATERIAL_BYTES + 1, "application/pdf")).toThrow("20 MB");
  });
  it("lets a teacher publish only to an assigned batch and hides archived material", async () => {
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const teacher = t.withIdentity({ tokenIdentifier: "teacher" });
    await expect(teacher.mutation(createMaterial, linkInput(data.courseId, data.batchB))).rejects.toThrow("Unauthorized");
    const materialId = await teacher.mutation(createMaterial, linkInput(data.courseId, data.batchA));
    const visible = await t.withIdentity({ tokenIdentifier: "student-0" }).query(listForStudent, {});
    expect(visible).toHaveLength(1);
    expect(visible[0]).not.toHaveProperty("storageId");
    expect(visible[0]).not.toHaveProperty("createdByAccountId");
    expect(await t.withIdentity({ tokenIdentifier: "student-1" }).query(listForStudent, {})).toHaveLength(0);
    await t.withIdentity({ tokenIdentifier: "owner" }).mutation(archiveMaterial, { materialId });
    expect(await t.withIdentity({ tokenIdentifier: "student-0" }).query(listForStudent, {})).toHaveLength(0);
  });

  it("returns a private storage URL only to an enrolled student", async () => {
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const materialId = await t.run(async (ctx) => {
      const owner = await ctx.db.query("portalAccounts").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", "owner")).unique();
      if (!owner) throw new Error("owner fixture missing");
      return await ctx.db.insert("materials", { courseId: data.courseId, batchId: data.batchA, titleBn: "ফাইল", titleEn: "File", descriptionBn: "বিবরণ", descriptionEn: "Description", kind: "file", storageId: data.storageId, visibility: "batch", status: "published", publishedAt: 1, createdByAccountId: owner._id, createdAt: 1, updatedAt: 1 });
    });
    await expect(t.withIdentity({ tokenIdentifier: "student-1" }).query(getDownloadUrl, { materialId })).rejects.toThrow("Unauthorized");
    await expect(t.withIdentity({ tokenIdentifier: "student-0" }).query(getDownloadUrl, { materialId })).resolves.toMatch(/^https?:\/\//);
  });
});
