# Owner Teachers Page Implementation Plan

## Status

Implementation-ready plan for a dedicated `/owner/teachers` workspace. It can
be built in parallel with the Batches page because it requires no academic
schema redesign and treats course/batch assignment data as read-only context.

## Frozen product decisions

- The page lists every teacher record across the coaching centre.
- Owners can create, inspect, edit, deactivate, reactivate, and archive teachers
  subject to server-owned blockers.
- Creating a teacher also creates a reserved teacher portal account for the
  approved login email.
- A teacher may teach multiple subjects, but there is no global teacher-subject
  ownership table.
- Subject responsibility is contextual:
  - course defaults come from `courseTeacherDefaults`;
  - current batch work comes from `teacherBatchAssignments`;
  - weekly teaching time comes from `batchSchedules`.
- The Teachers page displays those relationships but does not rewrite course
  defaults, batch assignments, or weekly routines.
- Website visibility is editable, but only active teachers may be public.
- An inactive teacher cannot receive new assignments or schedules.
- A teacher with active batch assignments or schedules cannot be deactivated or
  archived until the owner resolves those items in Batches.
- Archived teachers are read-only and cannot be restored in this implementation.

## User outcomes

An owner can:

1. Search and filter all teachers from one page.
2. Create a teacher and reserve portal access using the teacher's email.
3. See profile details, account state, course-default responsibilities, active
   batches, subjects, and weekly workload.
4. Edit allowed profile and website fields.
5. Understand why deactivation or archival is blocked and jump to the exact
   affected batch.
6. Distinguish teacher employment state, portal-access state, and website
   publication state without conflating them.

## Scope

### Included

- `/owner/teachers` route and navigation entry;
- searchable, filterable, paginated teacher directory;
- create-teacher dialog with reserved account creation;
- teacher detail sheet;
- edit profile dialog;
- active/inactive transitions and archival;
- account-state display and relevant reserved-account email behavior;
- website visibility state;
- read-only course defaults, current batch assignments, subjects, and weekly
  workload summaries;
- blocker details and deep links to Batches;
- Bangla and English UI, responsive states, tests, and accessibility checks.

### Excluded

- course-default reassignment;
- batch teacher-assignment mutation;
- weekly routine editing;
- one-off schedule changes;
- teacher attendance/marks workflows;
- payroll, salary, HR documents, or staff performance;
- a global subject list stored on the teacher record;
- deleting claimed portal identities.

## State model

Show three independent states:

1. Teacher status: `active | inactive | archived`
2. Portal account status: `reserved | active | suspended | revoked`
3. Website state: `published | private`

Never collapse these into one badge. For example, an active teacher may still
have a reserved account and a private website profile.

Recommended transitions:

- Create → active teacher + reserved account + private website profile.
- Active → inactive only when no active assignments/schedules exist; suspend an
  active portal account in the same mutation.
- Inactive → active; reactivate a suspended portal account in the same audited
  mutation. A reserved account remains reserved.
- Active/inactive → archived only when no active assignments/schedules exist;
  revoke portal access and force `isPublic: false` atomically.
- Archived → no restoration in this scope.

## Information architecture

### Page header

- Eyebrow: People / জনবল
- Title: Teachers / শিক্ষক
- Description: manage teacher profiles, access, publication, and workload.
- Dominant action: `New teacher`.

### Filter toolbar

- Search by display name, Bangla/English name, employee code, email, or phone.
- Teacher status: active, inactive, archived.
- Portal state: reserved, active, suspended, revoked.
- Website state: published/private.
- Optional workload filter: assigned/unassigned.
- Preserve `status`, `accountStatus`, `query`, and `teacherId` in URL parameters
  for shareable owner-portal links.

### Desktop table

Columns:

1. Teacher: avatar/fallback, display name, employee code
2. Contact: email and phone
3. Teacher status
4. Portal access
5. Course subjects: distinct active course-default count
6. Active batches
7. Weekly classes
8. Website
9. Actions

Use 20-row pagination and a `DropdownMenu` for row actions. Never show teacher
financial information.

### Mobile representation

- Compact cards with avatar, name/code, teacher and account badges, contact,
  active-batch count, and next class summary.
- The main action opens the detail sheet.
- Maintain 44px touch targets and Bangla-safe line height.

### Teacher detail sheet

Sections:

1. Avatar, identity, contact, qualifications, joined date
2. Teacher, portal, and publication states
3. Course-default responsibilities grouped by course
4. Current batch assignments with course and subject
5. Weekly workload ordered by weekday/start time
6. Blocking assignments/schedules, when relevant
7. Actions: edit profile, open Website CMS, deactivate/reactivate, archive

The sheet uses `SheetTitle`/`SheetDescription`, restores trigger focus, and
becomes full-width on mobile.

## Teacher creation dialog

Use a standard or complex `Dialog`, grouped into three sections rather than a
multi-step wizard unless mobile testing proves the form too long.

### Identity and access

Required:

- display name;
- employee code;
- login email;
- phone;
- preferred portal locale.

Optional:

- Bangla name;
- English name;
- joined date;
- profile photo.

Explain inline that the login email reserves portal access and can only be
changed before the account is claimed.

### Public profile

- Bangla and English qualifications;
- Bangla and English bio;
- profile photo;
- `Show on website`, default false.

Creation defaults to active. A public profile is allowed because the new teacher
is active, but the checkbox remains explicitly owner-controlled.

### Submission

Use the existing atomic `teachers.createWithReservedAccount` contract, extended
for photo upload only if needed. On success, close the dialog, show a toast, and
open the new teacher detail sheet.

## Editing behavior

### Profile editing

- Editable while active or inactive: names, employee code, phone, biography,
  qualifications, joined date, photo, website visibility/order.
- Email is editable only while the linked portal account is `reserved`.
- Archived teacher records are read-only.
- Changing email updates teacher and reserved portal account atomically.

### Deactivate/reactivate

- Add explicit mutations instead of overloading a large profile update.
- `deactivate` returns structured blockers containing active batch assignments
  and active schedules.
- A successful deactivation sets teacher inactive, publication private, and an
  active account suspended in one audited transaction.
- `reactivate` sets teacher active and resumes a suspended account; reserved
  accounts remain reserved.

### Archive

- Show an `AlertDialog` with consequences: profile becomes read-only, website
  publication stops, and portal access is revoked.
- Block while active assignments or schedules exist.
- Return structured blocker rows with batch/course/subject labels and deep links
  to `/owner/batches?batchId=...`.

## Backend work

### New read model: `convex/academics/teacherWorkspace.ts`

Add:

- `listTeachers({ status, accountStatus?, publication?, assignmentState?,
  query?, paginationOpts })`
- `getTeacherDetails({ teacherId })`
- `getTeacherLifecycleBlockers({ teacherId, action })`

List projection should include:

- identity/contact fields required by the table;
- teacher/account/publication states;
- distinct active course-default count;
- distinct active batch count;
- active weekly schedule count;
- next scheduled routine summary.

Detail projection should resolve course, batch, subject, and schedule labels on
the server. Avoid multiple client subscriptions per teacher row.

### Mutations in `teachers.ts`

Retain/strengthen:

- `createWithReservedAccount`
- `updateProfile`
- `deactivate`
- `reactivate`
- `archive`
- `generatePhotoUploadUrl` if photo upload is included.

Lifecycle mutations should return either success or structured blockers rather
than requiring the client to parse error strings.

Example blocker shape:

```ts
{
  kind: "assignment" | "schedule"
  batchId: Id<"batches">
  batchNameBn: string
  batchNameEn: string
  courseNameBn: string
  courseNameEn: string
  subjectNameBn?: string
  subjectNameEn?: string
}
```

### Validation rules

- normalized employee code globally unique;
- normalized login email unique across teachers and all portal accounts;
- required display name, phone, and email normalization;
- only active teachers may be public;
- claimed-account email cannot change;
- inactive/archived teachers cannot receive assignments or schedules;
- deactivation/archive blockers are authoritative on the server;
- every lifecycle and access-state change is audited.

### Schema and index policy

- No new teacher-subject table or array field.
- No schema change is expected for the core page.
- Reuse `teachers` and `portalAccounts` indexes.
- Add `teachers.searchText` plus a search index only if testing shows bounded
  status pagination cannot support the required directory search. If added,
  use a proper widen/backfill/narrow migration and preserve normalized fields.

## Shadcn composition

Use installed components first:

- `Button`, `Badge`, `Table`, `Input`, `Select`, `Dialog`, `Sheet`,
  `AlertDialog`, `DropdownMenu`, `Separator`, `Skeleton`, `Tooltip`, and the
  existing `EmptyState`.
- Add `Avatar`, `Field`, `FieldGroup`, `Card`, `Spinner`, and `sonner` through
  `npx shadcn@latest` only when implementation confirms they are required.
- `Avatar` must include `AvatarFallback`.
- Forms use `FieldGroup`/`Field`; invalid fields use `data-invalid` and
  `aria-invalid`.
- Use full Card composition where cards are needed.
- Icons use Lucide and `data-icon` inside buttons.
- Use semantic states from `DESIGN.md`, never arbitrary raw colours.

## Suggested file ownership

Teacher task owns:

- `src/components/portal/teachers/**`
- `convex/academics/teacherWorkspace.ts`
- teacher-focused additions to `convex/academics/teachers.ts`
- teacher-focused backend/component tests

Shared integration files must be edited serially after parallel feature work:

- `src/components/portal/RoleSection.tsx`
- `src/components/portal/PortalShell.tsx`
- `convex/_generated/**`
- `DESIGN.md`

The Teacher task must not modify batch assignments, schedules, class
occurrences, `courseTeacherDefaults`, or `convex/schema.ts` unless a reviewed
search-index migration is explicitly approved.

## Implementation phases

### Phase 1 — Contracts and tests

- Lock directory/detail projections and structured blocker result.
- Add tests for create/reserved account, claimed-email immutability, state
  transitions, blockers, and authorization.

### Phase 2 — Backend read model and lifecycle APIs

- Build bounded teacher workspace queries.
- Split profile editing from lifecycle transitions.
- Add audit coverage and optional photo upload URL.

### Phase 3 — UI workspace

- Build searchable directory, responsive table/cards, detail sheet, create/edit
  dialog, and lifecycle confirmations.
- Add loading, empty, no-results, query-error, and mutation-error states.

### Phase 4 — Integration

- Add owner route/navigation metadata.
- Deep-link blockers to the Batches page and publication to Website CMS.
- Run Convex codegen only after shared integration changes are merged.

### Phase 5 — Verification

- Bangla-first visual checks at mobile, tablet, and desktop.
- Keyboard/focus, labels, avatar fallback, and overlay-title checks.
- Focused tests, full typecheck, full tests, lint, build, and authenticated E2E.

## Required tests

Backend:

- create teacher + reserved portal account atomically;
- duplicate code/email rejection;
- email update allowed only for reserved account;
- active/public invariant;
- deactivation blockers and successful suspension;
- reactivation behavior for suspended and reserved accounts;
- archive blockers and successful account revocation;
- correct course-default, batch, and workload projections;
- owner authorization and bounded pagination.

Frontend:

- empty state opens creation dialog;
- search/status/account/publication filtering;
- create validation and dirty-close warning;
- account-state explanation and claimed-email disabled state;
- detail sheet workload and assignment links;
- blocker dialog deep links;
- deactivate/reactivate/archive flows;
- Bangla and English labels;
- table-to-mobile-card behavior, keyboard navigation, and accessible titles.

## Acceptance criteria

- `/owner/teachers` lists all teachers with distinct teacher, portal, and
  website states.
- An owner can create a teacher and reserve portal access atomically.
- The page accurately shows course subjects, active batches, and weekly workload
  without inventing a global teacher-subject relationship.
- Profile edits respect claimed-account email immutability.
- Deactivation and archival cannot strand active assignments or schedules.
- Blockers name affected batches and provide a resolving action.
- Archived teachers are private, revoked, and read-only.
- The page is usable in Bangla and English at mobile and desktop widths.
- No N+1 subscriptions, unbounded Convex reads, or teacher financial data are
  introduced.
