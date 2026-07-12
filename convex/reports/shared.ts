import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireAccount, requireOwner, requireStudent, requireTeacher } from "../model/auth";
import { assertLocalDate } from "../model/dates";

export const REPORT_ROW_LIMIT = 1_000;
export const DASHBOARD_ROW_LIMIT = 2_000;

export const localeArg = v.union(v.literal("bn"), v.literal("en"));

export function assertDateRange(fromDate: string, toDate: string) {
  assertLocalDate(fromDate);
  assertLocalDate(toDate);
  if (fromDate > toDate) throw new ConvexError("The start date must not be after the end date");
}

export function dhakaDayBounds(localDate: string) {
  assertLocalDate(localDate);
  const start = Date.parse(`${localDate}T00:00:00+06:00`);
  return { start, end: start + 86_400_000 };
}

export function localized(locale: "bn" | "en", bn: string | undefined, en: string | undefined) {
  return (locale === "bn" ? bn || en : en || bn) ?? "";
}

export function csvCell(value: string | number | boolean | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createCsv(rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null | undefined>>) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function boundedResult<T>(rows: T[], limit = REPORT_ROW_LIMIT) {
  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
}

export async function requireOwnerOrStudent(ctx: QueryCtx, studentId: Id<"students">) {
  const account = await requireAccount(ctx);
  if (account.role === "owner") {
    await requireOwner(ctx);
    return account;
  }
  if (account.role !== "student" || account.studentId !== studentId) throw new ConvexError("Unauthorized");
  await requireStudent(ctx);
  return account;
}

export async function requireOwnerOrAssignedTeacherForBatch(ctx: QueryCtx, batchId: Id<"batches">) {
  const account = await requireAccount(ctx);
  if (account.role === "owner") {
    await requireOwner(ctx);
    return account;
  }
  if (account.role !== "teacher") throw new ConvexError("Unauthorized");
  await requireTeacher(ctx);
  const assignments = await ctx.db
    .query("teacherBatchAssignments")
    .withIndex("by_teacherId_and_batchId", (q) => q.eq("teacherId", account.teacherId).eq("batchId", batchId))
    .take(20);
  if (!assignments.some((assignment) => assignment.status === "active")) throw new ConvexError("Unauthorized");
  return account;
}
