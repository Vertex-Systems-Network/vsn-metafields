# Staging continuation recheck — 2026-10-08

## Scope

Read-only acceptance on the existing Shopify staging store `staging-oath3rth` and its exact Worker `vsn-metafields-staging`. No production access or billing mutation. The app remains installed and active.

## Verified in this continuation

- Direct Worker Observability query, restricted to the staging Worker and `/app/api/bulk.data`, returned three GET request events in the 20-minute query window. All were HTTP 200 with Worker outcome `ok`; wall times were approximately 4.43–4.61 seconds.
- On the unpublished Horizon theme preview, the Specifications app block rendered the existing product metafield `test_data.snowboard_length` as “Snowboard length — 159.0 cm” on mobile preview.
- The temporary editor block was removed and the editor was exited without saving. No theme was saved or published.
- After a normal staging app reload, the app Home showed the Starter subscription verified, 7/7 definitions and 248 loaded standard templates.
- The reload produced two fresh GETs to `/app/api/fields.data`; both returned HTTP 200 with Worker outcome `ok`. Wall times were 2,853 ms and 3,379 ms; CPU times were 21 ms and 20 ms. This verifies the current live route on the existing populated installation.
- Two separate GETs were logged as `canceled` during an earlier in-app navigation. They are incomplete requests, not HTTP error responses; the later reload completed successfully.

## Cloudflare error/warning review

A fresh seven-day query filtered to the exact staging Worker returned 4 error events and no warning events:

- Three historical `/app/api/fields.data` HTTP 502 responses on Oct 2–3 UTC, with wall times of 21.1–23.7 seconds.
- One Oct 7 `/app` `shopify-admin-auth-failed` diagnostic. Its log indicated database URL and Shopify API credential settings were present, but did not identify a missing Prisma session table or a migration issue. Root cause remains unconfirmed.

The successful current `fields.data` requests show recovery for this check; they do not establish why the historical 502s occurred or prove that the issue cannot recur.

## Outstanding

- Zero-start installation acceptance remains untested: this active staging installation is populated, and resetting or uninstalling it would conflict with the instruction to keep it active.
- Theme verification is editor-preview coverage only. Saved/published storefront behavior remains intentionally untested.
- App-level webhook delivery receipts were not independently verifiable using the available staging Admin GraphQL view.

## Result

The live `bulk.data` and `fields.data` routes passed this recheck, and the Specifications preview passed. Staging acceptance is **not complete** while historical error cause, zero-start acceptance and independent webhook receipt verification remain outstanding.

## Follow-up: historical auth diagnostic detail

A narrowly scoped seven-day Observability query for the exact staging Worker and the `shopify-admin-auth-failed` event recovered one diagnostic (2026-10-07 UTC). The route loader's diagnostic payload recorded:

- Authentication threw a `Response` with status 302.
- The database was reachable; the staging shop had 2 stored sessions, including 1 online session.
- `SHOPIFY_APP_URL` matched the request origin.
- The request had no `id_token`, so token decode/audience/destination checks were false.

This evidence does not indicate a Prisma session-table or connectivity failure. It is consistent with an authentication redirect, but the available event does not establish why the 302 was emitted; root cause remains unconfirmed. No session, app, billing, theme, or production state was changed.

## Follow-up: compliance webhook path review

Repository review confirmed the dedicated staging Shopify config declares all three compliance topics (customers/data_request, customers/redact, shop/redact) and points them to the staging Worker. The corresponding route handlers call authenticate.webhook; the two customer routes state that no customer payload is stored, and the shop-redact route delegates shop-scoped session cleanup to the uninstall webhook. A staging-only workflow exists that releases the prepared staging-webhooks-2 app version, then sends one CLI test delivery for each compliance topic and checks that production config remains untouched.

This is code/config evidence only. The workflow has not been dispatched and no test delivery receipt was observed, so registration and live delivery handling remain unverified. The workflow requires the RELEASE_STAGING_WEBHOOKS_2 dispatch input and staging environment secrets. No available GitHub connector action in this session dispatches workflows; Shopify CLI was not run directly. Exact files: shopify.app.cloudflare-staging.toml, .github/workflows/shopify-staging-release.yml, and app/routes/webhooks.customers.data_request.jsx, app/routes/webhooks.customers.redact.jsx, app/routes/webhooks.shop.redact.jsx.

## Read-only UI and telemetry rerun — 2026-10-08

Revisited Metaobjects, Import & export, Plans, Help center, then returned the installed staging app to Home. Initial loading/checking states resolved on later snapshots; the observed route responses were successful:

- /app/api/metaobjects.data: HTTP 200, Worker outcome ok, 3,192 ms wall / 27 ms CPU.
- /app/api/bulk.data: HTTP 200, Worker outcome ok, 4,691 ms wall / 29 ms CPU.
- /app/api/status.data: HTTP 200, Worker outcome ok, 2,652 ms wall / 16 ms CPU.
- /app/guide.data: HTTP 200, Worker outcome ok, 2,537 ms wall / 15 ms CPU.
- /app/api/diagnostics.data: HTTP 200, Worker outcome ok, 4,877 ms wall / 27 ms CPU.

The pages resolved to the existing Size guide (QA) metaobject definition, 3 saved import jobs, active Starter test subscription through 2026-11-06, and Help diagnostics Environment=Staging, Database=Reachable, Subscription=Active, with product/collection, metaobject, page/article, and file/media groups Ready. The Home page then resolved to 7/7 definitions and 248/248 loaded standard templates, with the Starter subscription verified. No create, edit, apply, billing, permission, or theme action was submitted. A 10-minute exact-Worker error/warning query returned zero events. Keyboard Tab moved focus from the Help center nav item to its Connection & permissions link; this is a narrow focus smoke only, not a full accessibility audit.


## Final continuation check — active deployment and direct bulk request — 2026-10-08

This check supersedes the earlier 10-minute zero-error observation with a fresh 24-hour query and then a separate query from the latest staging deployment onward.

- Cloudflare's deployment list identifies deployment `ec5f967e-c36d-47c3-96d6-aadbd0b2a034`, created 2026-10-07 23:13:50 UTC, as 100% on Worker version `67521451-4d0e-41b3-acb3-63c85357f93f` (version 70).
- A direct authenticated GET generated by opening the app's Import & export screen hit `/app/api/bulk.data`: HTTP 200, Worker outcome `ok`, 4,932 ms wall time, 22 ms CPU, version 70. The page resolved to its saved jobs. No import was submitted.
- The exact staging Worker had 1,360 telemetry records in the preceding 24 hours. There were 21 error-level records and zero warning-level records. The error records represented two observed conditions:
  - 19 `shopify-admin-auth-failed` diagnostics on older version 67. All logged a 302 response and reachable DB with two stored sessions (one online). Sixteen lacked an `id_token`; three had one whose decoded audience and destination matched. This does not establish why those auth redirects occurred.
  - One `/app/api/bulk.data` HTTP 503 on version 69 explicitly logged `Worker exceeded CPU time limit.`
- Since the 100% version 70 deployment, the exact Worker query returned 743 telemetry records, with zero error-level and zero warning-level records. It included 320 HTTP 200 responses. The 302s were on `/` and logged as `info` with Worker outcome `ok`.
- That same post-deployment window contains two HTTP 400 responses from `/app/api/values.data` on version 70. Both queried the temporary namespace `vsn_test_20261008`, which is absent from the seven currently registered definitions and was part of the staging test-fixture cleanup. The route source returns 400 when a requested definition is missing. This makes stale lookups against the removed test fixture the likely explanation (inference; the HTTP response body is not present in telemetry). A separate one-hour check found two later values lookups, both HTTP 200 on version 70, with no repeat 400.

## Updated acceptance result

The current 100% staging release has a passing direct `bulk.data` request and no observed Worker error-level or warning-level records since deployment. Historical auth redirects and the version 69 CPU-limit 503 are absent from that post-deployment error review, but their original causes are not proven. The two `values.data` HTTP 400s are consistent with stale requests to the removed test namespace; two subsequent requests passed and no recurrence was observed in the one-hour recheck. Zero-start acceptance, independent webhook delivery receipts, saved/published theme behavior, and a full accessibility audit remain outstanding. The staging app was returned to its Home screen and remains installed and active.
