
I want to make a web service for coaching/school management. i want you to go on a research of what should I add in that service, how should I organize them, how should I make them. Give me suggestions. help me to make a plan of making this useful web service.

3:09

Worked for 1m 23s
Build Dhrubok as a Bangladesh-first, mobile-friendly “daily operations” platform—not a giant ERP on day one.

Research shows attendance, fees, results, SMS, and parent communication are already table-stakes locally, so they should be your reliable core, not your differentiator. Scolinary, CampusQ, and Anas all offer versions of these. Your edge should be fast staff workflows, clean fee/due visibility, Bangla-first communication, easy migration from Excel, and trustworthy data.

The current project is a clean starter: it already names admissions, attendance, fees, exams, notices, and SMS as the intended foundations.

Product direction
Start with coaching centres first, while designing the core to support schools later.

Coaching centres have simpler academic structure: courses, batches, sessions, flexible fee packages, and frequent attendance. A school adds terms, classes, sections, roll promotion, board-style exams, staff HR, transport, etc. Build the shared foundation once, then turn on school-specific modules later.

Organize the service
Use this navigation:

Dashboard — today’s classes, attendance missing, fee collections, dues, notices
People — students, guardians, teachers, staff
Academic — courses/classes, batches/sections, subjects, routines, rooms
Daily operations — attendance, admission, leave, homework/materials
Finance — fee plans, invoices, collections, receipts, waivers, dues, expenses
Exams — exam schedule, marks entry, result publishing, report cards
Communication — notices, SMS/push queue, templates, delivery history
Reports — attendance, dues, collections, academic performance, exports
Settings — institution profile, academic year, roles, permissions, integrations
For coaching, label the academic area “Courses & Batches.” For schools, label it “Classes & Sections.” Internally, both can use the same enrolment and class-session model.

First version: build these workflows
Institution onboarding
Create an institution, academic year, courses/batches, staff accounts, and roles.

Student admission
Add a student and guardian, assign them to a batch, select a fee plan, record admission payment, and create a printable receipt.

Daily class operation
Teacher opens today’s session, marks attendance in a fast grid, and the office sees absences immediately.

Fee collection
Office searches by mobile number or student ID, takes cash/online payment, prints or sends receipt, and sees overdue students.

Guardian visibility
A guardian can see only their linked child’s attendance, upcoming routine, notices, payment history, dues, and later results.

Notices and reminders
Send an announcement to a batch, all guardians, or students with outstanding dues. Keep a delivery log; never treat “sent” as “delivered.”

Simple reporting
Daily collection, overdue fees, attendance percentage, absent-student list, and batch enrolment count.

This is a useful MVP. Do not begin with transport, library, payroll, hostel, biometric devices, online classes, or AI analytics.

What to add after the MVP
Phase Add Why
2 Exam setup, marks entry, grading, result sheets High value, but rules and printing make it more complex
2 Online payment reconciliation, payment links Removes manual accounting work
2 Homework, materials, teacher feedback Makes the guardian/student portal useful between payments
3 Expense ledger, staff salary, income statement Helps directors run the business
3 Bulk import/export, ID-card/admit-card printing Essential for onboarding established institutions
4 Biometric/QR attendance, WhatsApp, mobile app Add only after the daily web flow is dependable
Bangladesh-focused competitors consistently promote flexible fees, Bangla/English use, attendance, SMS, and mobile access—good evidence these must be handled well. Biz IT BD, Bornomala, and CampusQ are useful market references.

Data and permission model
Make every record belong to an institution. Never let users choose an institution ID from the browser as proof of permission; derive access from their authenticated membership.

Core records:

institutions
users
memberships (user + institution + role)
students
guardians
studentGuardians
staffProfiles
academicYears
programs/classes
batches/sections
enrolments
classSessions
attendanceRecords
feePlans
invoices
payments
paymentAllocations
exams
examSubjects
marks
notices
notificationDeliveries
auditLogs
Roles should be explicit:

Owner: billing, institution settings, every report
Director/admin: academic and operational control
Accounts: fees, payments, financial reports only
Teacher: assigned batches, attendance, marks, notices
Front desk: admissions, student records, collections
Guardian/student: their own linked data only
Audit every fee adjustment, payment void, result edit, and role change. Educational data includes children’s and staff members’ personal data, so permission boundaries, data minimisation, backups, and retention/deletion rules are core product features—not later polish. UNICEF’s school data-protection guidance

Technical approach for this project
Keep Next.js for the interface and Convex for real-time operational data.

Use multi-tenant tables with institutionId and indexes that begin with it.
Build role-checking helpers before individual modules.
Keep payment events/receipts immutable; record reversals rather than silently editing history.
Use CSV import with a validation preview; coaching centres will often start from Excel.
Make the attendance and collection screens work on a low-end phone in a few taps.
Use Bangla labels and optional English, Bengali dates/numbers where useful, and Bangladesh phone-number validation.
Integrate SMS first; add payment gateways only after deciding the business/payment flow.
Build reports from operational data, but maintain summary counters where scale requires it.
UNESCO’s EMIS guidance is a good design principle: collect only data that supports a decision, define fields consistently, and ensure data is complete, accurate, timely, and accessible. UNESCO EMIS buyer’s and user’s guide

A practical 12-week roadmap
Weeks 1–2: interview 6–8 directors, teachers, accountants, and guardians; document current paper/Excel/SMS workflow; define MVP.
Weeks 3–4: authentication, institution setup, roles, academic year, courses/batches, student/guardian records.
Weeks 5–6: admissions, fee plans, invoices, payments, receipts, due report.
Weeks 7–8: class sessions, attendance, teacher dashboard, absence notifications.
Weeks 9–10: guardian portal, notices, SMS templates/delivery log, core reports.
Week 11: one real institution pilot, CSV migration, staff training, fix friction.
Week 12: launch pilot, monitor missed attendance, failed messages, incorrect dues, and time saved at fee collection.
Before writing substantial code, choose one initial customer profile: for example, “a Dhaka coaching centre with 300–1,000 students, monthly fees, 10–30 batches, and guardian SMS.” That decision makes the MVP precise and prevents school-scale complexity from delaying the first useful version.

3:10
I only want to make it for coaching and this will be for a specific coaching. For now I only want to have the admin/owner role. Students will have profile but there won't be any spot in the web for them. And I think the guardians don't need profile. Their name and number should be in the student's profile.

4:18
That scope is much better for a first version: a private operations tool for one coaching centre, used only by its owner/admin.

Do not build multi-institution support, student login, guardian login, roles, or a public portal yet.

Your product becomes:

One owner manages students, batches, attendance, fees, exams, and guardian communication from one dashboard.

Simplified structure
Dashboard
Students
Courses & Batches
Attendance
Fees & Payments
Exams & Results
Notices / SMS
Reports
Settings
Students and guardians do not need accounts. The owner uses the system; students are records inside it.

Student profile
Keep guardian details inside the student record:

Student

- student ID
- name
- mobile number (optional)
- date of birth
- school / college
- class / HSC-SSC version
- address (optional)
- photo (later)

Guardian

- guardian name
- guardian mobile number
- relation: father / mother / other
- alternate guardian name and number (optional)
I recommend including an optional second guardian contact from the start. It is still not a separate “guardian profile,” but it handles common real situations without making the system complicated.

Also show these on the student profile:

Current batch/course enrolments
Attendance percentage
Fee plan, paid amount, due amount
Payment history and receipts
Exam results
Notices/SMS sent to their guardian number
Internal notes, such as “calls not answered” or “scholarship approved”
Core data model
For this coaching-specific version:

ownerAccount
coachingSettings
academicSessions
courses
batches
teachers
students
enrolments
classSessions
attendanceRecords
feePlans
invoices
payments
exams
examSubjects
marks
notices
smsDeliveries
Teachers should have records even if they cannot log in yet. That lets you assign a teacher to a batch, routine, and attendance session. Later, teacher login can be added without redesigning the data.

MVP features
Build these first:

Coaching setup
Name, logo, address, phone, academic session, receipt settings.

Course and batch management
Examples: “HSC 2027 Science”, “Class 10 Bangla Batch A”, teacher, room, routine, capacity.

Student admission
Add student and guardian details, enrol them in a batch, choose a fee plan, record initial payment.

Attendance
Pick today’s batch and mark present/absent in one fast screen. Show low-attendance students.

Fees
Define monthly/course-wise fee plans, record cash payment, generate receipt, list dues, and send fee reminders.

Notices and SMS
Send to a batch, all students, or students with dues/low attendance. Use guardian numbers by default.

Basic reports
Daily collections, monthly dues, batch-wise student count, attendance report, and student payment statement.

Add later
Exams, marks, grading, result sheets
Homework and study materials
Online payment links and automatic reconciliation
Teacher login
Student portal/app
QR/biometric attendance
Expenses, salary, and full accounting
Best build order
Coaching settings, batches, students, admissions
Fee plans, payments, receipts, due report
Attendance and routine
SMS/notice system
Reports
Exams and results
The key rule: make the owner’s daily work extremely quick. They should be able to record a payment, mark an entire batch’s attendance, and find a student by name or guardian phone number in seconds.

4:19
Hey I like most of your ideas. Now I want you to make a detailed design or structure of the product. Keep in mind that the product should be frictionless. Some product decisions: The payment collection will be manual. So, no need of a payment gateway. But I want to send msg to guardians after the payment collection, print invoice, msg guardians who has due. Also I don't want teacher login for now(may include in future).

I want to have a structure design of the full product. No need of 'pre-product' thing.
Ask  me as much questions you need.

17:17
Great—before I design the full product, I need to settle the operational rules. Short answers are fine, and you can write “you decide” wherever you want my recommendation.

Coaching structure
What kind of coaching is this, and what subjects/classes does it serve?

Can one student join multiple courses or batches simultaneously?

How do you distinguish a course from a batch? Please give one real example from your coaching.

Do batches have fixed start/end dates, or do students continue indefinitely?

Should the system store teachers as simple records for batch assignment, even though teachers cannot log in?

Do you need rooms and weekly class routines, including cancelled or rescheduled classes?

Students and admission
What information must be collected when admitting a student?

Should every student receive an automatically generated ID, roll number, or both?

Can the same student leave and later rejoin? If so, should their old attendance, payments, and results remain visible?

Do you need admission statuses such as active, paused, completed, and dropped?

Is one primary guardian enough, with an optional second emergency contact?

Should guardian messages always go to the primary guardian, or should the admin choose the recipient each time?

Attendance
Is attendance taken per scheduled class, once per day, or separately for each subject?

Which attendance states do you need besides present and absent—for example late, excused, or leave?

Should an absence automatically prepare or send a guardian message, or should the admin review it first?

Do you need attendance correction history showing when an old record was changed?

Fees and manual collection
How are fees normally charged: monthly, full-course, admission fee, exam fee, material fee, or a mixture?

Can different students in the same batch have different fees?

Do you allow discounts, scholarships, sibling discounts, fines, or waived fees?

Do you accept partial payments and advance payments?

When is a monthly fee considered due, and should unpaid balances carry into the next month?

Which manual payment methods should be recorded—for example cash, bank transfer, bKash, Nagad, or cheque?

Should invoice and payment receipt be separate documents, or do you currently use “invoice” to mean the receipt printed after payment?

What information must appear on the printed document: logo, student photo, guardian number, collector name, signature area, previous due, current payment, remaining due?

Should an incorrect payment be editable, cancelled with a reason, or reversed through a separate correction entry?

After collection, should the guardian message be sent automatically or shown for confirmation first?

For due reminders, should the admin select individual students, a batch, or everyone whose payment is overdue?

Exams and results
Should exams and results be included in the first complete product structure?

If yes, do you need marks by subject, grading, merit position, pass/fail, attendance marks, or only scores?

Should the owner be able to print individual result sheets and batch result summaries?

Should guardians receive result messages?

Messaging
Do you already know which SMS provider you will use, or should I design the messaging system independently of the provider?

Do you need SMS only, or should the system also support copying a prepared message for WhatsApp/Messenger?

Should Bangla and English message templates both be supported?

Do you want a complete message history on each student profile, including delivery status and cost?

Administration and reporting
Will exactly one person use the system, or may several admin/owner accounts use it simultaneously?

Which numbers are most important on the dashboard each morning?

Which reports do you regularly need to print or export?

Should the system track coaching expenses, or only student fees and collections?

Do you need CSV/Excel import for existing students and opening balances?

Should the interface be English, Bangla, or switchable between both?

Will printed invoices and reports need Bangla text?

Do you want dark mode, or should this be a light operational interface optimized for office use and printing?

Is the system intended mainly for desktop, or will the owner frequently collect payments and take attendance using a phone?

Are there any existing registers, invoice samples, result sheets, or screenshots whose structure the product should preserve?

17:17
There is so many questions and most of them useless. Please ask useful/important ones.

17:18
You’re right—I overdid it. I’ll make sensible product decisions for the smaller details. I only need these seven answers:

Give me one real example of how your coaching organizes students into courses and batches. Can a student join more than one batch?

How are fees charged in practice? Include monthly/course fees, admission fees, discounts, partial payments, and advance payments.

Is attendance recorded once per batch class, and do you need anything beyond present and absent?

Should exams and results be part of the product now? If yes, briefly describe how marks and results currently work.

After receiving payment, should the guardian SMS send automatically, or should the admin confirm it first?

Will only one owner use the system, or should multiple admin accounts be supported?

Should the interface and printed documents be English, Bangla, or both?

17:18
Yes
include monthly/course fees, admission fees, discounts, partial payments, and advance payments.
attendance should be recorded once per batch class and I don't need anything beyond present and absent
yes. Admin will set exams and it's details. For now the exam will be manual no need of a interface for making exams. Admin will input the student's result and the result will be sent to their guardians
automatically send SMS
multiple owner
both
17:28
I’m taking your first answer to mean that a student can join multiple batches. Based on that, this is the complete product structure I recommend.

1. Product definition
Dhrubok Portal will be a private management system for one coaching centre.

Multiple owners can use it with equal access.
Students, guardians, and teachers cannot log in.
Teachers exist only as administrative records.
Students may join multiple batches.
Guardian information lives inside the student profile.
Payments are collected manually.
Payment confirmations, due reminders, and published results are sent by SMS.
Exams happen offline; the portal only manages exam details and results.
The interface, messages, and printed documents support Bangla and English.
2. Main navigation
Section Purpose
Dashboard Today’s work, warnings, collections, dues, and shortcuts
Students Admission, profiles, enrolments, financial and academic history
Batches Courses, batches, teachers, routines, and student lists
Attendance Class sessions and present/absent entry
Payments Charges, collections, discounts, advances, receipts, and dues
Exams Offline exam setup, marks entry, publishing, and result SMS
Messages Due reminders, message history, failures, and templates
Reports Financial, attendance, student, batch, and result reports
Settings Coaching identity, owners, language, SMS, numbering, and defaults
Frequently used actions—Add student, Collect payment, Take attendance, and Enter results—should also appear as permanent quick actions.

1. Dashboard
The dashboard should answer: “What needs my attention today?”

Summary cards
Active students
Today’s collection
This month’s collection
Total outstanding dues
Today’s scheduled classes
Attendance not yet recorded
Failed SMS messages
Today’s classes
Each scheduled batch class shows:

Time
Batch
Subject
Teacher
Number of enrolled students
Attendance status
Take attendance action
Attention list
Students with overdue payments
Unfinished attendance
Exams awaiting results
Results ready but not published
Failed payment/result SMS messages
Recent activity
Recent admissions
Recent payments
Voided payments
Published results
Messages sent
Every dashboard item should link directly to the relevant action instead of only displaying information.

1. Students
Student list
Search should work with:

Student name
Student ID
Student phone
Guardian name
Guardian phone
Filters:

Batch
Course
Active/inactive status
Students with dues
Students without attendance
Admission date
Recommended columns:

Student ID
Name
Guardian phone
Current batches
Attendance percentage
Current due
Status
Quick actions
Quick actions:

Collect payment
View profile
Send message
Change batch
Mark inactive
Admission flow
Use one compact form with three sections rather than a long wizard.

Student information
Full name in Bangla
Full name in English
Student phone, optional
Date of birth, optional
Gender, optional
School or college
Current class
Address, optional
Photo, optional
Guardian information
Guardian name
Guardian phone
Relationship
Alternative phone, optional
Preferred message language
There is no separate guardian record or guardian account.

Enrolment and fees
Course
Batch
Admission date
Monthly or course fee
Admission fee
Discount
Initial payment
Custom notes
After saving, show:

Student ID
Successful enrolment
Initial payment receipt, if applicable
SMS delivery status
Student profile
The header should show:

Student name and ID
Active status
Guardian name and number
Current due
Attendance percentage
Current batches
Primary actions:

Collect payment
Add to batch
Send SMS
Print statement
Edit student
Profile sections:

Overview
Batches
Payments
Attendance
Results
Messages
Activity history
The activity history combines important events such as admission, batch changes, payments, payment cancellation, result publication, and profile changes.

1. Courses and batches
Course
A course describes what is being taught.

Examples:

HSC 2027 Physics
SSC English
University Admission Mathematics
Course information:

Bangla and English name
Description
Academic session
Default duration
Default fee structure
Active/archive status
Batch
A batch is the actual student group taking a course.

Batch information:

Batch name
Course
Assigned teacher
Start and end dates
Weekly routine
Room
Student capacity, optional
Default fee
Active/completed/archive status
A student can have multiple enrolment records, one for each batch.

Batch page
Show:

Batch details and routine
Student roster
Today/upcoming classes
Attendance history
Fee collection summary
Exams and results
Add/remove student actions
Removing a student from a batch should end their enrolment. It must not delete their historical attendance, payments, or results.

Teacher records
Teachers have no accounts. Store only:

Name
Phone
Subject
Assigned batches
Notes
Active/inactive status
6. Attendance
Attendance is recorded once for each batch class.

Class session
A class session contains:

Batch
Date
Start time
Subject or topic, optional
Teacher
Session status
Sessions can come from the weekly routine or be created manually for an extra class.

Attendance screen
The fastest safe workflow:

Open today’s batch.
Press Mark all present.
Tap the absent students.
Review the count.
Save attendance.
Only two states exist:

Present
Absent
The screen should display student name, ID, and photo if available. It should work comfortably on both phone and desktop.

The system must prevent duplicate attendance records for the same student and class session.

Attendance corrections are allowed, but the system records who changed them and when.

1. Fees and payments
The financial model should distinguish three things:

Charge/invoice: money the student owes
Payment: money manually received
Receipt: confirmation of received money
This separation is necessary for partial payments, discounts, dues, and advances.

Supported charges
Admission fee
Monthly fee
Full course fee
Exam fee
Material or other fee
Custom one-time charge
Discounts
Support both:

Fixed amount discount
Percentage discount
A discount can apply to:

Admission
A particular charge
Monthly fees
The entire course enrolment
Every discount should have a reason.

Payment collection flow
The owner:

Searches for the student.
Sees outstanding charges and available advance credit.
Selects charges or accepts the automatic oldest-due allocation.
Enters the received amount.
Selects the manual payment method.
Confirms collection.
Configurable manual methods can include:

Cash
bKash
Nagad
Bank transfer
Cheque
Other
For non-cash methods, an optional transaction/reference number can be recorded. The portal does not communicate with a payment gateway.

Partial and advance payments
If the payment is lower than the selected charge, the charge becomes partially paid.
If it exceeds current dues, the remaining amount becomes student credit.
Future charges automatically use available credit.
The student profile always shows due and advance balances separately.
Payment completion
Immediately after saving:

Create a unique receipt number.
Save the payment permanently.
Queue the guardian SMS.
Open the printable receipt.
Show the SMS delivery status.
A failed SMS must never reverse or invalidate the payment. It appears in a retry queue.

Printed receipt
Include:

Coaching logo and information
Receipt number and date
Student name and ID
Guardian phone
Batch or batches
Payment method
Charges covered
Previous due
Amount received
Discount, if applicable
Advance credit
Remaining due
Collected by
Signature area
Bangla/English print switch
Corrections
Completed payments should not be silently edited or deleted.

An owner can void a payment by entering a reason. The system reverses its allocations and advance credit, updates the due balance, and keeps both the original payment and cancellation history.

1. Due management
The due page should provide:

Total outstanding amount
Number of students with dues
Overdue monthly fees
Partial payments
Due amount by batch
Due ageing
Filters:

Batch
Fee month
Due date
Amount range
Message status
Owners can select one, several, or all filtered students and send due reminders.

Before sending, show:

Number of recipients
Total SMS count
Message preview
Students without valid guardian numbers
Due SMS is initiated manually by an owner. Payment confirmation SMS remains automatic.

1. Exams and results
“Manual exam” should mean the exam happens outside the system. There is no online question paper, exam-taking interface, or student portal.

Exam setup
An owner creates:

Exam name
Batch
Subject
Exam date
Full marks
Pass marks
Optional description
An exam starts in draft status.

Result entry
Use a spreadsheet-style table:

Student Marks Status Comment
Student name Numeric input Pass/fail/absent Optional
Features:

Keyboard-friendly entry
Validation against full marks
Save draft
Show missing results
Automatic pass/fail calculation
Bulk result entry
Publishing
Entering marks does not send messages. The owner must press Publish results.

Publishing:

Locks the result snapshot.
Calculates pass/fail.
Queues one SMS per student.
Records publication time.
Shows delivery results.
The guardian SMS includes student name, exam, marks, full marks, and pass/fail. If a published result is corrected, the system should clearly offer Save correction and resend SMS.

1. Messaging
Messages are event-based, not a general chat system.

Initial message types
Payment confirmation
Due reminder
Published exam result
Custom administrative message
Message templates
Templates support Bangla and English with variables such as:

{studentName}
{guardianName}
{batchName}
{amountPaid}
{remainingDue}
{receiptNumber}
{examName}
{marks}
{fullMarks}
Each student has a preferred message language. Owners can override it before sending.

Delivery states
Queued
Sent to provider
Delivered, if supported
Failed
Retrying
The message history stores:

Recipient number
Message text
Related student
Related payment/exam
Sending owner
Delivery status
Provider response
SMS cost, if available
Automatic messages need duplicate protection so refreshing the page or retrying an operation cannot send the same confirmation twice.

1. Reports
Financial
Daily collection
Collection by date range
Collection by payment method
Monthly fee collection
Student dues
Batch-wise dues
Discounts granted
Advance balances
Voided payments
Individual student statement
Attendance
Daily attendance
Batch attendance
Student attendance history
Attendance percentage
Frequently absent students
Classes with missing attendance
Academic
Exam result sheet
Batch result summary
Pass/fail summary
Individual student result history
Operational
Active students
Admissions by date
Students by batch
Batch capacity
Students without valid guardian numbers
SMS delivery and failure report
Every report should support print and CSV/Excel export where appropriate.

2. Owners and security
Multiple owners have equal access for now.

Owner management supports:

Invite owner
View active owners
Disable owner
Remove owner
View last activity
The final active owner cannot remove themselves.

Even though permissions are equal, every sensitive action records the responsible owner:

Payment collection
Payment cancellation
Discount
Attendance correction
Result publication or correction
Student deletion/archive
Owner changes
Settings changes
Use archive/inactive states for students, batches, and teachers instead of destructive deletion.

1. Settings
Organize settings into:

Coaching profile
Academic sessions
Owners
Courses and fee defaults
Payment methods
Receipt numbering
Languages
SMS provider
Message templates
Data import/export
Audit history
The coaching profile contains names in both languages, logo, address, phone number, receipt footer, and default language.

1. Frictionless interaction rules
These should guide every screen:

Global search is always available.
Common actions take no more than one or two page transitions.
Search should accept partial names and phone-number fragments.
Forms remember safe defaults such as date, batch, and payment method.
Tables provide bulk actions.
Desktop screens are keyboard-friendly.
Attendance and collection work comfortably on mobile.
Save buttons remain visible on long forms.
Validation appears beside the relevant field.
Completed actions clearly show receipt and SMS status.
Lists preserve filters when returning from a profile.
Printed content has dedicated layouts without dashboard navigation.
Bangla and English values are stored separately where exact official spelling matters.
Financial and published result actions require explicit confirmation.
Routine edits such as student details should not produce unnecessary confirmation dialogs.
15. Recommended build sequence
Authentication, multiple owners, coaching settings
Courses, batches, teachers, and routines
Students, guardian details, and multiple enrolments
Charges, discounts, manual payments, advances, and receipts
Automatic payment SMS and due reminders
Class sessions and attendance
Offline exams, marks entry, result publishing, and result SMS
Reports, exports, audit history, and bilingual polish
Explicitly outside the product for now
Student portal or login
Guardian portal or login
Teacher login
Online classes
Online examinations
Payment gateway
Payroll and full accounting
Library, hostel, transport, and inventory
Public coaching website
Internal chat system
This structure keeps Dhrubok focused on the owner’s actual operating loop: admit students, organize batches, record attendance, collect money, follow up on dues, record results, and keep guardians informed.
