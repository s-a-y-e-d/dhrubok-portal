/// <reference types="vite/client" />

import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { validatePublicHref, validatePublicImageMetadata } from "./shared";

const modules = Object.fromEntries([
  ...Object.entries(import.meta.glob("../**/*.ts")).map(([path, loader]) => [`./${path.slice(3)}`, loader]),
  ...Object.entries(import.meta.glob("./*.ts")).map(([path, loader]) => [`./publicSite/${path.slice(2)}`, loader]),
]);

async function seedOwner(t: ReturnType<typeof convexTest>, tokenIdentifier = "clerk|owner") {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const profileId = await ctx.db.insert("ownerProfiles", {
      displayName: "CMS Owner", email: "owner@example.com", status: "active", createdAt: now, updatedAt: now,
    });
    const accountId = await ctx.db.insert("portalAccounts", {
      role: "owner", status: "active", tokenIdentifier, loginEmail: "owner@example.com", normalizedLoginEmail: "owner@example.com",
      ownerProfileId: profileId, locale: "en", createdAt: now, updatedAt: now,
    });
    return { accountId };
  });
}

async function seedTeacherIdentity(t: ReturnType<typeof convexTest>, tokenIdentifier = "clerk|teacher") {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const teacherId = await ctx.db.insert("teachers", {
      employeeCode: "T-OWNER-CHECK", displayName: "Teacher", loginEmail: "teacher@example.com", normalizedLoginEmail: "teacher@example.com",
      phone: "+8801700000000", bioBn: "", bioEn: "", qualificationsBn: "", qualificationsEn: "", status: "active",
      isPublic: false, publicSortOrder: 0, createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("portalAccounts", {
      role: "teacher", status: "active", tokenIdentifier, loginEmail: "teacher@example.com", normalizedLoginEmail: "teacher@example.com",
      teacherId, locale: "en", createdAt: now, updatedAt: now,
    });
  });
}

const draftContent = {
  titleBn: "খসড়া", titleEn: "Draft", bodyBn: "খসড়া বডি", bodyEn: "Draft body",
  primaryCtaLabelBn: null, primaryCtaLabelEn: null, primaryCtaHref: null, mediaStorageId: null,
};

describe("public website CMS", () => {
  it("never exposes draft content, including a newer draft of a published block", async () => {
    const t = convexTest(schema, modules);
    await seedOwner(t);
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", email: "owner@example.com" });

    await owner.mutation(anyApi.publicSite.cms.saveContentDraft, { key: "hero", content: draftContent });
    await expect(t.query(anyApi.publicSite.public.getContentBlock, { key: "hero", locale: "en" })).resolves.toBeNull();

    await owner.mutation(anyApi.publicSite.cms.publishContent, { key: "hero" });
    await expect(t.query(anyApi.publicSite.public.getContentBlock, { key: "hero", locale: "en" })).resolves.toMatchObject({
      key: "hero", title: { value: "Draft", didFallback: false }, publishedRevision: 1,
    });

    await owner.mutation(anyApi.publicSite.cms.saveContentDraft, {
      key: "hero", content: { ...draftContent, titleEn: "New unpublished draft" },
    });
    await expect(t.query(anyApi.publicSite.public.getContentBlock, { key: "hero", locale: "en" })).resolves.toMatchObject({
      title: { value: "Draft" }, publishedRevision: 1,
    });
  });

  it("uses the other locale deterministically and reports fallback metadata", async () => {
    const t = convexTest(schema, modules);
    await seedOwner(t);
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", email: "owner@example.com" });
    await owner.mutation(anyApi.publicSite.cms.saveContentDraft, {
      key: "about_summary",
      content: { ...draftContent, titleBn: "", titleEn: "About us", bodyBn: "", bodyEn: "English-only body" },
    });
    await owner.mutation(anyApi.publicSite.cms.publishContent, { key: "about_summary" });

    await expect(t.query(anyApi.publicSite.public.getContentBlock, { key: "about_summary", locale: "bn" })).resolves.toMatchObject({
      title: { value: "About us", requestedLocale: "bn", resolvedLocale: "en", didFallback: true },
      body: { value: "English-only body", requestedLocale: "bn", resolvedLocale: "en", didFallback: true },
    });
  });

  it("projects public teacher fields without private login or phone data", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("teachers", {
        employeeCode: "T-001", displayName: "Public Teacher", nameEn: "Public Teacher", loginEmail: "private@example.com",
        normalizedLoginEmail: "private@example.com", phone: "+8801700000000", bioBn: "", bioEn: "Public bio",
        qualificationsBn: "", qualificationsEn: "MSc", status: "active", isPublic: true, publicSortOrder: 1,
        joinedAt: now, createdAt: now, updatedAt: now,
      });
    });

    const teachers = await t.query(anyApi.publicSite.public.listTeachers, { locale: "en", limit: 10 });
    expect(teachers).toHaveLength(1);
    expect(teachers[0]).toMatchObject({ displayName: "Public Teacher", bio: { value: "Public bio" } });
    expect(teachers[0]).not.toHaveProperty("loginEmail");
    expect(teachers[0]).not.toHaveProperty("normalizedLoginEmail");
    expect(teachers[0]).not.toHaveProperty("phone");
    expect(teachers[0]).not.toHaveProperty("employeeCode");
  });

  it("allows only an owner to publish and appends an audit event", async () => {
    const t = convexTest(schema, modules);
    const { accountId } = await seedOwner(t);
    await seedTeacherIdentity(t);
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", email: "owner@example.com" });
    const teacher = t.withIdentity({ tokenIdentifier: "clerk|teacher", email: "teacher@example.com" });
    await owner.mutation(anyApi.publicSite.cms.saveContentDraft, { key: "contact", content: draftContent });

    await expect(teacher.mutation(anyApi.publicSite.cms.publishContent, { key: "contact" })).rejects.toThrow("Unauthorized");
    await expect(t.query(anyApi.publicSite.public.getContentBlock, { key: "contact", locale: "en" })).resolves.toBeNull();
    await owner.mutation(anyApi.publicSite.cms.publishContent, { key: "contact" });

    const audit = await t.run((ctx) => ctx.db.query("auditLogs").withIndex("by_action_and_occurredAt", (q) => q.eq("action", "cms.content_published")).take(10));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorAccountId: accountId, actorRole: "owner", entityType: "siteContentBlocks" });
  });

  it("keeps gallery drafts private, publishes localized media, and archives without deletion", async () => {
    const t = convexTest(schema, modules);
    await seedOwner(t);
    const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", email: "owner@example.com" });
    const galleryItemId = await t.run(async (ctx) => {
      const imageStorageId = await ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
      const now = Date.now();
      return await ctx.db.insert("galleryItems", {
        titleBn: "শ্রেণিকক্ষ", titleEn: "Classroom", altBn: "ক্লাসে শিক্ষার্থীরা", altEn: "Students in class",
        imageStorageId, sortOrder: 2, status: "draft", createdAt: now, updatedAt: now,
      });
    });
    await expect(t.query(anyApi.publicSite.public.listGallery, { locale: "en", limit: 10 })).resolves.toEqual([]);

    await t.run((ctx) => ctx.db.patch("galleryItems", galleryItemId, { status: "published" }));
    await expect(t.query(anyApi.publicSite.public.listGallery, { locale: "bn", limit: 10 })).resolves.toMatchObject([
      { id: galleryItemId, title: { value: "শ্রেণিকক্ষ" }, alt: { value: "ক্লাসে শিক্ষার্থীরা" }, sortOrder: 2 },
    ]);

    await owner.mutation(anyApi.publicSite.cms.archiveGalleryItem, { galleryItemId });
    await expect(t.query(anyApi.publicSite.public.listGallery, { locale: "en", limit: 10 })).resolves.toEqual([]);
    const archived = await t.run((ctx) => ctx.db.get("galleryItems", galleryItemId));
    expect(archived?.status).toBe("archived");
  });

  it("accepts safe public image metadata and rejects SVG or oversized uploads", () => {
    expect(() => validatePublicImageMetadata("image/png", 1024)).not.toThrow();
    expect(() => validatePublicImageMetadata("image/svg+xml", 1024)).toThrow("JPEG, PNG, or WebP");
    expect(() => validatePublicImageMetadata("image/webp", 8 * 1024 * 1024 + 1)).toThrow("8 MB or smaller");
  });

  it("accepts local or HTTPS CTA links and rejects protocol-relative or credentialed URLs", () => {
    expect(() => validatePublicHref("/en/admission")).not.toThrow();
    expect(() => validatePublicHref("https://example.com/admission")).not.toThrow();
    expect(() => validatePublicHref("//malicious.example/admission")).toThrow("local path or HTTPS URL");
    expect(() => validatePublicHref("https://user:secret@example.com")).toThrow("local path or HTTPS URL");
  });

});
