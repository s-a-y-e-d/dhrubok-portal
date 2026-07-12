# Dhrubok Portal Audit Remediation Plan

## Objective

Move the implemented product from a feature-complete development build to a
reproducible, testable, production-ready release. This plan addresses the gaps
found during repository checks and live Chrome inspection without redesigning
working domain logic.

## Completion definition

The remediation is complete only when all of the following are true:

- A public applicant can choose a published course and batch and submit an
  admission form with Turnstile enabled in a production-like environment.
- Owner, teacher, and student sessions reach only their authorized portals and
  recover safely from account or role changes.
- Attendance, finance, exams, results, notices, materials, and admission flows
  have authenticated browser coverage.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`,
  `npm run build`, and `git diff --check` all pass from a clean process.
- Receipt, statement, attendance report, merit list, and result-sheet printing
  have been visually verified.
- SMS.BD is verified through its provider adapter without allowing delivery
  failures to roll back business transactions.
- `IMPLEMENTATION_STATUS.md` accurately reports the verified state.

## Working rules

- Read `AGENTS.md` before starting a work session.
- Read `DESIGN.md` before modifying user-facing UI.
- Read `convex/_generated/ai/guidelines.md` before modifying Convex code.
- Preserve immutable attendance and financial history rules.
- Never weaken authorization to make a UI or test pass.
- Keep SMS as an asynchronous side effect with idempotency keys.
- Do not run `npm audit fix --force`.
- Keep each commit limited to one phase or one independently reviewable fix.
- Run focused tests during a phase and the complete release gate at the end.

## Phase 0 — Establish a truthful baseline

### Tasks

1. Record current results for:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `npm run test:e2e`
   - `npm audit --omit=dev`
   - `git diff --check`
2. Update `IMPLEMENTATION_STATUS.md` to mark the following as open:
   - public admission unavailable;
   - lint failure;
   - Playwright startup failure;
   - missing authenticated E2E coverage;
   - production Turnstile, Clerk, Convex, SMS.BD, hosting, backup, and restore
     verification.
3. Do not describe tests as passing unless they ran to completion in the current
   checkout.

### Acceptance checks

- Status documentation matches command output.
- No implementation code is changed in this phase.

## Phase 1 — Restore public admission

This is the first release blocker because admission is a primary public
conversion path.

### Investigation

Trace the entire data path:

1. Published course creation and publication.
2. Public homepage course query.
3. Admission-scope course and batch query.
4. Admission page rendering.
5. Course-to-batch filtering.
6. Turnstile token creation and server validation.
7. Application mutation and duplicate handling.

Compare the filters used by the homepage and admission scope. Confirm whether
the admission query incorrectly requires a missing status, enrolment window,
published batch flag, or other field that seeded courses do not satisfy.

### Implementation tasks

- Make admission scope return only active, published, admissible courses.
- Return eligible batches grouped or indexed by course.
- Show a useful empty state when no admissions are open.
- Keep batch disabled until a course is selected.
- Clear a previously selected batch whenever the course changes.
- Validate the selected course and batch again in Convex; never trust the
  browser selection.
- Add production Turnstile variables to `.env.example` without adding secrets.
- Fail closed in production when Turnstile is absent.
- Allow an explicit development-only bypass only when the existing development
  environment flag is enabled.
- Surface duplicate application and validation errors in Bangla and English.

### Tests

- Admission scope includes a published course and eligible batches.
- Draft, archived, inactive, or non-admissible courses are excluded.
- A batch belonging to another course is rejected server-side.
- Invalid, expired, missing, and reused Turnstile tokens are rejected.
- A valid application is stored once.
- Duplicate application policy behaves as specified.
- Browser test selects course, selects batch, fills all required fields,
  accepts consent, and submits successfully using a test-safe Turnstile path.

### Acceptance checks

- The courses shown on the public homepage and admission form follow documented
  publication/admission rules.
- The form works in both `/bn/admission` and `/en/admission`.
- The application appears in the owner review queue.

## Phase 2 — Make role transitions resilient

### Problem to solve

Changing the development persona updates the effective Convex role before the
old page unmounts. Its reactive role-specific queries then throw `Unauthorized`
and can trigger the application error boundary.

### Implementation tasks

- Change persona switching to use a full navigation to the canonical portal
  after the mutation succeeds.
- Add a temporary switching state that unmounts or skips role-specific content
  immediately.
- Centralize canonical role destinations:
  - owner: `/{locale}/owner`
  - teacher: `/{locale}/teacher`
  - student: `/{locale}/student`
- Ensure portal gates redirect authenticated users away from a portal that does
  not match their active linked role.
- Add a role-aware error boundary for authorization changes caused by disabled
  accounts, changed links, expired sessions, and development impersonation.
- Do not catch and hide genuine backend authorization failures. Recover only
  when the current account state proves that navigation is required.
- Keep development impersonation unavailable unless
  `DEV_IMPERSONATION_ENABLED=true`.

### Tests

- Owner to teacher, teacher to student, student to owner.
- Direct access to the wrong role route redirects safely.
- Disabled and pending accounts reach the correct access page.
- A teacher cannot call an owner query during or after navigation.
- A student cannot call teacher or owner queries.
- No uncaught Convex authorization error or Next.js error boundary appears.

### Acceptance checks

- All persona transitions complete without manually entering another URL.
- Browser console has no role-transition errors.
- Production users never see the development switcher.

## Phase 3 — Repair the quality gate

### Lint fixes

- Remove render-time `Date.now()` from `RoleSection.tsx`.
- Produce the dashboard date from a stable value passed into the component, a
  mount-safe state value, or the date already used by the dashboard query.
- Remove the unused `idx` value in `PortalShell.tsx`.
- Replace raw public/content images with the approved Next.js image pattern, or
  document and locally disable the rule where dynamic external image behavior
  makes optimization inappropriate.

### Playwright startup fix

- Remove the false readiness dependency on `http://127.0.0.1:3210` when
  `npx convex dev` targets hosted Convex.
- Add a deterministic pre-test setup that:
  1. runs Convex code generation/deployment once;
  2. verifies the configured Convex URL;
  3. starts Next.js;
  4. waits for `/api/health` and the public homepage;
  5. seeds isolated E2E data through a guarded test helper.
- Ensure CI and local runs use the same backend strategy.
- Give each test run a unique data prefix or resettable fixture scope.
- Ensure failed test processes shut down cleanly.

### Acceptance checks

- Lint has zero errors and zero unreviewed warnings.
- Playwright starts and finishes from a clean terminal.
- Running E2E twice does not depend on data left by the first run.

## Phase 4 — Add authenticated end-to-end coverage

Use multiple agents only if each agent owns separate spec files and one lead
agent reviews and integrates all output. Do not let agents edit shared fixtures
or configuration concurrently.

### Shared test foundation

- Create deterministic owner, teacher, and student authentication states.
- Keep Clerk test credentials and tokens outside the repository.
- Add E2E helpers for seeded course, batch, student, guardian, teacher, fee plan,
  exam, and published content.
- Use unique identifiers per test.
- Assert both visible outcomes and relevant persisted Convex state.

### E2E workstreams

#### A. Admission and student lifecycle

- Submit a public application.
- Owner reviews and changes requested course/batch.
- Owner fills internal fields and accepts it.
- Student and portal account are created once.
- Repeated acceptance cannot duplicate the student.
- Rejected and withdrawn applications remain auditable.

#### B. Attendance

- Teacher sees only an assigned batch.
- Submit present, late, and absent statuses once.
- Late and absent queue guardian SMS; present does not.
- Submitted attendance becomes read-only.
- Owner and teacher cannot edit or resubmit it.
- Student sees the published attendance history.

#### C. Finance

- Create monthly, course, admission, and custom charges.
- Apply fixed and percentage discounts.
- Record full, partial, and advance payments.
- Allocate advance credit to a later charge.
- Queue payment SMS.
- Print a receipt.
- Void a payment with a required reason and verify allocation reversal.
- Preview a due campaign, confirm its recipient count, and queue it once.

#### D. Exams and results

- Owner creates MCQ, written, and combined exams.
- Teacher sees only assigned exams.
- Enter separate MCQ and written marks.
- Prevent scores beyond component full marks.
- Submit the complete roster for review.
- Block publication when marks are incomplete.
- Owner publishes results.
- Verify combined total, pass/fail, tie ranking, absence behavior, course merit,
  publication snapshot and SMS.
- Student sees only published results.
- Reopen, correct and republish with a new publication version.

#### E. Notices, materials and permissions

- Teacher publishes within assigned scope only.
- Owner publishes public/course/batch notices.
- SMS notice requires recipient preview confirmation.
- Students see only content belonging to their active enrolments.
- Cross-role and cross-student URL/API access is rejected.

#### F. Locale and accessibility

- Repeat one critical workflow in Bangla and one in English.
- Run axe checks on public, owner, teacher and student representative pages.
- Verify keyboard navigation and visible focus for dialogs and confirmation
  flows.

### Acceptance checks

- Critical workflow failures prevent release.
- Tests validate backend invariants, not only headings and URLs.
- No test sends a real SMS.

## Phase 5 — Simplify daily finance operations

### Information architecture

- `/owner/finance`: summary, student search, recent payments, balances and a
  prominent collect-payment action.
- `/owner/finance/collect`: focused payment workflow.
- `/owner/finance/dues`: recipient preview, filters and reminder campaigns.
- `/owner/finance/charges`: charges, adjustments and discounts.
- `/owner/finance/configuration`: fee plans and monthly billing rules.

If route separation is too disruptive, implement the same hierarchy with clear
tabs or disclosures, keeping configuration collapsed by default.

### Usability tasks

- Replace repeated 65+ student selects with searchable student lookup.
- Show student balance, unpaid charges and advance credit before amount entry.
- Make allocation totals and remaining advance explicit.
- Require confirmation before posting or voiding a payment.
- Mask guardian phone numbers in due tables; provide deliberate reveal where
  necessary.
- Keep exact recipient count and total due visible before queuing reminders.
- Ensure queue buttons are idempotent and disabled while submitting.

### Acceptance checks

- An owner can begin payment collection in no more than two deliberate actions
  from the dashboard.
- Configuration does not dominate routine finance screens.
- Keyboard and mobile workflows remain usable.

## Phase 6 — Navigation, loading and error-state cleanup

### Tasks

- Standardize the SMS/notices route; remove the inconsistent
  `/owner/messages` target or make it a deliberate redirect.
- Keep the portal shell visible while section data loads.
- Replace full-screen reloads with scoped skeletons after initial
  authentication is resolved.
- Add useful empty, error and retry states to every major list.
- Confirm all sidebar and quick-action links resolve to implemented sections.
- Verify no dead navigation remains across both locales and all roles.

### Acceptance checks

- Route crawl reports no unexpected 404 or empty catch-all pages.
- Loading and error states preserve context and recovery actions.

## Phase 7 — Print and report verification

### Artifacts

- Payment receipt: A5 and browser-print layout.
- Student statement: A4.
- Attendance report: A4.
- Exam result sheet: A4.
- Merit list: A4.
- Individual result: printable student/guardian copy.

### Checks

- Bangla and English fonts embed/render correctly.
- No navigation, buttons, development controls or dark backgrounds print.
- Long names, long coaching addresses and multi-page tables do not overlap.
- Page breaks preserve table headers and avoid split summary blocks.
- Currency, dates, guardian information, receipt numbers and publication
  versions are correct.
- Printed content matches persisted snapshots, not mutable current data.

### Acceptance checks

- Store representative PDFs or screenshots under a clearly named verification
  output directory, not in application source.
- Visually review every page before marking the phase complete.

## Phase 8 — SMS.BD production hardening

### Tasks

- Verify SMS.BD credentials and sender configuration in a non-production or
  low-risk test environment.
- Validate Bangladeshi phone normalization.
- Verify Bangla Unicode segmentation and provider billing implications.
- Test success, rejection, timeout, invalid JSON, rate limiting and provider
  outage responses.
- Confirm retry policy, maximum attempts and backoff.
- Add owner-visible delivery status and safe manual retry.
- Verify idempotency for attendance, payment, result and due-campaign events.
- Ensure logs never expose provider secrets or unnecessary complete phone
  numbers.
- Confirm originating transactions remain committed when delivery fails.

### Acceptance checks

- At least one authorized test SMS is delivered and reconciled.
- Failure and retry behavior is visible and auditable.
- Bulk due reminders cannot be accidentally queued twice.

## Phase 9 — Production configuration and operations

### Clerk

- Create production Clerk instance and Google OAuth configuration.
- Configure authorized redirect URLs and domains.
- Verify linked-email account claiming and unlinked-account access denial.
- Confirm production keys replace development keys.

### Convex

- Create a production deployment.
- Configure typed environment variables.
- Run schema/code deployment from CI.
- Review indexes and Convex Insights with realistic data volume.
- Verify scheduled monthly billing and operational summary jobs.

### Hosting

- Finalize the deployment target and HTTPS/domain setup.
- Configure CSP and security headers for Clerk, Convex, Turnstile and required
  media origins.
- Verify `/api/health`, robots and sitemap.
- Add error monitoring and uptime checks.

### Backup and restore

- Export a production-like Convex snapshot.
- Restore into a separate authorized deployment.
- Verify record counts and representative attendance, finance and result
  snapshots.
- Document the recovery procedure and responsible owner.

### Acceptance checks

- No development credentials, test switcher or seed functions are accessible
  in production.
- Restore is demonstrated, not only documented.

## Phase 10 — Security and release review

### Tasks

- Re-audit all public Convex functions for authentication and role checks.
- Verify students cannot enumerate other students, payments or results.
- Verify teachers cannot access unassigned batches or exams.
- Verify only owners can mutate financial records and publish results.
- Test admission spam controls and request limits.
- Test file upload type, size and authorization enforcement.
- Check sensitive data exposure in exports, logs, SMS previews and public pages.
- Review audit-log coverage for high-value mutations.
- Track the moderate Next.js/PostCSS advisory and upgrade only through a
  compatible dependency release.

### Final release gate

Run from a clean terminal and save the output:

```powershell
npm run convex:codegen
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
git diff --check
npm audit --omit=dev
```

Then perform a Chrome smoke test of:

1. Bangla and English public sites.
2. Admission submission.
3. Owner dashboard and one operation from every module.
4. Teacher attendance and marks entry.
5. Student attendance, dues and published result views.
6. Receipt and result printing.
7. Mobile navigation at the supported narrow breakpoint.

## Suggested agent allocation

Parallel work is useful only after Phase 1–3 stabilize shared contracts.

- Lead/integrator: owns shared configuration, fixtures, final review and release
  gate.
- Agent A: public admission and Turnstile.
- Agent B: role transitions, portal gates and navigation recovery.
- Agent C: authenticated E2E specifications after shared fixtures are merged.
- Agent D: finance information architecture and print verification after the
  critical backend/E2E work is stable.

Rules for parallel execution:

- Only the lead edits `package.json`, Playwright configuration, shared E2E
  fixtures, `PortalShell`, or global CSS.
- Assign exclusive file ownership before agents begin.
- Agents must report commands run and remaining uncertainty.
- The lead reviews every diff and runs the complete gate after integration.
- Do not declare completion from agent reports alone.

## Recommended execution order

1. Phase 0 — truthful baseline.
2. Phase 1 — public admission.
3. Phase 2 — role transitions.
4. Phase 3 — lint and Playwright startup.
5. Phase 4 — authenticated E2E coverage.
6. Phase 5 and Phase 6 — finance and navigation usability.
7. Phase 7 — print verification.
8. Phase 8 and Phase 9 — external services and production operations.
9. Phase 10 — security and final release gate.

Do not begin production rollout while any P1 or P2 item remains open.
