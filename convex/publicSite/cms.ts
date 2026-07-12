import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { writeAudit } from "../model/audit";
import { requireOwner } from "../model/auth";
import {
  boundedSortOrder,
  contentBlockKeyValidator,
  optionalTrimmed,
  requireAtLeastOneTranslation,
  requireTrimmed,
  validatePublicImageMetadata,
  validatePublicHref,
} from "./shared";

const contentInputValidator = v.object({
  titleBn: v.string(), titleEn: v.string(), bodyBn: v.string(), bodyEn: v.string(),
  primaryCtaLabelBn: v.union(v.string(), v.null()), primaryCtaLabelEn: v.union(v.string(), v.null()),
  primaryCtaHref: v.union(v.string(), v.null()), mediaStorageId: v.union(v.id("_storage"), v.null()),
});

const contentPreviewValidator = v.object({
  id: v.id("siteContentBlocks"), key: contentBlockKeyValidator,
  titleBn: v.string(), titleEn: v.string(), bodyBn: v.string(), bodyEn: v.string(),
  primaryCtaLabelBn: v.union(v.string(), v.null()), primaryCtaLabelEn: v.union(v.string(), v.null()),
  primaryCtaHref: v.union(v.string(), v.null()), mediaStorageId: v.union(v.id("_storage"), v.null()),
  mediaUrl: v.union(v.string(), v.null()), draftRevision: v.number(), publishedRevision: v.number(),
  status: v.union(v.literal("draft"), v.literal("published")), updatedAt: v.number(),
  updatedByAccountId: v.id("portalAccounts"), updatedByDisplayName: v.union(v.string(), v.null()),
});

const galleryPreviewValidator = v.object({
  id: v.id("galleryItems"), titleBn: v.string(), titleEn: v.string(), altBn: v.string(), altEn: v.string(),
  imageStorageId: v.id("_storage"), imageUrl: v.union(v.string(), v.null()), sortOrder: v.number(),
  status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
  createdAt: v.number(), updatedAt: v.number(), updatedByDisplayName: v.union(v.string(), v.null()),
});

const publicationWorkspaceValidator = v.object({
  courses: v.array(v.object({
    courseId: v.id("courses"), nameBn: v.string(), nameEn: v.string(), isPublic: v.boolean(), publicSortOrder: v.number(),
  })),
  teachers: v.array(v.object({
    teacherId: v.id("teachers"), displayName: v.string(), isPublic: v.boolean(), publicSortOrder: v.number(),
  })),
});

async function validateImage(ctx: MutationCtx, storageId: Id<"_storage">) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata) throw new Error("Uploaded image does not exist");
  validatePublicImageMetadata(metadata.contentType, metadata.size);
}

async function galleryEditorName(ctx: QueryCtx, galleryItemId: Id<"galleryItems">) {
  const [latest] = await ctx.db.query("auditLogs")
    .withIndex("by_entityType_and_entityId", (q) => q.eq("entityType", "galleryItems").eq("entityId", galleryItemId))
    .order("desc")
    .take(1);
  if (!latest?.actorAccountId) return null;
  const account = await ctx.db.get("portalAccounts", latest.actorAccountId);
  if (!account || account.role !== "owner") return null;
  const profile = await ctx.db.get("ownerProfiles", account.ownerProfileId);
  return profile?.displayName ?? null;
}

async function contentPreview(ctx: QueryCtx, id: Id<"siteContentBlocks">) {
  const block = await ctx.db.get("siteContentBlocks", id);
  if (!block) return null;
  const editorAccount = await ctx.db.get("portalAccounts", block.updatedByAccountId);
  const editorProfile = editorAccount?.role === "owner" ? await ctx.db.get("ownerProfiles", editorAccount.ownerProfileId) : null;
  return {
    id: block._id, key: block.key, titleBn: block.titleBn, titleEn: block.titleEn, bodyBn: block.bodyBn, bodyEn: block.bodyEn,
    primaryCtaLabelBn: block.primaryCtaLabelBn ?? null, primaryCtaLabelEn: block.primaryCtaLabelEn ?? null,
    primaryCtaHref: block.primaryCtaHref ?? null, mediaStorageId: block.mediaStorageId ?? null,
    mediaUrl: block.mediaStorageId ? await ctx.storage.getUrl(block.mediaStorageId) : null,
    draftRevision: block.draftRevision, publishedRevision: block.publishedRevision, status: block.status,
    updatedAt: block.updatedAt, updatedByAccountId: block.updatedByAccountId, updatedByDisplayName: editorProfile?.displayName ?? null,
  };
}

export const getContentPreview = query({
  args: { key: contentBlockKeyValidator },
  returns: v.union(contentPreviewValidator, v.null()),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const block = await ctx.db.query("siteContentBlocks").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    return block ? await contentPreview(ctx, block._id) : null;
  },
});

export const listContentPreviews = query({
  args: {},
  returns: v.array(contentPreviewValidator),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const keys = ["hero", "about_summary", "contact", "achievement_intro", "admission_intro", "footer"] as const;
    const previews = await Promise.all(keys.map(async (key) => {
      const block = await ctx.db.query("siteContentBlocks").withIndex("by_key", (q) => q.eq("key", key)).unique();
      return block ? await contentPreview(ctx, block._id) : null;
    }));
    return previews.filter((preview) => preview !== null);
  },
});

export const saveContentDraft = mutation({
  args: { key: contentBlockKeyValidator, content: contentInputValidator },
  returns: v.id("siteContentBlocks"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const content = {
      titleBn: args.content.titleBn.trim(), titleEn: args.content.titleEn.trim(),
      bodyBn: args.content.bodyBn.trim(), bodyEn: args.content.bodyEn.trim(),
      primaryCtaLabelBn: optionalTrimmed(args.content.primaryCtaLabelBn ?? undefined, "Bangla CTA label", 120),
      primaryCtaLabelEn: optionalTrimmed(args.content.primaryCtaLabelEn ?? undefined, "English CTA label", 120),
      primaryCtaHref: optionalTrimmed(args.content.primaryCtaHref ?? undefined, "CTA URL", 500),
      mediaStorageId: args.content.mediaStorageId ?? undefined,
    };
    if (content.titleBn.length > 300 || content.titleEn.length > 300) throw new Error("Content titles must be at most 300 characters");
    if (content.bodyBn.length > 20_000 || content.bodyEn.length > 20_000) throw new Error("Content bodies must be at most 20000 characters");
    if (content.primaryCtaHref) validatePublicHref(content.primaryCtaHref);
    if (content.mediaStorageId) await validateImage(ctx, content.mediaStorageId);
    const existing = await ctx.db.query("siteContentBlocks").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    const now = Date.now();
    let id: Id<"siteContentBlocks">;
    if (existing) {
      id = existing._id;
      await ctx.db.patch("siteContentBlocks", id, {
        ...content, status: "draft", draftRevision: existing.draftRevision + 1, updatedAt: now, updatedByAccountId: account._id,
      });
    } else {
      id = await ctx.db.insert("siteContentBlocks", {
        key: args.key, ...content, draftRevision: 1, publishedRevision: 0, status: "draft", updatedAt: now, updatedByAccountId: account._id,
      });
    }
    await writeAudit(ctx, {
      actorAccountId: account._id, actorRole: "owner", action: "cms.content_draft_saved", entityType: "siteContentBlocks", entityId: id,
      summary: `Saved ${args.key} content draft`, metadata: { key: args.key },
    });
    return id;
  },
});

export const publishContent = mutation({
  args: { key: contentBlockKeyValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const block = await ctx.db.query("siteContentBlocks").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    if (!block) throw new Error("Content block does not exist");
    requireAtLeastOneTranslation(block.titleBn, block.titleEn, "Title");
    requireAtLeastOneTranslation(block.bodyBn, block.bodyEn, "Body");
    const now = Date.now();
    const existingRevision = await ctx.db.query("siteContentRevisions")
      .withIndex("by_contentBlockId_and_revision", (q) => q.eq("contentBlockId", block._id).eq("revision", block.draftRevision))
      .unique();
    if (!existingRevision) {
      await ctx.db.insert("siteContentRevisions", {
        contentBlockId: block._id, revision: block.draftRevision,
        titleBn: block.titleBn, titleEn: block.titleEn, bodyBn: block.bodyBn, bodyEn: block.bodyEn,
        primaryCtaLabelBn: block.primaryCtaLabelBn, primaryCtaLabelEn: block.primaryCtaLabelEn,
        primaryCtaHref: block.primaryCtaHref, mediaStorageId: block.mediaStorageId,
        publishedAt: now, publishedByAccountId: account._id,
      });
    }
    await ctx.db.patch("siteContentBlocks", block._id, {
      status: "published", publishedRevision: block.draftRevision, updatedAt: now, updatedByAccountId: account._id,
    });
    await writeAudit(ctx, {
      actorAccountId: account._id, actorRole: "owner", action: "cms.content_published", entityType: "siteContentBlocks", entityId: block._id,
      summary: `Published ${args.key} content`, metadata: { key: args.key, revision: block.draftRevision },
    });
    return null;
  },
});

export const generateImageUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const listGalleryPreviews = query({
  args: {},
  returns: v.array(galleryPreviewValidator),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const statuses = ["draft", "published", "archived"] as const;
    const groups = await Promise.all(statuses.map((status) => ctx.db.query("galleryItems").withIndex("by_status_and_sortOrder", (q) => q.eq("status", status)).take(100)));
    const items = groups.flat().sort((a, b) => a.sortOrder - b.sortOrder || a._creationTime - b._creationTime);
    return await Promise.all(items.map(async (item) => ({
      id: item._id, titleBn: item.titleBn, titleEn: item.titleEn, altBn: item.altBn, altEn: item.altEn,
      imageStorageId: item.imageStorageId, imageUrl: await ctx.storage.getUrl(item.imageStorageId), sortOrder: item.sortOrder,
      status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt,
      updatedByDisplayName: await galleryEditorName(ctx, item._id),
    })));
  },
});

export const createGalleryItem = mutation({
  args: { titleBn: v.string(), titleEn: v.string(), altBn: v.string(), altEn: v.string(), imageStorageId: v.id("_storage"), sortOrder: v.number() },
  returns: v.id("galleryItems"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    await validateImage(ctx, args.imageStorageId);
    const now = Date.now();
    const id = await ctx.db.insert("galleryItems", {
      titleBn: requireTrimmed(args.titleBn, "Bangla title", 300), titleEn: requireTrimmed(args.titleEn, "English title", 300),
      altBn: requireTrimmed(args.altBn, "Bangla alt text", 500), altEn: requireTrimmed(args.altEn, "English alt text", 500),
      imageStorageId: args.imageStorageId, sortOrder: boundedSortOrder(args.sortOrder), status: "draft", createdAt: now, updatedAt: now,
    });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "cms.gallery_created", entityType: "galleryItems", entityId: id, summary: "Created gallery draft" });
    return id;
  },
});

export const updateGalleryItem = mutation({
  args: {
    galleryItemId: v.id("galleryItems"), titleBn: v.string(), titleEn: v.string(), altBn: v.string(), altEn: v.string(),
    imageStorageId: v.id("_storage"), sortOrder: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const item = await ctx.db.get("galleryItems", args.galleryItemId);
    if (!item || item.status === "archived") throw new Error("Gallery item is unavailable");
    await validateImage(ctx, args.imageStorageId);
    await ctx.db.patch("galleryItems", item._id, {
      titleBn: requireTrimmed(args.titleBn, "Bangla title", 300),
      titleEn: requireTrimmed(args.titleEn, "English title", 300),
      altBn: requireTrimmed(args.altBn, "Bangla alt text", 500),
      altEn: requireTrimmed(args.altEn, "English alt text", 500),
      imageStorageId: args.imageStorageId,
      sortOrder: boundedSortOrder(args.sortOrder),
      status: "draft",
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      actorAccountId: account._id, actorRole: "owner", action: "cms.gallery_draft_saved", entityType: "galleryItems", entityId: item._id,
      summary: "Updated gallery draft",
    });
    return null;
  },
});

export const getPublicationWorkspace = query({
  args: {},
  returns: publicationWorkspaceValidator,
  handler: async (ctx) => {
    await requireOwner(ctx);
    const [courses, teachers] = await Promise.all([
      ctx.db.query("courses").withIndex("by_status", (q) => q.eq("status", "active")).take(200),
      ctx.db.query("teachers").withIndex("by_status", (q) => q.eq("status", "active")).take(200),
    ]);
    return {
      courses: courses.map((course) => ({
        courseId: course._id, nameBn: course.nameBn, nameEn: course.nameEn,
        isPublic: course.isPublic, publicSortOrder: course.publicSortOrder,
      })),
      teachers: teachers.map((teacher) => ({
        teacherId: teacher._id, displayName: teacher.displayName,
        isPublic: teacher.isPublic, publicSortOrder: teacher.publicSortOrder,
      })),
    };
  },
});

export const publishGalleryItem = mutation({
  args: { galleryItemId: v.id("galleryItems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const item = await ctx.db.get("galleryItems", args.galleryItemId);
    if (!item || item.status === "archived") throw new Error("Gallery item is unavailable");
    await validateImage(ctx, item.imageStorageId);
    requireTrimmed(item.altBn, "Bangla alt text", 500);
    requireTrimmed(item.altEn, "English alt text", 500);
    await ctx.db.patch("galleryItems", item._id, { status: "published", updatedAt: Date.now() });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "cms.gallery_published", entityType: "galleryItems", entityId: item._id, summary: "Published gallery item" });
    return null;
  },
});

export const archiveGalleryItem = mutation({
  args: { galleryItemId: v.id("galleryItems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const item = await ctx.db.get("galleryItems", args.galleryItemId);
    if (!item) throw new Error("Gallery item does not exist");
    if (item.status !== "archived") await ctx.db.patch("galleryItems", item._id, { status: "archived", updatedAt: Date.now() });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "cms.gallery_archived", entityType: "galleryItems", entityId: item._id, summary: "Archived gallery item" });
    return null;
  },
});

export const setCoursePublication = mutation({
  args: { courseId: v.id("courses"), isPublic: v.boolean(), publicSortOrder: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const course = await ctx.db.get("courses", args.courseId);
    if (!course) throw new Error("Course does not exist");
    if (args.isPublic && course.status !== "active") throw new Error("Only active courses can be public");
    await ctx.db.patch("courses", course._id, { isPublic: args.isPublic, publicSortOrder: boundedSortOrder(args.publicSortOrder), updatedAt: Date.now(), updatedByAccountId: account._id });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: args.isPublic ? "cms.course_published" : "cms.course_unpublished", entityType: "courses", entityId: course._id, summary: args.isPublic ? "Published course on public website" : "Removed course from public website" });
    return null;
  },
});

export const setTeacherPublication = mutation({
  args: { teacherId: v.id("teachers"), isPublic: v.boolean(), publicSortOrder: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const teacher = await ctx.db.get("teachers", args.teacherId);
    if (!teacher) throw new Error("Teacher does not exist");
    if (args.isPublic && teacher.status !== "active") throw new Error("Only active teachers can be public");
    await ctx.db.patch("teachers", teacher._id, { isPublic: args.isPublic, publicSortOrder: boundedSortOrder(args.publicSortOrder), updatedAt: Date.now() });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: args.isPublic ? "cms.teacher_published" : "cms.teacher_unpublished", entityType: "teachers", entityId: teacher._id, summary: args.isPublic ? "Published teacher on public website" : "Removed teacher from public website" });
    return null;
  },
});

export const publishPublicNotice = mutation({
  args: { noticeId: v.id("notices") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const notice = await ctx.db.get("notices", args.noticeId);
    if (!notice) throw new Error("Notice does not exist");
    if (notice.audienceType !== "public") throw new Error("Only public-audience notices can be published publicly");
    if (notice.status === "archived") throw new Error("Archived notices cannot be published");
    requireAtLeastOneTranslation(notice.titleBn, notice.titleEn, "Notice title");
    requireAtLeastOneTranslation(notice.bodyBn, notice.bodyEn, "Notice body");
    const now = Date.now();
    await ctx.db.patch("notices", notice._id, { status: "published", publishedAt: now, updatedAt: now });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "cms.notice_published", entityType: "notices", entityId: notice._id, summary: "Published public notice" });
    return null;
  },
});
