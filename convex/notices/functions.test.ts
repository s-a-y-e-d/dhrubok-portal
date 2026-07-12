/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";

const discoveredModules = import.meta.glob("../**/*.ts");
const modules = Object.fromEntries(Object.entries(discoveredModules).map(([path, loader]) => [path.startsWith("./") ? `./notices/${path.slice(2)}` : `./${path.slice(3)}`, loader]));
const createNotice = makeFunctionReference<"mutation">("notices/functions:create");
const previewSms = makeFunctionReference<"query">("notices/functions:previewSms");
const publishNotice = makeFunctionReference<"mutation">("notices/functions:publish");
const listForStudent = makeFunctionReference<"query">("notices/functions:listForStudent");
const markRead = makeFunctionReference<"mutation">("notices/functions:markRead");
const listPublicNotices = makeFunctionReference<"query">("publicSite/public:listNotices");

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: "Owner", email: "owner@example.com", status: "active", createdAt: now, updatedAt: now });
    const ownerId = await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "owner", loginEmail: "owner@example.com", normalizedLoginEmail: "owner@example.com", ownerProfileId, locale: "en", createdAt: now, updatedAt: now });
    const academicSessionId = await ctx.db.insert("academicSessions", { nameBn: "২০২৬", nameEn: "2026", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", createdAt: now, updatedAt: now });
    const courseId = await ctx.db.insert("courses", { academicSessionId, code: "C1", slug: "c1", nameBn: "কোর্স", nameEn: "Course", shortDescriptionBn: "", shortDescriptionEn: "", descriptionBn: "", descriptionEn: "", status: "active", isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now, createdByAccountId: ownerId, updatedByAccountId: ownerId });
    const batchA = await ctx.db.insert("batches", { academicSessionId, courseId, code: "A", slug: "a", nameBn: "ক", nameEn: "A", status: "active", admissionOpen: false, isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now });
    const batchB = await ctx.db.insert("batches", { academicSessionId, courseId, code: "B", slug: "b", nameBn: "খ", nameEn: "B", status: "active", admissionOpen: false, isPublic: false, publicSortOrder: 2, createdAt: now, updatedAt: now });
    const teacherId = await ctx.db.insert("teachers", { employeeCode: "T1", displayName: "Teacher", loginEmail: "teacher@example.com", normalizedLoginEmail: "teacher@example.com", phone: "01700000000", bioBn: "", bioEn: "", qualificationsBn: "", qualificationsEn: "", status: "active", isPublic: false, publicSortOrder: 1, createdAt: now, updatedAt: now });
    await ctx.db.insert("portalAccounts", { role: "teacher", status: "active", tokenIdentifier: "teacher", loginEmail: "teacher@example.com", normalizedLoginEmail: "teacher@example.com", teacherId, locale: "en", createdAt: now, updatedAt: now, createdByAccountId: ownerId });
    await ctx.db.insert("teacherBatchAssignments", { teacherId, batchId: batchA, startsOn: "2026-01-01", status: "active", createdAt: now, createdByAccountId: ownerId });
    const studentId = await ctx.db.insert("students", { studentNumber: "S1", displayName: "Student", loginEmail: "student@example.com", normalizedLoginEmail: "student@example.com", schoolCollege: "School", currentClass: "10", guardianName: "Guardian", guardianPhone: "8801712345678", normalizedGuardianPhone: "8801712345678", guardianRelationship: "Parent", preferredSmsLocale: "en", admissionDate: "2026-01-01", status: "active", searchText: "student", createdAt: now, updatedAt: now, createdByAccountId: ownerId, updatedByAccountId: ownerId });
    await ctx.db.insert("portalAccounts", { role: "student", status: "active", tokenIdentifier: "student", loginEmail: "student@example.com", normalizedLoginEmail: "student@example.com", studentId, locale: "en", createdAt: now, updatedAt: now, createdByAccountId: ownerId });
    await ctx.db.insert("enrolments", { studentId, courseId, batchId: batchA, academicSessionId, enrolledOn: "2026-01-01", status: "active", createdAt: now, updatedAt: now, createdByAccountId: ownerId });
    await ctx.db.insert("coachingSettings", { nameBn: "ধ্রুবক", nameEn: "Dhrubok", shortNameBn: "ধ্রুবক", shortNameEn: "Dhrubok", addressBn: "ঢাকা", addressEn: "Dhaka", phone: "8801700000000", email: "hello@example.com", timezone: "Asia/Dhaka", currency: "BDT", defaultLocale: "bn", defaultGuardianSmsLocale: "bn", monthlyDueDay: 15, receiptPrefix: "R", studentIdPrefix: "S", applicationPrefix: "A", receiptFooterBn: "ধন্যবাদ", receiptFooterEn: "Thanks", smsEnabled: true, publicAdmissionsOpen: false, createdAt: now, updatedAt: now, updatedByAccountId: ownerId });
    return { courseId, batchA, batchB, studentId };
  });
}

const batchNotice = (courseId: string, batchId: string) => ({ titleBn: "নোটিশ", titleEn: "Notice", bodyBn: "বার্তা", bodyEn: "Message", audienceType: "batch", courseId, batchId, sendSms: false, publish: true, confirmSms: false });

describe("notice audience and read state", () => {
  it("lets a teacher publish to an assigned batch only and freezes student read scope", async () => {
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const teacher = t.withIdentity({ tokenIdentifier: "teacher" });
    await expect(teacher.mutation(createNotice, batchNotice(data.courseId, data.batchB))).rejects.toThrow("Unauthorized");
    const noticeId = await teacher.mutation(createNotice, batchNotice(data.courseId, data.batchA));
    const student = t.withIdentity({ tokenIdentifier: "student" });
    const before = await student.query(listForStudent, {});
    expect(before).toHaveLength(1);
    expect(before[0].readAt).toBeNull();
    expect(before[0].notice).not.toHaveProperty("createdByAccountId");
    expect(before[0].notice).not.toHaveProperty("sendSms");
    await student.mutation(markRead, { noticeId });
    expect((await student.query(listForStudent, {}))[0].readAt).toEqual(expect.any(Number));
  });

  it("never exposes a private notice through the public notice payload", async () => {
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const owner = t.withIdentity({ tokenIdentifier: "owner" });
    await owner.mutation(createNotice, batchNotice(data.courseId, data.batchA));
    await owner.mutation(createNotice, { titleBn: "সবার", titleEn: "Public", bodyBn: "প্রকাশ্য", bodyEn: "Visible", audienceType: "public", sendSms: false, publish: true, confirmSms: false });
    const publicRows = await t.query(listPublicNotices, { locale: "en", limit: 10 });
    expect(publicRows).toHaveLength(1);
    expect(publicRows[0].title.value).toBe("Public");
  });

  it("requires a current explicit SMS preview confirmation", async () => {
    const t = convexTest(schema, modules);
    const data = await seed(t);
    const owner = t.withIdentity({ tokenIdentifier: "owner" });
    const noticeId = await owner.mutation(createNotice, { titleBn: "ফি", titleEn: "Fee", bodyBn: "বকেয়া", bodyEn: "Due reminder", audienceType: "individual_students", studentIds: [data.studentId], sendSms: true, publish: false, confirmSms: false });
    const preview = await owner.query(previewSms, { noticeId });
    expect(preview).toMatchObject({ enabled: true, recipientCount: 1 });
    expect(preview.english.body).toContain("Dhrubok");
    await expect(owner.mutation(publishNotice, { noticeId, confirmSms: true, expectedSmsRecipientCount: 0 })).rejects.toThrow("stale or missing");
    await owner.mutation(publishNotice, { noticeId, confirmSms: true, expectedSmsRecipientCount: 1 });
    const messages = await t.run((ctx) => ctx.db.query("smsMessages").take(10));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ eventType: "custom_notice", studentId: data.studentId, status: "queued" });
  });
});
