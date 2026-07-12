import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type AuditValue = string | number | boolean | null;

export async function writeAudit(ctx: MutationCtx, input: {
  actorAccountId?: Id<"portalAccounts">;
  actorRole?: "owner" | "teacher" | "student";
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, AuditValue>;
}) {
  if (input.metadata && Object.keys(input.metadata).length > 12) throw new Error("Audit metadata is too large");
  return await ctx.db.insert("auditLogs", { ...input, occurredAt: Date.now() });
}
