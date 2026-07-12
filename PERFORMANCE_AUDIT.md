# Convex performance audit

Date: 2026-07-11

Scope: public browse/CMS, role dashboards, materials/notices management, student finance summaries, bulk monthly billing, attendance submission, exam publication, and report/export reads.

## Signals

`npx convex insights --details` was attempted against the local deployment. The CLI queried Convex cloud usage for the local deployment name and returned `DeploymentNotFound`, so no reliable runtime insight sample was available. This audit therefore uses code-path evidence and the project’s realistic scale targets; it does not claim measured production latency.

## Findings and changes

- Public course and teacher reads now use compound `isPublic + status + publicSortOrder` indexes instead of reading a larger public set and filtering active rows in JavaScript.
- Owner material moderation now uses `status + publishedAt`; teacher notice management and dashboard content use `createdByAccountId + status`. Sibling list/dashboard paths were updated together.
- Monthly billing is cursor-paginated and self-scheduling in batches of 25. SMS sending/report polling is scheduled outside business mutations.
- Daily global dashboard totals use precomputed `dailyOperationalSummaries`, refreshed by cron, rather than reactive global scans.
- Finance summary computation is bounded and now fails explicitly beyond 1,000 charges or payments instead of silently returning a truncated monetary result. A durable aggregate migration is required before any student reaches that safety limit.
- Student/teacher/owner list and report reads are paginated or have explicit safety caps. Production Convex functions contain no unbounded `.collect()` calls.
- Public marketing pages use point-in-time `fetchQuery` server reads. Portal operational screens retain reactive `useQuery` subscriptions where live updates are useful.

## Accepted bounded tradeoffs

- Exam publication and attendance submission intentionally process a complete roster in one atomic mutation, capped at 500 candidates/students because correctness requires all-or-nothing publication/submission.
- A few teacher/report projections perform bounded joins and post-filtering because the current schema does not denormalize batch IDs into exam results. There is no measured signal justifying a migration-heavy digest redesign yet.
- Student finance computation reads up to 1,000 rows to preserve exact reconciliation. The explicit limit prevents silent drift and provides a clear migration trigger.

## Verification

- `npm run convex:codegen`
- `npm run typecheck`
- `npm run lint`
- `npm test` (61/61 at audit checkpoint)

Production launch must repeat Convex insights after realistic staging load and compare documents read, bytes read, execution time, and OCC conflict rates for the listed flows.
