# Cloudflare migration baseline

This document defines the safety boundary for moving VSN Metafields from Railway hosting to Cloudflare.

## Main anchor

- Repository: `Vertex-Systems-Network/vsn-metafields`
- Baseline commit: `b36462870009d756d3d68efa324d5e36976c9cbb`
- Production host at baseline: `https://vsn-metafields-production.up.railway.app`
- Shopify distribution: App Store
- Embedded app: enabled

## Subscription safety invariants

During the hosting migration:

1. Keep the same Shopify app identity and existing `client_id`.
2. Do not invoke `appSubscriptionCreate` as part of migration validation.
3. Do not invoke `appSubscriptionCancel` as part of migration validation.
4. Existing merchants must not be asked to uninstall/reinstall.
5. Subscription status must continue to be sourced from Shopify:
   `currentAppInstallation.activeSubscriptions`.
6. Existing active subscription IDs and statuses should be captured before cutover and compared after cutover.
7. Railway remains available as rollback until existing paid merchants are verified after production cutover.

## Session/data safety

The first hosting migration keeps the existing Prisma + PostgreSQL session store.

Current session model lives in `prisma/schema.prisma` and Shopify uses
`PrismaSessionStorage` in `app/shopify.server.js`.

Database/session-store migration is explicitly out of scope for the first production cutover.

## Current billing behavior

- Active subscriptions are queried in `app/routes/app.api.status.jsx`.
- Subscription creation uses Shopify `appSubscriptionCreate`.
- Subscription cancellation uses Shopify `appSubscriptionCancel`.
- The current Pro plan is USD 35 every 30 days with a 15-day trial.

Hosting migration must not alter these billing semantics.

## Production URL cutover guard

Do not change `shopify.app.toml` production URLs until all of the following pass on Cloudflare staging:

- app boots successfully;
- Shopify authentication works;
- existing PostgreSQL-backed sessions can be used or safely re-established without reinstall;
- Admin GraphQL requests succeed;
- `currentAppInstallation.activeSubscriptions` returns expected active subscriptions;
- webhook endpoints respond correctly;
- embedded navigation works.

Only after staging validation may the Shopify application URL and redirect URLs be changed to the Cloudflare production URL.

## Rollback rule

If post-cutover authentication, billing-read, webhook, or embedded-app verification fails, restore the Shopify production URLs to the Railway host. Do not mutate billing records to repair a hosting problem.

## Security follow-up

`app/routes/clear-sessions.jsx` contains a hard-coded query-string secret. It should be removed or replaced before production Cloudflare cutover. This security repair must not clear production sessions during migration testing.

## Tracking

GitHub issue: #4
