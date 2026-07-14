import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function scheduleCourseSnapshot(ctx: MutationCtx, courseId: Id<"courses">) {
  await ctx.scheduler.runAfter(0, internal.academics.courseSnapshots.refresh, { courseId });
}

export async function scheduleBatchCourseSnapshot(ctx: MutationCtx, batchId: Id<"batches">) {
  const batch = await ctx.db.get("batches", batchId);
  if (batch) await scheduleCourseSnapshot(ctx, batch.courseId);
}
