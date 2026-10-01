# Development, Staging, and Live Release Flow

This is the required environment order for VSN Metafields feature development:

**Local development on `development` (or a short-lived branch based on it) → isolated staging → reviewed release to `main` → guarded live production.**

The merchant reports an existing local setup. Its actual runtime, credentials and Shopify connection have not been independently inspected here; validate locally before claiming a local test passed.

## 1. Local development

Start from current `development`. Create a short-lived feature branch based on it when changes need review. Keep commits and tests local first:

```bash
git switch development
git pull --ff-only origin development
npm ci
npm run dev
npm run check:release
```

Local secrets stay in ignored files. Use a development Shopify app/store and non-production database; verify actual env bindings before running writes. Never point local migrations, session operations or webhooks at production. Local execution is not staging acceptance.

## 2. Staging

After local checks, merge/review feature work into `development` according to repository protection. The existing `Cloudflare Staging Deploy` workflow is **manual dispatch**, and it checks out the `development` ref; a push to `development` runs relevant CI but does **not** automatically deploy staging. Dispatch the staging workflow from its approved workflow ref with confirmation `DEPLOY_DEVELOPMENT_TO_STAGING`, then verify the deployed source SHA matches the tested development commit.

Staging uses its dedicated Shopify app identity, shop, Cloudflare Worker and Neon endpoint. Verify Admin auth, scopes, definitions/values, theme editor blocks, storefront render, sessions, webhooks, billing reads, accessibility and regression. Record test evidence and differences; failure returns to local/development. Staging cannot change the live Shopify app URL or subscriptions.

## 3. Release source

`main` is the protected release branch. Promote the **staging-verified development commit** through a reviewed `development → main` PR and required checks. A planning/feature PR targets `development`, not `main`. A merge to `main` is not a production deployment.

## 4. Live production

Prepare an exact immutable source SHA from protected `main` using the guarded manual Cloudflare production workflow, then run independent production acceptance and the required Shopify app-version/release workflow for changes that require it. Keep release approval, billing/subscription fingerprint, production Session/token readiness, migrations, health and rollback evidence. Current certified rollback uses a previous Cloudflare Worker version; the old Railway endpoint is not a valid assumed rollback target. Production deployment/cutover is never triggered by local runs, a development push, staging dispatch, or a main merge.

## AI execution guard

Before **every** mutation or release, identify current Git branch, target environment, Shopify client/app identity, database endpoint, Cloudflare Worker, source SHA and authorization. Fail closed on mismatch. Never report local, staging or live verification based on the other environment's result. Never skip a stage to save time; record an explicit blocker if staging or live access is unavailable. Do not start the next stage until its previous-stage evidence is linked to the work unit and release record.

This document is the required routing contract for future feature work. Existing production rollback-window certification remains an independent prerequisite and is not superseded by a new feature plan.
