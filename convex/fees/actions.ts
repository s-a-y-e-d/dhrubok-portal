import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { dhakaDate } from "../model/dates";
import { v } from "convex/values";

export const dailyMaterialization = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runMutation(internal.fees.functions.materializeBatch, {
      cursor: null,
      throughPeriod: dhakaDate().slice(0, 7),
    });
    return null;
  },
});
