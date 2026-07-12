/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("owner initializes settings with due day 15 and public-safe projection", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: "Owner", email: "owner@example.com", status: "active", createdAt: now, updatedAt: now });
    await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "clerk|owner", loginEmail: "owner@example.com", normalizedLoginEmail: "owner@example.com", ownerProfileId, locale: "en", createdAt: now, updatedAt: now });
  });
  const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", email: "owner@example.com", emailVerified: true });
  await owner.mutation(api.settings.initialize, {
    nameBn: "ধ্রুবক", nameEn: "Dhrubok", shortNameBn: "ধ্রুবক", shortNameEn: "Dhrubok",
    addressBn: "ঢাকা", addressEn: "Dhaka", phone: "01712345678", email: "office@example.com",
    defaultLocale: "bn", defaultGuardianSmsLocale: "bn",
  });
  const stored = await t.run(async (ctx) => (await ctx.db.query("coachingSettings").take(1))[0]);
  expect(stored?.monthlyDueDay).toBe(15);
  expect(stored?.smsEnabled).toBe(false);
  const publicSettings = await t.query(api.settings.getPublic, {});
  expect(publicSettings).toMatchObject({ nameEn: "Dhrubok", phone: "8801712345678", publicAdmissionsOpen: false });
  expect(publicSettings).not.toHaveProperty("updatedByAccountId");
});

test("monthly due day must stay within 1 to 28", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: "Owner", email: "owner@example.com", status: "active", createdAt: now, updatedAt: now });
    const accountId = await ctx.db.insert("portalAccounts", { role: "owner", status: "active", tokenIdentifier: "clerk|owner", loginEmail: "owner@example.com", normalizedLoginEmail: "owner@example.com", ownerProfileId, locale: "en", createdAt: now, updatedAt: now });
    await ctx.db.insert("coachingSettings", { nameBn: "ধ্রুবক", nameEn: "Dhrubok", shortNameBn: "ধ্রুবক", shortNameEn: "Dhrubok", addressBn: "ঢাকা", addressEn: "Dhaka", phone: "8801712345678", email: "office@example.com", timezone: "Asia/Dhaka", currency: "BDT", defaultLocale: "bn", defaultGuardianSmsLocale: "bn", monthlyDueDay: 15, receiptPrefix: "R", studentIdPrefix: "S", applicationPrefix: "A", receiptFooterBn: "ধন্যবাদ", receiptFooterEn: "Thanks", smsEnabled: false, publicAdmissionsOpen: false, createdAt: now, updatedAt: now, updatedByAccountId: accountId });
  });
  const owner = t.withIdentity({ tokenIdentifier: "clerk|owner", emailVerified: true, email: "owner@example.com" });
  await expect(owner.mutation(api.settings.updateOperations, { monthlyDueDay: 29, defaultLocale: "bn", defaultGuardianSmsLocale: "bn", publicAdmissionsOpen: false, smsEnabled: false, receiptFooterBn: "ধন্যবাদ", receiptFooterEn: "Thanks" })).rejects.toThrow("between 1 and 28");
});
