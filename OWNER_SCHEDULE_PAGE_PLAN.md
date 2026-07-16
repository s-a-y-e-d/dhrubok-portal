# Owner Schedule Page Implementation Plan

## Status

Implementation-ready plan for a dedicated `/owner/schedule` operations calendar.
It complements Courses, Batches, and Teachers without editing the permanent
course structure or a batch's repeating weekly routine.

## Frozen product decisions

- The page manages individual `classSessions`, not `batchSchedules`.
- The calendar week runs Saturday through Friday in `Asia/Dhaka`.
- Weekly batch routines materialize a rolling eight weeks of occurrences.
- Week is the default desktop view; List is the compact and mobile-friendly view.
- The fallback visible time range is 07:00–22:00. Weeks with classes outside that
  range expand to the nearest surrounding hour.
- Rescheduling changes only the selected class's date, start time, and end time.
  Batch, teacher, subject, and every other occurrence remain unchanged.
- Owners may reschedule or create an extra class on any future date, including
  dates beyond the automatic eight-week window.
- Only future `scheduled` classes can be rescheduled or cancelled. `open`,
  `submitted`, and past classes are read-only.
- A cancellation reason is optional. Future cancelled classes remain visible by
  default and may be restored.
- A generated rescheduled class restores to its original generated date/time.
  An extra class has no restore-to-routine action, but it may be rescheduled or
  cancelled.
- Extra classes must use an active teacher assigned to the selected batch. The
  optional subject must match that teacher's active batch assignment.
- Teacher and batch time conflicts block rescheduling, restoration, and extra
  class creation. The UI uses a Shadcn Alert with the colliding class details.
- Opening attendance is explicit. On the class date, an owner may change a
  scheduled occurrence to `open`, snapshot the current eligible roster count,
  and continue to `/owner/attendance?session=...`.
- No SMS or other notification is sent for rescheduling or cancellation in this
  release.
- Bangla and English are included from the first implementation.
- Schedule appears in owner navigation immediately after Batches.
- Updating a batch routine reconciles untouched future generated occurrences.
  It preserves rescheduled, extra, cancelled, open, and submitted occurrences.

## Responsibility boundaries

| Surface    | Owns                                                                    | Does not own                         |
| ---------- | ----------------------------------------------------------------------- | ------------------------------------ |
| Courses    | Permanent course identity and teaching defaults                         | Batch routines and class occurrences |
| Batches    | Intake identity, assignments, and repeating weekly routine              | One-off occurrence changes           |
| Schedule   | Generated occurrences, extra classes, one-off reschedule/cancel/restore | Repeating routine edits              |
| Attendance | Opening rosters and immutable attendance submission                     | Calendar planning                    |

## Owner outcomes

An owner can:

1. Scan all classes in a Saturday–Friday week.
2. Switch between Week and List views and navigate to today or another week.
3. Filter by course, batch, teacher, subject, and status.
4. Open a class detail sheet with origin, schedule, status, and note metadata.
5. Reschedule one future class without changing the batch routine.
6. Add, reschedule, or cancel an extra class.
7. Cancel and restore a future generated occurrence.
8. See exact teacher or batch conflicts before submission.
9. Open today's class for attendance and continue to its roster.
10. Jump to the related Batch page.

## Data model

Extend `classSessions` with optional fields so existing documents remain valid:

- `occurrenceType`: `generated | extra`;
- `originalSessionDate`, `originalStartsAt`, `originalEndsAt` for generated
  occurrence restoration;
- `changeReason` for the latest reschedule/cancellation note;
- `cancelledAt`, `cancelledByAccountId`;
- `updatedAt`.

`scheduleId` remains the link to a batch routine. `isOneOffOverride` protects a
rescheduled occurrence from routine reconciliation. Extra classes have no
`scheduleId` and use a stable `extra:<sessionId>`-style key created at insert.

Add date-first indexes needed by the workspace and conflict checks. Keep all
new fields optional during this development migration; new writes always use the
new shape.

## Backend API

Create an owner Schedule workspace module with:

- `listWeek({ startDate, filters })` — bounded Saturday–Friday projection with
  batch, course, teacher, and subject labels;
- `getOptions()` — active courses, batches, teachers, subjects, and valid
  teacher-subject batch assignments;
- `getDetails({ sessionId })`;
- `previewConflict({ sessionId?, batchId, teacherId, startsAt, endsAt })`;
- `reschedule({ sessionId, sessionDate, startsAt, endsAt, reason? })`;
- `createExtra({ batchId, teacherId, subjectId?, sessionDate, startsAt, endsAt,
reason? })`;
- `cancel({ sessionId, reason? })`;
- `restore({ sessionId })`;
- `openAttendance({ sessionId })`.

All mutations require owner authorization, validate Dhaka-local date/time,
enforce lifecycle rules server-side, write audit events, and return structured
conflict errors.

## Occurrence materialization and reconciliation

- Expand the materializer horizon from 28 days to 56 days.
- New generated occurrences record their original date/time and generated type.
- Materialization remains idempotent by routine/date key.
- Routine reconciliation creates missing occurrences for the current routine.
- It cancels obsolete untouched future generated occurrences instead of deleting
  them, preserving auditability.
- It never modifies one-off overrides, extras, manually cancelled occurrences,
  open occurrences, submitted attendance, or past occurrences.
- Schedule creation, replacement, and cancellation enqueue reconciliation.

## Interface

### Header and controls

- Eyebrow: Academics / একাডেমিক
- Title: Schedule / সময়সূচি
- Primary action: Add extra class / অতিরিক্ত ক্লাস যোগ করুন
- Today, previous week, next week, and native date input controls
- Week/List Shadcn ToggleGroup
- Compact Shadcn Select filters for course, batch, teacher, subject, and status

### Week view

- Seven columns ordered Saturday–Friday.
- Vertical time grid derived from the week, with 07:00–22:00 fallback.
- Compact accessible class buttons positioned by time.
- Cards show time, batch, teacher, optional subject, and text status/origin badge.
- Overlaps render side-by-side without hiding either class.
- Cancelled cards remain visible in a muted treatment with a Cancelled badge.

### List view

- Date-grouped agenda using Shadcn Card/Separator/Badge composition.
- This is the default narrow-screen presentation and remains manually selectable
  on desktop.

### Detail sheet

- Batch/course, teacher, subject, time, origin, status, and optional reason.
- Actions are conditionally available from authoritative server state:
  Reschedule, Cancel, Restore original schedule, Open batch, Take attendance.

### Mutation dialogs

- Shadcn Dialog with FieldGroup/Field forms.
- Conflict errors use Shadcn Alert and identify the resource, class, and time.
- Reschedule copy explicitly states that only this occurrence changes.
- Cancellation uses AlertDialog-style confirmation but the reason remains
  optional.

## Responsive and accessibility requirements

- Week grid scrolls horizontally rather than compressing seven columns below
  useful width.
- Mobile defaults to List view and all controls meet the 44px touch target.
- Every class is a semantic button with an accessible label containing date,
  time, batch, teacher, and status.
- Status never relies on colour alone.
- Dialogs and sheets have titles/descriptions, restore focus, and expose field
  errors through `aria-invalid`.
- Bangla is tested before English for clipping and line height.

## Testing and acceptance criteria

### Convex tests

- Saturday–Friday range queries and filters;
- 56-day idempotent materialization;
- one-off reschedule preserves teacher/subject and original time;
- teacher and batch conflicts block writes with structured details;
- extra-class assignment validation;
- cancel/restore lifecycle rules;
- routine reconciliation preserves exceptions and attendance;
- attendance opening only on the class date with correct roster count;
- authorization and immutable submitted attendance.

### Browser acceptance

- Courses, Batches, Teachers, and Schedule routes all load through owner nav;
- Week/List switching, week navigation, filters, and detail sheet work;
- extra, reschedule, cancel, restore, conflict, and attendance handoff flows work;
- dark/light theme and Bangla/English remain readable;
- mobile list and horizontally scrolling week views remain usable;
- no console errors.

### Automated gate

- Convex codegen and local deployment;
- TypeScript;
- full Vitest suite;
- ESLint with zero new warnings;
- production build;
- `git diff --check`.
