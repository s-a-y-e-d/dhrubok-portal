import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireAccount, requireOwner, requireStudent } from "../model/auth";
import { writeAudit } from "../model/audit";
import { canAccessMaterial, requireMaterialManager, validateAcademicScope, validateExternalUrl, validateMaterialText, validateStoredFile } from "./shared";

const kindValidator = v.union(v.literal("file"), v.literal("link"), v.literal("text"));
const statusValidator = v.union(v.literal("draft"), v.literal("published"), v.literal("archived"));
const visibilityValidator = v.union(v.literal("course"), v.literal("batch"));

const materialValidator = v.object({
  _id: v.id("materials"), _creationTime: v.number(), courseId: v.id("courses"), batchId: v.optional(v.id("batches")), subjectId: v.optional(v.id("subjects")),
  titleBn: v.string(), titleEn: v.string(), descriptionBn: v.string(), descriptionEn: v.string(), kind: kindValidator,
  storageId: v.optional(v.id("_storage")), externalUrl: v.optional(v.string()), visibility: visibilityValidator, status: statusValidator,
  publishedAt: v.optional(v.number()), createdByAccountId: v.id("portalAccounts"), createdAt: v.number(), updatedAt: v.number(),
});

const studentMaterialValidator = v.object({
  _id: v.id("materials"), courseId: v.id("courses"), batchId: v.optional(v.id("batches")), subjectId: v.optional(v.id("subjects")),
  titleBn: v.string(), titleEn: v.string(), descriptionBn: v.string(), descriptionEn: v.string(), kind: kindValidator,
  externalUrl: v.optional(v.string()), visibility: visibilityValidator, publishedAt: v.optional(v.number()),
});

const materialInput = {
  courseId: v.id("courses"), batchId: v.optional(v.id("batches")), subjectId: v.optional(v.id("subjects")),
  titleBn: v.string(), titleEn: v.string(), descriptionBn: v.string(), descriptionEn: v.string(), kind: kindValidator,
  storageId: v.optional(v.id("_storage")), fileName: v.optional(v.string()), externalUrl: v.optional(v.string()), visibility: visibilityValidator,
};

async function validateInput(ctx: Parameters<typeof validateStoredFile>[0], input: {
  courseId: Parameters<typeof validateAcademicScope>[1]["courseId"];
  batchId?: Parameters<typeof validateAcademicScope>[1]["batchId"];
  subjectId?: Parameters<typeof validateAcademicScope>[1]["subjectId"];
  titleBn: string; titleEn: string; descriptionBn: string; descriptionEn: string;
  kind: "file" | "link" | "text"; storageId?: Parameters<typeof validateStoredFile>[1]; fileName?: string; externalUrl?: string; visibility: "course" | "batch";
}) {
  validateMaterialText(input);
  await validateAcademicScope(ctx, input);
  if (input.kind === "file") {
    if (!input.storageId || !input.fileName || input.externalUrl) throw new Error("File materials require only an uploaded file and filename");
    await validateStoredFile(ctx, input.storageId, input.fileName);
  } else if (input.kind === "link") {
    if (!input.externalUrl || input.storageId || input.fileName) throw new Error("Link materials require only an external URL");
    validateExternalUrl(input.externalUrl);
  } else if (input.storageId || input.externalUrl || input.fileName) {
    throw new Error("Text materials cannot include a file or link");
  }
}

export const generateUploadUrl = mutation({
  args: {}, returns: v.string(),
  handler: async (ctx) => {
    const account = await requireAccount(ctx);
    if (account.role !== "owner" && account.role !== "teacher") throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: { ...materialInput, publish: v.boolean() }, returns: v.id("materials"),
  handler: async (ctx, args) => {
    const account = await requireMaterialManager(ctx, args);
    await validateInput(ctx, args);
    const now = Date.now();
    const id = await ctx.db.insert("materials", {
      courseId: args.courseId, batchId: args.batchId, subjectId: args.subjectId, titleBn: args.titleBn.trim(), titleEn: args.titleEn.trim(),
      descriptionBn: args.descriptionBn.trim(), descriptionEn: args.descriptionEn.trim(), kind: args.kind, storageId: args.storageId,
      externalUrl: args.externalUrl, visibility: args.visibility, status: args.publish ? "published" : "draft", publishedAt: args.publish ? now : undefined,
      createdByAccountId: account._id, createdAt: now, updatedAt: now,
    });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: account.role, action: args.publish ? "material.published" : "material.created", entityType: "material", entityId: id, summary: args.publish ? "Published learning material" : "Created learning material draft" });
    return id;
  },
});

export const updateDraft = mutation({
  args: { materialId: v.id("materials"), ...materialInput }, returns: v.null(),
  handler: async (ctx, args) => {
    const material = await ctx.db.get("materials", args.materialId);
    if (!material || material.status !== "draft") throw new Error("Only draft materials can be edited");
    const account = await requireMaterialManager(ctx, args);
    if (account.role === "teacher" && material.createdByAccountId !== account._id) throw new Error("Unauthorized");
    await validateInput(ctx, args);
    await ctx.db.patch("materials", args.materialId, {
      courseId: args.courseId, batchId: args.batchId, subjectId: args.subjectId, titleBn: args.titleBn.trim(), titleEn: args.titleEn.trim(),
      descriptionBn: args.descriptionBn.trim(), descriptionEn: args.descriptionEn.trim(), kind: args.kind, storageId: args.storageId,
      externalUrl: args.externalUrl, visibility: args.visibility, updatedAt: Date.now(),
    });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: account.role, action: "material.updated", entityType: "material", entityId: args.materialId, summary: "Updated learning material draft" });
    return null;
  },
});

export const publish = mutation({
  args: { materialId: v.id("materials") }, returns: v.null(),
  handler: async (ctx, args) => {
    const material = await ctx.db.get("materials", args.materialId);
    if (!material || material.status !== "draft") throw new Error("Only draft materials can be published");
    const account = await requireMaterialManager(ctx, material);
    if (account.role === "teacher" && material.createdByAccountId !== account._id) throw new Error("Unauthorized");
    const now = Date.now();
    await ctx.db.patch("materials", args.materialId, { status: "published", publishedAt: now, updatedAt: now });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: account.role, action: "material.published", entityType: "material", entityId: args.materialId, summary: "Published learning material" });
    return null;
  },
});

export const archive = mutation({
  args: { materialId: v.id("materials") }, returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const material = await ctx.db.get("materials", args.materialId);
    if (!material) throw new Error("Material not found");
    if (material.status === "archived") return null;
    await ctx.db.patch("materials", args.materialId, { status: "archived", updatedAt: Date.now() });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "material.archived", entityType: "material", entityId: args.materialId, summary: "Archived learning material" });
    return null;
  },
});

export const deleteArchivedFile = mutation({
  args: { materialId: v.id("materials") }, returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const material = await ctx.db.get("materials", args.materialId);
    if (!material || material.status !== "archived" || material.kind !== "file" || !material.storageId) throw new Error("Only an archived material file can be deleted");
    const materials = await ctx.db.query("materials").take(1_001);
    if (materials.length > 1_000) throw new Error("Safe file cleanup requires the material storage index");
    if (materials.some((other) => other._id !== material._id && other.storageId === material.storageId)) throw new Error("Stored file is still referenced by another material");
    await ctx.storage.delete(material.storageId);
    await ctx.db.patch("materials", material._id, { storageId: undefined, updatedAt: Date.now() });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "material.file_deleted", entityType: "material", entityId: material._id, summary: "Deleted the stored file for an archived material" });
    return null;
  },
});

export const listForStudent = query({
  args: {}, returns: v.array(studentMaterialValidator),
  handler: async (ctx) => {
    const { student } = await requireStudent(ctx);
    const enrolments = await ctx.db.query("enrolments").withIndex("by_studentId_and_status", (q) => q.eq("studentId", student._id).eq("status", "active")).take(100);
    const byId = new Map<string, Doc<"materials">>();
    for (const enrolment of enrolments) {
      const courseMaterials = await ctx.db.query("materials").withIndex("by_courseId_and_status", (q) => q.eq("courseId", enrolment.courseId).eq("status", "published")).order("desc").take(100);
      const batchMaterials = await ctx.db.query("materials").withIndex("by_batchId_and_status", (q) => q.eq("batchId", enrolment.batchId).eq("status", "published")).order("desc").take(100);
      for (const material of [...courseMaterials, ...batchMaterials]) {
        if ((material.visibility === "course" || material.batchId === enrolment.batchId) && material.status === "published") byId.set(material._id, material);
      }
    }
    return [...byId.values()].sort((a, b) => (b.publishedAt ?? b.updatedAt) - (a.publishedAt ?? a.updatedAt)).slice(0, 200).map((material) => ({ _id: material._id, courseId: material.courseId, batchId: material.batchId, subjectId: material.subjectId, titleBn: material.titleBn, titleEn: material.titleEn, descriptionBn: material.descriptionBn, descriptionEn: material.descriptionEn, kind: material.kind, externalUrl: material.externalUrl, visibility: material.visibility, publishedAt: material.publishedAt }));
  },
});

export const getDownloadUrl = query({
  args: { materialId: v.id("materials") }, returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const material = await ctx.db.get("materials", args.materialId);
    if (!material || material.kind !== "file" || !material.storageId || material.status === "archived") return null;
    if (!(await canAccessMaterial(ctx, material))) throw new Error("Unauthorized");
    return await ctx.storage.getUrl(material.storageId);
  },
});

export const listManaged = query({
  args: { status: statusValidator, courseId: v.optional(v.id("courses")) }, returns: v.array(materialValidator),
  handler: async (ctx, args) => {
    const account = await requireAccount(ctx);
    if (account.role === "owner") {
      if (args.courseId) return await ctx.db.query("materials").withIndex("by_courseId_and_status", (q) => q.eq("courseId", args.courseId!).eq("status", args.status)).order("desc").take(200);
      return await ctx.db.query("materials").withIndex("by_status_and_publishedAt", (q) => q.eq("status", args.status)).order("desc").take(200);
    }
    if (account.role !== "teacher") throw new Error("Unauthorized");
    const rows = await ctx.db.query("materials").withIndex("by_createdByAccountId_and_status", (q) => q.eq("createdByAccountId", account._id).eq("status", args.status)).order("desc").take(200);
    return args.courseId ? rows.filter((row) => row.courseId === args.courseId) : rows;
  },
});
