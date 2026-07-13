import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireOwner, requireOwnerForFinancialMutation } from "../model/auth";
import { assertMinorUnits } from "../model/money";
import { nextIdentifier } from "../model/identifiers";
import { writeAudit } from "../model/audit";
import { enqueueSms } from "../messaging/model";
import { paymentMethodValidator } from "../model/validators";
import { refreshFinancialSummary } from "./model";

const rowValidator = v.object({
  studentNumber: v.string(),
  amountMinor: v.number(),
  method: paymentMethodValidator,
  paidAt: v.number(),
  externalReference: v.optional(v.string()),
  note: v.optional(v.string()),
});

export const previewBatch = mutation({
  args: {
    fileName: v.string(),
    fileHash: v.string(),
    rows: v.array(rowValidator),
    sendSms: v.boolean(),
  },
  returns: v.id("paymentImportBatches"),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    if (!args.fileName.trim() || !args.fileHash.trim())
      throw new Error("File name and hash are required");
    if (!args.rows.length || args.rows.length > 200)
      throw new Error("Import preview requires 1–200 rows");
    const duplicate = await ctx.db
      .query("paymentImportBatches")
      .withIndex("by_fileHash", (q) => q.eq("fileHash", args.fileHash))
      .unique();
    if (duplicate) return duplicate._id;
    const now = Date.now();
    const batchId = await ctx.db.insert("paymentImportBatches", {
      fileName: args.fileName.trim(),
      fileHash: args.fileHash,
      mappingVersion: 1,
      status: "staging",
      totalRows: args.rows.length,
      validRows: 0,
      invalidRows: 0,
      committedRows: 0,
      totalAmountMinor: 0,
      sendSms: args.sendSms,
      createdByAccountId: account._id,
      createdAt: now,
      updatedAt: now,
    });
    let validRows = 0,
      invalidRows = 0,
      totalAmountMinor = 0;
    for (let index = 0; index < args.rows.length; index++) {
      const row = args.rows[index];
      const errors: string[] = [];
      if (!Number.isSafeInteger(row.amountMinor) || row.amountMinor <= 0)
        errors.push("Amount must be positive integer minor units");
      if (!Number.isFinite(row.paidAt)) errors.push("Payment date is invalid");
      const student = await ctx.db
        .query("students")
        .withIndex("by_studentNumber", (q) =>
          q.eq("studentNumber", row.studentNumber.trim()),
        )
        .unique();
      if (!student) errors.push("Student number not found");
      let matchedChargeId;
      if (student) {
        const charges = await ctx.db
          .query("studentCharges")
          .withIndex("by_studentId_and_dueDate", (q) =>
            q.eq("studentId", student._id),
          )
          .take(100);
        matchedChargeId = charges.find(
          (c) =>
            c.status !== "paid" &&
            c.status !== "voided" &&
            c.netAmountMinor > c.paidAmountMinor,
        )?._id;
      }
      const status = errors.length ? ("invalid" as const) : ("valid" as const);
      if (errors.length) invalidRows++;
      else {
        validRows++;
        totalAmountMinor += row.amountMinor;
      }
      await ctx.db.insert("paymentImportRows", {
        batchId,
        rowNumber: index + 1,
        idempotencyKey: `${args.fileHash}:${index + 1}`,
        studentNumber: row.studentNumber.trim(),
        amountMinor: row.amountMinor,
        method: row.method,
        paidAt: row.paidAt,
        validationErrors: errors,
        matchedStudentId: student?._id,
        matchedChargeId,
        externalReference: row.externalReference?.trim() || undefined,
        note: row.note?.trim() || undefined,
        status,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch("paymentImportBatches", batchId, {
      status: "previewed",
      validRows,
      invalidRows,
      totalAmountMinor,
      updatedAt: Date.now(),
    });
    return batchId;
  },
});

export const getBatch = query({
  args: { batchId: v.id("paymentImportBatches") },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const batch = await ctx.db.get("paymentImportBatches", args.batchId);
    if (!batch) return null;
    const rows = await ctx.db
      .query("paymentImportRows")
      .withIndex("by_batchId_and_rowNumber", (q) => q.eq("batchId", batch._id))
      .take(200);
    return { batch, rows };
  },
});
export const listBatches = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.db
      .query("paymentImportBatches")
      .withIndex("by_status_and_createdAt")
      .order("desc")
      .take(30);
  },
});

export const commitBatch = mutation({
  args: { batchId: v.id("paymentImportBatches"), confirmed: v.boolean() },
  returns: v.object({ committed: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    const { account } = await requireOwnerForFinancialMutation(ctx);
    if (!args.confirmed) throw new Error("Import confirmation is required");
    const batch = await ctx.db.get("paymentImportBatches", args.batchId);
    if (!batch) throw new Error("Import batch not found");
    if (batch.status === "completed")
      return { committed: 0, skipped: batch.committedRows };
    if (!(batch.status === "previewed" || batch.status === "committing"))
      throw new Error("Import batch is not ready");
    await ctx.db.patch("paymentImportBatches", batch._id, {
      status: "committing",
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.finance.imports.commitBatchChunk, {
      batchId: batch._id,
      actorAccountId: account._id,
    });
    return { committed: 0, skipped: 0 };
  },
});

export const commitBatchChunk = internalMutation({
  args: {
    batchId: v.id("paymentImportBatches"),
    actorAccountId: v.id("portalAccounts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get("paymentImportBatches", args.batchId);
    if (!batch || batch.status !== "committing") return null;
    const rows = await ctx.db
      .query("paymentImportRows")
      .withIndex("by_batchId_and_status", (q) =>
        q.eq("batchId", batch._id).eq("status", "valid"),
      )
      .take(25);
    let committed = 0,
      skipped = 0;
    for (const row of rows) {
      const prior = await ctx.db
        .query("payments")
        .withIndex("by_importRowId", (q) => q.eq("importRowId", row._id))
        .unique();
      if (prior) {
        skipped++;
        await ctx.db.patch("paymentImportRows", row._id, {
          status: "skipped",
          paymentId: prior._id,
          validationErrors: ["Payment was already committed for this row"],
          updatedAt: Date.now(),
        });
        continue;
      }
      if (!row.matchedStudentId) {
        skipped++;
        await ctx.db.patch("paymentImportRows", row._id, {
          status: "skipped",
          validationErrors: ["Matched student is no longer available"],
          updatedAt: Date.now(),
        });
        continue;
      }
      assertMinorUnits(row.amountMinor);
      let allocated = 0;
      let charge = null;
      if (row.matchedChargeId) {
        charge = await ctx.db.get("studentCharges", row.matchedChargeId);
        if (
          charge &&
          charge.studentId === row.matchedStudentId &&
          charge.status !== "voided"
        ) {
          allocated = Math.min(
            row.amountMinor,
            Math.max(0, charge.netAmountMinor - charge.paidAmountMinor),
          );
        }
      }
      const year = new Date(row.paidAt).getUTCFullYear();
      const paymentNumber = await nextIdentifier(ctx, "payment", "PAY", year);
      const receiptNumber = await nextIdentifier(ctx, "receipt", "RCPT", year);
      const drawer =
        row.method === "cash"
          ? await ctx.db
              .query("cashDrawerSessions")
              .withIndex("by_status_and_businessDate", (q) =>
                q.eq("status", "open"),
              )
              .first()
          : null;
      const paymentId = await ctx.db.insert("payments", {
        paymentNumber,
        receiptNumber,
        studentId: row.matchedStudentId,
        amountMinor: row.amountMinor,
        allocatedAmountMinor: allocated,
        advanceAmountMinor: row.amountMinor - allocated,
        method: row.method,
        externalReference: row.externalReference,
        paidAt: row.paidAt,
        note: row.note,
        status: "posted",
        collectedByAccountId: args.actorAccountId,
        createdAt: Date.now(),
        cashDrawerSessionId: drawer?._id,
        importRowId: row._id,
        refundedAmountMinor: 0,
        reconciliationStatus: "unreviewed",
      });
      if (charge && allocated > 0) {
        await ctx.db.insert("paymentAllocations", {
          paymentId,
          chargeId: charge._id,
          studentId: row.matchedStudentId,
          amountMinor: allocated,
          chargeDescriptionBnSnapshot: charge.descriptionBn,
          chargeDescriptionEnSnapshot: charge.descriptionEn,
          createdAt: Date.now(),
        });
        const paid = charge.paidAmountMinor + allocated;
        await ctx.db.patch("studentCharges", charge._id, {
          paidAmountMinor: paid,
          status: paid >= charge.netAmountMinor ? "paid" : "partially_paid",
          settledAt: paid >= charge.netAmountMinor ? Date.now() : undefined,
        });
      }
      await ctx.db.patch("paymentImportRows", row._id, {
        status: "committed",
        paymentId,
        updatedAt: Date.now(),
      });
      await refreshFinancialSummary(ctx, row.matchedStudentId);
      if (batch.sendSms) {
        const student = await ctx.db.get("students", row.matchedStudentId);
        if (student)
          await enqueueSms(ctx, {
            idempotencyKey: `payment:${paymentId}:confirmation`,
            eventType: "payment_posted",
            relatedEntityType: "payment",
            relatedEntityId: paymentId,
            studentId: student._id,
            guardianPhone: student.guardianPhone,
            locale: student.preferredSmsLocale,
            body:
              student.preferredSmsLocale === "bn"
                ? `ধ্রুবক: ৳ ${(row.amountMinor / 100).toFixed(2)} পেমেন্ট গ্রহণ করা হয়েছে। রসিদ ${receiptNumber}।`
                : `Dhrubok: Payment of BDT ${(row.amountMinor / 100).toFixed(2)} received. Receipt ${receiptNumber}.`,
          });
      }
      committed++;
    }
    const committedRows = (batch.committedRows ?? 0) + committed;
    const remaining = await ctx.db
      .query("paymentImportRows")
      .withIndex("by_batchId_and_status", (q) =>
        q.eq("batchId", batch._id).eq("status", "valid"),
      )
      .first();
    if (remaining) {
      await ctx.db.patch("paymentImportBatches", batch._id, {
        committedRows,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        0,
        internal.finance.imports.commitBatchChunk,
        { batchId: batch._id, actorAccountId: args.actorAccountId },
      );
    } else {
      await ctx.db.patch("paymentImportBatches", batch._id, {
        status: "completed",
        committedRows,
        updatedAt: Date.now(),
      });
      await writeAudit(ctx, {
        actorAccountId: args.actorAccountId,
        actorRole: "owner",
        action: "payment_import.committed",
        entityType: "paymentImportBatch",
        entityId: batch._id,
        summary: "Payment import committed",
        metadata: { committed: committedRows, skipped },
      });
    }
    return null;
  },
});
