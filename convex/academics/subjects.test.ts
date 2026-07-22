/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
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

async function ownerFixture() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", {
      displayName: "Owner",
      email: "owner@example.com",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("portalAccounts", {
      role: "owner",
      status: "active",
      tokenIdentifier: "subject-owner",
      loginEmail: "owner@example.com",
      normalizedLoginEmail: "owner@example.com",
      ownerProfileId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
  });
  return t.withIdentity({ tokenIdentifier: "subject-owner" });
}

test("creates, edits, lists, and permanently deletes an unconnected subject", async () => {
  const owner = await ownerFixture();
  const subjectId = await owner.mutation(api.academics.subjects.create, {
    code: "math",
    nameEn: "Mathematics",
  });
  await owner.mutation(api.academics.subjects.update, {
    subjectId,
    code: "MATH-1",
    nameEn: "Advanced Mathematics",
  });
  expect(await owner.query(api.academics.subjects.listCatalog, {})).toEqual([
    expect.objectContaining({
      subjectId,
      code: "MATH-1",
      nameEn: "Advanced Mathematics",
      isConnected: false,
    }),
  ]);
  await owner.mutation(api.academics.subjects.remove, { subjectId });
  expect(await owner.query(api.academics.subjects.listCatalog, {})).toEqual([]);
});

test("refuses to delete a subject connected to a course", async () => {
  const owner = await ownerFixture();
  const subjectId = await owner.mutation(api.academics.subjects.create, {
    code: "PHY",
    nameEn: "Physics",
  });
  await owner.run(async (ctx) => {
    const now = Date.now();
    const account = await ctx.db.query("portalAccounts").first();
    if (!account) throw new Error("Missing owner account");
    const courseId = await ctx.db.insert("courses", {
      code: "SCI",
      slug: "science",
      nameBn: "Science",
      nameEn: "Science",
      shortDescriptionBn: "",
      shortDescriptionEn: "",
      descriptionBn: "",
      descriptionEn: "",
      status: "active",
      isPublic: false,
      publicSortOrder: 0,
      createdAt: now,
      updatedAt: now,
      createdByAccountId: account._id,
      updatedByAccountId: account._id,
    });
    await ctx.db.insert("courseSubjects", {
      courseId,
      subjectId,
      sortOrder: 0,
      createdAt: now,
    });
  });
  await expect(
    owner.mutation(api.academics.subjects.remove, { subjectId }),
  ).rejects.toThrow("connected to a course");
  expect(await owner.query(api.academics.subjects.listCatalog, {})).toEqual([
    expect.objectContaining({ subjectId, isConnected: true }),
  ]);
});
