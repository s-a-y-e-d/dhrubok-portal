import { v } from "convex/values";
import { query } from "../_generated/server";
import {
  boundedLimit,
  contentBlockKeyValidator,
  localeValidator,
  localizedTextValidator,
  localize,
} from "./shared";

const contentBlockValidator = v.object({
  key: contentBlockKeyValidator,
  title: localizedTextValidator,
  body: localizedTextValidator,
  primaryCtaLabel: localizedTextValidator,
  primaryCtaHref: v.union(v.string(), v.null()),
  mediaUrl: v.union(v.string(), v.null()),
  publishedRevision: v.number(),
  updatedAt: v.number(),
});

const galleryItemValidator = v.object({
  id: v.id("galleryItems"),
  title: localizedTextValidator,
  alt: localizedTextValidator,
  imageUrl: v.union(v.string(), v.null()),
  sortOrder: v.number(),
});

const courseCardValidator = v.object({
  id: v.id("courses"),
  slug: v.string(),
  name: localizedTextValidator,
  shortDescription: localizedTextValidator,
  coverUrl: v.union(v.string(), v.null()),
  publicSortOrder: v.number(),
});

const teacherCardValidator = v.object({
  id: v.id("teachers"),
  displayName: v.string(),
  name: localizedTextValidator,
  bio: localizedTextValidator,
  qualifications: localizedTextValidator,
  photoUrl: v.union(v.string(), v.null()),
  publicSortOrder: v.number(),
});

const noticeCardValidator = v.object({
  id: v.id("notices"),
  title: localizedTextValidator,
  body: localizedTextValidator,
  publishedAt: v.number(),
});

const scheduleSummaryValidator = v.object({
  id: v.id("batchSchedules"), batchId: v.id("batches"), weekday: v.number(), startMinutes: v.number(), endMinutes: v.number(),
});

export const getContentBlock = query({
  args: { key: contentBlockKeyValidator, locale: localeValidator },
  returns: v.union(contentBlockValidator, v.null()),
  handler: async (ctx, args) => {
    const block = await ctx.db.query("siteContentBlocks").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    if (!block || block.publishedRevision < 1) return null;
    const published = await ctx.db.query("siteContentRevisions")
      .withIndex("by_contentBlockId_and_revision", (q) => q.eq("contentBlockId", block._id).eq("revision", block.publishedRevision))
      .unique();
    if (!published) return null;
    return {
      key: block.key,
      title: localize(published.titleBn, published.titleEn, args.locale),
      body: localize(published.bodyBn, published.bodyEn, args.locale),
      primaryCtaLabel: localize(published.primaryCtaLabelBn, published.primaryCtaLabelEn, args.locale),
      primaryCtaHref: published.primaryCtaHref ?? null,
      mediaUrl: published.mediaStorageId ? await ctx.storage.getUrl(published.mediaStorageId) : null,
      publishedRevision: block.publishedRevision,
      updatedAt: published.publishedAt,
    };
  },
});

export const listGallery = query({
  args: { locale: localeValidator, limit: v.number() },
  returns: v.array(galleryItemValidator),
  handler: async (ctx, args) => {
    const limit = boundedLimit(args.limit, 48);
    const items = await ctx.db.query("galleryItems").withIndex("by_status_and_sortOrder", (q) => q.eq("status", "published")).take(limit);
    return await Promise.all(items.map(async (item) => ({
      id: item._id,
      title: localize(item.titleBn, item.titleEn, args.locale),
      alt: localize(item.altBn, item.altEn, args.locale),
      imageUrl: await ctx.storage.getUrl(item.imageStorageId),
      sortOrder: item.sortOrder,
    })));
  },
});

export const listCourses = query({
  args: { locale: localeValidator, limit: v.number() },
  returns: v.array(courseCardValidator),
  handler: async (ctx, args) => {
    const limit = boundedLimit(args.limit, 50);
    const candidates = await ctx.db.query("courses").withIndex("by_isPublic_and_status_and_publicSortOrder", (q) => q.eq("isPublic", true).eq("status", "active")).take(limit);
    return await Promise.all(candidates.map(async (course) => ({
      id: course._id,
      slug: course.slug,
      name: localize(course.nameBn, course.nameEn, args.locale),
      shortDescription: localize(course.shortDescriptionBn, course.shortDescriptionEn, args.locale),
      coverUrl: course.coverStorageId ? await ctx.storage.getUrl(course.coverStorageId) : null,
      publicSortOrder: course.publicSortOrder,
    })));
  },
});

export const getCourse = query({
  args: { slug: v.string(), locale: localeValidator },
  returns: v.union(v.object({
    ...courseCardValidator.fields,
    description: localizedTextValidator,
    subjects: v.array(v.object({ id: v.id("subjects"), name: localizedTextValidator, sortOrder: v.number() })),
    batches: v.array(v.object({
      id: v.id("batches"), slug: v.string(), name: localizedTextValidator,
      admissionOpen: v.boolean(), publicSortOrder: v.number(),
    })),
    schedules: v.array(scheduleSummaryValidator),
  }), v.null()),
  handler: async (ctx, args) => {
    const course = await ctx.db.query("courses").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
    if (!course || !course.isPublic || course.status !== "active") return null;
    const joins = await ctx.db.query("courseSubjects").withIndex("by_courseId_and_sortOrder", (q) => q.eq("courseId", course._id)).take(50);
    const subjects = (await Promise.all(joins.map(async (join) => {
      const subject = await ctx.db.get("subjects", join.subjectId);
      return subject && subject.status === "active"
        ? { id: subject._id, name: localize(subject.nameBn, subject.nameEn, args.locale), sortOrder: join.sortOrder }
        : null;
    }))).filter((subject) => subject !== null);
    const batches = (await ctx.db.query("batches").withIndex("by_courseId_and_status", (q) => q.eq("courseId", course._id).eq("status", "active")).take(50))
      .filter((batch) => batch.isPublic)
      .sort((a, b) => a.publicSortOrder - b.publicSortOrder)
      .map((batch) => ({
        id: batch._id, slug: batch.slug, name: localize(batch.nameBn, batch.nameEn, args.locale),
        admissionOpen: batch.admissionOpen, publicSortOrder: batch.publicSortOrder,
      }));
    const schedules = (await Promise.all(batches.map(async (batch) => {
      const rows = await ctx.db.query("batchSchedules")
        .withIndex("by_batchId_and_status", (q) => q.eq("batchId", batch.id).eq("status", "active"))
        .take(20);
      return rows.map((row) => ({
        id: row._id, batchId: row.batchId, weekday: row.weekday, startMinutes: row.startMinutes, endMinutes: row.endMinutes,
      }));
    }))).flat();
    return {
      id: course._id, slug: course.slug, name: localize(course.nameBn, course.nameEn, args.locale),
      shortDescription: localize(course.shortDescriptionBn, course.shortDescriptionEn, args.locale),
      description: localize(course.descriptionBn, course.descriptionEn, args.locale),
      coverUrl: course.coverStorageId ? await ctx.storage.getUrl(course.coverStorageId) : null,
      publicSortOrder: course.publicSortOrder, subjects, batches, schedules,
    };
  },
});

export const listOpenBatches = query({
  args: { locale: localeValidator, limit: v.number() },
  returns: v.array(v.object({
    id: v.id("batches"), courseId: v.id("courses"), courseSlug: v.string(), courseName: localizedTextValidator,
    name: localizedTextValidator, publicSortOrder: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = boundedLimit(args.limit, 50);
    const candidates = await ctx.db.query("batches")
      .withIndex("by_isPublic_and_status_and_publicSortOrder", (q) => q.eq("isPublic", true).eq("status", "active"))
      .take(limit);
    const open = candidates.filter((batch) => batch.admissionOpen);
    return (await Promise.all(open.map(async (batch) => {
      const course = await ctx.db.get("courses", batch.courseId);
      if (!course || !course.isPublic || course.status !== "active") return null;
      return {
        id: batch._id, courseId: course._id, courseSlug: course.slug,
        courseName: localize(course.nameBn, course.nameEn, args.locale),
        name: localize(batch.nameBn, batch.nameEn, args.locale), publicSortOrder: batch.publicSortOrder,
      };
    }))).filter((batch) => batch !== null);
  },
});

export const listSitemapEntries = query({
  args: {},
  returns: v.object({
    courseSlugs: v.array(v.string()),
    notices: v.array(v.object({ id: v.id("notices"), publishedAt: v.number() })),
  }),
  handler: async (ctx) => {
    const [courses, notices] = await Promise.all([
      ctx.db.query("courses").withIndex("by_isPublic_and_status_and_publicSortOrder", (q) => q.eq("isPublic", true).eq("status", "active")).take(200),
      ctx.db.query("notices").withIndex("by_audienceType_and_status", (q) => q.eq("audienceType", "public").eq("status", "published")).take(500),
    ]);
    return {
      courseSlugs: courses.map((course) => course.slug),
      notices: notices.map((notice) => ({ id: notice._id, publishedAt: notice.publishedAt ?? notice.updatedAt })),
    };
  },
});

export const listTeachers = query({
  args: { locale: localeValidator, limit: v.number() },
  returns: v.array(teacherCardValidator),
  handler: async (ctx, args) => {
    const limit = boundedLimit(args.limit, 50);
    const candidates = await ctx.db.query("teachers").withIndex("by_isPublic_and_status_and_publicSortOrder", (q) => q.eq("isPublic", true).eq("status", "active")).take(limit);
    return await Promise.all(candidates.map(async (teacher) => ({
      id: teacher._id,
      displayName: teacher.displayName,
      name: localize(teacher.nameBn ?? teacher.displayName, teacher.nameEn ?? teacher.displayName, args.locale),
      bio: localize(teacher.bioBn, teacher.bioEn, args.locale),
      qualifications: localize(teacher.qualificationsBn, teacher.qualificationsEn, args.locale),
      photoUrl: teacher.photoStorageId ? await ctx.storage.getUrl(teacher.photoStorageId) : null,
      publicSortOrder: teacher.publicSortOrder,
    })));
  },
});

export const listNotices = query({
  args: { locale: localeValidator, limit: v.number() },
  returns: v.array(noticeCardValidator),
  handler: async (ctx, args) => {
    const limit = boundedLimit(args.limit, 50);
    const notices = await ctx.db.query("notices").withIndex("by_audienceType_and_status", (q) => q.eq("audienceType", "public").eq("status", "published")).order("desc").take(limit);
    return notices.map((notice) => ({
      id: notice._id, title: localize(notice.titleBn, notice.titleEn, args.locale),
      body: localize(notice.bodyBn, notice.bodyEn, args.locale), publishedAt: notice.publishedAt ?? notice.updatedAt,
    }));
  },
});

export const getNotice = query({
  args: { noticeId: v.id("notices"), locale: localeValidator },
  returns: v.union(noticeCardValidator, v.null()),
  handler: async (ctx, args) => {
    const notice = await ctx.db.get("notices", args.noticeId);
    if (!notice || notice.audienceType !== "public" || notice.status !== "published") return null;
    return {
      id: notice._id, title: localize(notice.titleBn, notice.titleEn, args.locale),
      body: localize(notice.bodyBn, notice.bodyEn, args.locale), publishedAt: notice.publishedAt ?? notice.updatedAt,
    };
  },
});
