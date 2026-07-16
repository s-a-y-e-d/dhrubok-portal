import { v } from "convex/values";
import { env, internalMutation } from "./_generated/server";

const RESET_TABLES = [
  "courseOperationalSnapshots",
  "courseSubjects",
  "courseTeacherDefaults",
  "teacherBatchAssignments",
  "batchSchedules",
  "attendanceRecords",
  "classSessions",
  "paymentAllocations",
  "payments",
  "studentCharges",
  "studentFinancialSummaries",
  "receivableScopeSummaries",
  "financeDailySnapshots",
  "financeOperationalState",
  "dueReminderCampaignRecipients",
  "dueReminderCampaigns",
  "paymentPromises",
  "studentFeeAgreements",
  "financeAdjustments",
  "financeCreditAllocations",
  "studentCredits",
  "cashDrawerSessions",
  "cashDrawers",
  "paymentImportRows",
  "paymentImportBatches",
  "feePlanItems",
  "feePlans",
  "discountPolicies",
  "examPublishedSubjectResults",
  "examPublishedResults",
  "examPublications",
  "examSubjectResults",
  "examResults",
  "examCandidates",
  "examTeacherAssignments",
  "examBatches",
  "examSubjects",
  "examAuditEvents",
  "exams",
  "noticeRecipients",
  "notices",
  "materials",
  "admissionApplications",
  "enrolments",
  "batches",
  "courses",
] as const;

export const resetCourseDependentData = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    if (env.DEV_IMPERSONATION_ENABLED !== "true") {
      throw new Error("Development reset is disabled");
    }
    let deleted = 0;
    for (const table of RESET_TABLES) {
      const rows = await ctx.db.query(table).take(10_000);
      if (rows.length === 10_000) {
        throw new Error(`Refusing partial reset: ${table} exceeds 10,000 rows`);
      }
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    return { deleted };
  },
});
