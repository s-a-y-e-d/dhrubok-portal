# Dhrubok Portal — Owner Exam Rebuild Plan

**Status:** Implementation-ready
**Prepared:** 17 July 2026
**Confidence:** 97%
**Primary scope:** Owner exam list, complete exam creation, single-exam workspace, marks entry, review, publication, results, and owner Schedule integration.

## 1. Outcome

Rebuild Exams around one simple invariant:

> One exam belongs to exactly one batch.

An owner creates the entire exam in one atomic submission, including its schedule, selected course subjects, subject-specific marking rules, responsible teachers, and frozen student roster. The exam immediately appears as `scheduled`. There is no exam draft and no manual “Open marks entry” transition.

The owner can then open the exam, enter marks one subject at a time, review every exception, publish batch-scoped results, and correct a published result through the existing versioned reopen/republish workflow.

## 2. Locked product decisions

### 2.1 Scope and authority

- This delivery is owner-first. Teacher portal redesign is deferred.
- Teacher selection and `examTeacherAssignments` remain so every exam subject snapshots its responsible teacher for future teacher workflows.
- An owner has universal exam authority and is not restricted by teacher assignments.
- Owners can create, edit, enter or correct marks for every subject, review, publish, reopen, republish, and view all reports.
- Existing student result, guardian SMS, reporting, merit, and correction-history capabilities remain.

### 2.2 Academic boundary

- Academic sessions have already been removed from the live code and schema. Do not add session fields, filters, selectors, or migration work back into Exams.
- Every exam has one required `batchId`.
- The course is derived from the selected batch. Store `courseId` as a snapshot/query aid, but never let the client choose a mismatched course.
- Multi-batch audience modes are removed.
- Official merit is always batch merit over the exam’s frozen included candidates.

### 2.3 Required schedule

Every exam requires:

- exam date;
- start time;
- duration in minutes.

The backend derives the end time. Creation and schedule edits block overlap with another class or exam for the same batch. Teacher conflicts are outside this owner-first scope.

The exam appears on the owner Schedule immediately after creation. The Schedule item links to the exam workspace; schedule edits remain owned by the exam workspace so there is one authoritative edit path.

### 2.4 Creation and drafts

- `/owner/exams` has a prominent **Create exam** header button.
- The empty state includes the same action.
- The owner dashboard quick action links directly to `/owner/exams/create`.
- Creation uses a multi-step client-local form, but no server exam exists until final submission.
- Refreshing or abandoning the creation page discards the unsaved form.
- Final creation is atomic: validation failure creates nothing.
- Exam-creation drafts, `setupDraftJson`, draft restoration, and draft archive actions are removed.
- Marks drafts remain. Partial marks and autosave are required for large rosters.

### 2.5 Subjects and marking rules

- Available subjects come only from the selected batch’s course.
- The owner selects one or more subjects.
- Each selected subject independently supports:
  - `mcq`;
  - `written`/CQ;
  - `both`.
- Each subject stores applicable component full marks, total full marks, overall pass marks, and optional component pass marks.
- The backend is authoritative for totals and pass/fail.
- Selected subject order becomes marks navigation and printed report order.

### 2.6 Teachers

- Each exam subject has exactly one selected responsible teacher.
- Eligible teachers come from the course/batch academic structure for that subject.
- One teacher may own multiple subjects.
- The resolved teacher is snapshotted in `examTeacherAssignments` at creation.
- Missing teacher coverage blocks creation.
- Changing a teacher later does not delete marks.
- Assignment status fields remain for the future teacher workflow, but owner review and publication do not depend on teacher submission.

### 2.7 Candidates

- Creation starts with every active enrolment in the selected batch included.
- The owner may exclude individual students without giving a reason.
- The complete included/excluded roster is frozen as exam-owned data at creation.
- Later enrolments, withdrawals, transfers, or batch changes never alter the exam automatically.
- Before publication, the owner may explicitly include a newly eligible student, re-include an excluded student, or exclude an included student.
- The batch itself is immutable after creation.

### 2.8 Lifecycle

Use this owner-visible lifecycle:

```text
scheduled
  -> marks_entry        (first successful mark save)
  -> ready_for_review   (owner validation succeeds)
  -> published
  -> reopened           (owner supplies correction reason)
  -> published          (new immutable publication version)
```

Internal `publication_processing` may remain for bounded publication jobs. There is no `draft` or owner-triggered `open marks entry` state.

The Marks tab is available while `scheduled`. Before the scheduled end time it shows a clear warning, but the owner may still enter marks. The first successful save changes `scheduled` to `marks_entry` transactionally.

### 2.9 Editing and destructive effects

- Before marks exist, the owner may edit schedule, subjects, rules, teachers, and candidates.
- After marks exist:
  - name, type, date, start time, duration, and teacher changes are safe edits;
  - adding a subject or candidate creates a new empty scope;
  - removing a subject/candidate or changing a marking rule requires an impact preview and explicit destructive confirmation;
  - only affected editable marks are deleted/reset.
- After publication:
  - schedule/name metadata may be corrected with audit history;
  - result-affecting changes require reopening;
  - republishing creates a new immutable version and correction SMS messages.

## 3. Information architecture and routing

The current owner optional catch-all route passes only `section?.[0]`, so deeper exam URLs are not currently distinguishable. Update the route dispatcher to preserve and validate the full segment array.

```text
/[locale]/owner/exams
  Exam list

/[locale]/owner/exams/create
  Complete exam creation

/[locale]/owner/exams/[examId]
  One exam workspace
```

Use query state only for workspace tabs and the active subject:

```text
/owner/exams/[examId]?tab=overview
/owner/exams/[examId]?tab=marks&subject=[examSubjectId]
/owner/exams/[examId]?tab=review
/owner/exams/[examId]?tab=results
```

Required route work:

- change `src/app/[locale]/owner/[[...section]]/page.tsx` to pass the entire segment array;
- update `src/components/portal/RoleSection.tsx` to dispatch list, create, and detail exam views;
- validate unknown/malformed exam paths and render `notFound()` or a stable not-found state;
- update owner navigation and quick-action active-state handling for nested exam URLs;
- follow the installed Next.js 16 dynamic/catch-all route contract from `node_modules/next/dist/docs/`.

Teacher exam routes and teacher workspace redesign are explicitly deferred.

## 4. Owner UX specification

### 4.1 Exam list — `/owner/exams`

Page header:

- title and concise operational description;
- one dominant **Create exam** button using shadcn `Button`;
- button links to `/owner/exams/create`.

Filters:

- search by exam name or exam number;
- course;
- batch;
- status;
- date range;
- clear filters.

There is no academic-session filter. Filters remain URL-addressable so reload/back/forward preserve the list state.

Desktop uses shadcn `Table`; mobile uses operational `Card` records. Each record shows:

- exam name and number;
- course and batch;
- date, start time, duration, and derived end time;
- subject count and included candidate count;
- completion count/percentage;
- semantic `Badge` status;
- next action.

Default ordering prioritizes actionable exams, then the nearest relevant date. Published exams remain in the same list and are reachable through filters.

States:

- `Skeleton` rows while loading;
- shadcn-style empty state with **Create exam**;
- recoverable error state;
- pagination rather than client-side truncation.

### 4.2 Create exam — `/owner/exams/create`

Use a four-step wizard with client-local state. Desktop shows a compact progress rail/summary; mobile shows a shadcn `Progress` bar and current-step label. The stepper is a project-specific composition, not decorative navigation.

#### Step 1 — Batch and schedule

- searchable batch `Combobox`;
- derived read-only course identity;
- Bangla and English exam names;
- exam type;
- required date;
- required start time;
- required duration, with useful presets plus a custom value;
- derived end time;
- inline schedule conflict result.

Primary action: **Continue to subjects**.

#### Step 2 — Subjects, rules, and teachers

- show only subjects linked to the selected batch’s course;
- multi-select with native/shadcn `Checkbox` controls;
- each selected subject expands into its marking-rule editor;
- use `ToggleGroup` for MCQ/Written/Both;
- use shadcn `FieldGroup`, `Field`, `Input`, and validation attributes;
- show calculated total read-only;
- show the eligible/resolved teacher and allow a valid teacher choice where more than one is exposed by the academic read model;
- block progress when a selected subject has no valid teacher;
- support accessible subject ordering without drag-only interaction.

Primary action: **Continue to students**.

#### Step 3 — Students

- include all active enrolments by default;
- searchable, compact student table/card list;
- checkbox selection with selected/excluded totals always visible;
- no exclusion-reason field;
- “Select all eligible” and “Clear exclusions” actions;
- require at least one included candidate.

Primary action: **Review exam**.

#### Step 4 — Review and create

Read-only summary:

- batch and course;
- exam identity;
- date, start, duration, and end;
- schedule-conflict result;
- subjects, formats, marks, pass rules, and teachers;
- included and excluded student counts;
- batch-merit scope;
- guardian publication/SMS effects.

Primary action: **Create exam**.

Final submission calls one `createComplete` mutation. Show `Spinner` inside the disabled button while pending, preserve local values on error, and use `sonner` only after an authoritative mutation result. On success, navigate to `/owner/exams/[examId]?tab=overview`.

### 4.3 Exam workspace — `/owner/exams/[examId]`

Use shadcn `Tabs` with URL synchronization:

1. **Overview**
2. **Marks**
3. **Review & publish**
4. **Results & history**

The header remains visible across tabs and contains:

- exam identity;
- batch/course;
- schedule;
- status badge;
- compact progress;
- Edit action.

Tabs are sections within one exam, not separate setup gates. Browser back/forward and direct links must work.

#### Overview

- schedule card;
- included/excluded roster summary;
- subject/rule/teacher summary;
- marks completion by subject;
- audit highlights;
- edit action opening a shadcn `Sheet` on desktop and full-width mobile.

Edits first call `previewEditImpact`. Safe edits save directly. Destructive edits use `AlertDialog` with exact affected subject/student/result counts.

#### Marks

Selecting the exam is sufficient to enter the workspace. There is no batch selector and no required subject-selection landing screen.

- automatically open the first incomplete selected subject;
- provide visible subject navigation within the workspace;
- owner may switch subjects at any time;
- show per-subject completed/remaining counts;
- show a pre-end-time `Alert`, without blocking entry;
- no spreadsheet paste or CSV import.

Desktop marks grid:

- sticky student identity column;
- participation: present/absent;
- only applicable MCQ/written inputs;
- backend-calculated total and pass/fail preview;
- visible keyboard focus;
- Tab/Shift+Tab/Enter navigation;
- search by student name/number;
- filters: all, incomplete, invalid, absent, complete;
- autosave indicator and explicit **Save marks** fallback;
- unsaved-change protection;
- shadcn `Table`, `Input`, `Badge`, `Alert`, `Skeleton`, and `Spinner` composition.

Mobile marks entry:

- one student card at a time;
- previous/next controls;
- persistent subject and progress context;
- 44px minimum controls;
- never compress Bangla names or marks inputs below a usable width.

Absent behavior:

- absent is a complete entry;
- component fields are cleared and disabled;
- if marks already exist, changing to absent requires confirmation.

#### Review & publish

Lead with blockers and exceptions, not a giant result table:

- included candidates;
- complete/incomplete candidates;
- absent subject entries;
- invalid marks;
- pass/fail preview;
- tied merit positions;
- guardian phone problems;
- changed/reset marks audit indicators.

**Ready for review** validates actual candidate/subject completeness. Teacher assignment submission state does not block an owner.

Publication retains:

- immutable versioned snapshots;
- batch merit with competition ranking;
- exact Bangla/English guardian SMS preview;
- de-duplicated Mother/Father recipients;
- recipient and skipped-contact counts;
- explicit acknowledgement;
- publication-processing reconciliation where required.

Use `AlertDialog`/dedicated confirmation composition, never `window.confirm`.

#### Results & history

- current published version summary;
- result sheet;
- merit list;
- subject analysis;
- individual result links;
- publication/reopen/republish timeline;
- reopen action requiring a reason;
- correction metadata and SMS state.

Published status uses the project’s `info` semantic treatment.

## 5. shadcn and design-system implementation

### 5.1 Existing components to reuse

Reuse the installed project components under `src/components/ui/`:

- `Button`, `Card`, `Table`, `Badge`;
- `Field`, `Input`, `Select`, `Checkbox`, `ToggleGroup`;
- `Alert`, `AlertDialog`, `Dialog`, `Sheet`;
- `Popover`, `ScrollArea`, `Separator`;
- `Skeleton`, `Spinner`, `Tooltip`.

### 5.2 Official components to add

Preview with `npx shadcn@latest add --dry-run` and inspect diffs before adding:

```powershell
npx shadcn@latest add tabs combobox progress sonner --dry-run
```

Then add the approved official components without overwriting local customizations. Use the project’s Radix base, New York style, Lucide icons, Tailwind v4 semantic tokens, and `@/components/ui` alias.

### 5.3 New project-specific compositions

Create only workflow compositions that shadcn does not provide:

- `ExamStatusBadge`;
- `ExamCreationStepper`;
- `ExamScheduleSummary`;
- `ExamSubjectRuleEditor`;
- `ExamCandidateSelector`;
- `ExamWorkspaceTabs`;
- `ExamSubjectNavigator`;
- `OwnerMarksGrid`;
- `MobileMarksCard`;
- `ExamEditImpactDialog`;
- `PublishResultsDialog`.

These compose shadcn primitives; they do not replace them with raw styled controls.

### 5.4 DESIGN.md alignment

Update `DESIGN.md` before UI implementation because its current exam guidance still assumes five creation steps, draft/freeze transitions, and older marks semantics.

Document:

- four-step atomic exam creation;
- `scheduled` exam semantics;
- single-batch exam invariant;
- owner exam workspace tabs;
- subject-at-a-time marks navigation;
- sparse marks and autosave states;
- schedule conflict messaging;
- destructive edit-impact confirmation.

Keep Bangla-first typography, semantic colors, one dominant primary action per region, compact owner density, 44px mobile targets, and restrained operational visuals.

## 6. Target Convex model

The implementation preflight found existing records in the exam-related tables.
Therefore the rollout uses widen-and-coexist semantics: legacy rows and fields
remain readable, while newly created owner exams use `modelVersion: 3` and the
single-batch contract. Destructive table removal and schema narrowing are
deferred until a later audited migration proves that legacy records have been
converted or intentionally retired.

### 6.1 `exams`

Reshape new exams around required fields:

- `examNumber`;
- `batchId`;
- `courseId` snapshot;
- `nameBn`, `nameEn`;
- `examType`;
- `examDate`;
- `startMinutes`;
- `durationMinutes`;
- `endMinutes` derived and stored by the backend for reliable reads/conflict checks;
- `status`: `scheduled | marks_entry | ready_for_review | publication_processing | published | reopened | archived`;
- `candidateCount`, `subjectCount`;
- sparse marks progress counters;
- publication version/audit fields.

Remove/deprecate from the new contract:

- exam-level combined mark fields;
- `draft` and `marks_initializing` as owner-visible states;
- `setupDraftJson`;
- `audienceMode`;
- `rosterStatus`/manual roster-freeze fields;
- multi-scope merit settings;
- legacy compatibility fields after the empty-table preflight.

Indexes should support:

- batch + date;
- status + date;
- course + date;
- exam number.

### 6.2 Deprecate `examBatches`

One required `exams.batchId` is authoritative for model-version-3 exams. A
compatibility `examBatches` row is retained during the coexistence window so
existing reports and older functions remain safe; remove it only after the
explicit legacy migration.

### 6.3 `examSubjects`

Keep one row per selected subject with required:

- exam and subject IDs;
- sort order;
- mode;
- component/total/pass marks;
- component pass marks when configured;
- required flag if still needed by result policy.

Enforce unique `(examId, subjectId)` in mutations.

### 6.4 `examTeacherAssignments`

Keep one assignment per exam subject:

- `examId`;
- `examSubjectId`;
- `teacherId`;
- future-facing assignment state/audit timestamps.

Remove assignment `batchId`; the exam already owns one batch. Add/use a unique exam-subject index. Owner authorization never depends on the assignment teacher.

### 6.5 `examCandidates`

Store the frozen roster explicitly:

- `examId`;
- student and enrolment IDs;
- batch snapshot;
- `included | excluded`;
- inclusion/exclusion timestamps as useful audit metadata.

Remove audience source modes and required exclusion reasons.

### 6.6 Sparse `examSubjectResults`

Do not pre-create one empty result document for every candidate × subject during exam creation.

- Missing row means no marks entered yet.
- First save inserts the row.
- Later saves patch it.
- Entry rows keep participation, applicable component scores, derived total/pass state, entry status, actor, and timestamps.
- Review queries left-join frozen candidates/subjects with existing rows to identify missing work.

This keeps complete exam creation atomic and removes the current `marks_initializing` fan-out workflow.

### 6.7 Existing publication tables

Preserve and adapt immutable publication snapshots, aggregate results, audit events, SMS idempotency, and report queries to the one-batch invariant.

## 7. Backend API plan

### 7.1 Owner creation and editing

Replace draft orchestration with:

- `exams.creationOptions` — batches plus course subjects, effective teachers, and active enrolments;
- `exams.previewConflict` — same-batch class/exam overlap;
- `exams.createComplete` — one validated atomic creation mutation;
- `exams.previewEditImpact` — counts rows that an edit would reset;
- `exams.update` — safe or explicitly acknowledged destructive edit;
- `exams.detail` — complete owner workspace projection;
- `exams.listManaged` — paginated server-filtered owner list.

`createComplete` must revalidate every relationship server-side:

- owner identity;
- active/non-archived batch and derived course;
- every selected subject belongs to the course;
- every selected teacher is eligible for that subject/course/batch read model;
- valid date/start/duration/end;
- no same-batch overlap;
- included candidates are valid batch enrolments;
- at least one subject and candidate;
- valid subject mark distributions;
- unique subject/teacher/candidate inputs.

Never trust client totals, `courseId`, teacher eligibility, candidate membership, or conflict results.

### 7.2 Marks

Refactor owner marks APIs around exam + subject rather than teacher assignment:

- `marks.ownerSubjectGrid` — paginated/filterable candidates plus sparse results;
- `marks.saveOwnerRows` — bounded upsert, per-row validation, first-save lifecycle transition;
- `marks.subjectProgress`;
- retain assignment-scoped APIs only where needed to keep future teacher work structurally possible.

The owner endpoint derives owner identity server-side and may write every selected exam subject.

### 7.3 Review and publication

Update:

- `review.progress` and `review.summary` for sparse rows;
- `review.markReadyForPublication` to validate completeness directly, not teacher submission;
- `review.exceptions` and individual previews;
- `publication.preview`, `publish`, `reopen`, and history;
- batch-only merit labels/populations;
- report and student-result queries.

### 7.4 Schedule

Extend `convex/academics/scheduleWorkspace.ts` with a discriminated owner schedule item:

```text
kind: class | exam
```

The weekly query returns bounded class sessions and exams in one chronological projection. Exam items contain exam ID, batch/course, date/time/duration, status, and a workspace URL. Existing class reschedule/cancel/attendance actions remain class-only.

## 8. Component and file plan

### Routes and dispatch

- `src/app/[locale]/owner/[[...section]]/page.tsx`
- `src/components/portal/RoleSection.tsx`
- `src/components/portal/PortalShell.tsx`

### Owner exams

Replace the current monolithic `src/components/portal/ExamEditor.tsx` with:

```text
src/components/portal/exams/
├── owner/
│   ├── OwnerExamListPage.tsx
│   ├── OwnerExamCreatePage.tsx
│   ├── OwnerExamWorkspace.tsx
│   ├── ExamListFilters.tsx
│   ├── ExamStatusBadge.tsx
│   └── ExamWorkspaceTabs.tsx
├── create/
│   ├── ExamCreationStepper.tsx
│   ├── BatchScheduleStep.tsx
│   ├── SubjectRulesStep.tsx
│   ├── CandidateSelectionStep.tsx
│   └── ReviewCreateStep.tsx
├── marks/
│   ├── OwnerMarksWorkspace.tsx
│   ├── ExamSubjectNavigator.tsx
│   ├── OwnerMarksGrid.tsx
│   ├── MobileMarksCard.tsx
│   └── MarksToolbar.tsx
├── review/
│   ├── OwnerReviewWorkspace.tsx
│   ├── ReviewExceptions.tsx
│   └── PublishResultsDialog.tsx
└── edit/
    ├── EditExamSheet.tsx
    └── ExamEditImpactDialog.tsx
```

Reuse/refactor existing `ExamWorkQueue`, `MarksWorkspace`, `OwnerReviewWorkspace`, student results, and print/report components where behavior still matches. Do not duplicate valid result/publication logic.

### Convex

- `convex/schema.ts`
- `convex/exams/validators.ts`
- `convex/exams/model.ts`
- `convex/exams/exams.ts`
- `convex/exams/subjects.ts`
- `convex/exams/audience.ts`
- `convex/exams/assignments.ts`
- `convex/exams/marks.ts`
- `convex/exams/review.ts`
- `convex/exams/publication.ts`
- `convex/exams/studentResults.ts`
- `convex/exams/diagnostics.ts`
- `convex/academics/scheduleWorkspace.ts`
- `convex/reports/exams.ts` and affected report/dashboard projections.

Remove obsolete draft/audience/migration code only after repository-wide reference checks pass.

## 9. Delivery sequence

### Phase 0 — Contract and zero-data preflight

- Verify exam-related tables contain zero documents in the target deployment.
- Update `DESIGN.md` and this plan’s status references.
- Freeze the single-batch, no-draft, owner-universal contracts in tests.

Exit: no hidden data/migration blocker and design contract matches the rebuild.

### Phase 1 — Schema and pure domain model

- Reshape exam schema and indexes.
- Remove `examBatches` and draft/audience-only fields after preflight.
- Implement schedule overlap, subject rule validation, totals, pass/fail, and batch merit helpers.
- Update generated API/types.

Exit: schema deploys over the verified empty exam tables and domain tests pass.

### Phase 2 — Atomic creation backend

- Add options/conflict/create APIs.
- Snapshot subjects, teachers, and included/excluded candidates atomically.
- Add audit events and counters.
- Update dev seed for scheduled one-batch exams.

Exit: any invalid input rolls back the entire creation; valid creation produces no empty mark rows.

### Phase 3 — Owner exam list and creation UI

- Add nested route dispatch.
- Install approved missing shadcn primitives.
- Build list, filters, empty/loading/error states, and Create button.
- Build four-step local wizard and final review.
- Verify Bangla and English responsive layouts.

Exit: owner can create a complete exam and land on its workspace.

### Phase 4 — Owner workspace and editing

- Build shared header and URL-synced tabs.
- Build Overview and edit Sheet.
- Add impact preview and destructive confirmation.
- Preserve batch immutability and audit changes.

Exit: safe edits preserve marks; destructive edits reset exactly the previewed scope.

### Phase 5 — Sparse owner marks entry

- Build owner subject grid query/upsert mutations.
- Build desktop grid and mobile card flow.
- Add partial save/autosave, filters, keyboard navigation, and pre-end warning.
- Transition `scheduled` to `marks_entry` on first save.

Exit: owner can complete every subject without an assignment restriction or import feature.

### Phase 6 — Review, publication, and reports

- Adapt completeness/exception queries to sparse marks.
- Remove teacher-submission dependency from owner readiness.
- Preserve batch merit, immutable versions, SMS preview/enqueue, reopen, correction history, student results, and print reports.

Exit: published student/report/SMS values all come from the same immutable version.

### Phase 7 — Owner Schedule integration

- Add exam items to owner weekly schedule.
- Block same-batch class/exam and exam/exam overlap during create/edit.
- Link schedule exam items to the exam workspace.
- Keep class-only actions unavailable on exam rows.

Exit: created/edited exams appear at the correct date/time and cannot overlap the same batch.

### Phase 8 — Cleanup and hardening

- Remove obsolete draft wizard, manual open-entry flow, multi-batch UI, and unused compatibility paths.
- Keep teacher assignment data/API seams, but defer teacher UI redesign.
- Update implementation status and operational documentation.
- Run the complete verification gate.

Exit: no stale draft/audience/session wording or unreachable code remains.

## 10. Test plan

### Domain and schema

- one exam requires one valid batch;
- course always derives from batch;
- required date/start/duration and derived end validation;
- cross-midnight/invalid duration policy is rejected consistently;
- MCQ, written, and both configurations;
- component and overall pass boundaries;
- batch-only competition ranking `1, 2, 2, 4`;
- no academic-session fields or filters.

### Creation

- only course subjects are selectable;
- missing/invalid teacher blocks creation;
- duplicate subjects/candidates are rejected;
- active batch enrolments are included by default;
- exclusions require no reason;
- same-batch class/exam and exam/exam overlap is blocked;
- another batch at the same time is allowed;
- failed creation leaves every exam table unchanged;
- successful creation has `scheduled` status and zero result rows.

### Authorization

- owner can read/write every exam subject regardless of assigned teacher;
- owner can review/publish without teacher submission;
- non-owner/non-assigned access remains denied by server authorization;
- student sees only own published immutable result;
- future teacher assignment rows do not grant broader course/batch access.

### Marks and editing

- first save inserts sparse rows and changes status to `marks_entry`;
- partial saves survive reload;
- invalid rows do not silently partially overwrite valid values unless the API explicitly returns per-row outcomes;
- absent clears/disables component scores;
- subject-at-a-time grid reports accurate progress;
- adding a candidate/subject produces empty scope;
- destructive preview count equals deleted/reset count;
- teacher and schedule edits preserve marks;
- batch cannot change.

### Review/publication

- sparse missing rows block readiness;
- owner readiness ignores teacher assignment submission state;
- publication counts match frozen included candidates;
- excluded candidates never receive results/SMS;
- duplicate guardian phones enqueue once;
- failed SMS never rolls back publication;
- reopen requires a reason;
- republish increments version and sends correction messages once;
- student, print, report, and SMS values match the same version.

### Components/accessibility

- wizard values persist across steps but not refresh;
- back/forward preserves list filters and workspace tabs;
- Bangla labels do not clip;
- marks keyboard order matches visual order;
- sticky identity remains usable during horizontal scroll;
- mobile controls meet 44px targets;
- dialogs/sheets have titles, focus trapping, focus restoration, and escape behavior;
- destructive edits require explicit acknowledgement;
- loading dimensions remain stable.

### End-to-end

1. Owner opens `/owner/exams` and uses **Create exam**.
2. Owner selects a batch, schedule, subjects/rules/teachers, excludes students, reviews, and creates.
3. Exam appears in the owner Schedule.
4. Owner enters partial marks before the scheduled end and sees the warning.
5. First save changes status to marks entry; reload preserves marks.
6. Owner completes every subject, reviews exceptions, and publishes.
7. Student sees the exact published result; print/report routes match it.
8. Guardian SMS outbox has correct unique recipients and batch merit wording.
9. Owner reopens, corrects one mark, and republishes version two.

Run the critical owner journey in Bangla and English.

## 11. Verification gate

Focused checks during each phase, followed by:

```powershell
npm run convex:codegen
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e
git diff --check
```

Use the repository’s normal `npm test` command. Treat Windows file locks separately from source failures.

## 12. Explicit non-goals

- Teacher portal exam/marks UX redesign in this delivery.
- Multi-batch or course-wide exams.
- Academic sessions.
- Exam creation drafts.
- Manual “Open marks entry” action.
- Bulk spreadsheet paste or CSV import.
- Online exams, question banks, AI question generation, grading, or answer-script upload.
- Teacher/invigilator schedule-conflict modeling.

## 13. Definition of done

- `/owner/exams` is a fast, filterable list with a prominent Create action.
- Creation is four-step, local-only until one atomic mutation, and produces a complete scheduled exam.
- Every exam belongs to one immutable batch and appears on the owner Schedule.
- Date, start time, and duration are required; same-batch overlaps are blocked.
- Subjects come only from the batch course and retain independent MCQ/written rules.
- One responsible teacher is snapshotted per subject while owners retain universal authority.
- The complete roster is frozen with reasonless individual exclusions.
- There is no exam draft or manual marks-opening workflow.
- The merged exam workspace provides Overview, Marks, Review, and Results tabs.
- Marks entry automatically opens the first incomplete subject and persists partial work.
- Sparse marks keep creation atomic and progress/review accurate.
- Safe edits preserve marks; destructive edits preview and reset only affected rows.
- Batch merit, publication, SMS, student results, reports, and correction history remain correct and versioned.
- Bangla/English desktop and mobile owner flows pass accessibility and end-to-end verification.
