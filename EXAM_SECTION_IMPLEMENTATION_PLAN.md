# Dhrubok Portal — Exam Section Implementation Plan

**Status:** Implementation-ready plan

**Prepared:** 12 July 2026
**Scope:** Offline exam creation, candidate targeting, subject-level CQ/MCQ marks, teacher entry, owner review, audience-scoped merit, publication, guardian SMS, student results, reports, corrections, and migration of the current combined-result model.

## 1. Outcome

Build a fast, trustworthy exam workflow in which:

- an owner creates an offline exam for one batch, selected batches, or every active batch in a course;
- each subject independently supports CQ/written, MCQ, or both;
- the candidate roster is previewed and frozen before marks entry;
- teachers enter only the subject and batch marks assigned to them;
- teachers can save drafts without prematurely submitting work;
- the owner reviews one complete validation workspace before publication;
- merit is calculated within the frozen exam audience, not automatically across the entire course;
- an optional secondary batch position can be calculated for multi-batch exams;
- publication creates an immutable, versioned result snapshot and queues Mother/Father SMS messages;
- students see only published results and can print bilingual result cards;
- reopening and republishing preserves a permanent correction history.

The finished experience must remain phone-friendly, Bangla-first, keyboard-efficient on desktop, and safe around irreversible publication.

## 2. Locked product decisions

### 2.1 Exam boundary

- Exams remain offline. Dhrubok does not conduct online tests or grade answers.
- Every exam belongs to exactly one course and one academic session through that course.
- An exam contains one or more subjects from that course.
- Exam question-paper authoring, question banks, AI question generation, and answer-script storage are outside this scope.

### 2.2 Audience modes

Every exam has exactly one audience mode:

1. `single_batch`: one selected active batch in the course.
2. `selected_batches`: two or more selected active batches in the course.
3. `all_course_batches`: all eligible active enrolments in all active course batches when the roster is frozen.

The owner sees a candidate preview before confirmation. After confirmation, the candidate roster is frozen. Later admissions, transfers, completions, withdrawals, or batch changes do not alter that exam.

The same student cannot appear twice in one exam. If overlapping enrolments would create a duplicate, roster confirmation is blocked and the conflicting records are shown to the owner.

### 2.3 Subject and component rules

Each exam subject independently defines:

- mode: `mcq`, `written`, or `both`;
- MCQ full marks when applicable;
- CQ/written full marks when applicable;
- total full marks, calculated by the backend;
- overall subject pass marks;
- optional MCQ component pass marks;
- optional CQ/written component pass marks;
- sort order.

The backend is authoritative for totals and pass/fail. Client-calculated values are previews only.

Default pass policy:

- a present student passes a subject when the total reaches the subject pass mark and every configured component pass requirement is met;
- an absent subject result fails that subject;
- the overall exam result is pass only when every required subject is passed;
- absent students never receive component marks.

### 2.4 Merit rules

The official merit population is the exam's frozen candidate cohort.

| Audience mode      | Official merit label | Official population                                  |
| ------------------ | -------------------- | ---------------------------------------------------- |
| Single batch       | Batch merit          | Frozen candidates in that batch                      |
| Selected batches   | Overall exam merit   | Frozen candidates across the selected batches        |
| All course batches | Course merit         | Frozen candidates across all included course batches |

For selected-batch and all-course-batch exams, the owner may enable a secondary position within each student's own frozen batch cohort.

Merit configuration:

- `official_only`: calculate only the official exam-cohort position;
- `official_and_batch`: calculate official position plus secondary batch position;
- `none`: publish results without a merit list.

Recommended defaults:

- single batch: `official_only`;
- selected batches: `official_and_batch`;
- all course batches: `official_and_batch`.

Competition ranking is used: `1, 2, 2, 4`.

Tie ordering:

1. higher grand total;
2. higher combined CQ/written total;
3. higher combined MCQ total;
4. same position when still tied.

Failed or absent students do not receive an official merit position by default. This policy is stored with the exam publication so historical results remain explainable.

### 2.5 Roles and authority

- Owners create, edit, confirm rosters, assign teachers, review, publish, reopen, republish, archive, and view all exam data.
- Teachers see only assigned exams and may enter marks only for their assigned subject/batch scopes.
- Teachers save drafts and explicitly submit an assignment for owner review.
- Teachers cannot publish, reopen, change the exam audience, or change marking rules.
- Students see only their own published result snapshots.
- Guardians have no accounts.

### 2.6 Publication and corrections

- Publication is owner-only and requires a complete, valid roster.
- Publication freezes all student-visible subject results, totals, pass/fail states, merit positions, comments, population counts, and policy metadata.
- Each publication increments `publicationVersion`.
- Reopening requires a reason and writes an audit record.
- Republishing creates a new immutable version and sends a correction message, not a duplicate original result message.
- Failed messaging never changes or rolls back the exam publication.

### 2.7 Guardian messaging

- Result messages may target Mother, Father, or both according to coaching settings.
- Identical Mother/Father phone numbers are de-duplicated.
- Delivery is tracked separately for every unique recipient.
- Messages use the student's preferred SMS language.
- The preview shows exact Bangla and English text, unique recipient count, estimated segments, and missing/invalid guardian phones.
- The official merit scope must be named in the message; a bare “5th” is not sufficient.

Example for selected batches:

> মাসিক পরীক্ষায় অনিক হাসানের প্রাপ্ত নম্বর ৪৫০/৫০০, ফলাফল: উত্তীর্ণ, সামগ্রিক মেধাস্থান: ৫ম/৭১, ব্যাচ মেধাস্থান: ২য়/৩৪।

## 3. Target information architecture

Keep the existing `/[locale]/owner/exams`, `/[locale]/teacher/exams`, and `/[locale]/student/results` routes. Improve the internal page structure without creating unnecessary top-level navigation.

### 3.1 Owner exams

```text
Exams
├── Work queue
│   ├── Draft
│   ├── Marks in progress
│   ├── Needs teacher submission
│   ├── Ready for owner review
│   ├── Published
│   ├── Reopened
│   └── Archived
├── Create exam wizard
├── Exam workspace
│   ├── Overview
│   ├── Candidates
│   ├── Subjects & marking rules
│   ├── Teacher assignments
│   ├── Entry progress
│   ├── Review & publication
│   └── History
└── Reports
    ├── Result sheet
    ├── Tabulation sheet
    ├── Merit list
    ├── Subject analysis
    └── Individual result
```

### 3.2 Teacher exams

```text
My exam work
├── Needs entry
├── Draft saved
├── Returned for correction
├── Submitted
└── Published

Assignment workspace
├── Exam and marking-rule summary
├── Batch/subject selector when multiple assignments exist
├── Marks grid
├── Incomplete and invalid filters
└── Save draft / Submit for review
```

### 3.3 Student results

```text
Results
├── Latest published result spotlight
├── Published result history
├── Individual result detail
└── Print result
```

## 4. Frictionless UX specification

### 4.1 Shared exam list

Replace the undifferentiated selection list with a searchable work queue.

Each exam row shows:

- Bangla/English name according to locale;
- exam number and date;
- course and audience label;
- subject count and candidate count;
- completion percentage;
- state badge;
- the next required action.

Filters:

- search by exam name or number;
- academic session;
- course;
- status;
- date range;
- “Needs my action.”

Default ordering is action urgency followed by exam date, not simple creation order.

### 4.2 Create exam wizard

Use a five-step wizard with a persistent summary rail on desktop and a compact summary disclosure on mobile.

#### Step 1 — Basic information

- academic session;
- course;
- Bangla name;
- English name;
- exam type: weekly, monthly, model test, term, final, other;
- date;
- optional start/end time;
- optional venue.

Primary action: **Continue to audience**.

#### Step 2 — Audience

- segmented choice: One batch / Selected batches / All course batches;
- batch controls appropriate to the selected mode;
- live candidate count;
- duplicate/conflict warnings;
- searchable candidate preview;
- optional individual exclusions with required reason.

Do not freeze the roster yet. Primary action: **Continue with N candidates**.

#### Step 3 — Subjects and marks

Use an editable table rather than a long checkbox form.

| Subject | Mode | CQ full | MCQ full | Total | Pass | Component pass |
| ------- | ---- | ------: | -------: | ----: | ---: | -------------- |

Behavior:

- selecting a mode shows only relevant inputs;
- totals update immediately but remain server-validated;
- invalid distributions are explained next to the row;
- “Apply this rule to selected subjects” supports repetitive setup;
- drag or arrow controls set report order accessibly.

Primary action: **Continue to assignments**.

#### Step 4 — Teacher assignments and merit

- assign a teacher to each subject and optionally each batch;
- offer “Assign one teacher to all selected batches” where valid;
- block overlapping assignments for the same subject/batch scope;
- choose merit mode with a plain-language preview of who will be ranked;
- show the official label that will appear in reports and SMS.

Primary action: **Review exam**.

#### Step 5 — Review and confirm

Show one concise read-only summary:

- exam identity and schedule;
- audience mode and candidate count;
- included batches and exclusions;
- subject mark distributions and pass policies;
- teacher coverage;
- merit scope and population;
- warnings requiring resolution.

Confirmation text must state that the candidate roster and marking rules become locked when marks entry opens.

Primary action: **Create exam and open marks entry**.

Allow saving a draft from every step. Drafts do not freeze the roster.

### 4.3 Marks entry workspace

Desktop uses a spreadsheet-style grid. Mobile uses one student card at a time with previous/next navigation and a persistent progress summary.

Desktop grid requirements:

- sticky student identifier column;
- compact rows using DESIGN.md table spacing;
- participation selector: present or absent;
- only applicable CQ/MCQ fields;
- server-calculated total and result preview;
- Tab, Shift+Tab, Enter, and arrow-key navigation;
- current cell focus is always visible;
- autosave indicator plus explicit **Save draft** fallback;
- unsaved-change protection;
- search by student name or number;
- filters: all, incomplete, invalid, absent, complete;
- batch selector when the assignment spans batches;
- “Paste from spreadsheet” action with preview;
- CSV import with row-by-row validation, never silent partial import.

Absent behavior:

- choosing absent clears and disables component mark fields after confirmation if values existed;
- absent is treated as a completed entry, not a missing one.

Draft and submit are separate:

- **Save draft** persists current values;
- **Submit assignment for review** validates the entire assigned subject/batch scope;
- submission confirmation shows complete, absent, and invalid counts;
- after submission, the teacher sees read-only values unless the owner returns the assignment or reopens the exam.

### 4.4 Progress and ownership

Owner progress view groups work by subject and batch:

| Subject | Batch | Teacher | Complete | Missing | Invalid | State |
| ------- | ----- | ------- | -------: | ------: | ------: | ----- |

Every incomplete count opens the filtered records causing it.

Owner actions:

- remind teacher outside the system or later through a notice workflow;
- return an assignment with a required reason;
- open read-only marks;
- enter/correct marks directly while the exam is open;
- move to owner review only when every assignment is submitted and valid.

### 4.5 Owner review

The review page leads with exceptions, not a giant result table.

Summary cards:

- frozen candidates;
- complete students;
- absent subject entries;
- passed and failed students;
- missing values;
- invalid values;
- guardian recipients;
- missing/invalid guardian phones.

Review filters:

- failures;
- absences;
- tied positions;
- unusually high/low marks;
- changed after teacher submission;
- missing comments when a comment policy is enabled;
- guardian contact problems.

The owner can open an individual result drawer showing subject breakdown, computed summary, audit metadata, and the exact eventual student view.

### 4.6 Publication confirmation

Publication uses a dedicated confirmation panel, not a generic browser dialog.

It shows:

- publication version;
- candidate, pass, fail, and absent counts;
- official merit scope and population;
- batch-merit setting;
- unique Mother/Father recipient count;
- skipped contacts and why;
- exact Bangla and English SMS previews;
- estimated SMS segments;
- reports that become visible.

Required acknowledgement:

> আমি বুঝেছি যে প্রকাশের পর শিক্ষার্থীরা এই ফলাফল দেখতে পাবে এবং অভিভাবক SMS কিউ হবে। সংশোধনের জন্য কারণসহ পরীক্ষা পুনরায় খুলতে হবে।

Primary action includes the effect: **Publish 184 results and queue 315 SMS**.

### 4.7 Student result experience

Result detail order:

1. exam name, date, course, and publication version;
2. pass/fail state and grand total;
3. official merit label, position, and population when enabled;
4. secondary batch position when enabled;
5. subject-by-subject CQ/MCQ breakdown;
6. teacher comments;
7. print result action.

Do not use celebratory animation or decorative ranking podiums. Merit is academic information, not gamification.

### 4.8 Empty, loading, error, and success states

Every exam surface must define:

- initial loading skeleton with stable dimensions;
- no exams yet, with owner creation CTA or teacher explanation;
- no result published for students;
- query error with safe retry;
- mutation error preserving entered values;
- offline/network interruption warning;
- draft saved timestamp;
- assignment submitted confirmation;
- publication success with links to result sheet, merit list, and SMS log.

## 5. Target Convex data model

Use scaled integer marks with the existing `SCORE_SCALE = 100`.

### 5.1 `exams` additions

Add initially optional fields for the migration window:

- `examType`: weekly, monthly, model_test, term, final, other;
- `startsAtMinutes` optional;
- `endsAtMinutes` optional;
- `venue` optional;
- `audienceMode`: single_batch, selected_batches, all_course_batches;
- `rosterStatus`: preview, frozen;
- `rosterFrozenAt` optional;
- `candidateCount`;
- `meritMode`: official_only, official_and_batch, none;
- `officialMeritScope`: batch, selected_batches, course, none;
- `rankFailedStudents`: boolean, default false;
- `markingRulesVersion`: number;

Keep `courseId`, names, date, lifecycle status, publication metadata, and audit metadata.

The current exam-level mode and full-mark fields become deprecated compatibility fields after migration. Do not delete them in the first rollout.

### 5.2 `examSubjects` becomes marking configuration

Extend each row with:

- `mode`;
- `mcqFullMarksScaled` optional;
- `writtenFullMarksScaled` optional;
- `totalFullMarksScaled`;
- `passMarksScaled`;
- `mcqPassMarksScaled` optional;
- `writtenPassMarksScaled` optional;
- `isRequired` boolean;
- existing `sortOrder`.

Indexes:

- `by_examId_and_sortOrder`;
- `by_examId_and_subjectId`.

The `(examId, subjectId)` pair remains unique by mutation enforcement.

### 5.3 `examCandidates` — new frozen roster

Fields:

- `examId`;
- `studentId`;
- `enrolmentId`;
- `batchId`;
- `courseId`;
- `includedAt`;
- `source`: single_batch, selected_batches, all_course_batches;
- `excludedAt` optional;
- `exclusionReason` optional;
- `status`: included, excluded.

Indexes:

- `by_examId_and_studentId`;
- `by_examId_and_batchId`;
- `by_studentId_and_examId`;
- `by_examId_and_status`.

Do not use a candidates array inside the exam document.

### 5.4 `examTeacherAssignments` becomes subject-aware

Add:

- `examSubjectId`;
- retain optional `batchId` where no batch means all frozen exam batches;
- `status`: pending, in_progress, submitted, returned;
- `submittedAt` optional;
- `returnedAt` optional;
- `returnReason` optional;
- `updatedAt`.

Indexes:

- `by_examId`;
- `by_teacherId_and_status`;
- `by_examId_and_examSubjectId`;
- `by_examId_and_examSubjectId_and_batchId`;
- `by_teacherId_and_examId`.

Mutation enforcement prevents overlapping teacher scopes.

### 5.5 `examSubjectResults` — new editable subject marks

Fields:

- `examId`;
- `examSubjectId`;
- `studentId`;
- `examCandidateId`;
- `batchId`;
- `participation`: present, absent;
- `mcqScoreScaled` optional;
- `writtenScoreScaled` optional;
- `totalScoreScaled` optional;
- `passed` optional;
- `entryStatus`: missing, draft, ready, published;
- `teacherCommentBn` optional;
- `teacherCommentEn` optional;
- `enteredByAccountId` optional;
- `enteredAt` optional;
- `updatedAt`;
- `publishedMcqScoreScaled` optional;
- `publishedWrittenScoreScaled` optional;
- `publishedTotalScoreScaled` optional;
- `publishedPassed` optional;
- `publishedParticipation` optional;
- `publishedTeacherCommentBn` optional;
- `publishedTeacherCommentEn` optional;
- `publicationVersion` optional;
- `publishedAt` optional.

Indexes:

- `by_examId_and_studentId`;
- `by_examSubjectId_and_studentId`;
- `by_examId_and_entryStatus`;
- `by_examId_and_batchId_and_entryStatus`;
- `by_examSubjectId_and_entryStatus`.

### 5.6 `examResults` becomes the student-level aggregate

Retain the table but evolve it into the computed student summary:

- existing exam/course/student/enrolment identifiers;
- add `examCandidateId` and `batchId`;
- `grandTotalScaled`;
- `grandFullMarksScaled`;
- `percentageBasisPoints`;
- `passed`;
- `failedSubjectCount`;
- `absentSubjectCount`;
- `officialMeritPosition` optional;
- `officialMeritPopulation` optional;
- `officialMeritScope`: batch, selected_batches, course, none;
- `batchMeritPosition` optional;
- `batchMeritPopulation` optional;
- `entryStatus`;
- publication snapshot fields for every displayed aggregate;
- existing publication version and timestamps.

The current combined MCQ/written fields remain optional and deprecated during compatibility. New UI must read the new subject rows and aggregate fields when available.

### 5.7 `examPublicationEvents` — recommended version history

Fields:

- `examId`;
- `publicationVersion`;
- `kind`: initial, correction;
- `publishedAt`;
- `publishedByAccountId`;
- `candidateCount`;
- `passCount`;
- `failCount`;
- `recipientCount`;
- `officialMeritScope`;
- `meritMode`;
- `reopenReason` optional;
- `supersedesVersion` optional.

Indexes:

- `by_examId_and_publicationVersion`;
- `by_publishedAt`.

This complements audit logs with a report-friendly publication timeline.

## 6. Backend modules and API plan

Refactor the current `convex/exams/functions.ts` into focused modules while keeping existing public references temporarily available as compatibility wrappers.

```text
convex/exams/
├── model.ts                 # scaled marks, pass policy, ranking helpers
├── exams.ts                 # create/edit/lifecycle/list/detail
├── audience.ts              # preview, validate, freeze candidates
├── subjects.ts              # subject marking configurations
├── assignments.ts           # teacher scopes and submission states
├── marks.ts                 # draft entry, bulk save, validation
├── review.ts                # completion and exception summaries
├── publication.ts           # snapshots, merit, SMS, correction versions
├── studentResults.ts        # published student queries
├── migrations.ts            # staged data backfills
└── *.test.ts
```

### 6.1 Required queries

- `exams.listManaged` — paginated and filterable work queue;
- `exams.detail` — exam identity, state, counts, and rules;
- `audience.preview` — bounded candidate preview and conflict summary;
- `audience.listCandidates` — paginated frozen roster;
- `assignments.myWork` — teacher assignments requiring action;
- `marks.entryGrid` — paginated/filtered rows for one assignment;
- `review.progress` — subject/batch completion matrix;
- `review.summary` — publication validation counts;
- `review.individualPreview` — exact future student result;
- `publication.preview` — merit and SMS recipient/message preview;
- `studentResults.listMine` and `studentResults.detailMine`;
- report queries for tabulation, merit, subject analysis, and version history.

### 6.2 Required mutations

- `exams.createDraft`;
- `exams.updateDraft`;
- `exams.archiveDraft`;
- `audience.freezeRoster`;
- `assignments.configure`;
- `marks.saveDraft` for a bounded batch of rows;
- `marks.submitAssignment`;
- `marks.returnAssignment` with reason;
- `review.markReadyForPublication` or derive readiness transactionally;
- `publication.publish`;
- `publication.reopen` with reason;
- `publication.republish` through the same validated publish mutation.

Every function has argument and return validators. Authorization derives identity server-side and never accepts a user ID for permission decisions.

### 6.3 Transaction and scale boundaries

- Candidate preview is read-only and paginated.
- Roster freezing and subject-result initialization must respect Convex mutation limits. If the cohort can exceed a safe transaction size, create the exam in a `roster_freezing` state and schedule bounded internal batches, then atomically mark it frozen when counts reconcile.
- Bulk marks save accepts a bounded number of rows, such as 50, and returns per-row errors without writing invalid rows.
- Publication must not exceed mutation limits. For the current centre size, verify the actual maximum candidate count. If publication plus subject snapshots and SMS creation can exceed a single transaction, use a publication job with a locked version, bounded internal batches, reconciliation, and a final visibility flip. Students must never see a partially published version.
- Never calculate counts using unbounded `.collect().length`; use bounded reads and maintained counters where scale requires them.

## 7. Merit calculation specification

Merit is calculated only from the frozen candidate cohort and the frozen reviewed values.

Algorithm:

1. Exclude unresolved candidates; publication is blocked if any exist.
2. Exclude failed/absent students from ranking unless the stored policy explicitly includes them.
3. Sort by grand total descending.
4. Tie-break by total CQ/written descending.
5. Tie-break by total MCQ descending.
6. Assign competition rank based on the complete comparison tuple.
7. Store the official population count used for the published position.
8. If enabled, repeat within each frozen batch cohort and store batch position/population.

Important: the position and population are published data, not values recomputed live after publication.

## 8. SMS and guardian integration

Update result template variables:

- `studentName`;
- `examName`;
- `obtainedMarks`;
- `fullMarks`;
- `resultLabel`;
- `officialMeritLabel`;
- `officialMeritPosition`;
- `officialMeritPopulation`;
- `batchMeritPosition` optional;
- `batchMeritPopulation` optional;
- `publicationVersion` for correction templates where useful.

Recipient resolution must use the new Mother/Father fields rather than a legacy single guardian field.

Idempotency key includes exam, version, student, and recipient identity or normalized phone:

```text
exam:{examId}:v{version}:{studentId}:{normalizedPhone}
```

Templates:

- result published — Bangla and English;
- result corrected — Bangla and English.

The publication preview and actual enqueue operation must share the same recipient-resolution and template-rendering helpers to prevent preview/send drift.

## 9. Reporting plan

### 9.1 Individual result

- bilingual coaching and exam identity;
- subject rows with CQ, MCQ, total, full marks, and pass state;
- grand total and percentage;
- official merit label, position, and population;
- optional batch merit;
- comments;
- publication version and timestamp;
- correction notice when version is greater than one;
- deterministic A4 print.

### 9.2 Tabulation sheet

- A4 landscape;
- frozen candidate ordering with student numbers;
- one column group per subject;
- grand total, result, official merit, and batch merit;
- repeated table header on printed pages;
- version and publication timestamp.

### 9.3 Merit list

- official scope stated prominently;
- position, student, batch, obtained/full marks, percentage, and result;
- optional internal batch filter that never changes the official stored position;
- ties displayed correctly.

### 9.4 Subject analysis

- highest, lowest, average, and pass rate;
- absence count;
- score bands;
- selected-batch comparison;
- internal owner/teacher report only.

### 9.5 Correction history

- version timeline;
- reopen reason;
- changed values when practical;
- actors and timestamps;
- correction-SMS delivery status.

## 10. Component plan

Split the current monolithic `src/components/portal/ExamEditor.tsx`.

```text
src/components/portal/exams/
├── ExamWorkQueue.tsx
├── ExamFilters.tsx
├── ExamStatusBadge.tsx
├── create/
│   ├── ExamCreateWizard.tsx
│   ├── BasicInfoStep.tsx
│   ├── AudienceStep.tsx
│   ├── SubjectRulesStep.tsx
│   ├── AssignmentAndMeritStep.tsx
│   └── ReviewStep.tsx
├── marks/
│   ├── MarksWorkspace.tsx
│   ├── MarksGrid.tsx
│   ├── MobileMarksCard.tsx
│   ├── MarksToolbar.tsx
│   ├── ImportMarksDialog.tsx
│   └── SubmitAssignmentDialog.tsx
├── review/
│   ├── ExamProgressMatrix.tsx
│   ├── OwnerReviewWorkspace.tsx
│   ├── ReviewExceptions.tsx
│   ├── StudentResultPreview.tsx
│   └── PublishResultsDialog.tsx
└── history/
    └── ExamPublicationTimeline.tsx
```

Reuse existing shared buttons, tables, status badges, confirmation patterns, page states, and print frames. Add new reusable patterns to `DESIGN.md` only when no current pattern applies, particularly:

- dense editable marks grid;
- multi-step operational wizard;
- progress matrix;
- irreversible publication summary.

## 11. Migration strategy

Use widen–migrate–narrow. Existing published results must stay readable throughout.

### Deploy A — Widen and dual-read

1. Add the new tables and indexes.
2. Add new exam and subject fields as optional.
3. Keep current combined result fields.
4. Update reads to support:
   - new subject-level results when present;
   - legacy combined results otherwise.
5. Update newly created exams to use the new model behind a controlled feature flag or owner-only rollout.
6. Preserve current result pages and reports for legacy exams.

### Migration A — Backfill exam configuration

For every legacy exam:

- infer audience mode:
  - one exam batch → `single_batch`;
  - more than one exam batch → `selected_batches`;
- do not infer `all_course_batches`, because historical intent cannot be proven;
- set official merit scope from the inferred frozen selected audience;
- set `meritMode = official_only` to preserve current behavior as closely as possible;
- copy exam-level mode/full/pass rules onto every legacy `examSubject` only if that interpretation is academically acceptable;
- otherwise mark the exam as `legacy_combined` and retain legacy display without fabricating subject marks.

Preferred safety rule: never invent a subject-level score distribution from one combined score.

### Migration B — Backfill frozen candidates

Create `examCandidates` from legacy `examResults`, using the stored enrolment to resolve the historical batch. The legacy result roster is the historical source of truth, not current active enrolments.

Verify:

- candidate count equals legacy result count;
- no duplicate `(examId, studentId)`;
- every candidate belongs to the exam course;
- every candidate has a resolvable batch/enrolment or is explicitly reported for manual repair.

### Migration C — Preserve legacy result presentation

Do not split legacy combined scores among subjects. Mark legacy exams with a compatibility mode and continue showing their combined MCQ/written result exactly as published.

New exams use subject-level result records exclusively.

### Deploy B — New UI and dual operation

1. Enable the new creation wizard.
2. Route new-model exams to the new marks/review UI.
3. Route legacy exams to read-only or compatible correction UI.
4. Enable new reports and SMS templates for new-model exams.
5. Monitor errors, counts, publication duration, and SMS recipient differences.

### Deploy C — Narrow

After all writable exams use the new model and migration verification passes:

1. require the new fields for new-model exams through a discriminated schema shape or explicit model version;
2. remove dual-write paths;
3. retain dual-read for immutable legacy publications as long as those records exist;
4. deprecate, but do not immediately delete, legacy combined fields;
5. remove migration code only after production reconciliation and backup confirmation.

Use `@convex-dev/migrations` for batched, resumable backfills. Run dry runs first and record migrated, skipped, and failed counts.

## 12. Test plan

### 12.1 Domain unit tests

- MCQ-only, CQ-only, and combined subject configuration validation;
- component full marks sum to subject total;
- component and overall pass boundaries;
- absent subjects reject marks;
- subject and exam aggregate totals;
- overall fail when a required subject fails;
- duplicate student roster detection;
- competition ties `1, 2, 2, 4`;
- tie-break ordering;
- official merit populations for all three audience modes;
- optional batch merit populations;
- failed students excluded by default;
- Bengali ordinal/message formatting where applicable.

### 12.2 Authorization tests

- teacher sees only assigned exams;
- teacher can edit only assigned subject/batch rows;
- teacher cannot modify audience or marking rules;
- teacher cannot publish or reopen;
- owner can review and publish all exams;
- student can read only own published snapshot;
- draft, partial, and reopened unpublished changes remain hidden;
- account identity is derived server-side.

### 12.3 Workflow integration tests

- create single-batch exam and freeze correct roster;
- create selected-batch exam and calculate overall plus batch merit;
- create all-batches exam and freeze every eligible active enrolment;
- later enrolment changes do not alter frozen roster;
- teacher saves partial draft, reloads, and continues;
- incomplete assignment cannot be submitted;
- owner cannot publish unresolved results;
- owner preview counts equal publication counts;
- publication freezes subject and aggregate snapshots;
- Mother/Father duplicate phones generate one message;
- distinct Mother/Father phones generate two messages;
- failed SMS does not roll back publication;
- reopen requires a reason;
- republish increments version and sends correction messages exactly once.

### 12.4 Migration tests

- backfill is idempotent;
- dry run makes no writes;
- legacy candidate counts reconcile;
- legacy combined marks are never fabricated into subject marks;
- migrated legacy results remain visually and numerically identical;
- mixed legacy/new reads work during the migration window.

### 12.5 Component and accessibility tests

- wizard preserves values across steps;
- audience mode changes require confirmation when selections would be lost;
- keyboard traversal follows visual marks-grid order;
- focus remains visible;
- errors are associated with the correct cells and summarized;
- Bangla labels do not clip;
- all mobile controls meet 44px target size;
- confirmation acknowledgement gates publication;
- screen reader names include student, component, and full marks.

### 12.6 End-to-end tests

1. Owner creates and configures a selected-batch hybrid exam.
2. Teacher enters marks on desktop, saves, reloads, completes, and submits.
3. Owner reviews exceptions and publishes.
4. Student sees the exact published result and prints it.
5. SMS outbox contains correct unique guardian recipients and merit scope.
6. Owner reopens with reason, corrects one result, and republishes version two.
7. Student and report surfaces display version two while history preserves version one.

Run E2E coverage in English and at least one critical flow in Bangla.

## 13. Observability and reconciliation

Add owner-only diagnostics for:

- exams stuck in roster freezing or publication processing;
- candidate count versus aggregate result count;
- subject-result expected versus actual count;
- assignments submitted versus expected;
- published aggregate count versus candidate count;
- SMS preview recipients versus queued recipients;
- publication version mismatches;
- orphaned candidates, subject results, or assignments.

Audit actions:

- exam draft created/updated;
- roster frozen;
- teacher assignment configured/submitted/returned;
- marks changed after teacher submission;
- exam marked ready;
- results published;
- exam reopened;
- corrected results republished;
- exam archived.

## 14. Delivery phases

### Phase 0 — Contract alignment

- Update `IMPLEMENTATION_PLAN.md` exam rules so they no longer claim one combined result or unconditional course merit.
- Document Mother/Father result-recipient behavior.
- Add new reusable UX patterns to `DESIGN.md` only where necessary.
- Define legacy compatibility policy.

Exit criteria: product, data, merit, and migration decisions have no contradictions.

### Phase 1 — Domain model and widened schema

- Add model version, optional configuration fields, new tables, and indexes.
- Implement pure subject validation, aggregate, and ranking helpers with tests.
- Add dual-read types.

Exit criteria: schema deploys over current data; domain tests pass.

### Phase 2 — Audience and creation wizard

- Build draft creation, audience preview, duplicate checks, subject rules, teacher assignments, merit configuration, review, and roster freezing.
- Implement responsive wizard UI.

Exit criteria: owners can create all three audience modes and frozen counts reconcile.

### Phase 3 — Marks entry and teacher workflow

- Create subject/batch assignments and subject-result rows.
- Build desktop grid, mobile cards, draft saves, filters, validation, bulk paste/import preview, and submission.

Exit criteria: assigned teachers can complete large rosters without accessing another scope.

### Phase 4 — Owner progress and review

- Build progress matrix, return flow, exception filters, individual preview, and readiness validation.

Exit criteria: every publication blocker is visible and directly actionable.

### Phase 5 — Merit, publication, and SMS

- Implement official and batch merit calculation.
- Build immutable subject/aggregate snapshots.
- Add Mother/Father recipient resolution, template preview, idempotent enqueue, and correction messaging.
- Build publication confirmation.

Exit criteria: preview counts equal committed counts and publication remains atomic from the student's perspective.

### Phase 6 — Student results and reports

- Build subject-wise student result.
- Update print result, result sheet, tabulation, merit, analysis, and history reports.
- Verify Bangla print font and A4 layouts.

Exit criteria: screen and print values match the published snapshot exactly.

### Phase 7 — Migration and compatibility

- Deploy widened dual-read code.
- Run dry-run migrations.
- Backfill configuration and candidates.
- Verify legacy results.
- Enable new creation path.
- Narrow new-model requirements after reconciliation.

Exit criteria: no historical result changes and all new exams use the new model.

### Phase 8 — Hardening and rollout

- Complete unit, authorization, component, E2E, accessibility, performance, and print tests.
- Seed realistic large-batch fixtures.
- Test Bengali-first mobile entry.
- Add diagnostics and runbooks.
- Roll out to owners first, then teachers, then expose published student views.

Exit criteria: all acceptance criteria pass in a production-like environment.

## 15. Definition of done

- All three audience modes create the correct frozen cohort.
- Multi-subject exams store real subject-level marks.
- Every subject supports CQ, MCQ, or both with validated distributions.
- Teachers can save drafts and submit only their assigned work.
- Owner review exposes every missing, invalid, absent, failed, and contact exception.
- Official merit uses the frozen exam audience and states its scope and population.
- Optional batch merit is correct for selected/all-batch exams.
- Published results are immutable snapshots with visible versions.
- Mother/Father SMS messages include unambiguous merit scope and are de-duplicated by phone.
- Student and printed results show identical published data.
- Legacy results remain unchanged and readable.
- Bangla and English UI, SMS, and print layouts are verified.
- Desktop marks entry is keyboard-efficient and mobile marks entry is touch-friendly.
- Type checking, linting, focused Convex tests, component tests, E2E tests, and print QA pass.

## 16. Explicit non-goals

- Online examination delivery.
- Question bank or paper generation.
- AI-generated questions or grading.
- Answer-script upload and evaluation.
- Public unauthenticated result search.
- Guardian accounts.
- GPA/transcript replacement for formal schools.
- Predictive ranking or gamified leaderboards.

These may be reconsidered only through a separate product decision and architecture review.
