/// <reference types="vite/client" />
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";

const discoveredModules = import.meta.glob("../**/*.ts");
const modules = Object.fromEntries(Object.entries(discoveredModules).map(([path, loader]) => [path.startsWith("./") ? `./academics/${path.slice(2)}` : `./${path.slice(3)}`, loader]));
const createDraft = makeFunctionReference<"mutation">("academics/courses:createDraft");
const activate = makeFunctionReference<"mutation">("academics/courses:activate");
const overview = makeFunctionReference<"query">("academics/courseWorkspace:getCourseOverview");

async function setup() {
  const t = convexTest(schema, modules);
  const sessionId = await t.run(async ctx => { const now = Date.now(); const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: "Owner", email: "owner@example.com", status: "active", createdAt: now, updatedAt: now }); await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "owner-token", loginEmail: "owner@example.com", normalizedLoginEmail: "owner@example.com", ownerProfileId, locale: "en", createdAt: now, updatedAt: now }); return await ctx.db.insert("academicSessions", { nameBn: "২০২৬", nameEn: "2026", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", createdAt: now, updatedAt: now }); });
  return { t, owner: t.withIdentity({ tokenIdentifier: "owner-token" }), sessionId };
}

describe("course workspace readiness", () => {
  it("creates drafts with normalized search text and blocks incomplete activation", async () => {
    const { t, owner, sessionId } = await setup();
    const courseId = await owner.mutation(createDraft, { academicSessionId: sessionId, code: "ssc-27", slug: "ssc-27", nameBn: "এসএসসি", nameEn: "SSC" });
    const stored = await t.run(ctx => ctx.db.get("courses", courseId));
    expect(stored).toMatchObject({ status: "draft", isPublic: false, code: "SSC-27", searchText: "ssc-27 এসএসসি ssc" });
    const result = await owner.mutation(activate, { courseId });
    expect(result.activated).toBe(false);
    expect(result.issues.map((issue: { code: string }) => issue.code)).toEqual(expect.arrayContaining(["NO_QUALIFYING_BATCH", "NO_COURSE_SUBJECT"]));
    const data = await owner.query(overview, { courseId });
    expect(data.readiness.ready).toBe(false);
  });

  it("requires owner authorization", async () => {
    const { t, owner, sessionId } = await setup();
    const courseId = await owner.mutation(createDraft, { academicSessionId: sessionId, code: "AUTH", slug: "auth", nameBn: "কোর্স", nameEn: "Course" });
    await expect(t.query(overview, { courseId })).rejects.toThrow();
  });
});
