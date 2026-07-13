import type { MutationCtx } from "../_generated/server";

type SequenceKey =
  | "student"
  | "application"
  | "receipt"
  | "payment"
  | "exam"
  | "charge"
  | "due_campaign"
  | "fee_agreement"
  | "finance_adjustment";

export async function nextIdentifier(
  ctx: MutationCtx,
  key: SequenceKey,
  prefix: string,
  yearScope?: number,
) {
  const sequence = await ctx.db
    .query("numberSequences")
    .withIndex("by_key_and_yearScope", (q) =>
      q.eq("key", key).eq("yearScope", yearScope),
    )
    .unique();
  const value = sequence?.nextValue ?? 1;
  if (sequence)
    await ctx.db.patch("numberSequences", sequence._id, {
      nextValue: value + 1,
      updatedAt: Date.now(),
    });
  else
    await ctx.db.insert("numberSequences", {
      key,
      prefix,
      nextValue: value + 1,
      yearScope,
      updatedAt: Date.now(),
    });
  return `${prefix}${yearScope ? `-${yearScope}` : ""}-${String(value).padStart(5, "0")}`;
}
