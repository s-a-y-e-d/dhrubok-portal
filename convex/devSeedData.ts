import { v } from "convex/values";
import { env, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

async function requireDevOwner(ctx: MutationCtx) {
  if (env.DEV_IMPERSONATION_ENABLED !== "true") {
    throw new Error("Development test data is disabled");
  }
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const owner = await ctx.db
    .query("portalAccounts")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!owner || owner.role !== "owner" || owner.status !== "active") {
    throw new Error("Only an active owner can create test data");
  }
  return owner;
}

export const seedAcademics = mutation({
  args: {},
  returns: v.object({
    created: v.boolean(),
    courses: v.number(),
    batches: v.number(),
    enrolments: v.number(),
  }),
  handler: async (ctx) => {
    const owner = await requireDevOwner(ctx);
    const existing = await ctx.db
      .query("courses")
      .withIndex("by_code", (q) => q.eq("code", "TEST-SSC"))
      .unique();
    if (existing) {
      const batches = await ctx.db
        .query("batches")
        .withIndex("by_courseId_and_status", (q) =>
          q.eq("courseId", existing._id).eq("status", "active"),
        )
        .collect();
      return { created: false, courses: 1, batches: batches.length, enrolments: 0 };
    }

    const now = Date.now();
    const courseSpecs = [
      ["TEST-SSC", "test-ssc", "এসএসসি প্রস্তুতি", "SSC Preparation"],
      ["TEST-HSC", "test-hsc", "এইচএসসি প্রস্তুতি", "HSC Preparation"],
      ["TEST-ADM", "test-admission", "ভর্তি প্রস্তুতি", "Admission Preparation"],
    ] as const;
    for (const [courseIndex, [code, slug, nameBn, nameEn]] of courseSpecs.entries()) {
      const courseId = await ctx.db.insert("courses", {
        code,
        slug,
        nameBn,
        nameEn,
        searchText: `${code} ${nameBn} ${nameEn}`.toLowerCase(),
        shortDescriptionBn: "নিয়মিত ক্লাস ও পরীক্ষা",
        shortDescriptionEn: "Regular classes and exams",
        descriptionBn: "পরীক্ষা প্রস্তুতির পূর্ণাঙ্গ কোর্স।",
        descriptionEn: "A complete exam preparation course.",
        status: "active",
        isPublic: true,
        publicSortOrder: courseIndex + 1,
        createdAt: now,
        updatedAt: now,
        createdByAccountId: owner._id,
        updatedByAccountId: owner._id,
      });
      for (let batchIndex = 0; batchIndex < 2; batchIndex += 1) {
        const ordinal = courseIndex * 2 + batchIndex + 1;
        await ctx.db.insert("batches", {
          courseId,
          code: `TEST-B${ordinal}`,
          slug: `test-batch-${ordinal}`,
          nameBn: `ব্যাচ ${ordinal}`,
          nameEn: `Batch ${ordinal}`,
          startDate: "2026-01-10",
          status: "active",
          admissionOpen: true,
          isPublic: true,
          publicSortOrder: ordinal,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return { created: true, courses: 3, batches: 6, enrolments: 0 };
  },
});

export const seedOperations = mutation({
  args: {},
  returns: v.object({
    created: v.boolean(),
    attendanceRecords: v.number(),
    charges: v.number(),
    payments: v.number(),
    results: v.number(),
    materials: v.number(),
    notices: v.number(),
  }),
  handler: async (ctx) => {
    await requireDevOwner(ctx);
    return {
      created: false,
      attendanceRecords: 0,
      charges: 0,
      payments: 0,
      results: 0,
      materials: 0,
      notices: 0,
    };
  },
});
