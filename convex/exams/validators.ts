import { v } from "convex/values";

export const examMode = v.union(
  v.literal("mcq"),
  v.literal("written"),
  v.literal("both"),
);
export const examType = v.union(
  v.literal("weekly"),
  v.literal("monthly"),
  v.literal("model_test"),
  v.literal("term"),
  v.literal("final"),
  v.literal("other"),
);
export const audienceMode = v.union(
  v.literal("single_batch"),
  v.literal("selected_batches"),
  v.literal("all_course_batches"),
);
export const meritMode = v.union(
  v.literal("official_only"),
  v.literal("official_and_batch"),
  v.literal("none"),
);
export const meritScope = v.union(
  v.literal("batch"),
  v.literal("selected_batches"),
  v.literal("course"),
  v.literal("none"),
);
export const participation = v.union(v.literal("present"), v.literal("absent"));

export const subjectRule = v.object({
  subjectId: v.id("subjects"),
  mode: examMode,
  mcqFullMarksScaled: v.optional(v.number()),
  writtenFullMarksScaled: v.optional(v.number()),
  totalFullMarksScaled: v.number(),
  passMarksScaled: v.number(),
  mcqPassMarksScaled: v.optional(v.number()),
  writtenPassMarksScaled: v.optional(v.number()),
  isRequired: v.boolean(),
  sortOrder: v.number(),
});

export const assignmentInput = v.object({
  examSubjectId: v.id("examSubjects"),
  teacherId: v.id("teachers"),
  batchId: v.optional(v.id("batches")),
});
