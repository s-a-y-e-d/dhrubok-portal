import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../model/auth";
import { writeAudit } from "../model/audit";

const teacherStatus = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("archived"),
);
const accountStatus = v.union(
  v.literal("reserved"),
  v.literal("active"),
  v.literal("suspended"),
  v.literal("revoked"),
);
const listItem = v.object({
  teacherId: v.id("teachers"),
  employeeCode: v.string(),
  displayName: v.string(),
  loginEmail: v.string(),
  phone: v.string(),
  photoUrl: v.union(v.string(), v.null()),
  status: teacherStatus,
  accountStatus,
  isPublic: v.boolean(),
  courseSubjectCount: v.number(),
  activeBatchCount: v.number(),
  weeklyClassCount: v.number(),
});

export const listTeachers = query({
  args: {
    status: teacherStatus,
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listItem),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const result = await ctx.db
      .query("teachers")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .paginate(args.paginationOpts);
    const search = args.query.trim().toLowerCase();
    const page = [];
    for (const teacher of result.page) {
      const haystack =
        `${teacher.employeeCode} ${teacher.displayName} ${teacher.nameBn ?? ""} ${teacher.nameEn ?? ""} ${teacher.loginEmail} ${teacher.phone}`.toLowerCase();
      if (search && !haystack.includes(search)) continue;
      const [account, defaults, assignments, schedules] = await Promise.all([
        ctx.db
          .query("portalAccounts")
          .withIndex("by_teacherId", (q) => q.eq("teacherId", teacher._id))
          .unique(),
        ctx.db
          .query("courseTeacherDefaults")
          .withIndex("by_teacherId_and_status", (q) =>
            q.eq("teacherId", teacher._id).eq("status", "active"),
          )
          .take(200),
        ctx.db
          .query("teacherBatchAssignments")
          .withIndex("by_teacherId_and_status", (q) =>
            q.eq("teacherId", teacher._id).eq("status", "active"),
          )
          .take(500),
        ctx.db
          .query("batchSchedules")
          .withIndex("by_teacherId_and_status", (q) =>
            q.eq("teacherId", teacher._id).eq("status", "active"),
          )
          .take(500),
      ]);
      if (!account) continue;
      page.push({
        teacherId: teacher._id,
        employeeCode: teacher.employeeCode,
        displayName: teacher.displayName,
        loginEmail: teacher.loginEmail,
        phone: teacher.phone,
        photoUrl: teacher.photoStorageId
          ? await ctx.storage.getUrl(teacher.photoStorageId)
          : null,
        status: teacher.status,
        accountStatus: account.status,
        isPublic: teacher.isPublic,
        courseSubjectCount: defaults.length,
        activeBatchCount: new Set(assignments.map((row) => row.batchId)).size,
        weeklyClassCount: schedules.length,
      });
    }
    return { ...result, page };
  },
});

export const getTeacherDetails = query({
  args: { teacherId: v.id("teachers") },
  returns: v.union(
    v.null(),
    v.object({
      teacher: v.object({
        teacherId: v.id("teachers"),
        employeeCode: v.string(),
        displayName: v.string(),
        nameBn: v.optional(v.string()),
        nameEn: v.optional(v.string()),
        loginEmail: v.string(),
        phone: v.string(),
        bioBn: v.string(),
        bioEn: v.string(),
        qualificationsBn: v.string(),
        qualificationsEn: v.string(),
        status: teacherStatus,
        accountStatus,
        isPublic: v.boolean(),
        publicSortOrder: v.number(),
        joinedAt: v.optional(v.number()),
        photoUrl: v.union(v.string(), v.null()),
      }),
      defaults: v.array(
        v.object({
          courseId: v.id("courses"),
          courseNameBn: v.string(),
          courseNameEn: v.string(),
          subjectNameBn: v.string(),
          subjectNameEn: v.string(),
        }),
      ),
      assignments: v.array(
        v.object({
          batchId: v.id("batches"),
          batchNameBn: v.string(),
          batchNameEn: v.string(),
          courseNameBn: v.string(),
          courseNameEn: v.string(),
          subjectNameBn: v.optional(v.string()),
          subjectNameEn: v.optional(v.string()),
        }),
      ),
      weeklyClassCount: v.number(),
    }),
  ),
  handler: async (ctx, { teacherId }) => {
    await requireOwner(ctx);
    const teacher = await ctx.db.get("teachers", teacherId);
    if (!teacher) return null;
    const account = await ctx.db
      .query("portalAccounts")
      .withIndex("by_teacherId", (q) => q.eq("teacherId", teacherId))
      .unique();
    if (!account) return null;
    const [defaults, assignments, schedules] = await Promise.all([
      ctx.db
        .query("courseTeacherDefaults")
        .withIndex("by_teacherId_and_status", (q) =>
          q.eq("teacherId", teacherId).eq("status", "active"),
        )
        .take(200),
      ctx.db
        .query("teacherBatchAssignments")
        .withIndex("by_teacherId_and_status", (q) =>
          q.eq("teacherId", teacherId).eq("status", "active"),
        )
        .take(500),
      ctx.db
        .query("batchSchedules")
        .withIndex("by_teacherId_and_status", (q) =>
          q.eq("teacherId", teacherId).eq("status", "active"),
        )
        .take(500),
    ]);
    const defaultRows = [];
    for (const row of defaults) {
      const [course, subject] = await Promise.all([
        ctx.db.get("courses", row.courseId),
        ctx.db.get("subjects", row.subjectId),
      ]);
      if (course && subject)
        defaultRows.push({
          courseId: course._id,
          courseNameBn: course.nameBn,
          courseNameEn: course.nameEn,
          subjectNameBn: subject.nameEn,
          subjectNameEn: subject.nameEn,
        });
    }
    const assignmentRows = [];
    for (const row of assignments) {
      const batch = await ctx.db.get("batches", row.batchId);
      if (!batch) continue;
      const [course, subject] = await Promise.all([
        ctx.db.get("courses", batch.courseId),
        row.subjectId ? ctx.db.get("subjects", row.subjectId) : null,
      ]);
      if (course)
        assignmentRows.push({
          batchId: batch._id,
          batchNameBn: batch.nameBn,
          batchNameEn: batch.nameEn,
          courseNameBn: course.nameBn,
          courseNameEn: course.nameEn,
          subjectNameBn: subject?.nameEn,
          subjectNameEn: subject?.nameEn,
        });
    }
    return {
      teacher: {
        teacherId,
        employeeCode: teacher.employeeCode,
        displayName: teacher.displayName,
        nameBn: teacher.nameBn,
        nameEn: teacher.nameEn,
        loginEmail: teacher.loginEmail,
        phone: teacher.phone,
        bioBn: teacher.bioBn,
        bioEn: teacher.bioEn,
        qualificationsBn: teacher.qualificationsBn,
        qualificationsEn: teacher.qualificationsEn,
        status: teacher.status,
        accountStatus: account.status,
        isPublic: teacher.isPublic,
        publicSortOrder: teacher.publicSortOrder,
        joinedAt: teacher.joinedAt,
        photoUrl: teacher.photoStorageId
          ? await ctx.storage.getUrl(teacher.photoStorageId)
          : null,
      },
      defaults: defaultRows,
      assignments: assignmentRows,
      weeklyClassCount: schedules.length,
    };
  },
});

export const setActiveState = mutation({
  args: { teacherId: v.id("teachers"), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { teacherId, active }) => {
    const { account: owner } = await requireOwner(ctx);
    const teacher = await ctx.db.get("teachers", teacherId);
    if (!teacher || teacher.status === "archived")
      throw new Error("Teacher cannot change state");
    const portal = await ctx.db
      .query("portalAccounts")
      .withIndex("by_teacherId", (q) => q.eq("teacherId", teacherId))
      .unique();
    if (!portal) throw new Error("Teacher portal account not found");
    if (!active) {
      const [assignments, schedules] = await Promise.all([
        ctx.db
          .query("teacherBatchAssignments")
          .withIndex("by_teacherId_and_status", (q) =>
            q.eq("teacherId", teacherId).eq("status", "active"),
          )
          .take(1),
        ctx.db
          .query("batchSchedules")
          .withIndex("by_teacherId_and_status", (q) =>
            q.eq("teacherId", teacherId).eq("status", "active"),
          )
          .take(1),
      ]);
      if (assignments.length || schedules.length)
        throw new Error("Resolve active batch assignments and schedules first");
    }
    await ctx.db.patch("teachers", teacherId, {
      status: active ? "active" : "inactive",
      isPublic: active ? teacher.isPublic : false,
      updatedAt: Date.now(),
    });
    if (portal.status === "active" || portal.status === "suspended")
      await ctx.db.patch("portalAccounts", portal._id, {
        status: active ? "active" : "suspended",
        updatedAt: Date.now(),
      });
    await writeAudit(ctx, {
      actorAccountId: owner._id,
      actorRole: "owner",
      action: active ? "teacher.reactivated" : "teacher.deactivated",
      entityType: "teacher",
      entityId: teacherId,
      summary: active ? "Teacher reactivated" : "Teacher deactivated",
    });
    return null;
  },
});
