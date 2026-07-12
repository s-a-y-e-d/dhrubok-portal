import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { env } from "../_generated/server";

type AuthCtx = Pick<QueryCtx | MutationCtx, "auth" | "db">;

export async function requireIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

export async function requireAccount(ctx: AuthCtx): Promise<Doc<"portalAccounts">> {
  const identity = await requireIdentity(ctx);
  let account = await ctx.db.query("portalAccounts").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (env.DEV_IMPERSONATION_ENABLED === "true" && account?.role === "owner" && account.status === "active") {
    const session = await ctx.db.query("devImpersonationSessions").withIndex("by_controllerTokenIdentifier", (q) => q.eq("controllerTokenIdentifier", identity.tokenIdentifier)).unique();
    if (session) account = await ctx.db.get("portalAccounts", session.selectedAccountId);
  }
  if (!account || account.status !== "active") throw new Error("Unauthorized");
  return account;
}

export async function requireOwner(ctx: AuthCtx) {
  const account = await requireAccount(ctx);
  if (account.role !== "owner") throw new Error("Unauthorized");
  const profile = await ctx.db.get("ownerProfiles", account.ownerProfileId);
  if (!profile || profile.status !== "active") throw new Error("Unauthorized");
  return { account, profile };
}

export async function requireTeacher(ctx: AuthCtx) {
  const account = await requireAccount(ctx);
  if (account.role !== "teacher") throw new Error("Unauthorized");
  const teacher = await ctx.db.get("teachers", account.teacherId);
  if (!teacher || teacher.status !== "active") throw new Error("Unauthorized");
  return { account, teacher };
}

export async function requireStudent(ctx: AuthCtx) {
  const account = await requireAccount(ctx);
  if (account.role !== "student") throw new Error("Unauthorized");
  const student = await ctx.db.get("students", account.studentId);
  if (!student || student.status !== "active") throw new Error("Unauthorized");
  return { account, student };
}

export async function requireOwnerOrAssignedTeacher(ctx: AuthCtx, batchId: Id<"batches">) {
  const account = await requireAccount(ctx);
  if (account.role === "owner") return { account, teacher: null };
  if (account.role !== "teacher") throw new Error("Unauthorized");
  const assignments = await ctx.db.query("teacherBatchAssignments").withIndex("by_teacherId_and_batchId", (q) => q.eq("teacherId", account.teacherId).eq("batchId", batchId)).take(20);
  if (!assignments.some((assignment) => assignment.status === "active")) throw new Error("Unauthorized");
  return { account, teacher: account.teacherId };
}

export async function requireTeacherExamAssignment(ctx: AuthCtx, examId: Id<"exams">) {
  const { account, teacher } = await requireTeacher(ctx);
  const assignment = await ctx.db.query("examTeacherAssignments").withIndex("by_examId_and_teacherId", (q) => q.eq("examId", examId).eq("teacherId", teacher._id)).unique();
  if (!assignment) throw new Error("Unauthorized");
  return { account, teacher, assignment };
}

export async function requireStudentOwnsRecord(ctx: AuthCtx, studentId: Id<"students">) {
  const result = await requireStudent(ctx);
  if (result.student._id !== studentId) throw new Error("Unauthorized");
  return result;
}

export async function requireStudentEnrolledInBatch(ctx: AuthCtx, batchId: Id<"batches">) {
  const result = await requireStudent(ctx);
  const enrolment = await ctx.db.query("enrolments").withIndex("by_studentId_and_batchId", (q) => q.eq("studentId", result.student._id).eq("batchId", batchId)).unique();
  if (!enrolment || enrolment.status !== "active") throw new Error("Unauthorized");
  return { ...result, enrolment };
}

export const requireOwnerForFinancialMutation = requireOwner;
