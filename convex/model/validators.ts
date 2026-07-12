import { v } from "convex/values";

export const paginationResultFields = {
  isDone: v.boolean(),
  continueCursor: v.string(),
  splitCursor: v.optional(v.union(v.string(), v.null())),
  pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
};

export const localeValidator = v.union(v.literal("bn"), v.literal("en"));
export const accountStatusValidator = v.union(v.literal("reserved"), v.literal("active"), v.literal("suspended"), v.literal("revoked"));
export const academicStatusValidator = v.union(v.literal("planned"), v.literal("active"), v.literal("completed"), v.literal("archived"));
export const studentStatusValidator = v.union(v.literal("active"), v.literal("paused"), v.literal("completed"), v.literal("left"), v.literal("archived"));
export const attendanceStatusValidator = v.union(v.literal("present"), v.literal("late"), v.literal("absent"));
export const smsStatusValidator = v.union(v.literal("queued"), v.literal("sending"), v.literal("accepted"), v.literal("sent"), v.literal("delivered"), v.literal("failed"), v.literal("cancelled"));
export const paymentMethodValidator = v.union(v.literal("cash"), v.literal("bkash"), v.literal("nagad"), v.literal("bank_transfer"), v.literal("cheque"), v.literal("other"));
export const chargeTypeValidator = v.union(v.literal("admission"), v.literal("monthly"), v.literal("course"), v.literal("exam"), v.literal("material"), v.literal("custom"));
export const examModeValidator = v.union(v.literal("mcq"), v.literal("written"), v.literal("both"));
export const smsEventTypeValidator = v.union(
  v.literal("admission_received"),
  v.literal("admission_accepted"),
  v.literal("payment_posted"),
  v.literal("attendance_late"),
  v.literal("attendance_absent"),
  v.literal("result_published"),
  v.literal("result_corrected"),
  v.literal("due_reminder"),
  v.literal("custom_notice"),
);

export const auditMetadataValidator = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean(), v.null()),
);
