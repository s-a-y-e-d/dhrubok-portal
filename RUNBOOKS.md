# Dhrubok Portal operational runbooks

## SMS outage or low balance

Keep the domain operation committed; never reverse attendance, payments, or results because SMS failed. Disable SMS in owner settings if failures are systemic, inspect the durable message queue and latest provider balance, restore credentials/balance, then retry only eligible failed rows. Confirm provider reports and charges before bulk retry.

## Monthly billing rerun

Preview the target `YYYY-MM` period and confirm active enrolments and fee plans. Run monthly generation for that period; generation keys make reruns idempotent. Compare created charge counts and run owner reconciliation for sampled students. Never delete charges to rerun billing.

## Payment entered incorrectly

Locate the payment and receipt, verify the student and allocations, then use the owner-only void operation with a reason. The system reverses allocations and updates the summary. Record the corrected replacement as a new payment; do not edit or delete the original.

## Incorrect published result

Record the reason, reopen the published exam, correct marks through the assigned teacher flow, return every roster row to ready, and republish as a new version. Students continue seeing the last published snapshot during correction. Confirm corrected-result SMS idempotency and merit ranking.

## Locked-out account

Confirm the person, approved Google email, role record, and portal account status out of band. Owners can reset an unclaimed reservation or suspend/reactivate access subject to last-active-owner protection. Never attach an identity based only on an unverified email.

## Deployment failure

Follow the rollback steps in `DEPLOYMENT.md`. Preserve logs and deployed image/function identifiers. Avoid destructive database rollback; prefer a forward-compatible repair and reconciliation.

## Backup/export rehearsal

Use current Convex-supported export capabilities in staging. Record the export timestamp and schema/function revision, restore into an isolated environment, and compare row counts plus finance/report totals. Production export, retention, and restore execution require authorized account access.
