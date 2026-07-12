import { v } from "convex/values";
import { env, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const persona = v.object({ accountId: v.id("portalAccounts"), role: v.union(v.literal("owner"), v.literal("teacher"), v.literal("student")), displayName: v.string(), loginEmail: v.string(), code: v.string() });

function assertEnabled() {
  if (env.DEV_IMPERSONATION_ENABLED !== "true") throw new Error("Development impersonation is disabled");
}

async function requireController(ctx: Pick<MutationCtx | QueryCtx, "auth" | "db">) {
  assertEnabled();
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const account = await ctx.db.query("portalAccounts").withIndex("by_tokenIdentifier", q => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!account || account.role !== "owner" || account.status !== "active") throw new Error("Only an active owner can control test personas");
  return { identity, account };
}

const teacherNames = ["Ayesha Rahman", "Farhan Ahmed", "Nusrat Jahan", "Mahmud Hasan", "Sabina Yasmin", "Tanvir Hossain", "Rumana Akter", "Imran Kabir", "Sharmin Sultana", "Rafiul Islam", "Tahmina Chowdhury", "Arif Mahmud"];
const studentFirstNames = ["Ayan", "Nabila", "Samiha", "Rayhan", "Tasnim", "Adnan", "Maliha", "Fahim", "Raisa", "Nafis", "Anika", "Sakib", "Farzana"];
const studentLastNames = ["Rahman", "Ahmed", "Islam", "Hossain", "Akter"];

export const seedPersonas = mutation({
  args: {}, returns: v.object({ teachersCreated: v.number(), studentsCreated: v.number(), totalTeachers: v.number(), totalStudents: v.number() }),
  handler: async (ctx) => {
    const { account: owner } = await requireController(ctx); const now = Date.now(); let teachersCreated = 0; let studentsCreated = 0;
    for (let i = 1; i <= 12; i++) {
      const email = `teacher${String(i).padStart(2, "0")}@test.dhrubok.local`; const normalizedLoginEmail = email.toLowerCase();
      if (await ctx.db.query("portalAccounts").withIndex("by_normalizedLoginEmail", q => q.eq("normalizedLoginEmail", normalizedLoginEmail)).unique()) continue;
      const teacherId = await ctx.db.insert("teachers", { employeeCode: `T-${String(i).padStart(3, "0")}`, displayName: teacherNames[i - 1], nameEn: teacherNames[i - 1], loginEmail: email, normalizedLoginEmail, phone: `01710${String(100000 + i).slice(-6)}`, bioBn: "অভিজ্ঞ ও নিবেদিত শিক্ষক।", bioEn: "Experienced and dedicated teacher.", qualificationsBn: i % 2 ? "স্নাতকোত্তর" : "স্নাতক", qualificationsEn: i % 2 ? "Master's degree" : "Bachelor's degree", status: "active", isPublic: i <= 6, publicSortOrder: i, joinedAt: now - i * 86400000 * 30, createdAt: now, updatedAt: now });
      await ctx.db.insert("portalAccounts", { role: "teacher", status: "active", loginEmail: email, normalizedLoginEmail, teacherId, locale: i % 3 === 0 ? "en" : "bn", createdAt: now, updatedAt: now, createdByAccountId: owner._id }); teachersCreated++;
    }
    for (let i = 1; i <= 65; i++) {
      const email = `student${String(i).padStart(2, "0")}@test.dhrubok.local`; const normalizedLoginEmail = email.toLowerCase();
      if (await ctx.db.query("portalAccounts").withIndex("by_normalizedLoginEmail", q => q.eq("normalizedLoginEmail", normalizedLoginEmail)).unique()) continue;
      const displayName = `${studentFirstNames[(i - 1) % studentFirstNames.length]} ${studentLastNames[(i - 1) % studentLastNames.length]}`; const guardianPhone = `01820${String(200000 + i).slice(-6)}`;
      const studentId = await ctx.db.insert("students", { studentNumber: `DHR-${String(i).padStart(4, "0")}`, rollNumber: String(i), displayName, nameEn: displayName, loginEmail: email, normalizedLoginEmail, phone: `01930${String(300000 + i).slice(-6)}`, dateOfBirth: `20${String(8 + (i % 5)).padStart(2, "0")}-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 27)).padStart(2, "0")}`, gender: i % 2 ? "male" : "female", schoolCollege: `Dhrubok Partner School ${1 + (i % 4)}`, currentClass: String(6 + (i % 7)), address: `House ${i}, Dhaka`, guardianName: `Guardian of ${displayName}`, guardianPhone, normalizedGuardianPhone: guardianPhone, guardianRelationship: i % 3 === 0 ? "Mother" : "Father", preferredSmsLocale: i % 4 === 0 ? "en" : "bn", admissionDate: "2026-07-01", status: "active", searchText: `${displayName} DHR-${String(i).padStart(4, "0")} ${email}`.toLowerCase(), createdAt: now, updatedAt: now, createdByAccountId: owner._id, updatedByAccountId: owner._id });
      await ctx.db.insert("portalAccounts", { role: "student", status: "active", loginEmail: email, normalizedLoginEmail, studentId, locale: i % 4 === 0 ? "en" : "bn", createdAt: now, updatedAt: now, createdByAccountId: owner._id }); studentsCreated++;
    }
    const teachers = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", q => q.eq("role", "teacher").eq("status", "active")).take(200);
    const students = await ctx.db.query("portalAccounts").withIndex("by_role_and_status", q => q.eq("role", "student").eq("status", "active")).take(200);
    return { teachersCreated, studentsCreated, totalTeachers: teachers.length, totalStudents: students.length };
  },
});

export const listPersonas = query({ args: {}, returns: v.array(persona), handler: async (ctx) => {
  await requireController(ctx); const accounts = await ctx.db.query("portalAccounts").take(200); const result = [];
  for (const account of accounts) { if (account.status !== "active") continue; let displayName = "Owner"; let code = "OWNER"; if (account.role === "teacher") { const row = await ctx.db.get("teachers", account.teacherId); if (!row) continue; displayName = row.displayName; code = row.employeeCode; } else if (account.role === "student") { const row = await ctx.db.get("students", account.studentId); if (!row) continue; displayName = row.displayName; code = row.studentNumber; } result.push({ accountId: account._id, role: account.role, displayName, loginEmail: account.loginEmail, code }); }
  return result;
} });

export const selectPersona = mutation({ args: { accountId: v.optional(v.id("portalAccounts")) }, returns: v.union(v.literal("owner"), v.literal("teacher"), v.literal("student")), handler: async (ctx, args) => {
  const { identity, account: owner } = await requireController(ctx); const existing = await ctx.db.query("devImpersonationSessions").withIndex("by_controllerTokenIdentifier", q => q.eq("controllerTokenIdentifier", identity.tokenIdentifier)).unique();
  if (!args.accountId || args.accountId === owner._id) { if (existing) await ctx.db.delete("devImpersonationSessions", existing._id); return "owner"; }
  const selected = await ctx.db.get("portalAccounts", args.accountId); if (!selected || selected.status !== "active") throw new Error("Test persona not found");
  if (existing) await ctx.db.patch("devImpersonationSessions", existing._id, { selectedAccountId: selected._id, updatedAt: Date.now() }); else await ctx.db.insert("devImpersonationSessions", { controllerTokenIdentifier: identity.tokenIdentifier, selectedAccountId: selected._id, updatedAt: Date.now() }); return selected.role;
} });
