# Dhrubok Portal Implementation Status

Last updated: 2026-07-12 (Asia/Dhaka)

## Audit remediation status

The July 12 remediation baseline found that unit/integration tests and typecheck
passed, while lint failed, Playwright depended on a false local Convex readiness
URL, and authenticated browser coverage remained unavailable. Lint and local
Playwright startup are now repaired; the public suite runs against the configured
hosted Convex deployment after deterministic code generation.

Still open and release-blocking until verified with user-controlled credentials
or infrastructure:

- authenticated owner, teacher, and student E2E journeys;
- a production-like admission submission with configured Turnstile keys;
- production Clerk, Convex, hosting, monitoring, backup, and isolated restore;
- an authorized SMS.BD delivery and reconciliation;
- authenticated visual review of every receipt/report print artifact.

No external production-readiness item is considered passing based on repository
implementation alone.

This file tracks execution of the authoritative `IMPLEMENTATION_PLAN.md`. “Complete locally” means every repository implementation and verification action available without user-controlled credentials, an authenticated approved account, external infrastructure, or production approval is complete. No commits, pushes, deployments, real SMS sends, or production mutations were authorized.

## Baseline audit

- Git branch: `main`; the working tree was clean before implementation.
- The starting product was a Next.js/Clerk/Convex prototype with an empty schema and mock portal pages.
- Environment files remained local; only variable names were inspected.
- Baseline typecheck/build passed, while baseline lint had two errors in the removed demo UI.
- Convex AI guidance was installed and read before Convex work.

## Step ledger

| Step | Status | Delivered | Verification evidence | External-only remainder |
|---|---|---|---|---|
| 0. Repository and instruction alignment | Complete locally | Source-of-truth docs, scripts, env-name template, clean replacement of mock routes | Lint, typecheck, build and diff checks pass; no secrets added | Commits intentionally not created because the user prohibited them |
| 1. Framework and design foundation | Complete locally | Bilingual locale routing, separate public/role layouts, protected-route classification, accessible responsive shells and states | Public/redirect Playwright checks across 375×812, 768×1024, 1280×800 and 1440×900 | Approved Clerk role accounts for authenticated browser proof |
| 2. Testing harness and fixtures | Partial | Vitest, convex-test, Testing Library, Playwright and axe; deterministic domain fixtures | 19 test files and 72 tests pass; public Playwright suite starts without a false local Convex readiness dependency | Authenticated Clerk storage states and role-specific browser fixtures |
| 3. Schema, primitives and authorization | Complete locally | Full typed schema, normalization/date/money/audit helpers, account claim/bootstrap, role/scoping helpers, owner account administration and last-owner protection | Codegen/typecheck pass; focused account/settings tests; audit covered all 185 exported public Convex endpoints | Approved Google identities and production Clerk issuer configuration |
| 4. Academic core | Complete locally | Sessions, subjects, courses/joins, teachers/accounts, batches, assignments, schedules, archive rules, owner administration, role/public read models | Academic tests pass; owner routine/session operations compile and lint | Authenticated owner/teacher browser exercise |
| 5. Public website and CMS | Complete locally | Real bilingual pages, fixed content revisions, draft/preview/publish, gallery/media, owner CMS, localized SEO/canonicals/hreflang/OG/Twitter, sitemap/robots | CMS tests 7/7; production build; browser metadata/SEO endpoints and zero-console-error public checks | Authenticated owner upload/publish browser exercise |
| 6. Admissions and student core | Complete in repository; production proof open | Turnstile/honeypot/rate limit, public form, owner inbox, duplicate warnings, editable selection, atomic idempotent conversion, enrolment/fees/account hooks, student/owner profile editing and approvals | Admission/student tests pass; phone-size admission form accessibility/browser checks pass | Production-like Turnstile submission, owner queue confirmation, and approved Google student sign-in journey |
| 7. Attendance and automatic SMS | Complete locally | Session creation, validated schedule binding, exact roster, three-state marking, irreversible review/submit, immutable records, histories, idempotent late/absent SMS | Attendance tests include completeness, duplicates, scope, immutability, SMS and cross-batch schedule regression | Authenticated teacher browser journey and real SMS delivery |
| 8. SMS.BD integration | Complete locally | Provider adapter, validation, durable outbox/retry/report/balance jobs, fake provider, templates/settings, delivery/retry UI | Adapter/template/outbox tests pass; failure never rolls back domain writes | SMS.BD credentials, sender approval, designated test phone and explicit send approval |
| 9. Finance | Complete locally | Fee plans/items, assignment, discounts, monthly/idempotent billing, charges, allocation/partial/advance, void/reversal, reconciliation, reminders, receipts and student payment history | Finance tests include monthly rerun, allocation/advance/void/reconciliation and fee-plan assignment | Authenticated owner/student print browser proof |
| 10. Exams and results | Complete locally | Multi-subject/batch exam builder, MCQ/written/both marks, teacher grid, validation, review, ranking, versioned publication/correction SMS, student results, result/merit print routes | Exam and immutable published-snapshot report tests pass | Authenticated role browser journey and real SMS report confirmation |
| 11. Materials and notices | Complete locally | Authorized uploads, assigned publishing, moderation/archive, course/batch/individual scopes, frozen recipients, notice read state, authorized downloads, exact SMS preview | Focused material/notice tests pass; student projections minimize internal metadata | Authenticated upload/download browser journey |
| 12. Dashboards, reports and exports | Complete locally | Real role dashboards, daily summaries, bounded/paginated reports, persistent filters, Bangla-safe CSV, A4 attendance/exam/student statement and A5 receipt routes | Report tests pass; build and browser public suite pass | Authenticated role/print-preview exercise |
| 13. End-to-end hardening | Complete locally | Demo/TODO removal, 185-endpoint authorization/privacy audit and five fixes, performance/index audit, accessibility/responsive/cross-locale checks, retry/reconciliation/monthly/scale drills, security headers/CSP, audit review, local snapshot export validation | Codegen, typecheck, 69 tests, lint, build, 24 E2E/axe tests and diff check pass; realistic 100-student/50-batch/15-teacher scale test passes | Convex hosted Insights is unavailable for the local deployment; isolated restore needs another authorized deployment; formal Codex Security workspace awaits user Start approval |
| 14. Staging and production | Local artifacts complete | Standalone Dockerfile, compose/Caddy examples, health endpoint, environment separation, staging/production/rollback documentation and operational runbooks | Standalone production build passes; local Convex snapshot export contained 87 entries and validated as a readable ZIP | Docker is not installed locally; Clerk/Convex/Turnstile/SMS/domain/VPS credentials, staging smoke tests, production deployment and approved real SMS |

## Security and dependency notes

- The authorization audit found two medium and three low issues. All were fixed and regression-tested: cross-batch attendance schedule spoofing, teacher exposure of guardian phones, private-course batch enumeration, batch-scoped teacher exam aggregate leakage, and excess internal metadata in student material/notice payloads.
- Repeated sign-in resolution for an unapproved Google identity now remains idempotently `access_pending`; it no longer increments a claim counter or throws a rate-limit error. A real matching reserved account still claims atomically by verified email.
- `npm audit --omit=dev` reports two moderate PostCSS advisories nested under Next.js 16.2.10. The suggested `--force` remediation incorrectly downgrades to Next 9.3.3, so no unsafe breaking downgrade was applied. Recheck when the pinned Next release updates its dependency.
- `npx convex ai-files status` confirms all guidance/skills are current, then prints the known Windows libuv `UV_HANDLE_CLOSING` assertion after completing the status report.
- `npx convex insights --details` cannot inspect this local deployment (`DeploymentNotFound`); the code-level audit found no production `.collect()` and all list paths are bounded or paginated.
- Docker CLI is not installed on this machine, so the Docker image itself could not be built locally. The same standalone Next.js build stage passed directly.

## External blockers

Repository implementation does not by itself satisfy the release definition. Remaining proof or action requires user-controlled external state: approved Clerk owner/teacher/student Google identities, production Clerk/Convex/Turnstile/SMS.BD configuration, an approved SMS recipient and explicit send authorization, an isolated staging deployment for restore/smoke rehearsal, Docker/VPS/domain access, a formal security scan, and production deployment approval.
