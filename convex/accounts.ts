import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { env, mutation, query } from "./_generated/server";
import { localeValidator, paginationResultFields } from "./model/validators";
import { normalizeEmail } from "./model/normalization";
import { requireAccount, requireOwner } from "./model/auth";
import { writeAudit } from "./model/audit";

const activeAccountResult = v.object({
  status: v.literal("active"),
  role: v.union(v.literal("owner"), v.literal("teacher"), v.literal("student")),
  accountId: v.id("portalAccounts"),
});
const accountResolutionResult = v.union(activeAccountResult, v.object({ status: v.literal("access_pending") }));

export const ensureCurrentPortalAccount = mutation({
  args: {},
  returns: accountResolutionResult,
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    if (env.DEV_IMPERSONATION_ENABLED === "true") {
      const controller = await ctx.db.query("portalAccounts").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
      if (controller?.role === "owner" && controller.status === "active") {
        const session = await ctx.db.query("devImpersonationSessions").withIndex("by_controllerTokenIdentifier", (q) => q.eq("controllerTokenIdentifier", identity.tokenIdentifier)).unique();
        const selected = session ? await ctx.db.get("portalAccounts", session.selectedAccountId) : controller;
        if (selected?.status === "active") return { status: "active" as const, role: selected.role, accountId: selected._id };
      }
    }
    console.log("ACCOUNT_CLAIM_DIAGNOSTIC", { email: identity.email ?? null, emailVerified: identity.emailVerified ?? null });
    const tokenAccount = await ctx.db.query("portalAccounts").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (tokenAccount) {
      if (tokenAccount.status !== "active") return { status: "access_pending" as const };
      await ctx.db.patch("portalAccounts", tokenAccount._id, { lastSignedInAt: Date.now(), updatedAt: Date.now() });
      return { status: "active" as const, role: tokenAccount.role, accountId: tokenAccount._id };
    }

    // Clerk's Convex JWT may omit `email_verified` even for a verified Google
    // identity. An explicit false is rejected; an omitted flag is safe here
    // because access still requires an exact owner-approved email reservation.
    if (!identity.email || identity.emailVerified === false) return { status: "access_pending" as const };
    const normalizedLoginEmail = normalizeEmail(identity.email);
    const reservation = await ctx.db.query("portalAccounts").withIndex("by_normalizedLoginEmail", (q) => q.eq("normalizedLoginEmail", normalizedLoginEmail)).unique();
    if (!reservation || reservation.status !== "reserved" || reservation.tokenIdentifier) return { status: "access_pending" as const };
    const duplicateToken = await ctx.db.query("portalAccounts").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (duplicateToken) throw new Error("Account is already claimed");
    const now = Date.now();
    await ctx.db.patch("portalAccounts", reservation._id, { tokenIdentifier: identity.tokenIdentifier, status: "active", claimedAt: now, lastSignedInAt: now, updatedAt: now });
    const staleAttempts = await ctx.db.query("accountClaimAttempts").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (staleAttempts) await ctx.db.delete("accountClaimAttempts", staleAttempts._id);
    await writeAudit(ctx, { actorAccountId: reservation._id, actorRole: reservation.role, action: "account.claimed", entityType: "portalAccount", entityId: reservation._id, summary: "Approved portal account claimed" });
    return { status: "active" as const, role: reservation.role, accountId: reservation._id };
  },
});

export const getCurrent = query({
  args: {},
  returns: accountResolutionResult,
  handler: async (ctx) => {
    try {
      const account = await requireAccount(ctx);
      return { status: "active" as const, role: account.role, accountId: account._id };
    } catch {
      return { status: "access_pending" as const };
    }
  },
});

export const bootstrapFirstOwner = mutation({
  args: { secret: v.string(), displayName: v.string(), email: v.string(), locale: localeValidator },
  returns: v.id("portalAccounts"),
  handler: async (ctx, args) => {
    const bootstrapSecret = env.BOOTSTRAP_OWNER_SECRET;
    if (!bootstrapSecret || args.secret !== bootstrapSecret) throw new Error("Bootstrap is not configured");
    const existing = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", (q) => q.eq("role", "owner").eq("status", "active")).take(1);
    const reserved = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", (q) => q.eq("role", "owner").eq("status", "reserved")).take(1);
    if (existing.length > 0 || reserved.length > 0) throw new Error("Owner bootstrap has already been completed");
    const normalizedLoginEmail = normalizeEmail(args.email);
    const duplicateEmail = await ctx.db.query("portalAccounts").withIndex("by_normalizedLoginEmail", (q) => q.eq("normalizedLoginEmail", normalizedLoginEmail)).unique();
    if (duplicateEmail) throw new Error("An account already uses this email");
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: args.displayName.trim(), email: args.email.trim(), status: "active", createdAt: now, updatedAt: now });
    const accountId = await ctx.db.insert("portalAccounts", { role: "owner", status: "reserved", loginEmail: args.email.trim(), normalizedLoginEmail, ownerProfileId, locale: args.locale, createdAt: now, updatedAt: now });
    await writeAudit(ctx, { action: "owner.bootstrap_reserved", entityType: "portalAccount", entityId: accountId, summary: "First owner account reserved" });
    return accountId;
  },
});

export const reserveOwner = mutation({
  args: { displayName: v.string(), email: v.string(), phone: v.optional(v.string()), locale: localeValidator },
  returns: v.id("portalAccounts"),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    const normalizedLoginEmail = normalizeEmail(args.email);
    const duplicate = await ctx.db.query("portalAccounts").withIndex("by_normalizedLoginEmail", (q) => q.eq("normalizedLoginEmail", normalizedLoginEmail)).unique();
    if (duplicate) throw new Error("An account already uses this email");
    const now = Date.now();
    const ownerProfileId = await ctx.db.insert("ownerProfiles", { displayName: args.displayName.trim(), email: args.email.trim(), phone: args.phone?.trim(), status: "active", createdAt: now, updatedAt: now });
    const accountId = await ctx.db.insert("portalAccounts", { role: "owner", status: "reserved", loginEmail: args.email.trim(), normalizedLoginEmail, ownerProfileId, locale: args.locale, createdAt: now, updatedAt: now, createdByAccountId: account._id });
    await writeAudit(ctx, { actorAccountId: account._id, actorRole: "owner", action: "owner.reserved", entityType: "portalAccount", entityId: accountId, summary: "Owner portal account reserved" });
    return accountId;
  },
});

export const suspendOwner = mutation({
  args: { accountId: v.id("portalAccounts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account: actor } = await requireOwner(ctx);
    const target = await ctx.db.get("portalAccounts", args.accountId);
    if (!target || target.role !== "owner" || target.status !== "active") throw new Error("Owner account not found");
    const activeOwners = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", (q) => q.eq("role", "owner").eq("status", "active")).take(2);
    if (activeOwners.length <= 1) throw new Error("The last active owner cannot be suspended");
    await ctx.db.patch("portalAccounts", target._id, { status: "suspended", updatedAt: Date.now() });
    await ctx.db.patch("ownerProfiles", target.ownerProfileId, { status: "disabled", updatedAt: Date.now() });
    await writeAudit(ctx, { actorAccountId: actor._id, actorRole: "owner", action: "owner.suspended", entityType: "portalAccount", entityId: target._id, summary: "Owner access suspended" });
    return null;
  },
});

export const reactivateOwner = mutation({
  args: { accountId: v.id("portalAccounts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account: actor } = await requireOwner(ctx);
    const target = await ctx.db.get("portalAccounts", args.accountId);
    if (!target || target.role !== "owner" || target.status !== "suspended") throw new Error("Suspended owner account not found");
    await ctx.db.patch("portalAccounts", target._id, { status: "active", updatedAt: Date.now() });
    await ctx.db.patch("ownerProfiles", target.ownerProfileId, { status: "active", updatedAt: Date.now() });
    await writeAudit(ctx, { actorAccountId: actor._id, actorRole: "owner", action: "owner.reactivated", entityType: "portalAccount", entityId: target._id, summary: "Owner access reactivated" });
    return null;
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator, role: v.union(v.literal("owner"), v.literal("teacher"), v.literal("student")) },
  returns: v.object({
    page: v.array(v.object({
      accountId: v.id("portalAccounts"), role: v.union(v.literal("owner"), v.literal("teacher"), v.literal("student")),
      status: v.union(v.literal("reserved"), v.literal("active"), v.literal("suspended"), v.literal("revoked")),
      loginEmail: v.string(), locale: localeValidator, claimedAt: v.union(v.number(), v.null()), lastSignedInAt: v.union(v.number(), v.null()),
    })),
    ...paginationResultFields,
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const result = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", (q) => q.eq("role", args.role)).paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((account) => ({ accountId: account._id, role: account.role, status: account.status, loginEmail: account.loginEmail, locale: account.locale, claimedAt: account.claimedAt ?? null, lastSignedInAt: account.lastSignedInAt ?? null })),
    };
  },
});

export const resetLoginReservation = mutation({
  args: { accountId: v.id("portalAccounts"), newEmail: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account: actor } = await requireOwner(ctx);
    const target = await ctx.db.get("portalAccounts", args.accountId);
    if (!target) throw new Error("Portal account not found");
    if (target.role === "owner" && target.status === "active") {
      const activeOwners = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", (q) => q.eq("role", "owner").eq("status", "active")).take(2);
      if (activeOwners.length <= 1) throw new Error("The last active owner cannot be unlinked");
    }
    const normalizedLoginEmail = normalizeEmail(args.newEmail);
    const duplicate = await ctx.db.query("portalAccounts").withIndex("by_normalizedLoginEmail", (q) => q.eq("normalizedLoginEmail", normalizedLoginEmail)).unique();
    if (duplicate && duplicate._id !== target._id) throw new Error("An account already uses this email");
    await ctx.db.patch("portalAccounts", target._id, {
      loginEmail: args.newEmail.trim(), normalizedLoginEmail, tokenIdentifier: undefined,
      status: "reserved", claimedAt: undefined, lastSignedInAt: undefined, updatedAt: Date.now(),
    });
    await writeAudit(ctx, { actorAccountId: actor._id, actorRole: "owner", action: "account.login_reset", entityType: "portalAccount", entityId: target._id, summary: "Approved Google login email reset" });
    return null;
  },
});
