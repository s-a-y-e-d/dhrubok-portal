# Dhrubok Portal — Product and Implementation Plan

Status: authoritative execution plan

Prepared: 2026-07-11

Target: production-quality system for one coaching centre

Primary stack: Next.js 16, React 19, TypeScript, Convex, Clerk, Tailwind CSS 4

## 1. Purpose of this document

This document is the source of truth for turning the existing Dhrubok prototype into a complete product. It defines the product scope, user experiences, domain rules, data model, authorization boundaries, integrations, implementation sequence, testing strategy, deployment model, and delegation rules.

Implementation agents must not rediscover or redesign the product. When an ambiguity appears, preserve the rules in this document and ask the user only if the choice would materially alter data, permissions, money, messages, or published results.

The existing plan.md and product-structure.html are historical references. This file takes precedence when they conflict.

## 2. Locked product decisions

### 2.1 Product boundary

- The system serves one coaching centre. It is not a multi-tenant SaaS.
- The product contains a public coaching website and three authenticated portals: owner, teacher, and student.
- Multiple owners have equal authority.
- Teachers and students sign in through Clerk.
- Guardians do not have accounts. Their name, relationship, phone number, and preferred SMS language live on the student profile.
- Google is the normal Clerk sign-in method.
- Every student admission must contain the unique Google email that the student will use.
- A signed-in Google user receives no portal access until their verified email is linked to an approved Dhrubok account.
- Payments are collected manually. There is no payment gateway.
- The application supports English and Bangla UI, content, SMS templates, receipts, and reports.

### 2.2 Academic rules

- A course describes the academic offering.
- A batch is a scheduled delivery group for one course.
- A student may have multiple active batch enrolments.
- Teachers may be assigned to multiple batches.
- Students see only their own data.
- Teachers operate only within assigned batches and assigned exams.
- Owners control all courses, batches, enrolments, teachers, exams, finance, publishing, settings, and public content.

### 2.3 Attendance rules

- Attendance is taken once per batch class session.
- The only attendance values are present, late, and absent.
- A session is editable while attendance is being prepared.
- Final submission must include exactly one attendance value for every eligible student.
- After submission, attendance is permanently immutable for teachers and owners.
- There is no correction, reopen, edit, or delete workflow for submitted attendance.
- The UI must show a clear final review and irreversible confirmation before submission.
- Submission automatically queues an SMS to the guardian of every late or absent student.
- Present students receive no attendance SMS.
- SMS failure does not roll back or unlock attendance.

### 2.4 Financial rules

- Supported charge types include admission fee, monthly fee, course fee, exam fee, material fee, and custom charge.
- Fee plans may contain one-time and recurring items.
- Discounts may be fixed amounts or percentages.
- Partial payments and advance payments are supported.
- Monthly charges have a configurable due day. The coaching-wide default is the 15th.
- A charge due on the 15th becomes overdue on the 16th in Asia/Dhaka time.
- A posted payment automatically queues a guardian payment-confirmation SMS.
- Owners can send due reminders to selected or filtered overdue students.
- Posted payments are never silently edited or deleted. Corrections use an audited void/reversal workflow.
- Receipts are printable in Bangla or English.
- Money is stored as integer minor units, never floating-point currency.

### 2.5 Exam rules

- Exams happen offline; the product does not deliver online exams or question papers.
- An exam belongs to a course and may include students from one or more batches in that course.
- An exam may reference multiple subjects, but each student receives one combined result.
- Exam modes are MCQ, CQ/written, or both.
- For MCQ-only exams, an MCQ score is entered.
- For written-only exams, a written score is entered.
- For combined exams, MCQ and written scores are entered separately and summed by the backend.
- Each exam has full marks and pass marks. Combined component full marks must sum to total full marks.
- Passing is based on the combined total unless this rule is deliberately changed later.
- Teachers enter draft marks for assigned exams.
- Owners review and publish results.
- Merit position is calculated across the course population included in the exam, not independently per batch.
- Equal total scores receive the same competition rank: 1, 2, 2, 4.
- Published SMS messages include total marks, full marks, pass/fail, and course-based merit position.
- Draft or partially entered results never appear to students or guardians.

### 2.6 Messaging rules

- SMS.BD is the SMS provider.
- The integration must be hidden behind a provider adapter.
- Automatic messages: payment confirmation, late attendance, absent attendance, and published result.
- Owner-initiated messages: due reminders and custom/broadcast notices.
- Every automated event has an idempotency key so retries cannot duplicate messages.
- Provider failure never rolls back the originating business transaction.
- Message status, provider request ID, recipient, charge, attempt count, and final provider status are retained.
- Bangla message length and segment count must be previewed because Bangla SMS segments are shorter than Latin SMS segments.
- The coaching/brand name must be present in message templates to satisfy SMS.BD usage requirements.

## 3. Current repository baseline

The implementation starts from a functioning prototype:

- Next.js 16.2.10 App Router
- React 19.2.4
- TypeScript
- Tailwind CSS 4
- Convex 1.42.1
- Clerk Next.js 7.5.16
- Clerk issuer configuration exists in convex/auth.config.ts
- ConvexProviderWithClerk is already wired
- src/proxy.ts currently protects almost every route and must be redesigned so public routes remain public
- convex/schema.ts is empty
- dashboard, students, attendance, and payments pages are mock-data UI prototypes
- DESIGN.md exists and is mandatory
- Git is initialized
- npm run lint passes
- npm run build passes

Before every implementation wave, preserve this green baseline. Replace demo data progressively; do not perform a blind rewrite of the entire repository.

## 4. Product surfaces and route structure

Use locale-prefixed routes so public pages are indexable in both languages and portal navigation remains consistent.

    /                         redirect to preferred locale, default /bn
    /bn                      Bangla public homepage
    /en                      English public homepage
    /[locale]/courses
    /[locale]/courses/[slug]
    /[locale]/teachers
    /[locale]/notices
    /[locale]/notices/[slug]
    /[locale]/about
    /[locale]/contact
    /[locale]/admission
    /[locale]/admission/success
    /[locale]/sign-in
    /[locale]/access-pending

    /[locale]/owner
    /[locale]/owner/admissions
    /[locale]/owner/admissions/[applicationId]
    /[locale]/owner/students
    /[locale]/owner/students/[studentId]
    /[locale]/owner/teachers
    /[locale]/owner/courses
    /[locale]/owner/batches
    /[locale]/owner/batches/[batchId]
    /[locale]/owner/routine
    /[locale]/owner/attendance
    /[locale]/owner/attendance/[sessionId]
    /[locale]/owner/finance
    /[locale]/owner/finance/collect
    /[locale]/owner/finance/dues
    /[locale]/owner/finance/payments
    /[locale]/owner/finance/receipts/[paymentId]
    /[locale]/owner/exams
    /[locale]/owner/exams/[examId]
    /[locale]/owner/materials
    /[locale]/owner/notices
    /[locale]/owner/messages
    /[locale]/owner/reports
    /[locale]/owner/website
    /[locale]/owner/settings
    /[locale]/owner/settings/accounts
    /[locale]/owner/settings/sms
    /[locale]/owner/settings/audit

    /[locale]/teacher
    /[locale]/teacher/batches
    /[locale]/teacher/batches/[batchId]
    /[locale]/teacher/routine
    /[locale]/teacher/attendance
    /[locale]/teacher/attendance/[sessionId]
    /[locale]/teacher/exams
    /[locale]/teacher/exams/[examId]
    /[locale]/teacher/materials
    /[locale]/teacher/notices
    /[locale]/teacher/profile

    /[locale]/student
    /[locale]/student/routine
    /[locale]/student/attendance
    /[locale]/student/fees
    /[locale]/student/fees/receipts/[paymentId]
    /[locale]/student/results
    /[locale]/student/materials
    /[locale]/student/notices
    /[locale]/student/profile

Route groups may be used internally for layouts, but URLs must remain stable and understandable.

## 5. Role and capability matrix

| Capability | Owner | Teacher | Student | Public |
|---|---:|---:|---:|---:|
| Manage owners and access | Yes | No | No | No |
| Review admission applications | Yes | No | No | Submit only |
| Create and edit students | Yes | No | Limited profile request | No |
| Manage courses and batches | Yes | View assigned | View enrolled | View published |
| Manage enrolments | Yes | No | No | No |
| Manage teacher assignments | Yes | No | No | No |
| Create class sessions | Yes | Assigned batches | No | No |
| Submit attendance | Yes | Assigned batches | View own | No |
| Modify submitted attendance | Never | Never | Never | No |
| Manage fees and payments | Yes | No | View own | No |
| Print receipts | Yes | No | Own receipts | No |
| Create exams | Yes | No | No | No |
| Enter marks | Yes | Assigned exams | No | No |
| Publish results | Yes | No | View published | No |
| Publish materials | Yes | Assigned batches | View permitted | No |
| Send notices | Any audience | Assigned batches | Read | View public |
| Manage public website | Yes | No | No | Read |
| View audit log | Yes | No | No | No |

Authorization must be enforced in Convex functions. Route redirects and hidden controls are usability layers, not security boundaries.

## 6. Information architecture and frictionless UX

### 6.1 Shared principles

- Global search is available in authenticated portals.
- Search by student name, student ID, student email, student phone, guardian name, and guardian phone.
- The most common workflows must be reachable within two navigation actions.
- Tables retain filters and pagination when returning from a detail page.
- Forms use safe defaults, inline validation, keyboard navigation, and persistent save actions.
- A person enters their name once. An alternate Bangla or English spelling is optional; never make applicants duplicate the same name merely to satisfy bilingual UI.
- Destructive or irreversible actions use explicit confirmation containing the affected entity and consequence.
- Financial, attendance, and publication confirmations are visually stronger than ordinary save confirmations.
- All asynchronous actions show loading, success, retryable failure, and terminal failure states.
- Mobile touch targets are at least 44 by 44 CSS pixels.
- Desktop tables remain keyboard accessible and collapse into labelled cards or horizontal scroll on narrow screens.
- Public pages and portal pages use different layouts but the same tokens and typography system.
- Avoid decorative animation in operational flows.

### 6.2 Owner portal navigation

Primary navigation:

- Overview
- Admissions
- Students
- Academics
- Attendance
- Finance
- Exams
- Materials
- Notices and SMS
- Reports
- Website
- Settings

Permanent quick actions:

- Add student
- Collect payment
- Take attendance
- Create exam
- Send due reminders

### 6.3 Teacher portal navigation

- Overview
- My batches
- Routine
- Attendance
- Exams and marks
- Materials
- Notices
- Profile

Teachers never see finance navigation.

### 6.4 Student portal navigation

- Overview
- Routine
- Attendance
- Fees and receipts
- Results
- Materials
- Notices
- Profile

Student data is read-only except explicitly permitted profile fields or change requests.

## 7. Critical user workflows

### 7.1 Public admission to active student

1. Applicant opens the public admission page without signing in.
2. Applicant enters student details, guardian details, unique Google email, preferred course, and preferred batch.
3. The form verifies anti-spam challenge, validates phone/email, and displays a final review.
4. Submission creates an application with status new and a human-readable application number.
5. Guardian receives an application-received SMS only if that template is enabled.
6. Owner opens the application, checks for possible duplicate students, changes course/batch if needed, and fills internal fields.
7. Owner sets admission date, confirmed enrolment, fee plan, discounts, initial charges, student ID, and internal notes.
8. Owner presses Accept and admit.
9. One transactional Convex mutation creates the student, enrolment, initial charges, reserved portal account, and audit entry, then marks the application accepted.
10. The reserved portal account stores the normalized approved Google email but has no tokenIdentifier yet.
11. Student signs in with Google.
12. On the first authenticated request, a claim mutation matches the verified normalized email, ensures the reservation is unclaimed, and binds identity.tokenIdentifier.
13. Student is redirected to the student dashboard.
14. A signed-in email with no approved reservation is redirected to access-pending and receives no protected data.

The admission transaction must be idempotent. Repeating acceptance cannot create a second student.

### 7.2 Attendance

1. Owner creates routines; class sessions are generated or instantiated for a scheduled date.
2. Teacher opens an assigned session.
3. The roster contains students actively enrolled at the session time.
4. Teacher uses Mark all present, then changes individual students to late or absent.
5. The UI prevents submission while any student is unmarked.
6. Review shows present, late, and absent totals and lists all late/absent students.
7. Confirmation states that submission is permanent and messages will be sent.
8. One mutation validates authorization, roster completeness, uniqueness, and open session state.
9. The mutation writes records, sets the session to submitted, writes audit data, and schedules SMS jobs for late/absent students.
10. All subsequent mutation attempts fail with Attendance already submitted.

### 7.3 Manual payment

1. Owner searches and selects a student.
2. The collection screen shows overdue charges, upcoming charges, advance credit, and current balance.
3. Oldest outstanding charges are selected by default; owner can change allocations.
4. Owner enters amount, method, optional external reference, payment date, and note.
5. Backend validates that allocations do not exceed the payment or remaining charge balances.
6. Any surplus becomes advance credit.
7. Transaction creates payment, allocations, receipt number, updated financial summary, audit entry, and SMS outbox event.
8. Success screen provides Print receipt and View student actions and shows SMS queued status.
9. Receipt print layout is deterministic and works independently from portal navigation.

### 7.4 Monthly billing

1. A daily scheduled function calculates the current date in Asia/Dhaka.
2. On the first eligible run of a billing period, it finds active monthly enrolments in bounded batches.
3. It creates the month charge using an idempotency key based on enrolment, fee-plan item, and YYYY-MM.
4. Due date uses the fee-plan override or coaching default day 15.
5. Existing advance credit is allocated automatically according to oldest-due-first policy.
6. Dashboard and student balances update transactionally.
7. Re-running the job creates no duplicate charges.

### 7.5 Exam and result publication

1. Owner creates an exam for a course, selects participating batches and subjects, chooses mode, and defines component/full/pass marks.
2. Assigned teachers enter draft results in a spreadsheet-style grid.
3. Backend computes total; clients never submit a trusted total.
4. Teachers mark their entry ready for review.
5. Owner sees missing, invalid, and absent results and a merit preview.
6. Owner publishes only when all required rows are resolved.
7. Backend calculates pass/fail and competition rank across included course students.
8. Publication writes positions and publication version atomically and queues one result SMS per student.
9. Published results become visible in the student portal.
10. Any later correction requires an owner-controlled reopen and republish, increments the publication version, writes an audit event, and sends clearly labelled corrected-result SMS messages.

## 8. Data modeling standards

- Define every application table in convex/schema.ts.
- Use explicit validators for every field and every function argument/return.
- Use identity.tokenIdentifier as the canonical authenticated lookup key.
- Never accept userId or role from the client for authorization.
- Use separate child tables instead of unbounded arrays.
- Name indexes with all indexed fields in order.
- Use indexed queries; do not use query filter.
- Paginate or bound all user-facing lists.
- Store timestamps as UTC epoch milliseconds and render them in Asia/Dhaka.
- Store local calendar dates as YYYY-MM-DD strings where date identity matters.
- Store money as integer minor units.
- Store phone numbers in normalized E.164 format and a display form.
- Store normalized email separately from the display email.
- Store bilingual user-authored fields as explicit Bn and En properties when both are required.
- Add createdAt, updatedAt, createdByAccountId, and updatedByAccountId where provenance matters.
- Use status fields and archives instead of destructive deletion for business records.

## 9. Detailed Convex data structure

Field lists below are logical specifications. Implementation must use Convex Id types, validators, and the exact current guidance in convex/_generated/ai/guidelines.md.

### 9.1 Configuration, identity, and sequences

#### coachingSettings

Single active document.

Fields:

- nameBn, nameEn
- shortNameBn, shortNameEn
- addressBn, addressEn
- phone, email, websiteUrl
- timezone: Asia/Dhaka
- currency: BDT
- defaultLocale: bn or en
- defaultGuardianSmsLocale
- monthlyDueDay: integer 1–28, default 15
- logoStorageId, faviconStorageId
- receiptPrefix, studentIdPrefix, applicationPrefix
- receiptFooterBn, receiptFooterEn
- smsSenderId optional
- smsEnabled
- publicAdmissionsOpen
- activeAcademicSessionId
- createdAt, updatedAt, updatedByAccountId

Indexes:

- no list index required; enforce one active settings record through setup logic

#### portalAccounts

Links Clerk identity to an application role and domain record.

Fields:

- role: owner, teacher, student
- status: reserved, active, suspended, revoked
- tokenIdentifier optional until first Google sign-in
- loginEmail
- normalizedLoginEmail
- ownerProfileId optional
- teacherId optional
- studentId optional
- locale
- lastSignedInAt optional
- claimedAt optional
- createdAt, updatedAt
- createdByAccountId optional for initial bootstrap

Indexes:

- by_tokenIdentifier
- by_normalizedLoginEmail
- by_role_and_status
- by_studentId
- by_teacherId

Constraints:

- Exactly one linked domain identity must match the role.
- normalizedLoginEmail is unique among active/reserved accounts.
- tokenIdentifier is unique when present.
- Public sign-in never creates a role automatically.

#### ownerProfiles

Fields:

- displayName
- email
- phone optional
- avatarStorageId optional
- status: active, disabled
- createdAt, updatedAt

Indexes:

- by_status

#### numberSequences

Atomic counters for human-readable identifiers.

Fields:

- key: student, application, receipt, payment, exam
- prefix
- nextValue
- yearScope optional
- updatedAt

Indexes:

- by_key
- by_key_and_yearScope

### 9.2 Academic structure

#### academicSessions

Fields:

- nameBn, nameEn
- startDate, endDate
- status: planned, active, completed, archived
- createdAt, updatedAt

Indexes:

- by_status
- by_startDate

#### subjects

Fields:

- code
- nameBn, nameEn
- status: active, archived
- createdAt, updatedAt

Indexes:

- by_code
- by_status

#### courses

Fields:

- academicSessionId
- code
- slug
- nameBn, nameEn
- shortDescriptionBn, shortDescriptionEn
- descriptionBn, descriptionEn
- status: draft, active, completed, archived
- isPublic
- publicSortOrder
- coverStorageId optional
- createdAt, updatedAt, createdByAccountId, updatedByAccountId

Indexes:

- by_academicSessionId_and_status
- by_slug
- by_isPublic_and_publicSortOrder
- by_code

#### courseSubjects

Join table.

Fields:

- courseId
- subjectId
- sortOrder
- createdAt

Indexes:

- by_courseId_and_sortOrder
- by_subjectId
- by_courseId_and_subjectId

#### teachers

Fields:

- employeeCode
- displayName
- nameBn optional, nameEn optional
- loginEmail
- normalizedLoginEmail
- phone
- bioBn, bioEn
- qualificationsBn, qualificationsEn
- photoStorageId optional
- status: active, inactive, archived
- isPublic
- publicSortOrder
- joinedAt optional
- createdAt, updatedAt

Indexes:

- by_employeeCode
- by_normalizedLoginEmail
- by_status
- by_isPublic_and_publicSortOrder

#### batches

Fields:

- academicSessionId
- courseId
- code
- slug
- nameBn, nameEn
- roomBn, roomEn optional
- startDate, endDate optional
- capacity optional
- status: planned, active, completed, archived
- admissionOpen
- isPublic
- publicSortOrder
- createdAt, updatedAt

Indexes:

- by_courseId_and_status
- by_academicSessionId_and_status
- by_slug
- by_isPublic_and_publicSortOrder
- by_code

#### teacherBatchAssignments

Fields:

- teacherId
- batchId
- subjectId optional
- startsOn
- endsOn optional
- status: active, ended
- createdAt, createdByAccountId

Indexes:

- by_teacherId_and_status
- by_batchId_and_status
- by_teacherId_and_batchId

#### batchSchedules

Recurring routine definitions.

Fields:

- batchId
- teacherId
- subjectId optional
- weekday: 0–6 using a documented convention
- startMinutes: minutes after midnight Asia/Dhaka
- endMinutes
- roomBn, roomEn optional
- effectiveFrom
- effectiveUntil optional
- status: active, cancelled
- createdAt, updatedAt

Indexes:

- by_batchId_and_status
- by_teacherId_and_status
- by_weekday_and_status

### 9.3 Admissions, students, and enrolments

#### admissionApplications

Fields:

- applicationNumber
- submittedAt
- locale
- studentDisplayName
- studentNameBn optional, studentNameEn optional
- studentEmail, normalizedStudentEmail
- studentPhone optional
- dateOfBirth optional
- gender optional
- schoolCollege
- currentClass
- address optional
- guardianName
- guardianPhone
- normalizedGuardianPhone
- guardianRelationship
- alternateGuardianPhone optional
- preferredSmsLocale
- requestedCourseId
- requestedBatchId
- applicantNote optional
- photoStorageId optional
- status: new, under_review, accepted, rejected, withdrawn
- reviewedByAccountId optional
- reviewedAt optional
- rejectionReason optional
- acceptedStudentId optional
- conversionKey optional
- createdAt, updatedAt

Indexes:

- by_status_and_submittedAt
- by_applicationNumber
- by_normalizedStudentEmail
- by_normalizedGuardianPhone
- by_requestedCourseId_and_status

Constraints:

- conversionKey is written before or during acceptance and guarantees one conversion.
- Public queries expose only success/reference information, never the application list.

#### students

Fields:

- studentNumber
- rollNumber optional
- displayName
- nameBn optional, nameEn optional
- loginEmail
- normalizedLoginEmail
- phone optional
- dateOfBirth optional
- gender optional
- schoolCollege
- currentClass
- address optional
- photoStorageId optional
- guardianName
- guardianPhone
- normalizedGuardianPhone
- guardianRelationship
- alternateGuardianPhone optional
- preferredSmsLocale
- admissionDate
- status: active, paused, completed, left, archived
- sourceApplicationId optional
- internalNote optional
- createdAt, updatedAt, createdByAccountId, updatedByAccountId

Indexes:

- by_studentNumber
- by_normalizedLoginEmail
- by_normalizedGuardianPhone
- by_status_and_admissionDate
- search index for names/ID if supported by the chosen query design

#### enrolments

Fields:

- studentId
- courseId
- batchId
- academicSessionId
- enrolledOn
- endedOn optional
- status: active, completed, withdrawn, transferred
- feePlanId optional
- agreedMonthlyAmountMinor optional
- agreedCourseAmountMinor optional
- discountPolicyId optional
- createdAt, updatedAt, createdByAccountId

Indexes:

- by_studentId_and_status
- by_batchId_and_status
- by_courseId_and_status
- by_studentId_and_batchId
- by_feePlanId_and_status

Constraints:

- A student cannot have duplicate active enrolments in one batch.
- Ending an enrolment never deletes historical attendance, finance, or results.

#### studentProfileChangeRequests

Fields:

- studentId
- requestedByAccountId
- fieldKey
- oldValue
- requestedValue
- reason optional
- status: pending, approved, rejected
- reviewedByAccountId optional
- reviewedAt optional
- createdAt

Indexes:

- by_studentId_and_status
- by_status_and_createdAt

Directly editable student fields should be deliberately limited. Login email, guardian phone, official name, enrolments, and financial fields always require owner action.

### 9.4 Attendance

#### classSessions

Fields:

- batchId
- teacherId
- subjectId optional
- scheduleId optional
- sessionDate
- startsAt
- endsAt
- roomBn, roomEn optional
- topicBn, topicEn optional
- status: open, submitted, cancelled
- submittedAt optional
- submittedByAccountId optional
- rosterCount
- presentCount optional
- lateCount optional
- absentCount optional
- createdAt

Indexes:

- by_batchId_and_sessionDate
- by_teacherId_and_sessionDate
- by_status_and_sessionDate
- by_scheduleId_and_sessionDate

#### attendanceRecords

Fields:

- sessionId
- batchId
- studentId
- enrolmentId
- status: present, late, absent
- submittedAt
- submittedByAccountId

Indexes:

- by_sessionId
- by_sessionId_and_studentId
- by_studentId_and_submittedAt
- by_batchId_and_submittedAt
- by_studentId_and_status

Constraints:

- Unique sessionId plus studentId.
- No public update/delete function exists.
- Every record belongs to a submitted session.

### 9.5 Fees, billing, payments, and receipts

#### feePlans

Fields:

- courseId optional
- batchId optional
- nameBn, nameEn
- status: active, archived
- defaultDueDay optional
- createdAt, updatedAt

Indexes:

- by_courseId_and_status
- by_batchId_and_status
- by_status

#### feePlanItems

Fields:

- feePlanId
- chargeType: admission, monthly, course, exam, material, custom
- labelBn, labelEn
- amountMinor
- recurrence: once, monthly
- dueDay optional
- sortOrder
- status: active, archived
- createdAt, updatedAt

Indexes:

- by_feePlanId_and_status
- by_feePlanId_and_sortOrder

#### discountPolicies

Fields:

- studentId optional
- enrolmentId optional
- feePlanItemId optional
- kind: fixed, percentage
- valueMinor optional
- percentageBasisPoints optional
- reason
- startsOn
- endsOn optional
- status: active, ended
- approvedByAccountId
- createdAt

Indexes:

- by_studentId_and_status
- by_enrolmentId_and_status
- by_feePlanItemId_and_status

#### studentCharges

Fields:

- chargeNumber
- studentId
- enrolmentId optional
- feePlanItemId optional
- type
- periodKey optional, for example 2026-07
- descriptionBn, descriptionEn
- originalAmountMinor
- discountAmountMinor
- netAmountMinor
- paidAmountMinor
- dueDate
- status: upcoming, due, partially_paid, paid, waived, voided
- generationKey
- createdAt, createdByAccountId optional
- voidedAt optional
- voidedByAccountId optional
- voidReason optional

Indexes:

- by_studentId_and_dueDate
- by_studentId_and_status
- by_enrolmentId_and_periodKey
- by_status_and_dueDate
- by_generationKey

Constraints:

- generationKey is unique and provides recurring-billing idempotency.
- netAmountMinor equals original minus resolved discount.
- paidAmountMinor is maintained only through allocation mutations.

#### payments

Fields:

- paymentNumber
- receiptNumber
- studentId
- amountMinor
- allocatedAmountMinor
- advanceAmountMinor
- method: cash, bkash, nagad, bank_transfer, cheque, other
- externalReference optional
- paidAt
- note optional
- status: posted, voided
- collectedByAccountId
- createdAt
- voidedAt optional
- voidedByAccountId optional
- voidReason optional
- reversalOfPaymentId optional

Indexes:

- by_studentId_and_paidAt
- by_status_and_paidAt
- by_receiptNumber
- by_paymentNumber
- by_method_and_paidAt

#### paymentAllocations

Fields:

- paymentId
- chargeId
- studentId
- amountMinor
- chargeDescriptionBnSnapshot
- chargeDescriptionEnSnapshot
- createdAt
- reversedAt optional

Indexes:

- by_paymentId
- by_chargeId
- by_studentId_and_createdAt

#### studentFinancialSummaries

One document per student for efficient dashboard/profile reads.

Fields:

- studentId
- totalChargedMinor
- totalDiscountMinor
- totalPaidMinor
- totalVoidedMinor
- outstandingMinor
- advanceCreditMinor
- overdueMinor
- lastPaymentAt optional
- updatedAt

Indexes:

- by_studentId
- by_outstandingMinor
- by_overdueMinor

All finance mutations update source records and the summary within the same transaction. Add reconciliation tests and an owner-only reconciliation query to detect drift.

### 9.6 Exams and results

#### exams

Fields:

- examNumber
- courseId
- nameBn, nameEn
- examDate
- mode: mcq, written, both
- mcqFullMarksScaled optional
- writtenFullMarksScaled optional
- totalFullMarksScaled
- passMarksScaled
- status: draft, marks_entry, ready_for_review, published, reopened, archived
- publicationVersion
- publishedAt optional
- publishedByAccountId optional
- createdAt, updatedAt, createdByAccountId

Marks may be stored as scaled integers, such as hundredths, if fractional marks are needed. Use one documented scale consistently.

Indexes:

- by_courseId_and_examDate
- by_status_and_examDate
- by_courseId_and_status

#### examSubjects

Metadata only; marks are not split by subject.

Fields:

- examId
- subjectId
- sortOrder

Indexes:

- by_examId_and_sortOrder
- by_examId_and_subjectId

#### examBatches

Fields:

- examId
- batchId

Indexes:

- by_examId
- by_batchId
- by_examId_and_batchId

#### examTeacherAssignments

Fields:

- examId
- teacherId
- batchId optional
- createdAt

Indexes:

- by_examId
- by_teacherId
- by_examId_and_teacherId

#### examResults

Fields:

- examId
- courseId
- studentId
- enrolmentId
- participation: present, absent
- mcqScoreScaled optional
- writtenScoreScaled optional
- totalScoreScaled optional
- passed optional
- meritPosition optional
- teacherCommentBn optional
- teacherCommentEn optional
- entryStatus: missing, draft, ready, published
- enteredByAccountId optional
- enteredAt optional
- publicationVersion optional
- publishedAt optional
- updatedAt

Indexes:

- by_examId_and_studentId
- by_examId_and_entryStatus
- by_courseId_and_studentId
- by_studentId_and_publishedAt
- by_examId_and_totalScoreScaled

Constraints:

- Backend computes total and pass/fail.
- Scores cannot exceed component full marks or be negative.
- Merit is written only during owner publication.

### 9.7 Materials, notices, and messaging

#### materials

Fields:

- courseId
- batchId optional
- subjectId optional
- titleBn, titleEn
- descriptionBn, descriptionEn
- kind: file, link, text
- storageId optional
- externalUrl optional
- visibility: course, batch
- status: draft, published, archived
- publishedAt optional
- createdByAccountId
- createdAt, updatedAt

Indexes:

- by_courseId_and_status
- by_batchId_and_status
- by_createdByAccountId_and_status
- by_publishedAt

#### notices

Fields:

- titleBn, titleEn
- bodyBn, bodyEn
- audienceType: public, all_students, course, batch, individual_students
- courseId optional
- batchId optional
- status: draft, published, archived
- sendSms
- publishedAt optional
- createdByAccountId
- createdAt, updatedAt

Indexes:

- by_audienceType_and_status
- by_courseId_and_status
- by_batchId_and_status
- by_status_and_publishedAt

#### noticeRecipients

Used for individual audiences and for frozen delivery/read scope when needed.

Fields:

- noticeId
- studentId
- readAt optional

Indexes:

- by_noticeId
- by_studentId_and_readAt
- by_noticeId_and_studentId

#### smsMessages

Durable outbox and provider-delivery record.

Fields:

- idempotencyKey
- eventType: admission_received, payment_posted, attendance_late, attendance_absent, result_published, result_corrected, due_reminder, custom_notice
- relatedEntityType
- relatedEntityId
- studentId optional
- guardianPhone
- normalizedRecipient
- locale
- body
- segmentEstimate
- status: queued, sending, accepted, sent, delivered, failed, cancelled
- provider: sms_bd
- providerRequestId optional
- providerStatus optional
- providerChargeMinor optional
- attemptCount
- nextAttemptAt optional
- lastAttemptAt optional
- lastErrorCode optional
- lastErrorMessage optional
- createdAt, updatedAt, sentAt optional, deliveredAt optional

Indexes:

- by_idempotencyKey
- by_status_and_nextAttemptAt
- by_studentId_and_createdAt
- by_providerRequestId
- by_eventType_and_createdAt

#### smsTemplates

Fields:

- key
- name
- bodyBn
- bodyEn
- enabled
- variables
- updatedAt, updatedByAccountId

The variables list is bounded configuration, not delivery history.

Indexes:

- by_key
- by_enabled

#### smsProviderSnapshots

Fields:

- checkedAt
- balanceMinor optional
- providerStatus
- error optional

Indexes:

- by_checkedAt

### 9.8 Public website and audit

#### siteContentBlocks

Use fixed, typed content slots instead of an arbitrary page builder.

Fields:

- key: hero, about_summary, contact, achievement_intro, admission_intro, footer
- titleBn, titleEn
- bodyBn, bodyEn
- primaryCtaLabelBn optional
- primaryCtaLabelEn optional
- primaryCtaHref optional
- mediaStorageId optional
- draftRevision
- publishedRevision
- status: draft, published
- updatedAt, updatedByAccountId

Indexes:

- by_key
- by_status

#### galleryItems

Fields:

- titleBn, titleEn
- imageStorageId
- altBn, altEn
- sortOrder
- status: draft, published, archived
- createdAt, updatedAt

Indexes:

- by_status_and_sortOrder

#### auditLogs

Append-only.

Fields:

- actorAccountId optional for system tasks
- actorRole optional
- action
- entityType
- entityId
- summary
- metadata with a small bounded object containing non-sensitive identifiers
- occurredAt

Indexes:

- by_entityType_and_entityId
- by_actorAccountId_and_occurredAt
- by_action_and_occurredAt
- by_occurredAt

Never store API keys, full SMS provider responses containing secrets, or unnecessary student PII in audit metadata.

#### dailyOperationalSummaries

Fields:

- date
- activeStudentCount
- activeBatchCount
- scheduledSessionCount
- submittedSessionCount
- presentCount
- lateCount
- absentCount
- paymentsCount
- collectedMinor
- overdueStudentsCount
- overdueMinor
- updatedAt

Indexes:

- by_date

Use mutation-maintained summaries for dashboard totals instead of repeated whole-table counting.

## 10. Authentication and authorization architecture

### 10.1 Clerk configuration

- Enable Google as the normal sign-in method.
- Disable unrestricted application access at the Dhrubok authorization layer.
- Configure development and production Clerk instances separately.
- Configure Clerk's Convex integration and CLERK_JWT_ISSUER_DOMAIN for each Convex deployment.
- ClerkProvider must wrap ConvexProviderWithClerk.
- Use useConvexAuth for UI readiness where Convex authentication state matters.
- Public website and admission routes remain accessible without Clerk.

### 10.2 Account claiming

- Owner creates owner/teacher reservations or acceptance creates student reservation.
- Reservation includes normalized approved Google email and role.
- On authenticated entry, call ensureCurrentPortalAccount.
- Read identity from ctx.auth.getUserIdentity.
- Match tokenIdentifier first.
- If no token match, match one unclaimed reservation by normalized verified email.
- Atomically claim it by writing tokenIdentifier and active status.
- If no reservation exists, return access_pending without exposing whether another user exists.
- Never auto-promote a signed-in user.
- Suspending portal access preserves the underlying teacher/student record.
- Google is the only normal sign-in method in the first release; do not build a password fallback.
- If a student loses access to their Google account, an owner verifies the student offline, unlinks/suspends the old portal identity, records the new approved Google email, and creates a new reserved claim. This recovery is audited.

### 10.3 Backend authorization helpers

Create shared helpers:

- requireIdentity(ctx)
- requireAccount(ctx)
- requireOwner(ctx)
- requireTeacher(ctx)
- requireStudent(ctx)
- requireOwnerOrAssignedTeacher(ctx, batchId)
- requireTeacherExamAssignment(ctx, examId)
- requireStudentOwnsRecord(ctx, studentId)
- requireStudentEnrolledInBatch(ctx, batchId)
- requireOwnerForFinancialMutation(ctx)

Each helper returns a typed account/domain context and throws clear Not authenticated or Unauthorized errors. Never duplicate ad hoc role logic across modules.

### 10.4 Proxy and route handling

src/proxy.ts should perform only optimistic routing:

- Allow public localized pages, admission submission endpoints, Clerk callbacks, static assets, and health endpoints.
- Require authentication for owner, teacher, and student route groups.
- Redirect authenticated users away from the generic sign-in page to a role-resolution entry route.
- Do not rely on proxy for data authorization.

## 11. Convex backend organization

Recommended structure:

    convex/
      auth.config.ts
      schema.ts
      crons.ts
      model/
        auth.ts
        authorization.ts
        dates.ts
        money.ts
        identifiers.ts
        pagination.ts
        audit.ts
      accounts/
      settings/
      academics/
      admissions/
      students/
      attendance/
      finance/
      exams/
      materials/
      notices/
      messaging/
      publicSite/
      reports/
      integrations/
        smsBd.ts
        turnstile.ts
      tests/

Rules:

- Public functions are thin validated entry points.
- Sensitive reusable work uses internalQuery, internalMutation, and internalAction.
- Shared transactional logic stays in plain typed helper functions where possible.
- Actions do not use ctx.db.
- External API calls live in actions; actions call a minimal number of internal queries/mutations.
- Use ctx.scheduler.runAfter for outbox processing and bounded continuation.
- All public functions have argument and return validators.
- Generate and use api/internal references; never fabricate function references.

## 12. Mandatory Convex AI workflow

Every agent that reads or changes Convex code must do all of the following:

1. Read convex/_generated/ai/guidelines.md in full before editing.
2. Run npx convex ai-files status at the beginning of a major Convex wave.
3. If the managed guidance is stale, run npx convex ai-files update and review the resulting managed changes before continuing.
4. Never hand-edit files under convex/_generated except through Convex tooling.
5. Follow the guidance on validators, indexes, bounded queries, action/runtime separation, authentication, storage, testing, and scheduling.
6. Run npm run convex:codegen or npx convex codegen after schema or public API changes.
7. Run npx tsc --noEmit after codegen.
8. Add convex-test coverage for authorization and every critical state transition.

When appropriate, use the repository's focused Convex skills:

- convex-setup-auth for Clerk identity mapping and protected functions
- convex-migration-helper when a live schema requires widening/backfill/narrowing
- convex-performance-audit before production launch

## 13. Frontend architecture

Recommended source layout:

    src/
      app/
        [locale]/
          (public)/
          (auth)/
          owner/
          teacher/
          student/
        api/
        health/
      components/
        ui/
        public/
        owner/
        teacher/
        student/
        forms/
        tables/
        print/
      features/
        admissions/
        students/
        academics/
        attendance/
        finance/
        exams/
        materials/
        notices/
        website/
      lib/
        auth/
        i18n/
        formatting/
        validation/
        accessibility/
      messages/
        bn.json
        en.json

Frontend rules:

- Prefer Server Components for public/static composition.
- Use Client Components where Convex subscriptions, forms, or browser APIs are required.
- Treat every mutation call as untrusted and render server/backend validation errors clearly.
- Keep domain state in Convex; do not introduce a second global state store without a demonstrated need.
- Use URL search parameters for shareable filters and pagination.
- Build reusable table, status, empty-state, error-state, confirmation, and print patterns.
- Replace broken text-symbol icons in the prototype with an accessible icon library such as lucide-react.
- Avoid generic any types and duplicate domain interfaces; use generated Convex types and explicit view models.

## 14. Design system adaptation

DESIGN.md remains mandatory, but it currently describes a marketing-heavy MiniMax reference and lacks coaching-specific operational patterns.

Before delegating production UI:

1. Read DESIGN.md in full.
2. Preserve its core identity: DM Sans, black primary CTAs, white canvas, flat bordered surfaces, pill buttons, consistent spacing, and restrained brand colors.
3. Add documented operational components:
   - app shell and role-aware sidebar
   - dense responsive data table
   - mobile record card
   - monetary amount and due-state treatments
   - three-state attendance control
   - irreversible confirmation dialog
   - spreadsheet-style marks grid
   - toast and inline async status
   - file/material card
   - print receipt and report layout
   - bilingual field group
4. Add semantic tokens for warning, danger, info, overdue, late, absent, and disabled states with accessible contrast.
5. Add a Bengali typography exception using Noto Sans Bengali for Bengali glyphs while retaining DM Sans for Latin text.
6. Define focus-visible, pressed, disabled, selected, error, success, and loading states.
7. Keep public marketing pages spacious and portal pages operationally dense.
8. Do not add dark mode in the initial release; DESIGN.md currently has no authoritative dark palette.
9. Run npx @google/design.md lint DESIGN.md after modifying it.

## 15. Internationalization

- Support bn and en.
- Default to bn unless a persisted user preference or browser preference selects en.
- Use locale-prefixed public and portal URLs.
- Store interface translations in dictionaries.
- Store public content, course names, batch names, notices, materials, receipts, and SMS template text in explicit Bangla/English fields.
- Store a preferred locale on portal accounts and a preferred SMS locale on students.
- Formatting helpers must cover:
  - BDT currency
  - English and Bangla numerals where selected
  - Asia/Dhaka date and time
  - phone display
  - marks and percentages
- Do not machine-translate operational records at render time.
- If one translation is temporarily missing, fall back to the available language while visibly flagging missing CMS translations to owners.
- Print routes accept a locale parameter so owners and students can print the intended language.

## 16. SMS.BD integration

### 16.1 Provider adapter

Define a provider-neutral interface:

- sendMessage(recipient, body, senderId)
- getRequestReport(providerRequestId)
- getBalance()
- normalizeProviderError(response)

SMS.BD implementation:

- POST to https://api.sms.net.bd/sendsms
- Authenticate with API key stored only in Convex environment variables
- Normalize recipient to 8801XXXXXXXXX
- Persist returned request_id
- Poll https://api.sms.net.bd/report/request/{id}/ for final provider status and charge
- Poll balance periodically and expose low-balance warnings to owners

Never expose the SMS.BD API key to Next.js, the browser, logs, audit metadata, or public error messages.

### 16.2 Durable outbox

1. Business mutation writes or schedules an idempotent SMS event only after domain data is valid.
2. Internal mutation creates smsMessages row if idempotencyKey does not exist.
3. Scheduler runs the send action.
4. Action marks sending through internal mutation, calls provider, then stores accepted/failed result.
5. Retry transient errors with bounded exponential backoff.
6. Do not retry permanent failures such as invalid number or blocked content without owner intervention.
7. A report polling job updates sent/delivered/failed and charge.
8. Owner messages screen supports filtering, retrying eligible failures, and seeing low balance.

Suggested idempotency keys:

- payment:{paymentId}:confirmation
- attendance:{sessionId}:{studentId}:{status}
- exam:{examId}:v{publicationVersion}:{studentId}
- due:{campaignId}:{studentId}

### 16.3 Template requirements

Templates:

- admission received
- admission accepted
- payment confirmation
- attendance late
- attendance absent
- result published
- result corrected
- due reminder
- custom notice

Preview must show:

- recipient count
- rendered example
- character count
- estimated segment count
- missing variables
- students without valid guardian numbers

## 17. Public website and CMS

### 17.1 Public pages

Homepage:

- bilingual hero
- Apply for admission primary CTA
- active public courses
- open batches
- featured teachers
- achievements/content blocks
- current public notices
- contact and map information

Courses:

- searchable/listed public courses
- course detail with subjects, active/open batches, schedule summary, and admission CTA

Teachers:

- public teacher cards using only explicitly published fields

Notices:

- public notice list and detail

About/contact:

- owner-managed bilingual fixed sections

Admission:

- validated public form
- course and batch choice
- Google email requirement explanation
- privacy/consent acknowledgement
- anti-spam protection
- success reference

### 17.2 CMS boundaries

Do not build an arbitrary drag-and-drop site builder. Owners manage fixed typed sections, public course/teacher flags, notices, and gallery items.

Every CMS editor includes:

- Bangla and English tabs
- draft save
- preview
- publish
- last editor and timestamp
- media upload validation
- accessible alt text in both languages

Public pages render only published data.

### 17.3 Public form protection

- Add a honeypot field.
- Add Cloudflare Turnstile or an equivalent production anti-spam challenge.
- Verify the challenge server-side in a Convex action before an internal application mutation.
- Rate limit repeated submissions by normalized email/guardian phone and time window.
- Reject duplicate exact submissions idempotently.
- Do not reveal whether an email already belongs to a student.

## 18. Materials and file storage

- Use Convex file storage.
- Generate upload URLs only for authorized owners/teachers.
- Validate file type, size, filename, and scope before persisting material metadata.
- Suggested initial allowed types: PDF, common images, DOCX, PPTX, XLSX.
- Set explicit maximum file size in settings/code and show it before upload.
- Store files separately from metadata.
- Enrolled students receive signed URLs only after authorization checks.
- Public media and private learning materials use different query paths.
- Archiving material removes it from student lists but retains auditability.
- Deleting a stored blob requires a safe internal cleanup path after metadata is archived and no record references it.

## 19. Reporting and dashboard design

Owner dashboard:

- active students
- today's and current-month collections
- overdue total and student count
- today's sessions
- attendance pending
- results awaiting review
- SMS failures and provider balance
- new admission applications

Teacher dashboard:

- today's assigned sessions
- attendance pending
- assigned exams with mark-entry progress
- assigned batches
- recently published materials/notices

Student dashboard:

- next class
- current attendance percentage and latest status
- outstanding due/advance
- latest published result and merit
- unread notices
- recent materials

Reports:

- daily/monthly collection
- payment method breakdown
- dues and ageing
- discounts
- advances
- voided payments
- student statement
- batch roster
- daily/batch/student attendance
- late and absent history
- exam result sheet
- course merit list
- student result history
- SMS delivery and charges
- admissions funnel

All large reports must be paginated onscreen. CSV export jobs should be bounded and generated through authorized backend flows. Print views must exclude navigation and use stable page breaks.

## 20. Security, privacy, and integrity

- Enforce authentication and authorization at every Convex entry point.
- Public queries return only explicitly published fields.
- Never trust role, studentId, teacherId, totals, pass/fail, merit, due, or financial balance from the client.
- Validate Google email claims before account linking.
- Owners cannot remove or suspend the last active owner.
- Attendance submission is one-way and immutable.
- Financial edits use reversals and audit records.
- Published result corrections use versioned republishing and correction SMS.
- Sanitize or avoid arbitrary HTML in CMS/notices; prefer structured plain text or a restricted renderer.
- Validate and authorize every file access.
- Keep PII out of logs, analytics, URLs, and error trackers.
- Use environment variables for all secrets.
- Add strict security headers and a content security policy compatible with Clerk, Convex, and required media.
- Rate limit public admissions, sensitive retries, bulk SMS, and account-claim attempts.
- Add audit events for role/access changes, admission acceptance/rejection, enrolment changes, attendance submission, payment/void, discounts, exam publication/reopen, CMS publication, and SMS retries.
- Provide data export and archive procedures for operational recovery.

## 21. Technology stack

### Required existing technologies

- Next.js 16.2.10 App Router
- React 19.2.4
- TypeScript strict mode
- Tailwind CSS 4
- Convex 1.42.1
- Clerk Next.js 7.5.16 with Google
- ESLint 9

### Recommended additions

Runtime:

- next-intl for locale routing and dictionaries, after verifying compatibility with installed Next.js
- zod for shared form and boundary validation where Convex validators are not directly used
- react-hook-form and @hookform/resolvers for complex forms
- lucide-react for accessible consistent icons
- clsx and tailwind-merge only if the component composition needs them

Testing:

- vitest
- convex-test
- @edge-runtime/vm
- @testing-library/react
- @testing-library/user-event
- @playwright/test
- axe-core or @axe-core/playwright

Avoid adding a component framework that conflicts with DESIGN.md. Avoid Redux or another state library unless a concrete later need proves necessary.

### Printing

Use dedicated HTML print routes and CSS:

- print receipt
- student statement
- exam result sheet
- merit list
- attendance report

Do not introduce server-side PDF generation in the first implementation unless browser printing fails a concrete requirement.

## 22. Environment variables

Document all variables in .env.example without values.

Next.js/server:

- NEXT_PUBLIC_CONVEX_URL
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- CLERK_SECRET_KEY
- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_DEFAULT_LOCALE
- NEXT_PUBLIC_TURNSTILE_SITE_KEY
- TURNSTILE_SECRET_KEY where server verification is hosted
- NEXT_SERVER_ACTIONS_ENCRYPTION_KEY for self-hosted multi-instance safety

Convex:

- CLERK_JWT_ISSUER_DOMAIN
- SMS_BD_API_KEY
- SMS_BD_SENDER_ID optional
- SMS_LOW_BALANCE_MINOR
- TURNSTILE_SECRET_KEY if Convex verifies challenge
- APP_BASE_URL

Do not duplicate a secret between hosting layers unless that layer genuinely uses it.

## 23. Self-hosted production architecture

Recommended target:

- Next.js runs as a Docker standalone Node.js application on a VPS.
- Caddy or nginx terminates HTTPS and acts as reverse proxy.
- Convex remains managed for database, functions, schedules, realtime subscriptions, and file storage.
- Clerk remains managed for authentication.
- SMS.BD remains external provider.
- DNS points the production domain to the reverse proxy.

Deployment requirements:

- Set output: standalone in next.config.ts.
- Create multi-stage Dockerfile and .dockerignore.
- Add /api/health or equivalent health route that does not expose secrets.
- Run the container as non-root.
- Configure restart policy.
- Keep build-time NEXT_PUBLIC values separate from runtime server secrets.
- Configure production Clerk allowed origins, OAuth redirect URLs, and Convex issuer.
- Configure reverse-proxy request limits and disable buffering where App Router streaming requires it.
- Configure backups/exports according to current Convex capabilities before launch.
- Store deployment instructions and rollback steps in DEPLOYMENT.md.
- Use a staging domain/environment before production.

If the user later chooses Vercel, the application architecture remains the same; only the Next.js hosting and deployment steps change.

## 24. Observability and operations

- Structured server logs with event names and opaque entity IDs.
- Owner-visible SMS queue, failures, delivery status, cost, and balance.
- Health check for Next.js.
- Scheduled internal health record for monthly billing and SMS polling.
- Error tracking integration is recommended for production, configured to scrub PII.
- Track operational metrics:
  - admission conversion failures
  - account claim failures
  - attendance submission failures
  - SMS acceptance/delivery failure rates
  - billing job last success
  - result publication failures
  - financial reconciliation mismatches
- Add runbooks for:
  - SMS provider outage
  - low SMS balance
  - monthly billing rerun
  - payment void
  - incorrect published result
  - locked-out owner/student/teacher
  - failed deployment rollback

## 25. Implementation strategy

Build vertical slices on top of a stable foundation. A slice is complete only when its schema, authorization, backend functions, UI states, tests, and browser verification are complete.

Do not build all screens against mocks and postpone backend integration. Do not build all backend modules without exercising their real user flows.

### Step 0 — Repository and instruction alignment

Status: partially completed.

Tasks:

- Keep the updated AGENTS.md product overview.
- Mark this file as the authoritative plan in README.md.
- Review current uncommitted changes before implementation.
- Preserve the passing lint/build baseline.
- Add scripts for typecheck, test, test:e2e, and verify.
- Ensure .env.example documents names only.
- Remove mojibake from prototype source before reusing copy.
- Resolve the existing trailing whitespace in product-structure.html before making global git diff --check a required gate; do not make unrelated functional changes to that artifact.
- Decide a commit convention and commit after each completed vertical slice.

Acceptance:

- New contributor can identify source-of-truth instructions.
- npm run lint, npx tsc --noEmit, and npm run build pass.
- No secrets are committed.

### Step 1 — Framework and design foundation

Dependencies: Step 0.

Tasks:

- Read the relevant local Next.js 16 documentation before code changes:
  - App Router authentication
  - proxy
  - route handlers
  - internationalization
  - self-hosting
  - Server Actions if used
- Read DESIGN.md fully.
- Update DESIGN.md with operational components, Bengali typography, semantic states, responsive table/card rules, and print patterns.
- Establish locale routing and dictionaries.
- Create separate public, owner, teacher, and student layouts.
- Replace the prototype's broad auth protection with public/protected route classification.
- Build shared UI primitives and all standard states.
- Add accessible skip links, landmarks, focus styles, and responsive shell behavior.

Acceptance:

- Public homepage and sign-in are reachable unauthenticated.
- Protected routes redirect correctly.
- Each role has a shell with only its intended navigation.
- Bangla and English switching works without broken glyphs.
- DESIGN.md lint passes.
- No backend business data remains hard-coded into shared primitives.

### Step 2 — Testing harness and fixtures

May run alongside late Step 1 work if files do not overlap.

Tasks:

- Install Vitest, convex-test, edge runtime VM, Testing Library, Playwright, and accessibility tooling.
- Configure Convex module map correctly.
- Create test identity helpers for owner, teacher, student, and unauthenticated requests.
- Create deterministic fixtures for settings, courses, batches, teachers, students, enrolments, charges, sessions, exams, and SMS provider responses.
- Add smoke tests for existing routes and the green build.

Acceptance:

- npm test runs unit/integration tests.
- npm run test:e2e runs Playwright.
- Tests do not depend on production Clerk, Convex, or SMS credentials.

### Step 3 — Schema, domain primitives, and authorization

Dependencies: Steps 0–2 foundation.

Tasks:

- Read Convex AI guidance and run status.
- Implement schema in coherent groups.
- Add validators shared across domains.
- Add money, date, phone, email, identifier, pagination, and audit helpers.
- Implement portalAccounts and account claim flow.
- Implement requireOwner/Teacher/Student and scoped assignment/enrolment helpers.
- Seed coaching settings and first owner through a safe one-time bootstrap path.
- Add owner account management with last-owner protection.
- Generate Convex types.

Tests:

- Unauthenticated access rejected.
- Wrong role rejected.
- Teacher cannot access unassigned batch.
- Student cannot access another student.
- Verified approved email claims exactly one reserved account.
- Unapproved Google user receives access_pending.
- Duplicate claim and duplicate active email rejected.
- Last owner cannot disable themselves.

Acceptance:

- Authenticated Convex queries recognize Clerk sessions.
- Every later domain can import centralized typed authorization.
- Public functions expose no protected data.

### Step 4 — Academic core

Dependencies: Step 3.

Tasks:

- Academic sessions
- Subjects
- Courses and course-subject joins
- Teachers and reserved teacher accounts
- Batches
- Teacher-batch assignments
- Weekly schedules
- Owner CRUD with archive rules
- Teacher and student read models
- Public course/teacher projections

UI:

- Owner course list/detail/editor
- Owner batch list/detail/editor
- Owner teacher list/detail/editor
- Routine builder
- Teacher assigned-batches view
- Public course and teacher cards

Tests:

- Duplicate course/batch codes rejected.
- Archived records cannot receive new active assignments.
- Teacher sees only assigned batches.
- Public sees only isPublic plus active/published fields.

### Step 5 — Public website foundation and CMS

Dependencies: Steps 1, 3, and academic read models from Step 4.

Tasks:

- Fixed bilingual content blocks
- Gallery/media
- Draft/preview/publish
- Public homepage, courses, teachers, notices, about, and contact
- SEO metadata, sitemap, robots, canonical localized URLs, social preview
- Owner website-management screens
- File upload validation

Tests:

- Draft content is never public.
- Missing translation fallback is deterministic.
- Private teacher fields never enter public payloads.
- CMS publication is owner-only and audited.

### Step 6 — Admissions and student core

Dependencies: Steps 3–5.

Tasks:

- Public admission form
- Google email requirement
- Course/batch selectors from public/open records
- Turnstile/honeypot/rate limiting
- Application number generation
- Owner application inbox and review
- Duplicate-candidate warnings
- Acceptance transaction
- Student creation
- Multiple enrolments
- Initial fee-plan/charge creation hooks
- Reserved student portal account
- Rejection and withdrawal
- Student profile and owner profile editing
- Sensitive profile change-request flow

Tests:

- Invalid/closed batch rejected.
- Duplicate form replay returns same reference or safe duplicate response.
- Repeated acceptance creates one student only.
- Owner may change requested batch.
- Accepted student has exact intended enrolment and reserved Google email.
- Rejected application has no student.
- Student cannot change guardian phone/login email directly.

Browser acceptance:

- Complete application on phone viewport.
- Review and accept on owner desktop.
- Sign in with approved test Google identity and reach student portal.

### Step 7 — Attendance and automatic attendance SMS

Dependencies: Academic, enrolment, auth, and messaging primitives.

Backend:

- Session generation/creation
- Eligible roster query
- Final submit mutation
- Immutable attendance records
- Counts and summaries
- Late/absent outbox events
- Student/teacher/owner attendance views

UI:

- Today's sessions
- Three-state roster
- Mark all present
- late/absent toggles
- unmarked detection
- final irreversible review
- submitted read-only view
- student history

Tests:

- All roster students required exactly once.
- Duplicate student rejected.
- Unenrolled student rejected.
- Unassigned teacher rejected.
- Submitted session cannot be edited, reopened, or deleted by any role.
- Late and absent create one message each.
- Present creates no message.
- Retrying SMS cannot duplicate event.
- SMS failure leaves attendance submitted.

### Step 8 — SMS.BD integration

The provider adapter may be developed in parallel with Step 7 after smsMessages schema is frozen.

Tasks:

- SMS.BD send, report, and balance clients
- Response/error validators
- phone normalization
- template rendering
- segment estimation
- durable queue
- retry policy
- report polling
- balance polling and owner warning
- local fake provider for tests
- owner message history and retry screen
- template settings

Tests:

- API key never appears in client bundles or persisted messages.
- Accepted request ID stored.
- Report status and charge mapped.
- Invalid phone permanent failure.
- 5xx/timeout transient retry.
- insufficient balance visible and not endlessly retried.
- idempotency enforced.
- Bangla/English template variables validated.

Live verification:

- Use a designated test phone and explicit user approval before sending a real SMS.
- Confirm status through report endpoint.
- Do not bulk-test real recipients.

### Step 9 — Finance

Dependencies: Students, enrolments, auth, SMS outbox.

Backend:

- Fee plans and items
- discounts
- charge generation
- monthly billing
- custom charges
- payment collection
- oldest-due allocation
- partial payment
- advance credit
- payment void/reversal
- summaries and reconciliation
- receipt numbering
- due campaign selection
- payment and due SMS events

UI:

- Finance dashboard
- Student ledger
- Collection flow
- Allocation editor
- Discount flow
- Receipt print
- Payment history
- Due filters and bulk-reminder preview
- Void confirmation
- Student fee/receipt view

Tests:

- Money uses integers.
- Monthly generation is idempotent.
- Default due day 15 and override work.
- Partial payment balances correct.
- Advance credit applies correctly to future charges.
- Allocation cannot exceed payment or charge.
- Void exactly reverses allocations and summaries.
- Posted payment SMS is exactly once.
- Failed SMS does not roll back payment.
- Teacher cannot read finance.
- Student can read only own finance.
- Reconciliation result is zero after all supported operations.

### Step 10 — Exams and results

Dependencies: Courses, batches, teachers, students, SMS outbox.

Backend:

- Exams, subjects, batches, assignments
- MCQ/written/both validation
- candidate roster
- draft mark entry
- ready-for-review
- publication validation
- combined totals
- overall pass/fail
- competition ranking
- publication versioning
- result/correction SMS
- student result query

UI:

- Owner exam creation
- Teacher marks grid
- missing/invalid indicators
- owner review and merit preview
- publication confirmation with recipient count
- published result page
- correction/reopen workflow
- student results
- printable result and merit list

Tests:

- Component scores cannot exceed full marks.
- Combined total computed server-side.
- Pass mark boundary correct.
- Tie ranking is 1,2,2,4.
- Ranking spans selected batches in the course.
- Draft results hidden from students.
- Teacher cannot publish.
- Owner cannot publish incomplete unresolved roster.
- Publication sends merit in SMS.
- Republish increments version and sends correction, not duplicate original.

### Step 11 — Materials and notices

Dependencies: Auth, academic scopes, storage, i18n.

Tasks:

- Authorized upload lifecycle
- Course/batch-scoped materials
- Teacher direct publishing within assigned scope
- Owner moderation/archive
- Public and portal notices
- Teacher batch notices
- individual notice recipients
- read state
- optional notice SMS with explicit preview

Tests:

- Teacher cannot publish outside assignment.
- Student cannot access material outside enrolment.
- Archived material hidden.
- Public notice payload excludes private notices.
- Private storage URL requires authorization.

### Step 12 — Dashboards, reports, and exports

Dependencies: completed domain slices.

Tasks:

- Maintain operational summaries
- Real owner/teacher/student dashboard queries
- Paginated report queries
- Print routes
- CSV export
- empty/loading/error states
- filter persistence

Tests:

- No unbounded list query.
- Dashboard totals match source data.
- Role-scoped dashboards reveal no foreign data.
- CSV quoting, Unicode, and Bangla output correct.
- Print routes work at A4 and hide chrome.

### Step 13 — End-to-end hardening

Tasks:

- Remove all demo arrays and placeholder numbers.
- Resolve all TODOs/blockers.
- Full authorization audit.
- Convex performance audit.
- Accessibility audit.
- Responsive browser verification.
- Cross-locale verification.
- SMS failure/retry drills.
- Financial reconciliation.
- monthly billing rerun drill.
- backup/export and restore rehearsal.
- production security headers.
- dependency audit and lockfile review.
- load test realistic 100+ students, 50 batches, 15 teachers, and burst SMS queue.

Required checks:

    npx convex ai-files status
    npm run convex:codegen
    npx tsc --noEmit
    npm test
    npm run lint
    npm run build
    npm run test:e2e
    git diff --check

### Step 14 — Staging and production

Tasks:

- Create production Clerk instance and Google OAuth configuration.
- Create production Convex deployment and environment variables.
- Create SMS.BD production account/configuration and approved sender/content as required.
- Create staging and production Next.js configurations.
- Build Docker standalone image.
- Configure reverse proxy, HTTPS, domain, health checks, logs, and restart.
- Configure production CSP and allowed origins.
- Seed first owner and coaching settings.
- Run smoke tests in staging.
- Import existing data if later provided, using preview/validate/import/reconcile flow.
- Obtain user approval for production SMS test.
- Deploy production.
- Run production smoke tests without destructive sample data.
- Document rollback.

## 26. Parallel execution plan

Parallel work is encouraged only after contracts are frozen. The primary Codex agent remains responsible for architecture, integration, review, and verification.

### 26.1 Concurrency rules

- Maximum recommended active workers: primary plus three workers.
- Only the primary/schema owner edits convex/schema.ts, shared generated files, package.json, lockfile, route root layouts, DESIGN.md, and global CSS unless ownership is explicitly transferred.
- No two agents edit the same files concurrently.
- Workers must receive exact allowed paths, data contracts, acceptance criteria, and non-goals.
- A worker that discovers a schema need reports it to the primary instead of editing schema opportunistically.
- Generated Convex files are produced only at integration gates.
- Every worker reports changed files, checks run, and unresolved risks.
- Primary reviews complete diffs before accepting work.

### 26.2 Suggested waves

Foundation wave — mostly sequential:

- Primary: instructions, design rules, dependencies, locale routing, schema, auth, test harness.
- Read-only subagent: security/authorization checklist review.
- Read-only subagent: data-model/index review.

Academic/admission wave:

- Worker A: academic Convex functions in assigned domain files.
- Worker B: admission/student Convex functions and tests in assigned files.
- UI specialist: public/admission/owner student UI only after contracts are available.
- Primary: schema, auth integration, acceptance transaction, review.

Attendance/finance/SMS wave:

- Worker A: attendance domain and tests.
- Worker B: finance domain and tests.
- Worker C: SMS.BD adapter, fake provider, and tests.
- Primary: integration, transactional boundaries, idempotency review.

Exam/content wave:

- Worker A: exam/result/ranking domain and tests.
- Worker B: materials/notices/storage domain and tests.
- UI specialist: teacher/student flows against frozen APIs.
- Primary: publication/version/SMS integration and review.

Hardening wave:

- Worker A: authorization and security scan.
- Worker B: performance/index/query audit.
- Worker C: Playwright accessibility/responsive scenarios.
- Primary: fixes, live verification, deployment.

## 27. Delegated UI workflow

Use the delegated-ui-web-dev skill only for substantial screens or coherent multi-component flows. Codex remains accountable for the whole product.

Before each Antigravity delegation:

1. Finish routes, schema, generated types, query/mutation contracts, and fixtures for that surface.
2. Read DESIGN.md fully.
3. Run agy models and confirm Claude Opus 4.6 (Thinking).
4. Prepare one constrained brief with:
   - user goal and exact routes
   - allowed files/directories
   - existing components to reuse
   - exact data/actions
   - loading, empty, error, success, and permission states
   - responsive and accessibility requirements
   - bilingual and print requirements
   - instruction to read DESIGN.md in full
   - acceptance criteria
   - protected files and explicit non-goals
5. State that Antigravity is the UI implementer and Codex will inspect and finish the work.
6. Invoke Claude Opus 4.6 (Thinking) in accept-edits mode.
7. Wait for completion; do not start competing UI edits.
8. Use Gemini 3.5 Flash (High) exactly once only if Opus explicitly reports quota exhaustion.
9. Inspect changed-file list, git diff --check, full diff, and Antigravity report.
10. Codex corrects integration, accessibility, responsive, type, and behavior issues.
11. Run focused tests, full checks, and real browser verification before completion.

Invocation shape:

    agy models

    $prompt = @'
    <one implementation-ready UI brief following the requirements above>
    '@
    agy --model 'Claude Opus 4.6 (Thinking)' --mode accept-edits --dangerously-skip-permissions --print --print-timeout 20m --prompt $prompt

Quota-only fallback, using the identical brief:

    agy --model 'Gemini 3.5 Flash (High)' --mode accept-edits --dangerously-skip-permissions --print --print-timeout 20m --prompt $prompt

Never delegate:

- product decisions
- schema design
- Convex functions
- Clerk authorization
- SMS integration
- financial calculations
- merit calculation
- migrations
- environment/secrets
- deployment

Good delegation slices:

- public marketing and admission experience
- owner academic/admission management screens
- attendance workflow
- finance/receipt workflow
- exam marks/review workflow
- student and teacher portal surfaces

Do not ask Antigravity to edit backend, schema, auth, data contracts, dependencies, environment files, generated files, or unrelated code.

## 28. Test plan

### 28.1 Unit tests

- money formatting and arithmetic
- date/due-day calculations in Asia/Dhaka
- phone/email normalization
- SMS variable rendering and segment estimation
- exam totals, pass/fail, ties, ranking
- locale fallbacks
- permission predicate helpers

### 28.2 Convex integration tests

- every role/authorization boundary
- account reservation and claim
- application acceptance idempotency
- duplicate enrolment prevention
- attendance completeness and immutability
- monthly billing idempotency
- partial/advance/void accounting
- SMS outbox idempotency and retries
- result publication/versioning
- material visibility
- public projection privacy

### 28.3 Component tests

- forms and validation
- three-state attendance interactions
- irreversible confirmation
- payment allocation editor
- marks grid keyboard operation
- due reminder preview
- bilingual switching
- loading/empty/error states

### 28.4 End-to-end journeys

1. Public applicant submits admission.
2. Owner accepts, adjusts batch, creates fees.
3. Approved Google user signs in and reaches student portal.
4. Owner creates teacher; approved teacher signs in.
5. Teacher submits attendance with late and absent students.
6. SMS events are recorded once; submitted attendance is locked.
7. Owner records partial payment, prints receipt, and sees SMS status.
8. Monthly charge becomes overdue after configured day.
9. Owner sends filtered due reminders.
10. Owner creates combined MCQ/written exam.
11. Teacher enters marks; owner publishes.
12. Student sees total/pass/merit; result SMS event includes merit.
13. Teacher publishes material; only enrolled student sees it.
14. Owner publishes website content; draft is never public.

### 28.5 Accessibility and visual verification

Test at minimum:

- 375 by 812 mobile
- 768 by 1024 tablet
- 1280 by 800 desktop
- 1440 by 900 wide desktop

Verify:

- keyboard-only completion
- visible focus
- screen-reader labels and landmarks
- status not conveyed by color alone
- contrast
- zoom to 200 percent
- Bangla glyph rendering
- table/card responsive transformation
- A4 receipt/report print preview
- Clerk sign-in and role redirects

## 29. Definition of done

The product is complete only when:

- All routes in scope exist and use real Convex data.
- Public, owner, teacher, and student experiences are responsive and bilingual.
- Google sign-in and account linking work in development, staging, and production.
- Authorization is enforced in every Convex function.
- Public admission converts idempotently into a student.
- A student can belong to multiple batches.
- Attendance has present/late/absent, final review, permanent lock, and automatic late/absent SMS.
- Manual payments support all required fee types, discounts, partials, advances, voids, receipts, and automatic payment SMS.
- Monthly fees use configurable due day with default 15.
- Due reminders support safe filtered bulk sending.
- Exams support multiple subject metadata, one combined result, MCQ/written/both, pass marks, course merit, teacher entry, owner publication, and result SMS.
- Students can view routine, attendance, finance, results, notices, materials, and permitted profile information.
- Teachers can operate only in assigned scope.
- Owners can manage public content and publish bilingual pages.
- SMS.BD delivery status, retries, cost, and balance are observable.
- No demo data or dead navigation remains.
- Critical state transitions have automated tests.
- Lint, typecheck, tests, build, E2E, accessibility, and diff checks pass.
- Staging smoke tests pass.
- Backups/exports, rollback, and operational runbooks are documented.
- Final browser verification covers all roles, both locales, mobile, desktop, and print.

## 30. Explicit non-goals for this release

- Guardian login
- Payment gateway or online payment processing
- Online exam/question delivery
- Live classes or video conferencing
- Payroll
- Full accounting/general ledger
- Library, hostel, transport, inventory, or biometric attendance
- Native mobile apps
- Multi-coaching tenancy
- Arbitrary drag-and-drop website builder
- Editing submitted attendance

## 31. Source references for implementers

Local authoritative sources:

- AGENTS.md
- DESIGN.md
- convex/_generated/ai/guidelines.md
- node_modules/next/dist/docs/
- this IMPLEMENTATION_PLAN.md

External official references:

- Convex and Clerk: https://docs.convex.dev/auth/clerk
- Convex authentication: https://docs.convex.dev/auth
- Convex AI guidance: https://docs.convex.dev/ai
- Clerk Google/social connections: https://clerk.com/docs
- SMS.BD API: https://sms.bd/api

When documentation conflicts with remembered framework behavior, use the installed local Next.js documentation, the generated Convex AI guidance, and current official provider documentation.
