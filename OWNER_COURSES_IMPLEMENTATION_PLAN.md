# Owner Courses Workspace — Implementation Plan

Status: Approved product direction; ready for implementation
Scope: `/{locale}/owner/courses` and its academic, finance-readiness, scheduling, and supporting Convex surfaces
Last updated: 2026-07-13

## 1. Outcome

Replace the current generic Academic Portal experience at `owner/courses` with a course-first workspace that lets an owner:

1. Find the correct course quickly.
2. Understand its academic, fee, and website state without opening several screens.
3. Complete setup in a guided order.
4. Activate a course only after it is academically complete.
5. Manage batches, subjects, teacher coverage, and routines without losing course context.
6. See and resolve archive blockers before attempting an irreversible action.
7. Inspect schedules across courses with reliable teacher and batch conflict detection.

This is a complete replacement of the current `AcademicEditor` navigation for this route. Existing mutations and editor components may be reused temporarily during delivery, but the shipped experience must not expose the old generic Operations / Records / Create navigation.

## 2. Approved product decisions

These rules are fixed for implementation:

- Cover the complete roadmap, including the cross-course calendar and conflict UX.
- Replace the existing `owner/courses` experience when the new workspace is ready.
- The initial academic session is the active session whose dates contain today.
- URL state takes precedence over remembered state. If several sessions contain today, use the owner's last selected session. If none contains today, fall back to the nearest active session and show its name explicitly.
- Archived courses are hidden by default, available through a status filter, and read-only.
- Course activation is blocked until the canonical readiness check passes.
- Website configuration remains owned by Website CMS. The course workspace shows website status and links to CMS, but does not duplicate or redesign CMS controls.
- Course roll-forward / duplication is not included.
- Rooms are removed completely. No room name, room field, room column, room validation, or room conflict logic remains in batches, routines, class sessions, public pages, dashboards, or seed data.
- Schedule conflicts cover teacher overlaps and batch overlaps only.
- Course archive uses a guided blocker-resolution view. It never automatically modifies dependent records.

## 3. Canonical readiness contract

Readiness is a server-owned business rule. UI calculations are informational only and must never authorize activation.

### 3.1 Qualifying batches

A qualifying batch has status `planned` or `active`.

### 3.2 Academic readiness

A course is academically ready only when all checks pass:

1. The course has at least one qualifying batch.
2. The course has at least one active linked subject.
3. Every qualifying batch has active teacher coverage for every active course subject.
   - The assignment must identify the subject.
   - An assignment with no `subjectId` does not satisfy subject coverage.
4. Every qualifying batch has at least one active routine.
5. Every qualifying batch has an applicable active fee plan containing at least one active fee-plan item.
   - An active batch-specific plan satisfies that batch.
   - Otherwise, an active course-level plan satisfies the batch.
6. Every active enrolment in the course has an assigned active fee plan compatible with its course and batch.

Website publication does not affect academic readiness.

### 3.3 Display states

Expose three independent status groups:

- `Academic`: `Needs setup` or `Ready`.
- `Fees`: `Needs setup` or `Configured`.
- `Website`: `Not published` or `Published`.

The Academic status includes the fee checks because fees are required for activation. Fees are also displayed separately so owners can see the financial cause immediately.

### 3.4 Missing-item codes

The backend returns stable codes plus identifiers; the client localizes the message:

- `NO_QUALIFYING_BATCH`
- `NO_COURSE_SUBJECT`
- `BATCH_SUBJECT_TEACHER_MISSING`
- `BATCH_ROUTINE_MISSING`
- `BATCH_FEE_PLAN_MISSING`
- `BATCH_FEE_PLAN_EMPTY`
- `ENROLMENT_FEE_PLAN_MISSING`
- `ENROLMENT_FEE_PLAN_INCOMPATIBLE`

Each issue includes the smallest actionable scope: `courseId`, and where relevant `batchId`, `subjectId`, `enrolmentId`, and localized record labels. The UI must link directly to the section that resolves it.

### 3.5 Lifecycle mutations

Do not continue accepting an unrestricted `status` field through the generic course update mutation.

- `createDraft`: always creates `status: "draft"`, `isPublic: false`.
- `updateDetails`: updates identity and descriptions but not lifecycle state.
- `activate`: recomputes canonical readiness in the same mutation and rejects with structured issues unless ready.
- `complete`: allowed only after no planned or active batches remain.
- `archive`: allowed only after all existing dependency guards pass; returns structured blockers when it cannot proceed.

Legacy active records that fail the new readiness rule remain visible as `Active · Needs setup`. They are not automatically downgraded. Any later transition from draft to active must pass the gate.

## 4. Target information architecture

### 4.1 Route and URL state

Keep the existing route: `/{locale}/owner/courses`.

Use URL-addressable state:

```text
?sessionId=<id>&status=active&query=<text>&courseId=<id>&view=overview
```

Supported `view` values:

- `overview`
- `batches`
- `subjects-teachers`
- `schedule`
- `website`

Invalid IDs or view values fall back safely without throwing. Browser Back and Forward restore the visible session, filters, course, and section.

Session resolution order:

1. Valid `sessionId` in the URL.
2. A remembered session ID in local storage if it is still active and, when several sessions contain today, is one of the current matches.
3. The active session whose date range contains the current Dhaka date.
4. The nearest upcoming active session.
5. The most recently ended active session.
6. Empty state with `Create academic session` action.

### 4.2 Course list

Desktop uses the design-system compact table. Mobile uses full-width record cards with 44px actions.

Required controls:

- Search by Bangla name, English name, or course code.
- Session selector.
- Status filters: Active, Draft, Completed, Archived, All.
- Clear filters.
- `New course` as the single primary action.

Required row/card fields:

- Course name and code.
- Academic session.
- Lifecycle status.
- Batch count.
- Active student count and total capacity.
- Academic readiness.
- Fee status.
- Website status.
- Next scheduled routine occurrence when available.
- Contextual next action.

Archived rows are visually neutral, open read-only, and do not show edit or restore actions.

### 4.3 Course header

The selected course header contains:

- Localized name and code.
- Session name.
- Lifecycle badge.
- Academic, fee, and website status summaries.
- One contextual primary action:
  - `Add a batch`
  - `Add subjects`
  - `Assign teachers`
  - `Add routine`
  - `Configure fees`
  - `Activate course`
- Secondary overflow menu for Edit details, Complete, and Archive.

### 4.4 Workspace sections

#### Overview

- Readiness checklist with actionable links.
- Active/planned batch count.
- Active students and total capacity.
- Teacher-coverage gaps.
- Routine gaps.
- Fee-plan gaps.
- Next routines.
- Website status with `Open Website CMS` link.
- Recent course-related audit events if an existing bounded audit query can support the scope; otherwise defer audit history without blocking the workspace.

#### Batches

- All batches for this course grouped by status.
- Name, code, dates, capacity, enrolment count, admission state, teacher coverage, routine state, and fee state.
- Create and edit batch in a drawer.
- Batch lifecycle actions with exact blockers.
- No room fields.

#### Subjects & teachers

- Course subject list with accessible ordering controls.
- Coverage matrix: subjects as rows, qualifying batches as columns.
- Each cell shows assigned teacher(s) or `Missing`.
- Link/unlink subject and create/end assignment without navigating to Operations.
- Unlink confirmation lists affected batches and active schedules/assignments.

#### Schedule

- Course-scoped weekly agenda first.
- Batch filter and teacher filter.
- Create/update/cancel routines.
- Pre-submit conflict preview and authoritative mutation validation.
- Conflicts report the colliding teacher or batch, weekday, time, and effective date range.
- No room inputs or columns.

#### Website

- Read-only status summary: public/private, content completeness, public batches, admission availability.
- Public course preview link when published.
- `Manage in Website CMS` action.
- No publishing form or sort-order editor in this workspace.

### 4.5 Cross-course calendar

Provide an `All schedules` view accessible from the Schedule section toolbar:

- Week agenda on desktop; day agenda on narrow screens.
- Filters: academic session, course, batch, teacher.
- Teacher conflicts and batch conflicts are shown with text and icons, not color alone.
- Phase one interaction may use click-to-open and standard forms. Drag/drop is optional and must not delay delivery.

## 5. Convex architecture

All new functions require explicit argument and return validators and owner authorization. Read `convex/_generated/ai/guidelines.md` again immediately before implementation.

### 5.1 New modules

Create:

- `convex/academics/courseReadiness.ts`
  - Shared canonical computation usable by queries and mutations.
  - Stable issue-code validators and result validator.
- `convex/academics/courseWorkspace.ts`
  - Course list, course overview, batch facts, coverage matrix, schedule agenda, archive blockers, and session resolution inputs.
- `convex/academics/courseSnapshots.ts`
  - Internal snapshot refresh and public list projections.
- `convex/academics/courseWorkspace.test.ts`
  - Backend contract and lifecycle tests.

### 5.2 Search support

Add a normalized `searchText` field to `courses`, composed from code, Bangla name, and English name, plus a Convex search index filtered by academic session and lifecycle status where supported.

Use widen–migrate–narrow:

1. Add `searchText` as optional and make all course writes populate it.
2. Backfill existing courses with `@convex-dev/migrations`.
3. Verify no course lacks the field.
4. Make it required and remove fallback search handling.

Do not load every course into the browser for search.

### 5.3 Operational snapshots

Add `courseOperationalSnapshots` keyed uniquely by `courseId` with:

- `courseId`
- `academicSessionId`
- lifecycle status
- qualifying, active, planned, completed, and archived batch counts
- active enrolment count
- total qualifying-batch capacity
- academic-ready boolean
- fee-configured boolean
- missing-issue counts by category
- website-published boolean
- next routine summary if deterministically available
- `updatedAt`

The list reads snapshots so a 20-row page does not fan out across all dependent tables.

Snapshot behavior:

- Activation never trusts the snapshot; it computes readiness canonically in the same mutation.
- Dependency-changing mutations schedule an internal snapshot refresh with `ctx.scheduler.runAfter(0, ...)`.
- A missing snapshot renders `Calculating…` and schedules/retries refresh; it never implies readiness.
- Backfill all current courses using the migrations component.

Refresh after changes in:

- course create/update/activate/complete/archive
- subject link/unlink/reorder
- batch create/update/lifecycle changes
- teacher assignment create/end
- routine create/update/cancel
- fee plan create/archive/item changes
- fee-plan assignment to an enrolment
- enrolment create/status/batch/course changes

### 5.4 Required read contracts

`listCourses`:

- Args: session, lifecycle status, search text, pagination options.
- Returns course identity plus snapshot projection.
- Default page size: 20.

`getCourseOverview`:

- Course identity and session.
- Canonical readiness result.
- Batch facts.
- Website status.
- Contextual next action code.

`getCoverageMatrix`:

- Active course subjects.
- Qualifying batches.
- Active assignments grouped by batch and subject.

`getScheduleAgenda`:

- Bounded date/effective-range or weekly query.
- Course/batch/teacher filters.
- Conflict metadata.

`getArchiveBlockers`:

- Blocking batches grouped by their active assignments, schedules, enrolments, and lifecycle state.
- Resolution links/codes; no mutation side effects.

### 5.5 Conflict validation

Keep server enforcement in `convex/academics/schedules.ts`, but return structured conflict details instead of a generic message.

Validate:

- Same teacher with overlapping weekday/time and effective date range.
- Same batch with overlapping weekday/time and effective date range.

The client preview query improves UX, but the create/update mutation repeats the validation to prevent races.

## 6. Room removal migration

Room removal affects existing stored documents and is a breaking schema change. Use `@convex-dev/migrations`; do not delete schema fields in the first deploy.

### Deploy A — widen and stop writes

1. Keep `roomBn` and `roomEn` optional in the schema with deprecation comments on:
   - `batches`
   - `batchSchedules`
   - `classSessions`
2. Remove room arguments from all create/update mutations and stop writing room fields.
3. Remove room fields from validators and projections consumed by new clients while old optional data remains at rest.
4. Remove room UI and display from owner, teacher, student, public, and dashboard surfaces.
5. Update development seed data to stop creating room values.
6. Deploy and verify new documents contain no room values.

### Migration — clear stored fields

Add idempotent batched migrations in `convex/migrations.ts`:

- `clearBatchRooms`
- `clearBatchScheduleRooms`
- `clearClassSessionRooms`

Each returns `{ roomBn: undefined, roomEn: undefined }` only when either field exists.

Run in every target deployment:

```text
npx convex run migrations:clearBatchRooms '{"dryRun":true}'
npx convex run migrations:clearBatchScheduleRooms '{"dryRun":true}'
npx convex run migrations:clearClassSessionRooms '{"dryRun":true}'
```

Then run without `dryRun`, monitor the migrations component, and verify there are no remaining documents with either field.

### Deploy B — narrow

1. Remove `roomBn` and `roomEn` from all three schema definitions.
2. Remove compatibility code and migration verification helpers after production confirmation.
3. Run Convex code generation and the full verification suite.

The removal checklist must cover:

- `convex/schema.ts`
- `convex/academics/shared.ts`
- `convex/academics/batches.ts`
- `convex/academics/schedules.ts`
- `convex/academics/readModels.ts`
- `convex/attendance/functions.ts`
- `convex/publicSite/public.ts`
- `convex/reports/dashboards.ts`
- `convex/devSeedData.ts`
- `src/components/portal/academics/AcademicOperations.tsx`
- `src/components/portal/academics/AcademicRecordCreator.tsx`
- `src/components/portal/academics/record-editors/BatchRecordEditor.tsx`
- `src/components/portal/SelfService.tsx`
- `src/components/portal/RoleSection.tsx`
- `src/app/[locale]/(public)/page.tsx`
- `src/app/[locale]/(public)/courses/[slug]/page.tsx`
- related tests, fixtures, and generated Convex types

## 7. Frontend component plan

Replace `AcademicEditor` at the route boundary with `CoursesWorkspace`.

Suggested structure:

```text
src/components/portal/courses/
  CoursesWorkspace.tsx
  CourseList.tsx
  CourseMobileCard.tsx
  CourseFilters.tsx
  CourseWorkspaceHeader.tsx
  CourseOverview.tsx
  CourseReadinessChecklist.tsx
  CourseBatches.tsx
  BatchDrawer.tsx
  CourseCoverageMatrix.tsx
  AssignmentDrawer.tsx
  CourseSchedule.tsx
  ScheduleDrawer.tsx
  ScheduleConflictPanel.tsx
  AllSchedulesAgenda.tsx
  CourseWebsiteStatus.tsx
  CourseDetailsDrawer.tsx
  CourseCreateFlow.tsx
  CourseArchiveFlow.tsx
  courseWorkspaceState.ts
  index.ts
```

Reuse the existing design-system classes and primitives where they meet the contract. Add new reusable patterns to `DESIGN.md` before using them:

- Operational workspace header.
- Readiness checklist.
- Coverage matrix.
- Agenda conflict treatment.

Avoid inline arbitrary styles in the new components. Add named classes to `src/app/globals.css` using existing tokens.

### 7.1 Progressive course creation

The creation flow is a drawer or focused modal, not a top-level tab.

Step 1 — create draft:

- Academic session.
- Bangla name.
- English name.
- Course code.
- Auto-suggested slug hidden under Advanced; validate uniqueness on submit.

Step 2 — continue setup:

- `Add subjects` (recommended primary action).
- `Create first batch`.
- `Finish later`.

Descriptions and website fields are not required to create the academic draft. Website content remains in Website CMS.

### 7.2 Unsaved and concurrent changes

- Track dirty forms.
- Warn before closing a dirty drawer or changing selected course.
- If reactive server data changes while a form is dirty, show the established “updated by another owner” pattern with Reload latest and Keep editing choices.
- Do not overwrite dirty input silently.

### 7.3 Accessibility and bilingual requirements

- Bangla is the first QA locale.
- All mobile controls meet 44×44px.
- Table rows/cards have explicit accessible names.
- Tabs implement Arrow keys, Home, End, and correct focus movement.
- Drawers/modals trap focus, close with Escape when safe, and restore focus.
- Status is always text plus semantic color.
- Coverage matrix has a linear mobile/card alternative; do not force an unusable compressed grid.

## 8. Delivery phases

Each phase ends in a shippable, tested state. Do not start the next phase with failing gates.

### Phase 0 — contracts and safe schema widening

- Add readiness types, issue codes, and canonical computation tests.
- Add optional course `searchText`, search index, and new snapshot table.
- Add room deprecation comments and stop all room writes/reads in product code.
- Add migration definitions for search backfill, snapshots, and room clearing.
- Update `DESIGN.md` with the new workspace patterns.

Exit criteria:

- Existing owner course route still works during the transition.
- New writes contain search text and no room fields.
- Migration dry runs pass.

### Phase 1 — course-first list and workspace shell

- Implement session resolution and URL state.
- Implement search, lifecycle filters, pagination, desktop table, and mobile cards.
- Implement course header and Overview shell.
- Implement progressive draft creation.
- Surface academic/fee/website states and contextual next action.
- Keep existing editing capabilities reachable inside the new shell until migrated.

Exit criteria:

- Known course is reachable in no more than two interactions after route load.
- Browser navigation restores state.
- Draft/active/completed/archived courses are correctly filterable.

### Phase 2 — complete course operations

- Replace existing course and batch editors with drawers.
- Move course subject linking into Subjects & teachers.
- Implement teacher-coverage matrix and assignment actions.
- Implement course-scoped routine management.
- Add fee-plan status and direct link to the correctly filtered Finance workspace.
- Add readiness-gated activation.
- Implement structured complete/archive blocker flows.
- Make archived workspace fully read-only.

Exit criteria:

- Every readiness issue resolves from its linked workspace section.
- Activation cannot succeed unless the server recomputation passes.
- No owner needs the old AcademicEditor tabs to configure a course.

### Phase 3 — schedule oversight and final cleanup

- Add all-schedules week/day agenda.
- Add course, batch, and teacher filters.
- Add conflict preview and structured collision display.
- Finish room data migration and narrow schema after verification.
- Remove `AcademicEditor`, `AcademicRecords`, `AcademicOperations`, and `AcademicRecordCreator` only after all non-course responsibilities are deliberately relocated or retained elsewhere.
- Remove dead styles, tests, exports, and query paths.

Important cleanup constraint: the old Academic Portal also owns sessions, global subjects, teachers, and operations. Do not delete those capabilities accidentally. Before deleting the old components, ensure:

- Session management has an explicit reachable owner destination.
- Global subject management has an explicit reachable owner destination.
- Teacher Directory remains reachable through its current owner navigation.
- Any batch operation not moved into the course workspace has a documented replacement.

Exit criteria:

- No room reference remains outside historical migration files.
- Teacher and batch conflicts are enforced by mutations and explained before submission.
- Old course navigation is removed without losing adjacent academic workflows.

## 9. File-level implementation map

### Modify

- `src/components/portal/RoleSection.tsx` — mount `CoursesWorkspace` for the owner courses section and remove room displays.
- `src/components/portal/PortalShell.tsx` — keep route/navigation label, update description if needed.
- `src/app/globals.css` — token-based workspace, readiness, coverage, agenda, drawer, and mobile-card styles.
- `DESIGN.md` — document reusable operational workspace patterns before UI implementation.
- `convex/schema.ts` — optional-to-required search field, snapshot table, room field removal sequence.
- `convex/academics/courses.ts` — split details and lifecycle mutations; snapshot refresh hooks.
- `convex/academics/batches.ts` — remove rooms, structured blockers, refresh hooks.
- `convex/academics/assignments.ts` — structured conflicts/blockers and refresh hooks.
- `convex/academics/schedules.ts` — remove rooms, conflict details, refresh hooks.
- `convex/academics/options.ts` — stop using broad workspace payloads for the new route; retain only for remaining consumers.
- `convex/finance/functions.ts` and any newer fee-plan module — readiness-compatible plan reads and snapshot refresh hooks.
- enrolment/admission mutations — snapshot refresh after enrolment state or scope changes.
- public, dashboard, self-service, attendance, seed, and test files listed in the room-removal section.

### Add

- New frontend course workspace folder from Section 7.
- New Convex modules from Section 5.
- `convex/migrations.ts` entries for course search, snapshots, and room removal.
- Focused unit/component/E2E tests from Section 10.

### Retire after parity

- Course-specific paths inside `AcademicEditor.tsx`.
- Course-specific paths inside `AcademicRecords.tsx`.
- Course and batch creation paths inside `AcademicRecordCreator.tsx`.
- Course-subject, assignment, and routine paths inside `AcademicOperations.tsx`.
- `CourseRecordEditor.tsx` and `BatchRecordEditor.tsx` after new drawers have parity.

## 10. Test plan

### 10.1 Convex tests

Add coverage for:

- Readiness fails with no batch.
- Readiness fails with no subject.
- Every subject requires an active subject-specific teacher assignment in every qualifying batch.
- One active routine per qualifying batch satisfies the routine check.
- Batch-specific fee plan takes precedence and course-level plan provides fallback.
- Fee plan without active items is incomplete.
- Missing or incompatible enrolment fee plans block readiness.
- Draft activation succeeds only after every check passes.
- Legacy active incomplete course remains active but reports issues.
- Completion fails while planned/active batches exist.
- Archive blockers return exact dependent records.
- Teacher overlap and batch overlap are rejected across overlapping effective ranges.
- Adjacent times and non-overlapping effective ranges are allowed.
- Search matches Bangla, English, and normalized code.
- Owner authorization is required on every new query/mutation.
- Snapshot refresh produces the same summary flags as canonical readiness.
- Migration functions are idempotent.

### 10.2 Component tests

- Session-selection precedence and fallback.
- URL parsing, invalid-value fallback, and Back/Forward restoration.
- Search/filter state and empty results.
- Mobile and desktop list projections.
- Contextual next-action priority.
- Readiness links open the correct section/batch/subject.
- Activation modal lists all unresolved issues and cannot submit early.
- Archived course is read-only.
- Dirty drawer close/selection-change warning.
- Reactive concurrent update warning.
- Coverage matrix keyboard and mobile alternative.
- Conflict panel announces collisions accessibly.

### 10.3 E2E scenarios

1. Create draft → add subjects → create batch → assign teachers → add routine → configure fee plan → activate.
2. Attempt activation at every incomplete stage and verify exact blocker and resolution link.
3. Search in Bangla and English, switch session/status, open a course, then use browser Back/Forward.
4. Create a conflicting teacher routine and conflicting batch routine; verify preview and authoritative rejection.
5. Complete/archive dependencies through guided links, then archive the course.
6. Open an archived course and verify every mutation control is absent or disabled.
7. Verify teacher, student, owner dashboard, and public routine/course surfaces contain no room labels or values.
8. Run core flow at mobile width and in both locales.

### 10.4 Required verification commands

Run proportionally during development and all gates before final handoff:

```text
npm run convex:codegen
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e
git diff --check
npx @google/design.md lint DESIGN.md
```

## 11. Migration and rollout sequence

1. Deploy Phase 0 widened schema and compatibility code.
2. Run search-text and snapshot backfills in development; verify.
3. Run room-clearing migrations in development with dry run, execution, and verification.
4. Ship Phase 1 behind a temporary code-level feature flag only if production parity cannot be completed in one release. Do not maintain two long-lived course experiences.
5. Complete Phase 2, run E2E owner setup flow, and switch `owner/courses` to the new workspace.
6. Complete Phase 3 schedule view.
7. Deploy widened production schema/code.
8. Run and monitor production migrations with `--prod` only after a verified backup/export and release checklist approval.
9. Confirm no stored room fields remain and all courses have search text/snapshots.
10. Deploy narrowed schema and remove compatibility/dead code.

Rollback rules:

- Before schema narrowing, rollback may restore the prior UI, but room values cleared by migration are intentionally not restored.
- Do not narrow the schema until production migration verification is complete.
- Snapshot data is derived and may be rebuilt; canonical course, batch, assignment, routine, fee, and enrolment data remains authoritative.

## 12. Acceptance criteria

The project is complete only when:

- `owner/courses` opens directly to the course list for the resolved current session.
- Owners can find by Bangla name, English name, or code and filter every lifecycle state.
- Course selection and workspace section are URL-addressable.
- The Overview shows exact academic, fee, and website status.
- Every readiness issue has a direct corrective action.
- A draft course cannot activate until all approved readiness rules pass server-side.
- Every qualifying batch has every course subject assigned to at least one active teacher, at least one routine, and an applicable non-empty active fee plan.
- Active enrolments without compatible fee plans block activation/readiness.
- Website controls are not duplicated; the workspace links to Website CMS.
- Archive blockers are shown before confirmation and no dependency is changed automatically.
- Archived courses are accessible through filters and are read-only.
- Teacher and batch schedule conflicts are previewed and enforced.
- No room field, input, table column, output, validator, seed value, or stored document remains after migration completion.
- Existing session, global subject, teacher, attendance, finance, public course, admission, and self-service workflows continue to work.
- Bangla and English pass layout checks at desktop and mobile widths.
- All verification commands pass.

## 13. Explicit non-goals

- Course roll-forward or duplication.
- Room management or room conflict detection.
- Website CMS redesign.
- Online course sales, payment gateways, live video, chat, or marketplace features.
- Restoring archived courses.
- Drag-and-drop scheduling as a release requirement.
- Replacing the existing finance system; this work only reads fee readiness and links to the appropriate Finance scope.

## 14. Recommended implementation order inside each phase

For every slice:

1. Define/extend the backend validator and test.
2. Implement the canonical backend behavior.
3. Add the typed UI projection.
4. Add component tests.
5. Run targeted tests, typecheck, and lint.
6. Perform bilingual desktop/mobile QA.
7. Only then remove the superseded old path.

This ordering keeps the server authoritative, prevents the replacement UI from drifting from activation rules, and makes the final deletion of the old Academic Portal course paths a controlled parity step rather than a rewrite cliff.
