<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Product Overview

Dhrubok Portal is a public website and role-based coaching-management system for
one coaching centre.

- Multiple owners administer the coaching centre with equal access. Students
  and teachers have their own Clerk-authenticated portals using Google as the
  normal sign-in method. A verified Google identity receives no portal access
  until its approved email is linked to a Dhrubok owner, teacher, or student
  record. Guardians do not have accounts; guardian name and phone number live on
  the student profile.
- The public website presents owner-managed coaching content and includes a
  public admission application. Applicants choose a preferred course and batch.
  Owners review the application, may change those choices, complete internal
  admission fields, and convert an accepted application into a student.
- The core workflows are student admission, course and batch enrolment, class
  routines, attendance, manual fee collection, due tracking, offline exam and
  result management, learning materials, notices, printable payment receipts,
  and guardian SMS notifications.
- Attendance is recorded once per batch class with exactly three states:
  present, late, and absent. Submitted attendance is immutable for owners and
  teachers. Submitting late or absent attendance automatically queues a guardian
  SMS.
- Payments are recorded manually; there is no payment gateway. The system sends
  an automatic guardian SMS after a payment is recorded. Monthly fees become due
  after the 15th by default, with a configurable due day. Due reminders are
  owner-initiated bulk messages.
- Exams happen offline and may cover multiple subjects with MCQ, CQ/written, or
  both. Teachers enter marks, owners publish results, and published result SMS
  messages include pass/fail and course-based merit position.
- SMS delivery uses SMS.BD behind a provider adapter. Payment, result, late, and
  absent messages are automatic; due reminders are owner initiated. Failed SMS
  delivery never rolls back the originating attendance, payment, or result.
- Students can view their routines, attendance, fees and dues, results, notices,
  and materials, and can update permitted profile fields. Teachers can work with
  assigned batches, record attendance, enter marks, publish materials, and send
  notices within their allowed scope.
- The interface, public content, SMS templates, receipts, and reports support
  both Bangla and English.

## Design and UI

Before designing, changing, or reviewing any user-facing UI, read
[`DESIGN.md`](DESIGN.md) in full and treat it as the project's design source of
truth. Follow its design tokens, typography, spacing, component patterns,
responsive rules, and do/don't guidance. Do not introduce new visual patterns
or arbitrary values when an applicable token or component is already defined.

When a new reusable UI pattern is genuinely needed, add or update its guidance
in `DESIGN.md` so future work remains consistent. Apply the design system to a
frictionless coaching-operations interface: prioritize rapid search, readable
data tables, clear financial states, large touch targets, and print-friendly
receipts and reports.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
