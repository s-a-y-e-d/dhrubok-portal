# Owner dashboard screenshots

Captured from the local owner session at `http://localhost:3000` on 2026-07-12 using seeded demo data.

| Page | Route | Screenshot |
|---|---|---|
| Overview | `/en/owner` | [overview-viewport.png](overview-viewport.png) |
| Admissions | `/en/owner/admissions` | [admissions-viewport.png](admissions-viewport.png) |
| Students | `/en/owner/students` | [students-viewport.png](students-viewport.png) |
| Academics | `/en/owner/courses` | [academics-viewport.png](academics-viewport.png) |
| Attendance | `/en/owner/attendance` | [attendance-viewport.png](attendance-viewport.png) |
| Finance | `/en/owner/finance` | [finance-viewport.png](finance-viewport.png) |
| Exams | `/en/owner/exams` | [exams-viewport.png](exams-viewport.png) |
| Materials | `/en/owner/materials` | [materials-viewport.png](materials-viewport.png) |
| Notices / SMS | `/en/owner/notices` | [notices-sms-viewport.png](notices-sms-viewport.png) |
| Reports | `/en/owner/reports` | [reports.png](reports.png) |
| Website | `/en/owner/website` | [website.png](website.png) |
| Settings | `/en/owner/settings` | [settings.png](settings.png) |
| Collect payment quick action | `/en/owner/finance/collect` | [collect-payment.png](collect-payment.png) |
| Due reminders quick action | `/en/owner/finance/dues` | [due-reminders.png](due-reminders.png) |

## Inspection notes

- Primary owner navigation is present and links resolve to the expected routes.
- Overview, Students, Finance, Reports, Website, and Settings rendered populated owner views.
- Admissions, Attendance, Exams, Materials, and Notices rendered usable empty/initial states where no records were available.
- The Settings screen shows coaching settings are not initialized; that is a first-run state, not a browser failure.
- The full-page captures retain the fixed sidebar at each page break; viewport captures are the cleaner review images where available.
