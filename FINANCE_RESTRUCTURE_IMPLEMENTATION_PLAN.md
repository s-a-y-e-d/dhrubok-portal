# Finance Restructure Implementation Plan

## Status

- Product decisions: approved
- Data migration: not required; there is no finance data to preserve
- Implementation: not started
- SMS integration: deliberately deferred

## Objective

Replace the existing broad finance subsystem with a focused cash-collection
workflow built around three fee types:

1. Admission fee, collected automatically when a student is admitted.
2. Full monthly fees, collected for one or more whole months.
3. Other fees, collected immediately with an owner-entered fee name.

The finished system must be fast for daily owner use, preserve an auditable
receipt history, provide a simple student view, and leave a clean integration
point for guardian SMS without sending or queuing SMS in this phase.

## Approved Product Rules

### General

- All collections are cash. Do not store or display a payment-method choice.
- Money is stored only in integer minor units.
- Partial payments are not allowed.
- Every non-zero collection creates a unique English receipt.
- Collections are never deleted. Incorrect collections are voided with a
  required reason and retained in history.
- Receipt actions use the label **Print / Save PDF** and invoke the browser
  print dialog. The browser may print physically or save the receipt as PDF.
- Do not queue or send payment SMS in this implementation.

### Admission

- Admission fee may be zero.
- Agreed monthly fee must be greater than zero.
- Admission fee is treated as received during admission.
- If admission fee is greater than zero, admission atomically creates a posted
  admission collection and its receipt.
- If admission fee is zero, admission creates no financial collection and no
  receipt.
- The first billing month defaults to the admission month.
- The owner may select a later first billing month, including a month in the
  following year when needed.

### Monthly fees

- The due date is permanently the first day of each month.
- Remove the configurable monthly due-day setting.
- One monthly record represents one enrolment and one calendar month.
- A month is either unpaid or paid in full. There is no partial state.
- One collection may cover several unpaid months.
- The one-click collection action covers all currently due months for that
  student in one collection and one receipt.
- The confirmation must list every month, its snapshotted amount, and the total.
- Manual collection may include due months from previous years.
- Manual collection may include future months through December of the current
  calendar year.
- Already-paid months cannot be selected or paid twice.
- The interface displays only **Due now** and **Future paid**. It does not show
  an upcoming state.

### Monthly-fee changes and enrolment changes

- Existing paid and unpaid monthly records retain their snapshotted amounts.
- A changed agreed monthly fee applies only to monthly records generated after
  the change.
- When a student changes course or batch, the previous enrolment stops
  generating monthly records.
- Historical dues, collections, and receipts remain unchanged.
- The new enrolment receives an owner-selected first billing month.

### Other fees

- Other fees are collected immediately and never create a due.
- The owner enters one required free-text fee name and an amount greater than
  zero.
- The receipt displays that name exactly as entered; it never displays the
  internal category name "Other".

### Collection dates

- Collection date defaults to the current Dhaka date.
- Owners may use a past collection date.
- A backdated collection requires an explicit warning in the final
  confirmation.
- Future collection dates are not allowed.

## Information Architecture

Keep one **Finance** item in the owner sidebar. Use a compact horizontal
sub-navigation within Finance; do not introduce a second sidebar.

```text
Owner
├── /owner/finance
│   └── Monthly-fee table and one-click due collection
├── /owner/finance/collect
│   └── Manual monthly or other-fee collection
├── /owner/finance/receipts
│   └── Collection history, receipt access, and voiding
└── /owner/finance/receipts/[collectionId]
    └── English A5 receipt and Print / Save PDF

Existing owner workflows
├── /owner/admissions
│   └── Admission fee, monthly fee, and first billing month
└── /owner/students
    └── Change agreed monthly fee and enrolment

Student
├── /student/fees
│   └── Due now, future paid, history, and receipts
└── /student/receipt/[collectionId]
    └── Authorized read-only English receipt
```

## Page Specifications

### `/owner/finance` — Monthly fees

This is the Finance landing page and the primary daily workflow.

#### Summary controls

Show four compact, drill-down summary cards:

- Collected today
- Total due now
- Students with dues
- Future months paid

#### Filters

- Search by student name, student number, or guardian phone
- Course
- Batch
- Due only
- Clear filters

Show every active student by default, ordered with students owing fees first.
Use bounded pagination rather than loading the full student population.

#### Desktop table

Columns:

1. Student
2. Course and batch
3. Agreed monthly fee
4. Due now: month labels and total
5. Future paid: month labels
6. Action

Keep the student column sticky when the table scrolls horizontally.

#### Mobile cards

Collapse each row into a shadcn `Card` showing the same information with a
full-width collection action. All interactive targets must be at least 44px.

#### One-click collection

The **Collect due** action opens a shadcn `AlertDialog` containing:

- Student identity
- Every due month and its amount
- Authoritative total
- A statement that every listed month will be paid in full
- A statement that corrections require voiding the collection
- Cancel and Confirm collection actions

The server, not the client, resolves the final eligible months and total again
inside the posting transaction. On success, show:

- Receipt number
- Total collected
- Print / Save PDF
- View receipts
- Done

### `/owner/finance/collect` — Manual collection

Use a searchable student selector. A `student` query parameter may preselect a
student when the owner arrives from another screen.

Use a shadcn `ToggleGroup` with:

- Monthly fee, selected by default
- Other fee

#### Monthly mode

- Show all unpaid due months.
- Show selectable future months through December of the current year.
- Show paid months as disabled.
- Allow multiple month selection.
- Do not provide an editable amount field.
- Calculate the displayed total from month snapshots.
- Include collection date and optional note.
- Use an explicit preview/confirmation before posting.

#### Other mode

- Required fee name
- Required amount greater than zero
- Collection date
- Optional note
- Explicit preview/confirmation before posting

If collection date is before today, the confirmation must visibly state the
backdated date.

### `/owner/finance/receipts` — Collection history

Use a paginated table with:

- Receipt number
- Collection date
- Student
- Receipt item summary
- Amount
- Type: admission, monthly, or other
- Status: posted or voided
- Collected by
- Actions

Filters:

- Student search
- Date range
- Type
- Status

Actions:

- View receipt
- Print / Save PDF
- Void collection

Voiding requires a reason in an accessible dialog and a final destructive
confirmation. Voiding a monthly collection restores every covered monthly
record to unpaid. Voiding admission or other collection changes only the
collection status. The admitted student remains admitted.

### Owner receipt route

Render an English-only A5 receipt with:

- Coaching-centre English name and contact details
- Receipt number and collection date
- Student name and number
- Course and batch snapshots or current context as defined below
- One line per collected item
- Total cash received
- Collector name
- Configurable English footer
- Signature line
- Prominent monochrome-safe **VOIDED** treatment when applicable

Use immutable snapshots for receipt-critical text so later student, course,
batch, or custom-fee changes do not rewrite historical receipts.

### Admission workflows

Update both application conversion and direct admission.

Financial fields:

- Admission fee, required numeric input with minimum zero
- Agreed monthly fee, required and greater than zero
- First billing month, defaulted to the admission month

The admission mutation must atomically create the student, enrolment, reserved
student account, initial monthly record when applicable, and optional admission
collection. Return the optional collection/receipt identifier to the UI.

The admission success state includes **Print / Save Admission Receipt** only
when admission fee is greater than zero.

### `/owner/students`

Keep agreed monthly fee editable. Clarify the effective behavior in the UI:

- Existing monthly records remain unchanged.
- Newly generated monthly records use the changed amount.

Course/batch transfer asks for the new enrolment's first billing month.

### `/student/fees`

Replace the existing complex statement with a calm, read-only page containing:

- Due now: month labels and total
- Future paid: month labels
- Paginated collection history
- Receipt links

Students may access only records belonging to their linked student identity.
Voided collections remain visible and clearly marked.

## Backend Design

Follow `convex/_generated/ai/guidelines.md` for every schema and function
change. All public and internal functions require argument and return
validators. Owner mutations derive authorization from the authenticated server
identity.

### Enrolment fields

Retain or add:

- `agreedMonthlyAmountMinor`
- `firstBillingMonth` as `YYYY-MM`

Do not store a due-day field. Due date is derived as the first day of the
period.

### `monthlyFeeRecords`

One document per enrolment and calendar month:

- `studentId`
- `enrolmentId`
- `courseId`
- `batchId`
- `periodKey` (`YYYY-MM`)
- `dueDate` (`YYYY-MM-01`)
- `amountMinor` snapshot
- `status`: `unpaid` or `paid`
- optional `collectionId`
- `createdAt`
- optional `paidAt`

Required indexes should include:

- enrolment and period
- student and due date
- student and status
- status and due date
- course and status/due date where needed by filters
- batch and status/due date where needed by filters

Mutation logic must enforce one record per enrolment and period. Collection
mutations must re-read and validate each selected record transactionally.

### `feeCollections`

One immutable collection header:

- `receiptNumber`
- `studentId`
- `collectionType`: `admission`, `monthly`, or `other`
- `amountMinor`
- `collectedOn`
- optional `note`
- `status`: `posted` or `voided`
- `collectedByAccountId`
- `createdAt`
- optional `voidedAt`
- optional `voidedByAccountId`
- optional `voidReason`

Include indexes for student/date, status/date, type/date, receipt number, and
collector/date.

### `feeCollectionItems`

Use a child table rather than an array on the collection document:

- `collectionId`
- `studentId`
- optional `monthlyFeeRecordId`
- `itemType`: `admission`, `monthly`, or `other`
- `descriptionSnapshot`
- optional `periodKey`
- `amountMinor`
- student/course/batch display snapshots required by the receipt
- `createdAt`
- optional `reversedAt`

Index by collection, monthly record, and student/date.

### Receipt numbering

Reuse the existing server-side identifier mechanism and configured receipt
prefix where suitable. Receipt generation must happen in the same transaction
as collection posting.

### Monthly materialization

Replace legacy monthly billing with one idempotent internal materializer.

- Run daily using Dhaka date semantics.
- Process active enrolments in bounded batches.
- For each enrolment, materialize missing periods from `firstBillingMonth`
  through the current month.
- Stop at the enrolment's effective end/transfer boundary.
- Snapshot the enrolment's current agreed monthly amount only when inserting a
  new record.
- Reruns must not create duplicates.
- Admission and enrolment-transfer mutations should create the currently due
  record immediately when applicable instead of waiting for cron.

### Collection mutations

Implement focused mutations for:

- Collect all current dues for one student
- Collect selected monthly periods
- Collect another fee
- Void a collection

For monthly collections, clients submit selected record identifiers or period
keys, never arbitrary amounts. The server recomputes the total and refuses
paid, duplicate, unrelated, future-out-of-range, or partial selections.

### Query boundaries

- Owner worklists and receipt history are paginated and index-backed.
- Owner summary cards use bounded/maintained summaries rather than unbounded
  table scans.
- Student queries derive the student identity server-side and cannot enumerate
  another student's records.
- Teachers receive no financial data.

### SMS seam

Do not enqueue an SMS and do not create SMS messages during collection.
Structure the collection result so a future, separately approved SMS phase can
attach to a stable `collectionId` and idempotency key without changing the
financial transaction model.

## Legacy Removal Scope

Remove the legacy UI, API functions, schema tables, cron jobs, reports, tests,
seed/reset logic, and dashboard projections for:

- Fee plans and fee-plan items
- Discounts and formal fee agreements
- Generic student charges
- Partial-payment allocation
- Advance payments and credits
- Adjustments, refunds, waivers, and write-offs
- Due-reminder campaigns and payment promises
- Receivables ageing and reconciliation
- Cash drawers and cash closing
- Payment imports
- Payment-method choices
- Legacy finance operational snapshots
- Finance SMS queueing
- Configurable monthly due day

Retain only simplified collection totals, due totals, recent collections,
receipt history, monthly fee records, and void history where other portal
surfaces need financial summaries.

Because no finance data exists, use a direct schema cutover. Do not add a
compatibility layer or migration for deleted finance records.

## Cross-Feature Updates

Update all dependencies discovered in:

- Admission conversion and direct admission
- Owner student list/detail and enrolment transfer
- Owner dashboard totals and recent collections
- Student dashboard fee summary
- Student fees and receipt pages
- Owner reports/exports that currently read legacy finance tables
- Global search results that currently expose payments
- Developer seed/reset utilities
- Scheduled jobs
- Audit action labels
- Portal descriptions and navigation copy
- Unit, component, and end-to-end fixtures

Any report that cannot be expressed meaningfully with the simplified model
should be removed rather than emulating deleted accounting concepts.

## UI Component Plan

Use installed shadcn components before creating new patterns:

- `Table` for desktop worklists and receipt history
- full `Card` composition for mobile records and summaries
- `AlertDialog` for collection posting confirmations
- `Dialog` for void-reason entry
- `ToggleGroup` for Monthly fee / Other fee
- `FieldGroup` and `Field` for form structure
- `Input`, `Select`, `Checkbox`, and `Calendar` as appropriate
- `Badge` for paid, due, and voided labels
- `Skeleton` for loading
- the existing empty-state component for no-data states
- `Spinner` inside disabled pending buttons
- `sonner` for success and error feedback
- `Separator` instead of hand-built divider markup

If a searchable combobox is needed, inspect the shadcn registry and current
component documentation first, then add it through the project's npm-based
shadcn CLI. Do not hand-roll a competing selector.

Follow the project's Radix base, new-york style, Tailwind v4 semantic tokens,
Lucide icon library, and `@/components/ui` imports.

## `DESIGN.md` Update

Update the Finance Operations and Financial Components guidance before UI
implementation. Remove requirements for:

- Partial allocation
- Payment-method selection
- Ageing buckets and due campaigns
- Cash closing and variance
- Advance-credit presentation

Add authoritative patterns for:

- Monthly-fee worklist
- Due-now and future-paid states
- Whole-month selection
- Multi-month confirmation
- Other-fee name and amount
- Backdated-collection warning
- Posted/voided collection history
- English-only A5 fee receipts
- Cash-only behavior
- Mobile monthly-fee cards

Preserve the existing design tokens, Bangla-first portal typography, semantic
color rules, 44px mobile targets, monochrome-safe print requirements, and
one-primary-action principle.

## Implementation Phases

### Phase 1 — Contract and schema cutover

1. Update `DESIGN.md` finance guidance.
2. Define the simplified schema and validators.
3. Remove legacy finance tables and references from schema.
4. Update enrolment fields and remove `monthlyDueDay` from settings.
5. Regenerate Convex types and resolve all compile-time dependency sites.

Exit criteria: schema/codegen succeeds and all legacy finance references are
enumerated as either removed or scheduled for replacement.

### Phase 2 — Core backend

1. Implement month/date helpers using Dhaka semantics.
2. Implement idempotent monthly materialization.
3. Implement indexed owner and student queries.
4. Implement admission, due, selected-month, other-fee, and void mutations.
5. Implement receipt query and simplified summary projections.
6. Add audit events without SMS side effects.

Exit criteria: focused Convex tests pass for all financial invariants.

### Phase 3 — Admission and student management

1. Update direct-admission financial fields.
2. Update application-conversion financial fields.
3. Add first-billing-month selection and validation.
4. Return and surface optional admission receipts.
5. Update monthly-fee editing and transfer behavior in `/owner/students`.

Exit criteria: both admission paths atomically create correct records and
monthly-fee changes affect only later materialization.

### Phase 4 — Owner finance pages

1. Replace the legacy Finance workspace with the new route structure.
2. Build monthly-fee summary, filters, paginated table, and mobile cards.
3. Build one-click due confirmation and receipt success state.
4. Build manual monthly/other collection.
5. Build receipt history and void workflow.
6. Build the English A5 receipt surface.

Exit criteria: an owner can complete each daily collection workflow on desktop
and mobile with explicit confirmation and authoritative server feedback.

### Phase 5 — Student, dashboard, and report integration

1. Replace the student fee statement with the simplified view.
2. Update student receipt authorization and route.
3. Rewrite owner and student dashboard finance projections.
4. Simplify or remove legacy finance reports and exports.
5. Update search, navigation descriptions, audit labels, seeds, and fixtures.

Exit criteria: no portal surface reads removed finance APIs or tables.

### Phase 6 — Legacy deletion and verification

1. Delete unused finance components and backend modules.
2. Delete obsolete CSS while preserving shared print styles used elsewhere.
3. Remove obsolete cron registrations.
4. Run a repository-wide legacy-reference search.
5. Run codegen, typecheck, unit/component tests, lint, production build, and
   targeted Playwright tests.
6. Visually verify Bangla and English owner screens, mobile layouts, dark-mode
   component states, and English A5 print preview.

Exit criteria: the repository contains no reachable legacy finance workflow and
all required verification passes.

## Backend Test Matrix

- Admission fee zero creates no collection or receipt.
- Positive admission fee creates one collection and one receipt atomically.
- Monthly fee zero or negative is rejected.
- First billing month defaults correctly and accepts a valid later month.
- Admission after the first creates the current due immediately when selected.
- Daily materialization is idempotent.
- Missed daily runs catch up all missing due months.
- Fee change does not rewrite existing records.
- Transfer stops old-enrolment materialization and starts the new schedule.
- Collect-all-due resolves and posts every due month once.
- Multi-month manual collection creates one receipt with separate items.
- Future collection is limited to the current calendar year.
- Prior-year dues remain collectible.
- Paid and duplicate months are rejected.
- Client-supplied amount tampering cannot alter monthly totals.
- Other fee uses the exact entered name and amount.
- Future collection date is rejected.
- Backdated collection is accepted and recorded accurately.
- Voiding monthly collection restores all covered months.
- Voiding admission/other collection does not alter enrolment.
- Repeated void attempts are rejected.
- Owners can mutate; teachers cannot access finance; students can read only
  their own records.
- No collection creates or queues an SMS.

## UI and E2E Test Matrix

- Finance root renders summary cards, filters, and paginated active students.
- Due students sort before non-due students.
- Due-only filter, course, batch, and search work together.
- Desktop sticky-column table remains usable at narrow widths.
- Mobile cards preserve all essential values and 44px targets.
- One-click confirmation lists every month and amount.
- Monthly mode is the manual-collection default.
- Multiple due/future months can be selected.
- Paid months are disabled.
- Other mode requires fee name and amount.
- Backdated confirmation is visibly distinct.
- Success state links to the generated receipt.
- Receipt history filters and void workflow work.
- Admission success conditionally shows the receipt action.
- Student page shows only Due now, Future paid, history, and owned receipts.
- English receipt prints as A5 and remains legible in grayscale.
- Bangla owner UI does not clip text; English UI remains stable.
- Keyboard navigation, dialog focus management, labels, and error messaging pass
  accessibility checks.

## Acceptance Criteria

The restructure is complete when:

1. Admission with a positive fee automatically records cash and creates a
   receipt; zero admission fee creates neither.
2. Monthly dues begin on the selected first billing month and are due on the
   first day.
3. The owner can collect every current due through one confirmed action whose
   preview names all months.
4. The owner can manually collect multiple full monthly fees or one named other
   fee.
5. Partial payments, duplicate month payments, and future-year prepayment are
   impossible.
6. Every collection has an English printable A5 receipt.
7. Every collection can be audited and voided with a reason.
8. Students see only their own simplified fee information and receipts.
9. No finance workflow queues or sends SMS.
10. All approved legacy finance capabilities and dead dependencies are removed.
11. `DESIGN.md`, tests, reports, dashboards, seeds, and navigation match the new
    model.
12. Codegen, typecheck, tests, lint, build, targeted browser tests, and print
    verification pass.

## Deferred Work

- Guardian SMS after fee collection
- SMS retry, delivery status, templates, and provider integration
- Online payment gateways
- Non-cash payment methods
- Partial payments
- Advance payments beyond the approved current-year future-month workflow
- Discounts, waivers, refunds, adjustments, and accounting-ledger features
- Payment import and cash-drawer operations

