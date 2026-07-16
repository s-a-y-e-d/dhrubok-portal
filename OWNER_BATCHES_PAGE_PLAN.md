# Owner Batches Page Implementation Plan

## Status

Implementation-ready plan for a dedicated `/owner/batches` workspace. It is
designed to be built in parallel with the Teachers page after the completed
Course-page rebuild.

## Frozen product decisions

- The page lists batches from every course; academic sessions do not exist.
- A batch always belongs to one permanent root course.
- Batch identity is bilingual name, code, and start date. Slug is generated
  from code on the server. Capacity and end date do not exist.
- New batches are active, public, and admission-open by default.
- Creating a batch copies the course's current active teacher-subject defaults
  into batch-specific assignments. Later course-default changes do not rewrite
  an existing batch.
- Every new batch requires at least one weekly routine row.
- A weekly routine row contains weekday, start time, end time, teacher, and an
  optional subject.
- Editing a weekly routine changes future generated occurrences only. It never
  changes submitted attendance or a one-off occurrence override.
- One-off class rescheduling and extra classes belong to the future Schedule
  page, not this page.
- Student admission/enrolment editing remains in Admissions and Students. The
  Batch page shows roster counts and links to the filtered students view.
- A completed or archived batch is read-only. Archived batches cannot be
  restored in this implementation.

## User outcomes

An owner can:

1. See all batches across all courses in one searchable, filterable workspace.
2. Create a batch from an active course and begin using it immediately.
3. Open a batch to inspect its course, status, teachers, subjects, routine, and
   enrolled-student count.
4. Edit batch identity, visibility, admission state, teacher assignments, and
   future weekly routine.
5. Complete a finished intake or archive an unused batch when server-owned
   blockers allow it.
6. Jump to the related Course, filtered Students list, or future Schedule page.

## Scope

### Included

- `/owner/batches` route and owner navigation entry;
- global batch list with search, course/status filters, and pagination;
- batch detail sheet;
- two-step batch creation dialog;
- batch identity and publication editing;
- copied course-default assignments;
- assignment editing for this batch only;
- weekly-routine replacement with conflict preview;
- future occurrence reconciliation;
- lifecycle actions and authoritative blockers;
- Bangla and English UI, loading, empty, error, and responsive states;
- Convex and component tests.

### Excluded

- academic sessions, capacity, end date, and owner-entered slug;
- course subject/default editing;
- teacher profile CRUD;
- student admission or enrolment mutation;
- one-off rescheduling, cancellation, extra classes, and calendar views;
- attendance editing;
- fee-plan editing;
- drag-and-drop calendar rearrangement.

## Information architecture

### Page header

- Eyebrow: Academics / একাডেমিক
- Title: Batches / ব্যাচ
- Description explains that batches represent individual intakes of permanent
  courses.
- Dominant action: `New batch`.

### Filter toolbar

- Search by batch name, batch code, course name, or course code.
- Course filter: all active and archived courses that have batches.
- Status filter: `Active`, `Planned`, `Completed`, `Archived`.
- Secondary visibility filters: admission open and website published.
- URL query parameters are recommended for `courseId`, `status`, and `query` so
  links from Courses, Students, and dashboards preserve context.

### Desktop table

Columns:

1. Batch name and code
2. Course
3. Status
4. Weekly classes
5. Teachers
6. Active students
7. Admission
8. Website
9. Actions

Use 20-row pagination. The batch name opens the detail sheet. Row actions use a
`DropdownMenu`; status always uses text plus a semantic `Badge`.

### Mobile representation

- Replace the wide table with compact batch cards below the table breakpoint.
- Preserve batch/course identity, status, next routine summary, student count,
  and admission state.
- Every interactive target is at least 44px.

### Batch detail sheet

The sheet is 400–560px on desktop and full-width on mobile. Sections:

1. Identity and lifecycle badges
2. Course and start date
3. Admission and website state
4. Active student count with `View students`
5. Teacher-subject assignments
6. Weekly routine ordered Sunday through Saturday, then start time
7. Actions: edit details, edit teachers, edit weekly routine, complete, archive

The sheet must have `SheetTitle` and `SheetDescription`, restore focus on close,
and use an `AlertDialog` for destructive/lifecycle confirmation.

## Creation flow

Use one complex `Dialog` with two numbered steps.

### Step 1 — Course and batch details

Required:

- active course;
- Bangla batch name;
- English batch name;
- batch code;
- start date.

Read-only defaults shown before continuing:

- status: active;
- admission: open;
- website: public;
- generated slug is not shown as an editable field.

Selecting a course loads its current active `courseTeacherDefaults`. Block the
next step if the course is archived or has no complete default mapping.

### Step 2 — Teachers and weekly routine

- Show copied teacher-subject assignments from the selected course.
- Allow owner adjustments for this batch without changing course defaults.
- Require every subject-bearing routine row to match an active batch
  assignment.
- Require at least one routine row.
- Each row has weekday, start, end, teacher, optional subject, and remove action.
- Highlight all conflicting rows and disable final submission.
- Show both batch collisions and teacher collisions, naming the other batch,
  weekday, time, and effective range.

Final submission is atomic: batch, assignments, schedules, audit entry, course
snapshot refresh, and occurrence-materialization scheduling either all succeed
or none are created.

## Editing behavior

### Edit batch details

- Editable: names, code, start date, admission-open, public visibility.
- Slug is regenerated from code on the server.
- Changing start date is blocked after submitted attendance exists or active
  enrolments predate the proposed start date.
- Only active batches may be public or admission-open.

### Edit teachers

- Replaces the batch's active assignment set from an effective date.
- This never changes `courseTeacherDefaults`.
- An assignment cannot end while an active routine still references it.
- Removing a teacher therefore requires the same transaction to replace or end
  their future routine rows.

### Edit weekly routine

- Use a full routine editor, not one mutation per row.
- Owner chooses an `effectiveFrom` date, defaulting to today in Dhaka.
- Validate the complete proposed array against itself and existing schedules.
- On success:
  1. end/cancel superseded routine templates from the effective date;
  2. create the replacement templates;
  3. cancel unmodified future `scheduled` occurrences from superseded
     templates on or after `effectiveFrom`;
  4. preserve `open`, `submitted`, and explicitly one-off-overridden
     occurrences;
  5. materialize a fresh rolling four-week window;
  6. write one audit event and refresh the course snapshot.

## Class-occurrence compatibility contract

Add an explicit marker to `classSessions` before implementing routine editing:

```ts
isOneOffOverride: v.optional(v.boolean())
```

- Materialized occurrences use `false` or absence.
- The later Schedule page sets it to `true` when moving one occurrence.
- Batch routine reconciliation must never delete or rewrite an occurrence where
  this marker is true.
- Keep the immutable schedule/date `sessionKey`; visible date/time may differ
  after a one-off override.
- Submitted occurrences remain immutable under every mutation.

This is the only schema change reserved for the Batches implementation. If the
Schedule page starts concurrently, one integration owner must coordinate this
field and its semantics.

## Backend work

### New read model: `convex/academics/batchWorkspace.ts`

Add:

- `listBatches({ status, courseId?, query?, paginationOpts })`
- `getBatchDetails({ batchId })`
- `getBatchEditOptions({ batchId? , courseId? })`
- `getRoutineReplacementPreview({ batchId, effectiveFrom, assignments,
  routine })`
- `getLifecycleBlockers({ batchId, action })`

List rows should be bounded projections, not N+1 client queries. Return names
needed for display, counts, and the next routine summary.

### Atomic mutations

Add or replace with:

- `batches.createWithRoutine`
- `batches.updateDetails`
- `batches.replaceAssignmentsAndRoutine`
- `batches.complete`
- retain guarded `batches.archive`

Do not expose a client sequence that creates a batch and then separately adds
assignments and routines. That would leave partial operational batches.

### Validation rules

- global uniqueness for normalized batch code and generated slug;
- active parent course required for creation;
- valid ISO start/effective dates;
- teacher and subject records must be active;
- subject must belong to the parent course;
- subject routine must match the selected teacher assignment;
- valid weekday/minute ranges;
- no overlapping new rows for the batch;
- no overlapping teacher schedules across batches over intersecting effective
  ranges;
- completed/archived batch immutability;
- server-owned lifecycle blockers.

### Index review

Reuse existing indexes where possible. Add a batch search index only if bounded
course/status queries plus normalized `searchText` cannot meet the target. Do
not scan all batches or fan out unbounded joins.

## Shadcn composition

Use installed components first:

- `Button`, `Badge`, `Table`, `Input`, `Select`, `Dialog`, `Sheet`,
  `AlertDialog`, `DropdownMenu`, `Checkbox`, `Separator`, `Skeleton`, and the
  existing `EmptyState`.
- Add `Field`, `FieldGroup`, `FieldSet`, `ToggleGroup`, `Card`, `ScrollArea`,
  `Spinner`, and `sonner` through `npx shadcn@latest` only if implementation
  confirms they are missing and needed.
- Forms use `FieldGroup`/`Field`; validation uses `data-invalid` and
  `aria-invalid`.
- `SelectItem` belongs inside `SelectGroup`.
- Icons use the project's Lucide library and `data-icon` inside buttons.
- Use semantic tokens from `DESIGN.md`; do not introduce raw status colours.

## Suggested file ownership

Batch task owns:

- `src/components/portal/batches/**`
- `convex/academics/batchWorkspace.ts`
- batch-focused additions to `batches.ts`, `assignments.ts`, `schedules.ts`, and
  `classOccurrenceMaterializer.ts`
- batch-focused tests

Shared integration files must be edited serially after parallel feature work:

- `src/components/portal/RoleSection.tsx`
- `src/components/portal/PortalShell.tsx`
- `convex/schema.ts`
- `convex/_generated/**`
- `DESIGN.md`

## Implementation phases

### Phase 1 — Contracts and tests

- Lock request/response validators and occurrence-reconciliation behavior.
- Add failing tests for atomic creation, conflicts, copied defaults, routine
  replacement, overrides, and submitted-occurrence immutability.

### Phase 2 — Batch read model and atomic mutations

- Implement bounded workspace queries.
- Implement create/edit/lifecycle mutations and audit events.
- Extend materialization/reconciliation idempotently.

### Phase 3 — UI workspace

- Build list, filters, desktop/mobile states, detail sheet, and lifecycle
  dialogs.
- Build the two-step creation dialog and routine editor.

### Phase 4 — Integration

- Add owner route and navigation metadata.
- Link Courses to filtered Batches and Batches to Students/Schedule.
- Run Convex codegen after shared schema integration.

### Phase 5 — Verification

- Bangla-first visual and interaction checks at mobile, tablet, and desktop.
- Keyboard/focus and screen-reader label checks.
- Focused tests, full typecheck, full tests, lint, build, and authenticated E2E.

## Required tests

Backend:

- atomic create success and rollback;
- copied course defaults do not change when course defaults later change;
- duplicate code/slug rejection;
- internal and existing teacher/batch conflict rejection;
- subject/teacher assignment mismatch rejection;
- routine replacement preserves submitted and one-off-overridden occurrences;
- materialization is idempotent;
- start-date and lifecycle blockers;
- owner authorization.

Frontend:

- empty state opens creation dialog;
- course filter and URL state;
- step validation and dirty-close warning;
- conflicting routine rows are highlighted and submission stays disabled;
- detail/edit/lifecycle flows;
- Bangla and English labels;
- table-to-mobile-card behavior and accessible overlay titles.

## Acceptance criteria

- `/owner/batches` shows all batches across courses without any academic-session
  concept.
- A complete operational batch is created in one atomic submission.
- Course defaults are copied, then become batch-owned history.
- Owners can safely change all future routine occurrences from the Batch page.
- Submitted attendance and one-off Schedule overrides are preserved.
- No batch form exposes slug, capacity, or end date.
- Server conflicts and lifecycle blockers are authoritative and actionable.
- The page is usable in Bangla and English at mobile and desktop widths.
- No unbounded Convex reads, N+1 client subscriptions, or partial mutations are
  introduced.

