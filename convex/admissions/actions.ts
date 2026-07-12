import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, env } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { applicationReferenceValidator, submissionArgs } from "./public";
import { verifyTurnstile } from "./turnstile";

export const submit = action({
  args: { ...submissionArgs, turnstileToken: v.string() },
  returns: applicationReferenceValidator,
  handler: async (ctx, args): Promise<{ applicationId: Id<"admissionApplications">; applicationNumber: string; submittedAt: number; replayed: boolean }> => {
    const { turnstileToken, ...application } = args;
    await verifyTurnstile({
      secret: env.TURNSTILE_SECRET_KEY ?? "",
      token: turnstileToken,
      idempotencyKey: application.submissionKey,
      expectedAction: "admission_submit",
    });
    return await ctx.runMutation(internal.admissions.public.submitVerified, application);
  },
});
