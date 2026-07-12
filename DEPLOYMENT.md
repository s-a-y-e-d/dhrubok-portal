# Dhrubok Portal deployment

Production deployment is intentionally not performed by repository automation. It requires owner-approved Clerk, Convex, SMS.BD, Turnstile, DNS, domain, and VPS access.

## Environment separation

Create independent Clerk, Convex, Turnstile, and Next.js configurations for staging and production. Build-time `NEXT_PUBLIC_*` values are embedded in the browser bundle and must point to the matching environment. Runtime server secrets must not be passed as Docker build arguments.

Required build arguments:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_DEFAULT_LOCALE`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

Runtime Next.js secrets:

- `CLERK_SECRET_KEY`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`

Convex environment values are configured in the Convex deployment, not the Next.js container: `CLERK_JWT_ISSUER_DOMAIN`, `SMS_BD_API_KEY`, optional `SMS_BD_SENDER_ID`, `SMS_LOW_BALANCE_MINOR`, `TURNSTILE_SECRET_KEY`, `APP_BASE_URL`, and the one-time `BOOTSTRAP_OWNER_SECRET` until bootstrap is complete.

## Staging checklist

1. Create the staging Clerk instance with Google enabled and configure allowed origins and redirects for the staging domain.
2. Create/link the staging Convex deployment, set its environment values, then run `npm run convex:codegen` and deploy functions using the current Convex production-deploy command after reviewing current official documentation.
3. Create a staging Turnstile widget restricted to the staging hostname and configure both site and secret keys.
4. Keep `smsEnabled=false` until SMS.BD credentials, sender/content approval, and an explicit real-recipient test are approved.
5. Build the image with pinned source revision and staging public arguments. Do not use `latest` as the only rollback reference.
6. Run the container behind Caddy/nginx, confirm `/api/health`, then run public, sign-in, role authorization, and non-destructive reporting smoke tests.
7. Reserve the first owner with the one-time bootstrap secret, claim it using the approved verified Google email, initialize coaching settings, seed SMS templates, then remove/rotate `BOOTSTRAP_OWNER_SECRET`.
8. Reconcile imported student, enrolment, attendance, finance, and result totals before opening access.

## Production release

Promote the exact verified image digest from staging. Point DNS only after HTTPS, health checks, Clerk origins, Convex issuer, Turnstile hostname, CSP/connect sources, and rollback have been verified. Obtain explicit user approval before enabling SMS or sending a real message.

## Rollback

1. Stop traffic-changing operations such as imports and bulk reminders.
2. Repoint the compose image to the previously verified immutable digest and run `docker compose up -d`.
3. Confirm `/api/health`, public pages, sign-in, and read-only owner reports.
4. Do not roll Convex data backward blindly. If a schema/function rollback is incompatible, deploy a forward-compatible repair following widen-migrate-narrow and reconcile affected records.
5. Record the incident window, deployed digests, function version, and any domain writes that occurred.

See [RUNBOOKS.md](RUNBOOKS.md) for operational incidents.
