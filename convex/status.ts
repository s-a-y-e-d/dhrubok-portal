import { query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  returns: v.object({ message: v.string(), checkedAt: v.number() }),
  handler: async () => {
    return {
      message: "Convex backend is connected",
      checkedAt: Date.now(),
    };
  },
});
