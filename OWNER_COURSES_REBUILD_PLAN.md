# Owner Courses Rebuild Plan

## Status

Implementation-ready plan for rebuilding `/owner/courses` and removing academic
sessions from the product and data model.

This plan is intentionally limited to:

- removing academic sessions completely;
- making courses permanent root-level records;
- adding course-level default teacher-subject mappings;
- rebuilding the owner Course page;
- creating a course, its first batch, assignments, and weekly routine through
  one three-step wizard;
- establishing the minimum class-occurrence contract needed by the later
  Schedule page.

Dedicated `/owner/batches`, `/owner/teachers`, and `/owner/schedule` pages are
separate follow-up projects. Their shared backend requirements are recorded here
so this work does not create another migration later.

## Product decisions

The following decisions are frozen for this implementation.

### Course model

- A course is a permanent, reusable root record and continues indefinitely.
- A course does not belong to an academic session.
- Academic sessions and every `academicSessionId` are removed from the system.
- Course lifecycle is only `active | archived`.
- There is no draft or completed course state.
- A newly created course is active but private (`isPublic: false`). Website
  publication remains an explicit Website CMS action.
- Course slug is generated from the course code and is not entered in the
  wizard.
- Course code and generated slug remain globally unique.

### Course teacher defaults

- Step 2 selects existing active teachers and existing active subjects only.
- Every course subject must have exactly one default teacher.
- A teacher may be the default teacher for multiple subjects.
- The mapping is a course-level default, not a batch assignment.
- Creating a future batch copies the current course defaults into that batch's
  teacher assignments.
- Changing a course default later affects future batches only. Existing batch
  assignments do not change automatically.

### First batch and routine

- Course creation always creates one first batch.
- The first batch requires only name, code, and start date from the owner.
- Batch slug is generated from the batch code.
- Capacity and end date are removed.
- The first batch is created as active, public, and admission-open.
- At least one weekly routine row is required.
- A routine row contains weekday, start time, end time, teacher, and an optional
  subject.
- Multiple non-overlapping routine rows may use the same weekday.
- If a routine has a subject, the selected teacher must be that subject's
  default teacher from Step 2.
- A subjectless routine may use any teacher selected in Step 2.
- The batch start date is the effective-from date for all initial routines.
- Batch and teacher time conflicts block final submission and highlight every
  affected row.

### Class occurrences

- Weekly routines automatically materialize actual class occurrences for a
  rolling four-week window.
- Later, the Schedule page reschedules one occurrence only; it never edits the
  recurring routine.
- Later, the Batch page edits the weekly routine and therefore affects future
  occurrence generation.
- Submitted attendance makes its class occurrence immutable.

### Creation transaction

Final submission is atomic. A validation or write failure creates none of the
course, course subjects, course teacher defaults, first batch, batch teacher
assignments, or routines.

## Target domain model

```text
Course (active | archived)
├── Course subjects
├── Course teacher defaults
│   └── exactly one teacher per course subject
└── Batches
    ├── copied teacher-subject assignments
    ├── weekly routine templates
    ├── enrolled students
    └── generated class occurrences
```

### `courses`

Remove:

- `academicSessionId`
- `draft` and `completed` status variants
- session-based indexes and search-index filter fields

Retain:

- code and generated slug;
- bilingual names, short descriptions, and detailed descriptions;
- optional cover image;
- public publication fields;
- audit fields.

Status becomes:

```ts
v.union(v.literal("active"), v.literal("archived"))
```

The course search index filters by status only.

### New `courseTeacherDefaults` table

Add a stable course-level mapping instead of overloading
`teacherBatchAssignments`:

```ts
courseTeacherDefaults: defineTable({
  courseId: v.id("courses"),
  subjectId: v.id("subjects"),
  teacherId: v.id("teachers"),
  status: v.union(v.literal("active"), v.literal("ended")),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdByAccountId: v.id("portalAccounts"),
  updatedByAccountId: v.id("portalAccounts"),
})
```

Required indexes:

- `by_courseId_and_status`
- `by_courseId_and_subjectId`
- `by_teacherId_and_status`
- `by_subjectId_and_status`

Every mutation must enforce at most one active mapping for a course-subject
pair. The create wizard requires exactly one mapping for every selected course
subject.

### `batches`

Remove:

- `academicSessionId`
- `endDate`
- `capacity`
- session-based indexes

Make `startDate` required. Keep the existing batch lifecycle for now because
the later Batch page still needs active/completed/archived behavior. This plan
only guarantees that the wizard creates the first batch as active.

Name and code are the only owner-entered identity fields in the wizard. Generate
slug from code on the server. Set:

```ts
status: "active"
admissionOpen: true
isPublic: true
publicSortOrder: 0
```

Remove capacity-derived projections such as `totalCapacity` from course
operational snapshots, workspace queries, public projections, readiness UI, and
tests. Capacity must not survive as a hidden read-model concept after it is
removed from batches.

### `teacherBatchAssignments`

Keep this table as the historical, batch-specific assignment source.

For the initial batch, copy every active `courseTeacherDefaults` row into one
active batch assignment. Since the batch has a required start date, use that
date as `startsOn`. Leave `endsOn` absent.

Future batch creation must use the same copy operation. Editing course defaults
must not rewrite existing rows.

### `batchSchedules`

Keep batch schedules as recurring weekly templates. Initial schedules use the
batch start date as `effectiveFrom` and have no `effectiveUntil`.

Continue enforcing:

- valid weekday and minute ranges;
- end time after start time;
- matching active teacher-batch assignment;
- no overlapping active schedule for the same batch;
- no overlapping active schedule for the same teacher.

Conflict validation must operate on the entire submitted routine array as well
as existing database schedules. Two new rows in the same atomic submission
must be checked against each other before writes begin.

### `classSessions`

Add a `scheduled` state so automatically generated future occurrences are not
treated as attendance sessions already open for submission:

```ts
scheduled | open | submitted | cancelled
```

Generated occurrences retain `scheduleId`, batch, teacher, optional subject,
date, and timestamps. Their idempotency key remains based on schedule and date.
The generation key is immutable: a later one-off reschedule changes the visible
date/time but retains the original key so the materializer cannot recreate the
old occurrence.

Make roster totals optional while an occurrence is `scheduled`. Resolve the
eligible enrolment roster and set `rosterCount` when attendance is opened; do
not freeze a potentially stale roster four weeks in advance.

The occurrence materializer must:

- generate from `max(today, effectiveFrom)` through 28 days ahead;
- skip dates after `effectiveUntil` when present;
- be idempotent through `by_sessionKey`;
- never overwrite rescheduled, cancelled, open, or submitted occurrences;
- run after initial course creation and later on a recurring maintenance job;
- use bounded batches and scheduler continuation rather than unbounded reads.

Opening attendance transitions a scheduled occurrence to `open`. Submitted
occurrences reject time, batch, teacher, subject, cancellation, and reschedule
mutations.

## Academic-session removal strategy

The project is still in development and destructive removal of existing domain
data is authorized. Use a reset-then-narrow workflow instead of a production
data-preserving backfill.

### Preserve

- owner profiles and owner portal accounts;
- Clerk identity linkage needed for owner login;
- owner settings and coaching configuration;
- SMS/provider configuration records;
- public-site branding and non-course CMS configuration;
- migration component state.

### Clear

Clear all session-dependent academic and transactional data, including the
complete dependency trees for:

- academic sessions, courses, course subjects, course snapshots, batches,
  assignments, schedules, and class occurrences;
- students and enrolments;
- admission applications and conversion records;
- attendance records;
- fee plans, agreements, charges, allocations, payments, refunds, receivable
  summaries, campaigns, and finance snapshots;
- exams, assignments, marks, frozen audiences, and results;
- course/batch notices and materials;
- SMS jobs and audit rows referring to cleared domain records;
- generated development seed data tied to any cleared record.

Before implementation, derive the final reset manifest directly from
`convex/schema.ts` so no table containing course, batch, enrolment, student,
exam, payment, class-session, or academic-session references is omitted.

### Reset implementation

Use the already-installed `@convex-dev/migrations` component. Add explicit,
batched delete migrations grouped by dependency domain and a serial reset
runner. Do not use `.collect()` or one oversized transaction.

The runner must:

1. refuse to run unless the deployment is explicitly marked as development;
2. print/return the list of preserved and cleared domains;
3. support dry run;
4. clear domain tables in bounded batches;
5. expose migration status;
6. provide a verification query that samples every table expected to be empty;
7. be run and verified before narrowing the schema.

Suggested sequence:

```powershell
npx convex run migrations:resetAcademicDomain '{"dryRun":true}'
npx convex run migrations:resetAcademicDomain
npx convex run --component migrations lib:getStatus --watch
npx convex run migrations:verifyAcademicDomainReset
```

After verification, remove `academicSessions`, all `academicSessionId` fields,
their indexes, validators, query arguments, projections, forms, filters, seed
logic, and tests. Because dependent documents are empty, the narrowed schema
can deploy without a field-preservation migration.

This destructive shortcut must never be reused for a data-preserving production
deployment. A future production equivalent would require a conventional
widen-migrate-narrow rollout.

## Backend API plan

### Replace course creation with `createWithFirstBatch`

Create one owner-only mutation with an input shaped approximately as follows:

```ts
{
  course: {
    code: string;
    nameBn: string;
    nameEn: string;
    shortDescriptionBn: string;
    shortDescriptionEn: string;
    descriptionBn: string;
    descriptionEn: string;
    coverStorageId?: Id<"_storage">;
  };
  defaults: Array<{
    teacherId: Id<"teachers">;
    subjectIds: Id<"subjects">[];
  }>;
  batch: {
    code: string;
    nameBn: string;
    nameEn: string;
    startDate: string;
  };
  routine: Array<{
    weekday: number;
    startMinutes: number;
    endMinutes: number;
    teacherId: Id<"teachers">;
    subjectId?: Id<"subjects">;
  }>;
}
```

Return `{ courseId, batchId }`.

### Validation order

Perform all reads and validation before the first insert:

1. Require an active owner account.
2. Normalize and validate course and batch codes.
3. Generate slugs from codes and check global code/slug uniqueness.
4. Validate bilingual required fields and local batch start date.
5. Require at least one teacher, one subject, and one routine row.
6. Reject duplicate teacher entries and duplicate subjects within a teacher.
7. Flatten defaults and reject any subject assigned to more than one teacher.
8. Load all referenced teachers and subjects and require active status.
9. Require every selected course subject to have exactly one teacher.
10. Validate every routine row's weekday and time.
11. Require routine teachers to be selected in Step 2.
12. When a routine has a subject, require its exact teacher-subject mapping.
13. Detect overlaps among submitted routine rows for both batch and teacher.
14. Only after validation succeeds, write the entire graph.

### Atomic write order

Within the single Convex mutation:

1. Insert active private course.
2. Insert `courseSubjects` in deterministic display order.
3. Insert `courseTeacherDefaults`.
4. Insert active/public/admission-open first batch.
5. Copy defaults into `teacherBatchAssignments` with `startsOn = startDate`.
6. Insert active weekly schedules with `effectiveFrom = startDate`.
7. Write one course-created audit event containing the first batch ID.
8. Schedule snapshot refresh.
9. Schedule rolling occurrence materialization after the transaction commits.

Any thrown validation or write error rolls the mutation back.

### Supporting APIs

Add or revise bounded owner APIs for:

- paginated root-level course search by status;
- course details with subjects and default teacher mappings;
- active teacher and subject options for the wizard;
- course detail update without lifecycle changes;
- replace/update course teacher defaults for future batches only;
- guarded archive that rejects active dependent batches;
- batch creation helper that copies current course defaults;
- routine conflict preview using the same shared validation code as final save.

Remove `sessions.ts` and session-related options/read models after the reset.

## `/owner/courses` UX plan

The page becomes a focused course catalog. It must not contain the all-batch,
teacher-directory, or schedule workspaces planned for their dedicated pages.

### Page layout

1. **Header**
   - Eyebrow: Academics
   - Title: Courses
   - Short explanation that courses are permanent offerings and batches carry
     each intake.
   - One primary action: `New course`.

2. **Toolbar**
   - Search by course name or code.
   - Status filter: Active / Archived.
   - No academic-session selector.

3. **Course table**
   - Course name
   - Code
   - Subjects count
   - Default teachers count
   - Active batches count
   - Active students count
   - Website publication state
   - Status
   - Row action menu

4. **Course detail sheet**
   - Bilingual details and cover
   - Subjects with default teacher beside each subject
   - Batch summary with a future-facing `View batches` link
   - Website publication status and link to Website CMS
   - Edit details, edit defaults, and guarded archive actions

The table is the primary desktop representation. On narrow screens, rows become
compact stacked records without hiding the name, code, status, or primary row
action. Maintain 44px minimum touch targets.

### Three-step creation dialog

Use an 800px shadcn `Dialog` on desktop and a full-height responsive layout on
mobile. Keep the dialog mounted across steps so form state is not lost.

#### Step 1 — Course details

Fields:

- Bangla name
- English name
- Course code
- Bangla short description
- English short description
- Bangla detailed description
- English detailed description
- Optional cover image

Show the generated slug as non-editable helper text only if it provides useful
confirmation; do not make it an input.

Validate Step 1 before moving forward. Do not write to Convex.

#### Step 2 — Teachers and subjects

Use repeatable teacher sections:

- choose an existing active teacher;
- select one or more existing active subjects with checkboxes;
- allow adding another teacher section;
- prevent selecting the same teacher twice;
- disable or visibly mark a subject already assigned to another teacher;
- show a compact summary such as `3 teachers · 7 subjects`.

At least one teacher and one subject are required. Every selected subject must
belong to exactly one teacher. Do not create teachers or subjects inline.

#### Step 3 — First batch and weekly routine

Batch fields:

- Bangla name
- English name
- Batch code
- Start date

Defaults displayed as read-only confirmation:

- Active
- Admission open
- Public

Routine editor:

- repeatable rows;
- weekday shadcn `Select`;
- start and end time inputs;
- teacher shadcn `Select` limited to Step 2 teachers;
- optional subject shadcn `Select` limited to that teacher's mapped subjects,
  plus `No subject`;
- add row and remove row actions;
- allow more than one row per weekday;
- show inline row-level validation and conflict messages;
- show a compact weekly preview sorted by weekday and time.

Final button: `Create course and batch`.

On success, close the dialog, show a success message, refresh the table, select
the created course, and open its detail sheet. On failure, stay on Step 3 and
preserve every field.

### Navigation and dismissal behavior

- Back and Next buttons do not write data.
- Closing a dirty wizard requires an AlertDialog confirmation.
- Escape and backdrop dismissal use the same dirty-state protection.
- Focus moves to the first invalid field after validation.
- Step indicators expose current/completed states semantically, not by color
  alone.
- Browser tab order follows the visible form order.

## Shadcn and design-system mapping

Reuse the existing components in `src/components/ui/`:

- `Button`
- `Input`
- `Textarea`
- `Label`
- `Select`
- `Checkbox`
- `Dialog`
- `AlertDialog`
- `Sheet`
- `DropdownMenu`
- `Badge`
- `Separator`
- `Tooltip`
- `EmptyState`
- `Skeleton`

Add a local shadcn-style `Table` primitive because the current UI directory has
no table abstraction. Add a small domain-specific `WizardSteps` component under
the course feature, not as a generic visual primitive.

All new primitives must use `DESIGN.md` variables for color, radii, shadows,
focus, density, bilingual typography, and interaction states. Do not import
stock shadcn colors or arbitrary Tailwind palette values. Bangla is the first QA
locale.

## Proposed file organization

```text
src/components/portal/courses/
├── CoursesPage.tsx
├── CourseTable.tsx
├── CourseDetailSheet.tsx
├── CourseCreateDialog.tsx
├── course-create/
│   ├── CourseDetailsStep.tsx
│   ├── TeacherSubjectsStep.tsx
│   ├── FirstBatchRoutineStep.tsx
│   ├── RoutineRowsEditor.tsx
│   ├── WizardSteps.tsx
│   ├── schema.ts
│   └── types.ts
└── *.test.tsx

src/components/ui/
└── table.tsx

convex/academics/
├── courses.ts
├── courseTeacherDefaults.ts
├── batches.ts
├── schedules.ts
├── classOccurrenceMaterializer.ts
├── courseWorkspace.ts
└── shared.ts
```

Retire the old course-centric `CourseOperations.tsx` composition only after its
still-needed logic is extracted into the new APIs/components. Do not duplicate
conflict, assignment, or lifecycle rules in React.

## Implementation phases

### Phase 0 — Baseline and dependency ledger

- Record the current branch and worktree state.
- Run current codegen, typecheck, targeted academics tests, and course component
  tests to establish the baseline.
- Produce a complete `academicSessions`/`academicSessionId` reference ledger.
- Produce the reset table manifest from the live schema.
- Confirm owner identity/settings/CMS tables are excluded from reset.

Exit condition: every session dependency and every table to clear is accounted
for.

### Phase 1 — Development reset tooling

- Add batched migration definitions and a serial reset runner.
- Add explicit development-only guard.
- Add dry-run and verification support.
- Test reset behavior against a seeded local/dev deployment.
- Run the authorized reset and verify all scoped tables are empty.

Exit condition: domain data is empty and owner login/settings still work.

### Phase 2 — Narrow schema and remove sessions

- Delete the academic-session table, validators, functions, indexes, UI, and
  navigation/filter state.
- Remove every `academicSessionId` from schemas and application code.
- Remove course draft/completed states and batch capacity/end date.
- Make batch start date required.
- Add `courseTeacherDefaults` and indexes.
- Add `scheduled` class occurrence status.
- Update seed builders and all affected tests.
- Run Convex codegen before TypeScript fixes so generated types reflect the new
  model.

Exit condition: `rg "academicSessionId|academicSessions" convex src` returns no
product references, excluding any intentionally retained historical migration
notes.

### Phase 3 — Backend course graph creation

- Implement shared normalization and validation helpers.
- Implement course default mapping APIs.
- Implement atomic `createWithFirstBatch`.
- Implement bounded root course list/detail queries.
- Implement conflict preview using shared schedule validation.
- Implement course archive and edit behavior.
- Implement future-batch assignment-copy helper.
- Implement initial four-week occurrence materialization and idempotency.

Exit condition: backend tests prove atomic rollback and every frozen invariant.

### Phase 4 — Rebuild the Course page

- Replace the session-filtered workspace with root course search/status state.
- Build the course table and detail sheet.
- Build the three-step dialog using existing shadcn primitives.
- Add the local Table primitive and course-specific WizardSteps.
- Add dirty-dismissal protection, focus management, inline validation, loading,
  empty, error, and success states.
- Preserve bilingual URL and owner portal conventions.

Exit condition: an owner can create and inspect a complete course graph without
encountering any session or draft-course concept.

### Phase 5 — Verification and cleanup

- Remove or archive obsolete session/course workspace components.
- Remove unused CSS only after verifying no other portal screen consumes it.
- Update `DESIGN.md` only if the wizard stepper or responsive course table adds a
  genuinely reusable pattern.
- Update implementation status documentation.
- Run the full validation ladder.

## Test plan

### Backend unit/integration tests

Test successful creation of:

- one teacher with one subject;
- one teacher with multiple subjects;
- multiple teachers with distinct subjects;
- multiple routine rows on one weekday;
- subjectless routine row;
- future start date;
- four-week idempotent occurrence generation.

Test rejection and full rollback for:

- duplicate course or batch code/slug;
- inactive or missing teacher/subject;
- zero teachers, subjects, or routines;
- the same subject assigned to two teachers;
- routine teacher absent from defaults;
- routine subject assigned to a different teacher;
- invalid weekday or time range;
- overlapping rows for the first batch;
- overlapping rows for the same teacher;
- partial failure after validation;
- edits to a submitted class occurrence.

Test default behavior:

- course is active and private;
- first batch is active, public, and admission-open;
- course default changes do not mutate existing batch assignments;
- a later batch copies the then-current defaults;
- course archive is blocked while dependent active batches remain.

### Component tests

- Step navigation preserves entered values.
- Step 1 prevents advancement with invalid bilingual details/code.
- Step 2 prevents duplicate teacher and subject selection.
- Step 3 filters subjects by selected teacher.
- Multiple rows on the same weekday are supported.
- Conflicting rows are highlighted and final submission is blocked.
- Final submission sends normalized minutes and the complete graph once.
- Failed submission preserves state.
- Dirty close, Escape, and backdrop actions require confirmation.
- Success closes the dialog and opens the new course detail.
- Bangla and English labels render without mojibake.

### Browser tests

- Complete the wizard using keyboard only.
- Verify focus trap, focus restoration, and first-invalid-field focus.
- Verify mobile layout and 44px touch targets.
- Verify Bangla overflow at each step.
- Verify course search and Active/Archived filters update the URL predictably.
- Verify refresh/deep link restores course selection/detail state.
- Verify no session selector or draft/completed course filter remains.

### Validation ladder

Run in this order:

```powershell
git diff --check
npm run convex:codegen
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e
```

Use `npm test` without Jest-only flags. Treat Windows file locks or stale `.next`
types as environment issues only after confirming the source-level checks.

## Acceptance criteria

The work is complete when all of the following are true:

- Academic sessions do not exist in the UI, Convex schema, functions, filters,
  reports, tests, or seed paths.
- Courses are root-level and have only active/archived lifecycle states.
- The Course page lists all courses without a session selector.
- The page uses Dhrubok-themed shadcn primitives from `src/components/ui`.
- Owners can complete the three-step wizard using existing teachers and
  subjects.
- Every course subject has exactly one default teacher; teachers can own several
  subjects.
- The first batch requires name, code, and start date and is created active,
  public, and admission-open.
- Initial weekly routines accept multiple periods per weekday and optional
  subjects.
- Batch/teacher conflicts block submission and identify affected rows.
- Final submission is atomic.
- The course is private until explicitly published in Website CMS.
- Future batches can copy current course teacher defaults without changing
  existing batches.
- Four weeks of class occurrences are generated idempotently from routines.
- Submitted attendance occurrences are immutable.
- Owner accounts/settings survive the development data reset.
- All validation commands pass, and browser-only claims are backed by Playwright
  verification.

## Follow-up plans

After this plan ships, create separate implementation plans in this order:

1. Owner Batches page, including batch editing, default assignment copying, and
   weekly routine management.
2. Owner Schedule page, including calendar/list views, extra classes,
   one-occurrence rescheduling, cancellation, and generation monitoring.
3. Owner Teachers page, including directory, workload, assignments, and weekly
   schedule views.

The Batch page should precede Schedule because the Schedule page relies on the
batch routine-editing boundary defined here.
