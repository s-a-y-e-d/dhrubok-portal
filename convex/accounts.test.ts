/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedOwner(t: ReturnType<typeof convexTest>, input: { email: string; tokenIdentifier?: string; status?: "reserved" | "active" }) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: input.email, email: input.email, status: "active", createdAt: now, updatedAt: now });
    return await ctx.db.insert("portalAccounts", {
      role: "owner",
      status: input.status ?? "reserved",
      tokenIdentifier: input.tokenIdentifier,
      loginEmail: input.email,
      normalizedLoginEmail: input.email,
      ownerProfileId,
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("portal account claiming", () => {
  it("claims one approved reservation using a verified email", async () => {
    const t = convexTest(schema, modules);
    const accountId = await seedOwner(t, { email: "owner@example.com" });
    const authenticated = t.withIdentity({ tokenIdentifier: "clerk|owner", email: "OWNER@example.com", emailVerified: true });

    await expect(authenticated.mutation(api.accounts.ensureCurrentPortalAccount, {})).resolves.toMatchObject({ status: "active", role: "owner", accountId });
    await expect(authenticated.mutation(api.accounts.ensureCurrentPortalAccount, {})).resolves.toMatchObject({ status: "active", accountId });

    const account = await t.run((ctx) => ctx.db.get("portalAccounts", accountId));
    expect(account?.tokenIdentifier).toBe("clerk|owner");
    expect(account?.status).toBe("active");
  });

  it("claims an approved reservation when Clerk omits the optional verified flag", async () => {
    const t = convexTest(schema, modules);
    const accountId = await seedOwner(t, { email: "owner@example.com" });
    const authenticated = t.withIdentity({ tokenIdentifier: "clerk|owner-without-flag", email: "owner@example.com" });
    await expect(authenticated.mutation(api.accounts.ensureCurrentPortalAccount, {})).resolves.toMatchObject({ status: "active", role: "owner", accountId });
  });

  it("does not claim a reservation without a verified email", async () => {
    const t = convexTest(schema, modules);
    const accountId = await seedOwner(t, { email: "owner@example.com" });
    const authenticated = t.withIdentity({ tokenIdentifier: "clerk|unverified", email: "owner@example.com", emailVerified: false });

    await expect(authenticated.mutation(api.accounts.ensureCurrentPortalAccount, {})).resolves.toEqual({ status: "access_pending" });
    const account = await t.run((ctx) => ctx.db.get("portalAccounts", accountId));
    expect(account?.tokenIdentifier).toBeUndefined();
  });

  it("keeps repeated unapproved access checks pending instead of rate-limit errors", async () => {
    const t = convexTest(schema, modules);
    const authenticated = t.withIdentity({ tokenIdentifier: "clerk|pending", email: "pending@example.com", emailVerified: true });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await expect(authenticated.mutation(api.accounts.ensureCurrentPortalAccount, {})).resolves.toEqual({ status: "access_pending" });
    }
    const attempts = await t.run((ctx) => ctx.db.query("accountClaimAttempts").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", "clerk|pending")).unique());
    expect(attempts).toBeNull();
  });

  it("rejects protected account reads when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.accounts.getCurrent, {})).resolves.toEqual({ status: "access_pending" });
  });

  it("does not authorize a suspended identity", async () => {
    const t = convexTest(schema, modules);
    await seedOwner(t, { email: "owner@example.com", tokenIdentifier: "clerk|suspended", status: "active" });
    await t.run(async (ctx) => {
      const account = await ctx.db.query("portalAccounts").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", "clerk|suspended")).unique();
      if (account) await ctx.db.patch("portalAccounts", account._id, { status: "suspended" });
    });
    const suspended = t.withIdentity({ tokenIdentifier: "clerk|suspended", email: "owner@example.com", emailVerified: true });
    await expect(suspended.query(api.accounts.getCurrent, {})).resolves.toEqual({ status: "access_pending" });
  });

  it("prevents suspending the last active owner", async () => {
    const t = convexTest(schema, modules);
    const accountId = await seedOwner(t, { email: "owner@example.com", tokenIdentifier: "clerk|owner", status: "active" });
    const authenticated = t.withIdentity({ tokenIdentifier: "clerk|owner", email: "owner@example.com", emailVerified: true });
    await expect(authenticated.mutation(api.accounts.suspendOwner, { accountId })).rejects.toMatchObject({ data: { code: "LAST_ACTIVE_OWNER" } });
  });

  it("allows one owner to suspend another while preserving an active owner", async () => {
    const t = convexTest(schema, modules);
    await seedOwner(t, { email: "actor@example.com", tokenIdentifier: "clerk|actor", status: "active" });
    const targetId = await seedOwner(t, { email: "target@example.com", tokenIdentifier: "clerk|target", status: "active" });
    const actor = t.withIdentity({ tokenIdentifier: "clerk|actor", email: "actor@example.com", emailVerified: true });
    await expect(actor.mutation(api.accounts.suspendOwner, { accountId: targetId })).resolves.toBeNull();
    const target = await t.run((ctx) => ctx.db.get("portalAccounts", targetId));
    expect(target?.status).toBe("suspended");
  });
});
