import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({
  env: {
    CLERK_JWT_ISSUER_DOMAIN: v.string(),
    SMS_BD_API_KEY: v.optional(v.string()),
    SMS_BD_SENDER_ID: v.optional(v.string()),
    SMS_LOW_BALANCE_MINOR: v.optional(v.string()),
    TURNSTILE_SECRET_KEY: v.optional(v.string()),
    APP_BASE_URL: v.optional(v.string()),
    BOOTSTRAP_OWNER_SECRET: v.optional(v.string()),
    DEV_IMPERSONATION_ENABLED: v.optional(v.string()),
  },
});
