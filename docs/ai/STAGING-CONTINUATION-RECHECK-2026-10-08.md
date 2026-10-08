# Staging continuation recheck — 2026-10-08

## Scope

Read-only acceptance on the existing Shopify staging store `staging-oath3rth` and its exact Worker `vsn-metafields-staging`. No production access or billing mutation. The app remains installed and active.

## Verified in this continuation

- Direct Worker Observability query, restricted to the staging Worker and `/app/api/bulk.data`, returned three GET request events in the 20-minute query window. All were HTTP 200 with Worker outcome `ok`; wall times were approximately 4.43–4.61 seconds.
- On the unpublished Horizon theme preview, the Specifications app block rendered the existing product metafield `test_data.snowboard_length` as “Snowboard length — 159.0 cm” on mobile preview.
- The temporary editor block was removed and the editor was exited without saving. No theme was saved or published.
- Returned to the VSN Metafields app Home. The staging UI showed Starter subscription verified, 7/7 definitions, and 248 loaded standard templates.

## Outstanding

- **Current direct `/app/api/fields.data` HTTP result is unverified.** The attempted staging telemetry request used an invalid route and returned 404. An account-wide retry was rejected by automatic review because it could include production telemetry. No further telemetry request was made.
- A separate seven-day, exact-staging-Worker error review previously found four error events: three historical `/app/api/fields.data` HTTP 502s (Oct 2–3 UTC) and one Oct 7 auth/database diagnostic. The app Home now loads its workspace and definitions, but that does not establish the root cause or prove those historical errors are fixed. No warning events were reported in that review.
- Zero-start installation acceptance remains untested: this active staging installation is populated, and resetting or uninstalling it would conflict with the instruction to keep it active.
- Theme verification is editor-preview coverage only. Saved/published storefront behavior remains intentionally untested.
- App-level webhook delivery receipts were not independently verifiable using the available staging Admin GraphQL view.

## Result

The live `bulk.data` route and Specifications preview passed. Staging acceptance is **not complete** while the `fields.data` direct response and historical error cause remain unresolved, and zero-start/webhook receipt coverage is unavailable under the current constraints.
