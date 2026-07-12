import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { dhakaDate } from "../model/dates";

export const dailyBilling = internalAction({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    const periodKey = dhakaDate().slice(0, 7);
    await ctx.runMutation(internal.finance.functions.generateMonthlyBatch, { periodKey, cursor: null });
    return null;
  },
});
