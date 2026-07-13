# Finance Section Implementation Plan

Status: Proposed

Prepared: 2026-07-13

Scope: Owner finance operations and student finance visibility

Primary backend: Convex 1.42.x

## 1. Outcome

Evolve Dhrubok finance from a capable payment-and-dues module into the daily
operating system for the coaching centre's finance desk, without turning the
product into a general ledger or adding an online payment gateway.

The completed section must let an owner:

1. understand today's collection position immediately;
2. find a student and post a correctly allocated payment quickly;
3. manage fee agreements, concessions, waivers, credits, refunds, and write-offs
   without editing financial history;
4. prioritize receivables by ageing, course, and batch;
5. create safe reminder campaigns for all overdue students or for selected
   courses, batches, ageing buckets, and students;
6. track each reminder recipient through queued, accepted, delivered, failed,
   skipped, and retried states;
7. close and reconcile the physical cash drawer each day;
8. export trustworthy operational records and import payments through a
   preview-first, idempotent process; and
9. give students a clear statement that explains every charge, payment,
   allocation, concession, and adjustment.

## 2. Fixed Product Boundaries

- One coaching centre, with multiple equal-access owners.
- Teachers never receive finance access.
- Students can read only their own finance records.
- Guardians do not have accounts.
- Payments remain manual/offline. No payment gateway is introduced.
- Money remains integer minor units. Never store or calculate money with
  floating-point Taka values.
- Posted financial events are append-only. Corrections use linked void,
  reversal, refund, credit, waiver, or write-off records.
- SMS failure never rolls back a payment, adjustment, or campaign.
- Bangla remains the default locale; all UI, receipts, statements, exports, and
  messages support Bangla and English.
- This is receivables and collection management, not double-entry accounting,
  payroll, tax, assets, liabilities, or a general ledger.

## 3. Current State Audit

### 3.1 Existing strengths to preserve

The repository already implements:

- course- or batch-scoped fee plans and fee-plan items;
- enrolment fee-plan assignment and negotiated monthly/course amounts;
- fixed and percentage discounts with effective dates and owner approval;
- idempotent monthly charge generation;
- admission, monthly, course, exam, material, and custom charge types;
- payment allocation across multiple selected charges;
- partial payment and unapplied advance credit;
- automatic advance application to future charges;
- immutable posted payments with audited void/reversal;
- unique payment, receipt, and charge identifiers;
- payment confirmation SMS with recipient-level idempotency;
- per-student financial summaries and a reconciliation query;
- owner and student receipt access;
- student charge/payment history and printable statements;
- collections, payment method, dues, discounts, advance, and void reports;
- collections, dues, and student-statement CSV exports;
- owner-only financial mutations and explicit teacher exclusion; and
- a search-first finance UI with collection, configuration, and reminder tabs.

These are foundations, not temporary prototypes. New work must reuse the current
payment, allocation, receipt, audit, and SMS invariants.

### 3.2 Current gaps and risks

| Area                  | Current limitation                                                                                       | Required response                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Reminder scope        | `duePreview` is global, capped at 100; campaigns accept raw student IDs and have no course/batch filters | Add indexed server-side audience resolution and durable campaigns             |
| Campaign history      | A timestamp string is used as `relatedEntityId`; no campaign or recipient records exist                  | Add campaign and recipient tables with immutable audience snapshots           |
| Campaign safety       | No duplicate-suppression window, segment/cost preview, last-reminded signal, or outcome summary          | Add draft preview, suppression, confirmation, delivery rollup, and retry      |
| Course/batch finance  | Charges do not snapshot course or batch; student summaries are global                                    | Add charge scope snapshots and scoped receivable summaries                    |
| Ageing                | Only total overdue is stored; no bucket distribution or worklist priority                                | Add ageing buckets, oldest due date, and indexed worklist fields              |
| Date rollover         | `overdueMinor` changes only when a student's summary is refreshed                                        | Add a daily resumable receivable refresh and drift monitoring                 |
| Summary scalability   | `computeFinancialSummary` rereads up to 1,000 charges and 1,000 payments                                 | Move toward incremental aggregates plus bounded reconciliation                |
| Collection completion | Collection exists but is contained in a very large client component                                      | Extract a dedicated cashier workspace and explicit confirmation/success steps |
| Adjustments           | Payment void exists; true refund, credit note, waiver, and write-off documents do not                    | Add typed adjustment records and atomic posting functions                     |
| Fee agreements        | Negotiated values exist on enrolment but have no effective-dated agreement history                       | Add immutable/versioned student fee agreements                                |
| Cash control          | System reconciliation exists, but physical drawer close/variance does not                                | Add drawer sessions and audited closing                                       |
| Imports               | CSV exports exist; preview-first payment import does not                                                 | Add import batch/row staging and idempotent posting                           |
| UI architecture       | `FinanceEditor.tsx` is over 1,200 lines and owns unrelated workflows                                     | Split by finance feature and keep route-level orchestration thin              |

### 3.3 Current files that implementation must respect

- `convex/schema.ts`
- `convex/finance/model.ts`
- `convex/finance/functions.ts`
- `convex/finance/actions.ts`
- `convex/finance/finance.test.ts`
- `convex/reports/finance.ts`
- `convex/reports/exports.ts`
- `convex/reports/dashboards.ts`
- `convex/reports/summaries.ts`
- `convex/messaging/model.ts`
- `convex/messaging/actions.ts`
- `src/components/portal/FinanceEditor.tsx`
- `src/components/portal/FinanceWorkspace.tsx`
- `src/components/portal/BillingSetup.tsx`
- `src/components/portal/ReportsEditor.tsx`
- `src/components/portal/StudentFinance.tsx`
- `src/components/portal/StudentStatementPrint.tsx`
- `src/components/portal/ReceiptPrint.tsx`
- `src/components/portal/PortalShell.tsx`
- `src/components/portal/RoleSection.tsx`
- `src/app/[locale]/owner/[[...section]]/page.tsx`
- `src/app/[locale]/student/[[...section]]/page.tsx`
- `DESIGN.md`

Before implementation, reread `DESIGN.md`,
`convex/_generated/ai/guidelines.md`, and the relevant Next.js 16 guide under
`node_modules/next/dist/docs/` for the catch-all route and client/server
boundaries being changed.

## 4. Target Information Architecture

Keep `/[locale]/owner/finance` as the finance entry point, but make the route
state explicit and linkable through catch-all sections or a stable `view` query
parameter. The owner navigation should expose only the Finance entry; internal
finance navigation handles these workspaces:

| Workspace              | Purpose                                                         | Primary action             |
| ---------------------- | --------------------------------------------------------------- | -------------------------- |
| Overview               | Today's position, receivable health, alerts, and drill-downs    | Collect payment            |
| Collect                | Search-first cashier workflow and payment completion            | Post payment               |
| Dues                   | Ageing worklist, filters, promises, and student follow-up       | Create reminder campaign   |
| Campaigns              | Draft, preview, send, monitor, and retry due reminders          | Queue approved campaign    |
| Charges & agreements   | Fee plans, billing runs, agreements, discounts, and waivers     | Create or assign agreement |
| Payments & adjustments | Payments, allocations, voids, credits, refunds, write-offs      | Post adjustment            |
| Cash closing           | Drawer session, expected cash, counted cash, and variance       | Close drawer               |
| Reports & exports      | Collections, ageing, methods, concessions, adjustments, closing | Export report              |
| Imports                | Upload, validate, preview, commit, and review payment imports   | Commit valid rows          |

On mobile, use a horizontally scrollable tab list or a compact view selector.
Do not create a second sidebar.

## 5. Target Domain Architecture

### 5.1 Source-of-truth rules

- `studentCharges` is the source of truth for assessed receivables.
- `payments` is the source of truth for money received.
- `paymentAllocations` links received money to assessed receivables.
- `financeAdjustments` records non-payment corrections and settlements.
- Summary tables are derived accelerators and must be reconcilable.
- Campaign/recipient tables snapshot communication intent and outcome; they do
  not change finance balances.
- Course/batch scope on a charge is a historical snapshot. It must not change
  when the student's current enrolment or batch changes.

### 5.2 Existing table extensions

#### `studentCharges`

Add optional fields during widening:

- `courseId?: Id<"courses">`
- `batchId?: Id<"batches">`
- `academicSessionId?: Id<"academicSessions">`
- `agreementId?: Id<"studentFeeAgreements">`
- `sourceAdjustmentId?: Id<"financeAdjustments">`
- `settledAt?: number`

Add indexes:

- `by_courseId_and_dueDate`
- `by_batchId_and_dueDate`
- `by_courseId_and_status_and_dueDate`
- `by_batchId_and_status_and_dueDate`
- `by_academicSessionId_and_dueDate`

All enrolment-derived charges must write course, batch, and session snapshots.
Unscoped custom charges may keep these fields absent, but the collection UI
must ask the owner to select an enrolment when one is applicable.

#### `payments`

Add optional fields:

- `cashDrawerSessionId?: Id<"cashDrawerSessions">`
- `importRowId?: Id<"paymentImportRows">`
- `refundedAmountMinor?: number`
- `reconciliationStatus?: "unreviewed" | "matched" | "exception"`

Add indexes:

- `by_cashDrawerSessionId_and_paidAt`
- `by_importRowId`
- `by_collectedByAccountId_and_paidAt`

#### `studentFinancialSummaries`

Add optional fields during widening:

- `currentMinor?: number`
- `overdue1To15Minor?: number`
- `overdue16To30Minor?: number`
- `overdue31To60Minor?: number`
- `overdue61To90Minor?: number`
- `overdueOver90Minor?: number`
- `oldestUnpaidDueDate?: string`
- `lastReminderAt?: number`
- `nextPromiseDate?: string`
- `summaryVersion?: number`

The existing total fields remain supported. After backfill and verification,
the ageing fields become required.

### 5.3 New tables

#### `receivableScopeSummaries`

One row per student + enrolment/charge scope. This supports course/batch
worklists without recomputing every student's ledger.

Fields:

- `studentId`
- `enrolmentId?`
- `courseId?`
- `batchId?`
- `academicSessionId?`
- `outstandingMinor`
- `overdueMinor`
- the six ageing buckets used on the student summary
- `oldestUnpaidDueDate?`
- `lastPaymentAt?`
- `lastReminderAt?`
- `updatedAt`
- `summaryVersion`

Indexes:

- `by_studentId_and_enrolmentId`
- `by_courseId_and_overdueMinor`
- `by_batchId_and_overdueMinor`
- `by_courseId_and_oldestUnpaidDueDate`
- `by_batchId_and_oldestUnpaidDueDate`
- `by_academicSessionId_and_overdueMinor`

#### `dueReminderCampaigns`

Fields:

- `campaignNumber`
- `status: "draft" | "previewed" | "queueing" | "queued" | "completed" | "cancelled" | "failed"`
- `scopeType: "all" | "course" | "batch" | "custom"`
- `courseId?`
- `batchId?`
- `academicSessionId?`
- `ageingBuckets: string[]` (bounded to the fixed enum set)
- `minimumOverdueMinor?`
- `maximumOverdueMinor?`
- `suppressIfRemindedSince?`
- `localeMode: "student_preference" | "bn" | "en"`
- `templateBnSnapshot`
- `templateEnSnapshot`
- `resolvedStudentCount`
- `eligibleRecipientCount`
- `suppressedRecipientCount`
- `queuedMessageCount`
- `deliveredMessageCount`
- `failedMessageCount`
- `estimatedSegments`
- `estimatedCostMinor?`
- `createdByAccountId`
- `approvedByAccountId?`
- `createdAt`
- `previewedAt?`
- `queuedAt?`
- `completedAt?`
- `cancelledAt?`
- `cancelReason?`

Indexes:

- `by_status_and_createdAt`
- `by_courseId_and_createdAt`
- `by_batchId_and_createdAt`
- `by_createdByAccountId_and_createdAt`
- `by_campaignNumber`

`batchId`, when present, must belong to `courseId`. A batch campaign stores both
IDs. A course campaign includes eligible overdue charges across all active and
historical batches belonging to that course, constrained by the selected
academic session when supplied.

#### `dueReminderCampaignRecipients`

One row per campaign + student. Do not store recipients in an array on the
campaign document.

Fields:

- `campaignId`
- `studentId`
- `courseId?`
- `batchId?`
- `overdueMinorSnapshot`
- ageing bucket snapshot fields
- `guardianPhoneSnapshot`
- `locale`
- `messageBodySnapshot`
- `segmentCount`
- `estimatedCostMinor?`
- `status: "eligible" | "suppressed" | "queued" | "accepted" | "delivered" | "failed" | "cancelled"`
- `suppressionReason?`
- `smsMessageId?`
- `lastAttemptAt?`
- `createdAt`
- `updatedAt`

Indexes:

- `by_campaignId_and_status`
- `by_campaignId_and_studentId`
- `by_studentId_and_createdAt`
- `by_smsMessageId`

Recipient identity is deduplicated by student within one campaign. If one
student has overdue charges in multiple selected batches, the SMS shows the
combined overdue amount for the selected scope and only one recipient row is
created.

#### `studentFeeAgreements`

Fields:

- `agreementNumber`
- `studentId`
- `enrolmentId`
- `feePlanId`
- `effectiveFrom`
- `effectiveTo?`
- `status: "draft" | "active" | "superseded" | "ended"`
- `agreedMonthlyAmountMinor?`
- `agreedCourseAmountMinor?`
- `installmentRule?`
- `reason`
- `approvedByAccountId`
- `createdAt`
- `supersedesAgreementId?`

Indexes:

- `by_enrolmentId_and_status`
- `by_studentId_and_effectiveFrom`
- `by_feePlanId_and_status`
- `by_agreementNumber`

An agreement is versioned, never edited after activation. Activating a new
agreement supersedes the prior active agreement in the same transaction.

#### `financeAdjustments`

Fields:

- `adjustmentNumber`
- `studentId`
- `chargeId?`
- `paymentId?`
- `type: "waiver" | "credit_note" | "refund" | "write_off"`
- `amountMinor`
- `method?` for refunds
- `externalReference?`
- `reason`
- `status: "draft" | "posted" | "voided"`
- `postedAt?`
- `postedByAccountId?`
- `voidedAt?`
- `voidedByAccountId?`
- `voidReason?`
- `createdAt`
- `createdByAccountId`

Indexes:

- `by_studentId_and_createdAt`
- `by_chargeId`
- `by_paymentId`
- `by_type_and_postedAt`
- `by_status_and_postedAt`
- `by_adjustmentNumber`

Posting behavior:

- waiver: reduces an unpaid charge balance and marks it waived only when fully
  waived;
- credit note: creates student credit that can allocate to present/future
  charges;
- refund: reduces available advance or references refundable payment value;
- write-off: closes a receivable for operational reporting but remains visible
  as a loss/adjustment;
- voiding an adjustment creates the inverse effect atomically and preserves the
  original row.

#### `paymentPromises`

Fields:

- `studentId`
- `courseId?`
- `batchId?`
- `promisedAmountMinor?`
- `promisedOn`
- `note`
- `status: "open" | "kept" | "missed" | "cancelled"`
- `createdByAccountId`
- `createdAt`
- `resolvedAt?`

Indexes:

- `by_studentId_and_status`
- `by_status_and_promisedOn`
- `by_batchId_and_status`

#### `cashDrawers`

Start with one seeded `main` drawer, but keep the model ready for another
counter later.

Fields: `code`, `nameBn`, `nameEn`, `status`, `createdAt`, `updatedAt`.
Indexes: `by_code`, `by_status`.

#### `cashDrawerSessions`

Fields:

- `drawerId`
- `businessDate` (Asia/Dhaka)
- `status: "open" | "closed" | "reopened"`
- `openingFloatMinor`
- `expectedCashMinor`
- `countedCashMinor?`
- `varianceMinor?`
- `openedByAccountId`
- `openedAt`
- `closedByAccountId?`
- `closedAt?`
- `closeNote?`
- `reopenedByAccountId?`
- `reopenedAt?`
- `reopenReason?`

Indexes:

- `by_drawerId_and_businessDate`
- `by_status_and_businessDate`
- `by_businessDate`

Only one open session may exist per drawer. Payments using `cash` require an
open drawer session after this feature is enabled. Non-cash payments do not.

#### `paymentImportBatches` and `paymentImportRows`

The batch stores file metadata, mapping/version, status, totals, creator, and
timestamps. Each row stores normalized fields, a deterministic idempotency key,
validation errors, matched student/charge IDs, preview allocation, and final
payment ID.

No imported payment is posted while the batch is in preview. Commit processes
valid rows in bounded scheduled batches, reuses the normal payment-posting
domain function, and skips already-posted idempotency keys.

#### `financeDailySnapshots`

One immutable rollup per business date after the day closes or daily refresh
completes:

- collection totals and count;
- cash/non-cash split;
- outstanding and overdue totals;
- ageing buckets;
- discounts, waivers, refunds, write-offs, and voids;
- overdue student count; and
- generatedAt / sourceVersion.

Index by date. Use snapshots for trends; use live summaries for today's cards.

## 6. Backend Module Layout

Refactor the monolithic finance backend while preserving API compatibility
during rollout:

```text
convex/finance/
  validators.ts
  money.ts
  allocation.ts
  summaries.ts
  charges.ts
  payments.ts
  agreements.ts
  adjustments.ts
  receivables.ts
  campaigns.ts
  cashClosing.ts
  imports.ts
  exports.ts
  scheduled.ts
  migrations.ts
  finance.test.ts
  campaigns.test.ts
  adjustments.test.ts
  cashClosing.test.ts
  imports.test.ts
```

Keep `convex/finance/functions.ts` as a temporary compatibility facade only if
existing generated references make staged migration safer. New UI should call
feature-specific APIs after the compatibility deploy is stable.

### 6.1 Shared domain services

Extract these helpers so UI mutations, imports, and future tools cannot
implement different finance rules:

- `resolveChargeScope`
- `calculateAgeingBuckets`
- `buildOldestDueFirstAllocation`
- `validateAllocation`
- `postPaymentTransaction`
- `reversePaymentTransaction`
- `postAdjustmentTransaction`
- `refreshStudentAndScopeSummaries`
- `resolveReminderAudience`
- `renderDueReminderMessage`
- `calculateSmsSegments`
- `calculateExpectedDrawerCash`

They must accept typed Convex contexts and IDs; no `any` contexts and no
client-supplied totals.

### 6.2 Public API shape

Representative functions:

```text
finance/overview:getOverview
finance/receivables:listWorklist
finance/receivables:getAgeingSummary
finance/payments:getCollectionContext
finance/payments:previewAllocation
finance/payments:postPayment
finance/payments:voidPayment
finance/agreements:listForStudent
finance/agreements:activateAgreement
finance/adjustments:previewAdjustment
finance/adjustments:postAdjustment
finance/campaigns:previewCampaign
finance/campaigns:createDraft
finance/campaigns:queueCampaign
finance/campaigns:getCampaign
finance/campaigns:listCampaigns
finance/campaigns:retryFailedRecipients
finance/cashClosing:getOpenSession
finance/cashClosing:openSession
finance/cashClosing:previewClose
finance/cashClosing:closeSession
finance/imports:createBatch
finance/imports:validateBatch
finance/imports:commitBatch
```

All collection and report lists are paginated. Preview functions return bounded
samples plus aggregate counts, not unbounded recipient arrays.

## 7. Course- and Batch-Based Reminder Campaign Design

This is a required first-class workflow, not a client-side filter over the
first 100 overdue students.

### 7.1 Filters

The campaign builder supports:

- academic session (defaults to active session);
- scope: all, one course, one batch, or manually selected students;
- course selection;
- batch selection constrained by course;
- one or more ageing buckets;
- minimum and optional maximum overdue amount;
- exclude students reminded within 3, 7, 14, or 30 days;
- include/exclude open payment promises;
- preferred student locale or forced Bangla/English; and
- manual removal from the resolved preview.

### 7.2 Audience semantics

1. Resolve overdue charge/scope summaries on the server.
2. For a course campaign, include overdue scope rows matching the course.
3. For a batch campaign, include overdue scope rows matching both course and
   batch.
4. Aggregate matching rows by student.
5. Deduplicate guardians using the messaging layer's recipient normalization,
   while retaining one campaign-recipient row per student.
6. Apply suppression rules and record the exact reason.
7. Snapshot amount, phone, locale, body, scope, and segment count before queue.
8. Queue in bounded internal mutations; never attempt the whole campaign in one
   mutation.
9. Link every `smsMessages` row to the durable campaign ID and recipient row.
10. Roll up accepted/delivered/failed outcomes asynchronously without altering
    finance balances.

### 7.3 Campaign confirmation UI

The confirmation step shows:

- selected course and batch names;
- ageing and amount filters;
- eligible, suppressed, and manually excluded student counts;
- total overdue amount represented;
- guardian recipient count;
- exact Bangla and English previews;
- UCS-2/GSM segment count and estimated cost;
- last-reminder warning and duplicate-suppression policy;
- a sample of recipients with overdue amounts; and
- an acknowledgement checkbox before the final queue action.

After queueing, show a durable campaign detail page with delivery status,
failed-recipient reasons, retry action, and links back to each student's finance
record.

## 8. Frontend Component Architecture

Replace `FinanceEditor.tsx` as the implementation container with a thin
workspace router and feature folders:

```text
src/components/portal/finance/
  FinanceWorkspace.tsx
  FinanceNav.tsx
  overview/
    FinanceOverview.tsx
    FinanceMetricCard.tsx
    AgeingSummary.tsx
    FinanceAlerts.tsx
  collect/
    CashierWorkspace.tsx
    StudentFinanceSearch.tsx
    StudentBalanceHeader.tsx
    ChargeAllocationTable.tsx
    PaymentDetailsForm.tsx
    PaymentConfirmationDialog.tsx
    PaymentSuccessPanel.tsx
  dues/
    ReceivablesWorklist.tsx
    ReceivableFilters.tsx
    PromiseEditor.tsx
  campaigns/
    CampaignBuilder.tsx
    CampaignPreview.tsx
    CampaignConfirmationDialog.tsx
    CampaignHistory.tsx
    CampaignDetail.tsx
  agreements/
    FeeAgreementEditor.tsx
    DiscountPolicyEditor.tsx
  adjustments/
    AdjustmentEditor.tsx
    AdjustmentHistory.tsx
  closing/
    CashDrawerPanel.tsx
    CashClosingDialog.tsx
  imports/
    PaymentImportWizard.tsx
    ImportValidationTable.tsx
  reports/
    FinanceReports.tsx
```

### 8.1 Cashier workflow

1. Focus student search on entry.
2. Show student, student number, course/batch, total outstanding, overdue, and
   advance credit.
3. Show unpaid charges oldest-first; preselect oldest charges.
4. Enter amount and update the allocation preview immediately.
5. Allocate oldest-due-first by default, while allowing explicit per-charge
   edits that remain within server-validated balances.
6. Show the amount becoming advance credit.
7. Capture method, reference, business date/time, and note.
8. Use a custom confirmation dialog that states allocations, advance, receipt,
   SMS side effect, and immutability.
9. On success, show receipt, print, student record, and “collect another”
   actions.

Target: an ordinary payment reaches the success state in under 45 seconds.

### 8.2 Design system additions

Before implementing new reusable UI, update `DESIGN.md` with:

- finance workspace navigation;
- ageing bucket semantics;
- campaign preview and delivery status patterns;
- adjustment confirmation patterns;
- drawer closing and variance treatment;
- import validation/error table; and
- the distinction between overdue (danger), adjustment (info/warning), and
  physical cash variance (danger when non-zero).

Use existing tokens only. Keep 44px mobile targets, monospaced right-aligned
money, Bangla-first labels, no decorative gradients, no browser confirmation,
and monochrome-safe print.

## 9. Migration and Deployment Strategy

Use `@convex-dev/migrations`, already installed and registered. Finance
migrations live in `convex/finance/migrations.ts` and are run with dry-run,
status monitoring, and explicit verification.

### Deploy A: Widen and dual-write

1. Add new tables and optional fields/indexes.
2. Add scope/ageing helpers.
3. Dual-write course/batch/session snapshots for every new charge.
4. Dual-write old student summaries and new scoped summaries.
5. Keep all current UI and API behavior working.
6. Add reconciliation diagnostics for scope and ageing summaries.

### Migration A: Backfill charge scope

For every charge with `enrolmentId` and missing scope fields:

1. load the enrolment;
2. write course, batch, and academic-session snapshots;
3. record/report orphaned enrolment references rather than guessing; and
4. leave genuinely unscoped custom charges optional.

Run:

```powershell
npx convex run finance/migrations:backfillChargeScope '{"dryRun":true}'
npx convex run finance/migrations:backfillChargeScope
npx convex run --component migrations lib:getStatus --watch
```

### Migration B: Build scoped summaries and ageing

Rebuild `receivableScopeSummaries` and new student ageing fields in bounded
batches. The migration must be idempotent and safe while dual-writing continues.

Verification compares:

- sum of scoped outstanding vs student outstanding;
- sum of scoped overdue vs student overdue;
- sum of ageing buckets vs outstanding; and
- oldest scope due date vs source charges.

### Deploy B: Read new aggregates

1. Switch dues worklists, course/batch filters, and overview cards to new
   summaries.
2. Keep the old `duePreview` and `sendDueReminders` callable for rollback, but
   remove them from the UI.
3. Launch campaign drafts/previews and durable recipient records.
4. Start daily resumable receivable refresh.

### Deploy C: Finance operations

Launch agreements, typed adjustments, cash drawer sessions, and enhanced
student statements. Each feature is separately flaggable through coaching
settings if a staged production rollout is required.

### Deploy D: Imports and narrowing

1. Launch preview-first imports after payment APIs are stable.
2. Verify all eligible charges and summaries are migrated.
3. Make required ageing fields non-optional.
4. Remove dual-read fallbacks.
5. Deprecate old reminder APIs; remove only after no clients reference them.

Never delete legacy finance fields during the first rollout. Mark them optional
and deprecated until production reconciliation has remained clean through at
least one full monthly billing cycle.

## 10. Phased Implementation Work

### Phase 0 — Baseline and architecture guardrails

- Freeze and document existing finance invariants.
- Add characterization tests for the current payment, allocation, advance,
  void, summary, receipt, and SMS behavior.
- Update `DESIGN.md` for new finance patterns.
- Create validators and shared domain helpers.
- Add feature flags only where production staging needs them.

Exit gate: current finance tests pass unchanged and the new architecture has no
behavioral regression.

### Phase 1 — Scope snapshots, ageing, and durable summaries

- Widen schema and dual-write charge scope.
- Add scoped summaries and ageing buckets.
- Add daily refresh with resumable batching.
- Backfill and reconcile existing data.
- Add indexed overview/ageing/worklist queries.
- Extend dues and collections exports with course, batch, oldest due date, and
  ageing columns.

Exit gate: course/batch totals reconcile to charge source data; date rollover
updates overdue and ageing without a payment mutation.

### Phase 2 — Finance overview and receivables worklist

- Build overview metrics with drill-down filters.
- Build ageing worklist with course, batch, session, bucket, amount, promise,
  and last-reminded filters.
- Add payment promises.
- Extract finance navigation and feature folders.

Exit gate: every overview number links to the exact records that compose it.

### Phase 3 — Safer reminder campaigns

- Create campaign and recipient tables.
- Implement server-side course/batch audience resolution.
- Add suppression, deduplication, segment/cost preview, immutable snapshots,
  queue batching, status rollups, and retry.
- Build campaign builder, confirmation, history, and detail UI.
- Link SMS records to campaign recipients.

Exit gate: owners can send to all overdue students, one course, or one batch;
the same student receives at most one message per campaign; duplicate campaigns
respect the selected suppression window.

### Phase 4 — Cashier workflow completion

- Move current collection UI into focused components.
- Add authoritative server allocation preview.
- Add explicit confirmation and success states.
- Improve keyboard and mobile operation.
- Preserve deep links from dashboard, student, dues, and campaign screens.

Exit gate: ordinary payment completion under 45 seconds; no client-calculated
total is trusted by the backend.

### Phase 5 — Agreements and adjustments

- Introduce versioned agreements.
- Connect future charge generation to the agreement effective on the due date.
- Add waiver, credit note, refund, and write-off posting/reversal.
- Extend statements, receipts where applicable, reports, exports, summaries,
  and audit logs.

Exit gate: every balance change is explainable from immutable source documents.

### Phase 6 — Cash closing

- Seed main drawer.
- Add open/close/reopen workflow.
- Associate cash payments with the open drawer session.
- Calculate expected cash from posted cash payments minus cash refunds, plus
  opening float.
- Require variance reason when counted cash differs.
- Add daily closing report and audit trail.

Exit gate: a day cannot be silently reclosed; reopen requires a reason; closing
totals reproduce from source records.

### Phase 7 — Import workflow and trend snapshots

- Add CSV template and upload parsing.
- Stage normalized rows with validation and matching results.
- Add dry preview, correction/export of error rows, and bounded idempotent
  commit.
- Reuse normal posting logic and SMS policy; allow import-time SMS choice with
  explicit confirmation.
- Add daily snapshots and period comparisons.

Exit gate: retrying an import never duplicates a payment; batch totals equal
the sum of committed rows.

### Phase 8 — Student experience and final hardening

- Redesign student finance as a ledger-style statement with explanations.
- Show agreement, concessions, allocations, adjustments, advance, next due,
  and downloadable receipts/statements.
- Complete accessibility, Bangla, mobile, print, authorization, performance,
  and production-data reconciliation checks.

Exit gate: student and owner views agree exactly; teachers cannot discover or
query any finance data.

## 11. Reporting Deliverables

Add or upgrade:

- finance overview with live drill-down;
- daily/monthly collection register;
- payment-method and collector breakdown;
- receivable ageing by course and batch;
- overdue worklist with last reminder and promise date;
- concession/discount/waiver report;
- refund/credit/write-off report;
- voided payment and adjustment report;
- advance-credit report;
- cash drawer closing and variance report;
- campaign outcome report; and
- student statement with a chronological finance timeline.

CSV exports must contain explicit minor-unit or formatted-BDT column labels,
include scope columns, preserve Bangla text with BOM-safe output where the
existing export helper requires it, remain bounded, and disclose truncation.

## 12. Authorization, Audit, and Safety

- All finance mutations call `requireOwnerForFinancialMutation` or its eventual
  equivalent.
- IDs from the client identify requested records but never establish authority.
- Validate course/batch/enrolment consistency on the server.
- Never accept balance, ageing, campaign recipient count, allocation total,
  expected cash, or variance from the client as authoritative.
- Every posted/voided payment, adjustment, agreement activation, campaign
  approval/queue/retry, cash close/reopen, and import commit writes an audit log.
- Audit metadata stores IDs and integer amounts, not private message bodies or
  excessive guardian data.
- Campaign confirmation is required because SMS creates external cost and
  contact side effects.
- Import commit and drawer close require explicit confirmation.
- Keep mutation batches within Convex limits; use scheduled internal mutations
  for campaign resolution/queueing, daily refresh, migrations, and imports.

## 13. Test Strategy

### 13.1 Domain/unit tests

- ageing boundaries: due today, 1, 15, 16, 30, 31, 60, 61, 90, and 91 days;
- Asia/Dhaka date rollover;
- course and batch scope snapshots;
- one student with multiple enrolments/batches;
- course campaign aggregates across batches;
- batch campaign excludes other batches in the same course;
- campaign deduplication and suppression windows;
- Bangla/English message rendering and SMS segment counts;
- partial payment, oldest-first allocation, manual allocation, and advance;
- concurrent payment attempts cannot over-allocate;
- agreement effective-date selection and supersession;
- partial/full waiver, credit, refund, write-off, and reversal;
- cash expected/count/variance and reopen;
- import idempotency and row-level validation;
- summary and source-ledger reconciliation; and
- all owner/student/teacher authorization boundaries.

### 13.2 Component tests

- searchable student selection and keyboard navigation;
- allocation preview and advance display;
- confirmation acknowledgement behavior;
- course-to-batch dependent filter;
- campaign preview/suppression counts;
- error, empty, loading, partial, success, and retry states;
- Bangla labels and money formatting; and
- teacher navigation remains finance-free.

### 13.3 Browser/E2E journeys

1. Owner collects a partial cash payment and prints the A5 receipt.
2. Owner collects more than outstanding and sees advance credit.
3. Owner creates a course campaign and removes one recipient before queueing.
4. Owner creates a batch campaign and confirms no other batch is included.
5. Failed SMS is retried without duplicating delivered recipients.
6. Owner records a promise, then sees it become missed after its date.
7. Owner posts and reverses each adjustment type.
8. Owner closes the drawer with zero variance and with explained variance.
9. Owner previews and commits an import; retry is idempotent.
10. Student sees the same totals and opens the correct receipt/statement.
11. Teacher cannot navigate to or query finance.

Run phone and desktop widths in Bangla and English. Visually verify A5 receipts
and A4 statements/reports in authenticated owner and student sessions.

### 13.4 Required verification commands

```powershell
npm run convex:codegen
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e
npx @google/design.md lint DESIGN.md
git diff --check
```

Use focused finance tests during each phase, then the complete suite at every
phase exit.

## 14. Performance and Scale Guardrails

- No unbounded arrays for campaign recipients, import rows, statement events,
  or adjustments.
- No `.filter()` database scans; add indexes that match course, batch, date,
  status, and scope queries.
- No `.collect()` for operational finance tables.
- Paginate owner lists and use bounded preview samples.
- Campaign and import processing must be cursor-based/resumable.
- Avoid N+1 student lookups in high-volume worklists by snapshotting the
  minimum stable display fields needed or by bounded enrichment.
- Replace full-history summary recomputation on each mutation with incremental
  aggregate updates, but retain bounded reconciliation as a diagnostic.
- Add summary versioning so backfills and logic changes can be detected.
- Daily refresh must skip unchanged/non-overdue scopes where indexes allow.

## 15. Observability and Operations

Add owner-visible or diagnostic signals for:

- last successful daily receivable refresh;
- summary drift count and amount;
- campaign queue progress and failures;
- SMS provider enabled/configured state and low balance;
- open cash drawer and unclosed prior business date;
- import batch progress/errors; and
- monthly billing run status, created/skipped counts, and failures.

Do not claim live SMS completion until SMS.BD credentials, `smsEnabled`, and a
controlled real-recipient delivery test are verified.

## 16. Definition of Done

The finance section is complete when:

- every recommended product change in this plan is implemented or explicitly
  deferred with owner approval;
- course- and batch-based reminder campaigns work from server-resolved,
  snapshotted audiences;
- all financial mutations preserve immutable history and reconcile;
- daily ageing remains correct across date rollover;
- the cashier, campaign, adjustment, closing, and import workflows pass their
  acceptance journeys;
- owner and student totals match source records and each other;
- teachers have no finance access;
- Bangla/English, mobile/desktop, receipt/statement/report print verification is
  complete;
- migrations have been dry-run, executed, monitored, and verified;
- no compatibility fallback is removed before production data is migrated; and
- the full repository verification suite passes.

## 17. Recommended Execution Order

Implement in this order:

1. Phase 0 characterization and design rules;
2. Phase 1 scope/ageing architecture and migrations;
3. Phase 3 reminder campaigns, because course/batch reminders are a confirmed
   product requirement and depend directly on Phase 1;
4. Phase 2 overview/worklist, reusing the same scoped summaries;
5. Phase 4 cashier refactor;
6. Phase 5 agreements/adjustments;
7. Phase 6 cash closing;
8. Phase 7 imports/trends;
9. Phase 8 student experience and hardening.

This order delivers the user's course/batch reminder requirement early without
building it on a temporary client-side audience model.
