# Cloudflare migration baseline

This document defines the safety boundary for moving VSN Metafields from Railway hosting to Cloudflare.

## Main anchor

- Repository: `Vertex-Systems-Network/vsn-metafields`
- Original migration baseline: `b36462870009d756d3d68efa324d5e36976c9cbb`
- PHASE-01 start anchor: `36dd19a5068f0fca9638768fc7cfea65b8d2b62a`
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
- The current Pro plan is USD 55 every 30 days with a 5-day trial.

Hosting migration must not alter these billing semantics. The 5-day / USD 55 change was an independently authorized product change and is not part of the hosting migration mechanism.

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

## PHASE-01 staging readiness

The PHASE-00 security baseline is closed. Issue #41 completed the protected project-history rewrite and the destructive session-clear route remains absent.

Current Cloudflare preparation is deliberately staging-only:

- `wrangler.jsonc` targets `vsn-metafields-staging`;
- there are no production routes/custom domains in committed Wrangler config;
- Worker secrets/database URLs are not committed;
- production Shopify URLs remain on Railway;
- billing creation/cancellation is forbidden as a staging-validation mechanism;
- Railway remains the production rollback target.

The first runtime compatibility milestone must keep the existing PostgreSQL database. The current standard Prisma client is not yet treated as Workers-certified; the next work unit must validate a Cloudflare-compatible Prisma PostgreSQL driver-adapter path before any staging deployment.

## Tracking

GitHub issue: #4


## Staging readiness evidence

Work unit 1/6 is complete on the guarded migration branch:

- migration invariant validator: pass;
- React Router production build: pass;
- Wrangler `4.141.0` Worker bundle dry-run: pass;
- Shopify production `client_id` and Railway URLs: unchanged;
- billing mutation during staging validation: still forbidden;
- PostgreSQL/Prisma session store: unchanged.

The dry-run proves packaging readiness only. It does not certify live database connectivity from Workers; that is the next work unit.


## Prisma Worker runtime evidence

Work unit 2/6 is complete on the guarded migration branch:

- Prisma Client / CLI: `6.19.3`;
- `@prisma/adapter-pg`: `6.19.3`;
- `pg`: `8.23.0`;
- Prisma generator: `engineType = "client"` (no Rust query engine);
- same PostgreSQL datasource and Session schema retained;
- same Shopify `PrismaSessionStorage(prisma)` integration retained;
- real CI PostgreSQL store/load/delete session round-trip: pass;
- Prisma validate + migrate deploy: pass;
- lint, typecheck, contract smoke, build: pass;
- Wrangler staging dry-run: pass.

No production database contents or Shopify subscriptions were migrated or mutated. The next milestone is execution inside the actual Workers runtime and staging-only deployment preparation.


## Workerd runtime and staging deployment evidence

Work unit 3/6 is complete on the guarded migration branch:

- full built React Router app boots under `wrangler dev` / workerd;
- HTTP readiness probe returns the expected VSN Metafields application response;
- isolated Worker-side PrismaPg + Shopify PrismaSessionStorage store/load/delete round-trip passes against ephemeral PostgreSQL;
- staging bindings are declared without committed secret values;
- `.wrangler/` and `.dev.vars*` are ignored;
- staging runtime deployment is automatic only for protected `main` runtime-path changes via the `cloudflare-staging` GitHub environment;
- manual `DEPLOY_STAGING_ONLY` dispatch remains available as a controlled fallback;
- the deploy workflow refuses the Railway production Shopify URL;
- no production Shopify URL, billing state, merchant install, database contents, or Railway service is changed.

The next milestone is an isolated Cloudflare staging deployment from protected `main`, followed by Shopify authentication, existing subscription-read, webhook, embedded-navigation, and session-continuity validation.
