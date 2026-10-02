# Typed values, advanced features and operations — batch table items 3, 5, 6

The user authorized autonomous implementation and self-review in the prior batch and now requested items 3, 5, 6 together. The most recent conversation table maps 3 to typed values (META-004), 5 to advanced metaobjects/bulk/specialized blocks (META-007/008/009), and 6 to onboarding/permissions/diagnostics (META-010). These table numbers are distinct from META identifiers. An older planning artifact uses a different six-item table; it is not used to silently expand this batch to live release.

Source branch: feature/metafield-values-advanced-operations, based on development d72f3f4f25c561fee4cadc681de73a91e19fbd1f. Target: development, followed by isolated staging. Main and live are separate protected release stages.

## Implementation and acceptance contract

| Item | Implemented boundary | Evidence required |
| --- | --- | --- |
| 3 Values | Typed scalar, structured JSON/rich text, measurements, lists and accessible references; product/variant/collection resource context; compareDigest-protected writes | Representative staging write/read and stale-write rejection |
| 5 Metaobjects | Merchant-owned definition create/list/metadata edit, typed entry create/list/edit/delete, draft/public confirmation, empty-only definition removal, reference integration | Disposable staging lifecycle and omitted-field preservation |
| 5 Bulk | CSV template/parser/export, server-side immutable preview, before snapshots, 100-row/256 KB bound, durable shop-isolated SQLite/Neon jobs, ten-row chunks, per-row invalid/conflict/failure outcomes, retry and crash recovery | SQLite additive migration/session preservation and failure tests, staging mixed-row apply |
| 5 Specialized blocks | Reference cards, FAQ and image/video Media, safe mappings, bounded rendering, responsive layout, existing guarded variant refresh | Shopify extension build/release; actual two-theme editor/storefront/media tests remain necessary |
| 6 Operations | Setup guide, actual scope/entitlement/database diagnostics, optional-picker gap reporting, Shopify request for already configured base permissions, saved import history and recovery guidance | Representative staging diagnostics; real merchant onboarding still requires signed-in browser and a valid plan |

## Data and recovery

The migration adds MetafieldJob only. Session models/fields remain intact; local SQLite and hosted PostgreSQL job models match. Job contents are merchant product/variant/collection values, not customer/order data or credentials. Jobs expire after seven days and become inaccessible; expired jobs are physically deleted on the next import preview, and all shop jobs are removed on authenticated uninstall/shop-redact. There is no scheduled purge claim. Keep at most twenty active jobs per shop. An old Worker can ignore the additive table; do not drop it during rollback while snapshots may be needed.

Preview binds resource/definition/type/value and original compareDigest. Apply confirms job ID/hash and optimistic ledger revision. Each write rechecks definition/reference availability, and Shopify compare-and-set prevents overwriting a changed value. Invalid rows are skipped; conflicts need a fresh preview. Failed rows can retry against the original snapshot; successful rows are not repeated. If Shopify succeeded but saving progress failed, resume recognizes matching values and avoids another write. This is convergent recovery, not a claim that Shopify offers a transaction spanning the external API and app database.

Before export restores previously existing values through a fresh preview. New values have no before value and require selected manual removal. Bulk delete, automatic destructive rollback, unrestricted large background imports, and definition/type migrations are outside this bounded workflow.

Metaobject updates use existing timestamp checks and field patches that preserve omitted fields. Shopify does not offer an atomic compareDigest for these entry updates; an external concurrent edit between the read and write remains possible. Definition type/field keys remain immutable here; destructive field migrations use the native editor. Definition removal is restricted to empty definitions with a second entry check. App/Shopify-owned types are read-only.

## Verification record

Initial focused test run passed 83 tests; the next run including three specialized Liquid behavior fixtures passed 86. Lint passed with zero errors and one existing packages-page hook warning. Typecheck passed. The first build detected an extra exported helper in an API route referencing server-only code; the helper is now internal so React Router can strip it. Final release checks and staging result must be recorded below after they execute.

Existing paid-plan behavior is retained on every values/metaobjects/references/bulk read/write route. Diagnostics are authenticated and can explain a missing plan. Staging previously has zero active subscriptions; service-level API probes do not certify a paid merchant UI flow. No charge/subscription creation/cancellation is part of this batch.

Real Shopify browser acceptance remains pending: the prior sign-in request was declined. No new sign-in attempt or credential access is implied by local/service test success. Shopify rich-text/image/video filters, two-theme editor/storefront integration, accessibility, responsive screenshots and complete merchant onboarding require actual evidence. Unit fixtures do not supply it. Unsupported types and owners stay explicitly in Shopify’s native editor; this does not claim writes for all 118 catalog types or every owner.

## Local quality and self-review completed

Explicit Node v22.13.0 final npm run check:release passed: zero lint errors (one existing hook warning), typecheck, Session/MetafieldJob model parity, 86 tests, Prisma generation and React Router build. Shopify CLI 4.8.2 staging app build passed for all five blocks. The three new blocks have 25/23/22 settings; only existing Specifications retains the 45-settings advisory. ANPOS integrity/staging isolation/migration-invariant checks passed. Control-plane conformance ran 21 cases: 20 passed, one pre-existing skip (not claimed as executed).

Self-review also restricted public access widening for populated metaobject definitions to exact confirmation, kept omitted entry fields intact, made JSON request bodies bounded while streaming, bound single-value reloads to the submitted identity, and retained preview hash integrity during failed-row retries. The final code still requires CI and actual isolated staging execution; local quality is not that evidence.

## Development publication and billing follow-up

PR #158 merged to development at aa5e23ec64748200855d66b7b67e01a1936be5b5 after App Validation run 36992767217 and AI Native Quality Gates run 36992767258 succeeded on head 54caf097cbaa248b0dd8763ca6c2af72908f8597. Main remains dde3ba16539c892b140cce72b3039dd55d42edf6. This records development publication, not staging acceptance.

The merchant subsequently reported that staging plan purchase only refreshed the page. Code inspection found direct cross-origin top-window navigation and a NODE_ENV production check that also selected real billing in optimized staging builds. The follow-up uses a fresh App Bridge ID token for the explicit authenticated POST, supported window.open(url, "_top") navigation, and a visible approval link if navigation cannot complete. It prevents repeated clicks while a confirmation is available and surfaces non-JSON authentication/API failures. The return URL uses the authenticated shop and configured app key to reopen the embedded app in Shopify admin; untrusted host/shop form fields do not control it. Explicit APP_ENV staging/local/development uses test billing even with NODE_ENV production; explicit production remains real. Unknown explicit environments fail closed. Price remains USD 55 monthly with five trial days. Subscription query, mutation and cancellation responses now fail closed on malformed/error outcomes.

Node 22.13.0 release checks pass with zero lint errors/warnings, typecheck, database model parity, 91 tests and full app build. Five new executable billing tests cover staging vs live environment, fresh token POST, visible failure without auto retry, actual route return identity/test flag, and malformed/duplicate/GraphQL-error rejection using mocked authentication/API. No real billing mutation or subscription approval was performed. The reported merchant-browser refresh cannot be claimed reproduced or fixed end-to-end until the merchant approval screen is actually observed.

References used for navigation/authentication: https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/navigation-api and https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/admin. Local installed Shopify SDK billing/request implementation corroborates returning to admin.shopify.com/store/{authenticated-shop}/apps/{configured-api-key}.
