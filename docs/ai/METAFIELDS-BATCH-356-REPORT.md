# Typed values, advanced features and operations — batch table items 3, 5, 6

## Latest storefront QA follow-up — 2026-10-03 Asia/Karachi

**Variant race/recovery and safe-link fixes are merged to development and released to isolated staging. Full merchant/two-theme acceptance remains pending.**

| Evidence | Actual result |
| --- | --- |
| Implementation | [PR167](https://github.com/Vertex-Systems-Network/vsn-metafields/pull/167), head738113e714fdffb0c000714873ede9d6a055efb1, merged development e90b9f764865f4d10ee7add4bc7de3941bf50a68 |
| Checks | Exact Node22.13.0 local release checks passed: 113 tests, zero lint errors/warnings, typecheck, SQLite/Postgres contract and build. App Validation37066223055 and repository-integrity37066223011 passed. |
| Meaningful regressions | Nine deterministic tests execute the shipped JS; six fail against the prior asset, all nine pass after the fixes. Supported storefront fixtures also pass. |
| Exact-source staging runtime | [37066444570](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/37066444570)/job111035293960 passed at2026-10-02T21:25:10Z: 21 typed cases, stale-write protection, metaobjects, bulk, diagnostics, retained values and complete disposable cleanup |
| Exact-source staging extension | [37066820946](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/37066820946)/job111036670063 passed at2026-10-02T21:27:23Z. All five blocks,113 contracts; active version staging-metafields-e90b9f764865; production_app_changed=false. |
| Main/live | Main remains dde3ba16539c892b140cce72b3039dd55d42edf6. No production release or provider cleanup performed. |

Fixed: invalidate requests at selection time, including a return to the original variant; hide stale content until a verified response; start eligible blocks together; preserve the current request's busy state; recover hidden/empty anchors; abort stalled requests after eight seconds. Safe links reject backslashes and embedded tab/newline/carriage return that can normalize into external destinations. Locale-relative links and escaped captions remain supported.

Review findings and the combined remaining merchant/theme/accessibility/performance tasks are in `docs/ai/METAFIELDS-MERCHANT-THEME-ACCEPTANCE.md`. Structured exact-source evidence is `docs/evidence/metafields-storefront-qa-2026-10-03.json`. The tests use LiquidJS and VM event/network/DOM doubles: they do not certify actual Shopify filters, theme events or browser accessibility. Full acceptance counts remain3 complete,7 verification_required,1 in_progress,1 not_started (9 work units pending). No signed-in Shopify tab was available and the prior declined sign-in handoff was not repeated. Three compliance topics were again enqueued; independent delivery remains unverified. Actual billing approval navigation remains pending; read-only metadata still shows the ACTIVE test pro-plan.

Evidence-only follow-up commits are not staging runtime deployments. The following baseline and chronological failure records are preserved.

## Batch 3/5/6 verified baseline — 2026-10-02

**Development implementation, required CI, representative staging API acceptance and staging extension release passed. Full merchant/theme acceptance remains pending; this batch is not certified complete end-to-end or promoted live.**

| Evidence | Actual result |
| --- | --- |
| Final required CI | PR165 head f118213d9236d391e75fe12aec5ce3afc3ca3137: App Validation 37060442804 and AI Native Quality Gates 37060442740 passed |
| Local release checks | Node22.13.0: 103 tests passed, zero lint errors/warnings, typecheck, SQLite/Postgres parity and build passed |
| Staging runtime | Run37060758630/job111016550222, source f94962df65b02fb3e586daffd0d3dbc7aa021aa6: full pass |
| Advanced service lifecycle | 21 representative typed values, stale-write/no-overwrite, wrong references, complete metaobjects, bulk mixed outcomes/isolation/resume and diagnostics passed |
| Fixture recovery | Current/base cleanup passed; exact prior metaobject definition24588714356 recovered; prior four reference definitions recovered in run36997071272; no reported leftover fixtures |
| Billing actual read | pro-plan ACTIVE, test=true, five trial days, USD55 EVERY_30_DAYS; no agent billing writes |
| Staging extension | Run37061195975/job111017989214 passed; active version staging-metafields-f94962df65b0, all five blocks; production_app_changed=false |
| Main/live | Main unchanged dde3ba16539c892b140cce72b3039dd55d42edf6; no production deployment performed |

Structured proof: `docs/evidence/metafields-batch356-staging-2026-10-02.json`. Runtime and extension share the same exact source. Subsequent evidence-only commits are not runtime deployments. The chronological failed runs below remain part of the record and are superseded by this final service/release acceptance.

Remaining: signed-in merchant value/metaobject/import/onboarding tasks; actual purchase-approval navigation; two-theme Shopify editor/storefront, rich text/image/video/variant/empty/private/mobile states; accessibility/performance and applicable security acceptance before live. The prior browser sign-in request was declined and was not repeated. Read_files is absent; optional media/page pickers report gaps. Do not infer merchant approval navigation or full frontend acceptance from active subscription metadata.

Existing Specifications retains the 45-settings advisory. Three staging compliance webhook topics were enqueued; delivery was not independently verified. Metaobject timestamp updates and actual-empty deletion checks cannot eliminate an external read/write race. All-owner/type discovery remains broader than certified value mutations. Production rollout/cleanup stays separate.


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

Metaobject updates use existing timestamp checks and field patches that preserve omitted fields. Shopify does not offer an atomic compareDigest for these entry updates; an external concurrent edit between the read and write remains possible. Definition type/field keys remain immutable here; destructive field migrations use the native editor. Definition removal verifies both ID-bound and type-bound actual empty collections. Those reads and the deletion are separate Shopify operations; creation by another editor between the final check and deletion is a residual race, so this does not claim atomic empty-definition deletion. App/Shopify-owned types are read-only.

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

Billing follow-up PR #159 passed App Validation run 36994119055 and AI Native Quality Gates run 36994119084 and merged to development db2d5b047671445d5f78e749e156a072960b8239. Staging run 36994295498/job 110797358141 deployed that exact Worker, applied and verified the additive Neon migration, passed runtime/source/plan contract, and passed actual offline session/Admin GraphQL/subscription reads (two stored sessions, zero active subscriptions). Its final advanced lifecycle step failed honestly on dimension JSON unit normalization: Shopify returned CENTIMETERS rather than input centimeters. Base fixture cleanup passed. The extension was not released on this failed acceptance.

The measured compatibility follow-up canonicalizes aliases and measurement case to Shopify's full uppercase units, accepts returned units for re-editing, and compares structured typed semantics rather than JSON key order during bulk write recovery. Probe assertions preserve full value equality after type encoding; they do not skip measurement checks. Two executable tests cover uppercase round-trip/list measurements and changed-value/text distinction. Node 22.13.0 full release checks pass with 93 tests, zero lint errors/warnings, typecheck, database parity and build. A corrected exact-SHA staging run is required before claiming advanced acceptance.

PR #160 passed App Validation 36994830655 and AI Native Quality Gates 36994830751, then merged to development 5412817c92e6032ac56c31b75cecf7e035e2fff5. Staging run 36995055805/job 110799772398 again deployed and passed migration/runtime/session/subscription checks. The advanced step failed with four definition-cleanup errors; its finally block hid the original failure. Base cleanup passed, but that does not certify advanced cleanup. The next probe preserves original errors and failed fixture identities, and retries only explicit fully rejected THROTTLED responses (maximum four calls, 1–5 second delay). It never retries ambiguous mutation timeouts, partial-data errors or transport failures. Throttling is a hypothesis until actual diagnostics establish it. A narrow recovery targets only vsn_probe/Disposable definitions minted during this failed run's logged 10:23:01–10:23:58 UTC window, with associated values retained. Current advanced acceptance remains failed; no new extension release is claimed.

Diagnostics/recovery follow-up local verification: explicit Node 22.13.0 full release checks passed, 96 tests, zero lint errors/warnings, typecheck, database parity and build. Three new tests cover throttle-only bounded retry, no ambiguous/partial mutation replay, and failed-run recovery excluding merchant names/namespaces/outside timestamps. Shopify rate-limit guidance: https://shopify.dev/docs/api/usage/limits.

PR #161 passed CI (App Validation 36995815115, AI Native Quality Gates 36995815126) and merged a4e90553f473f7d2b7bcfcf351cb4bcc3f54856f. Staging 36996039029/job 110802855424 deployed it and passed runtime/session/subscription reads. Actual active subscriptions changed from zero in earlier reads to one at 10:33:42 UTC; the agent performed no billing mutation and did not observe the merchant browser approval itself. The run failed while recovering the disposable reference definitions: Shopify explicitly reported that reference-type definition deletion requires deleting associated metafields. This establishes a retention limitation, not a throttling root-cause claim.

Merchant reference definition removal is now rejected before any mutation, with a native-editor impact-review message. Reset preflights the entire selected namespace before removing any definitions. Ordinary non-reference deletion keeps associated values. Probe-only reference cleanup accepts only disposable identities created in the current nonce or the precisely observed failed-run window and checks the exact deleted ID; this authorized test cleanup uses Shopify's required associated-value deletion. It is never reachable from the merchant removal route. Representative reference values are deleted first and prior failed-run products were confirmed removed. The four remaining disposable definitions still require verified recovery; do not claim their cleanup before the next run succeeds.

Reference-retention follow-up verification: Node 22.13.0 full release checks passed with 98 tests, zero lint errors/warnings, typecheck, DB parity and build. Focused tests and syntax checks also passed after adding read-only active billing metadata (plan name/status/test/trial/recurring pricing, no subscription IDs or tokens). Two regressions prove merchant references cannot mutate deletion and probe reference cleanup rejects merchant identities and confirms exact IDs.


## Atomic stale-write compatibility follow-up

PR #162 passed App Validation 36996753510 and AI Native Quality Gates 36996753470, then merged development 481b330c14e0ad368a7ecde5d355cf2b981478e4. Staging run 36997071272/job 110806122517 deployed that source and passed migration/runtime/session reads, all 20 representative typed round-trips, current/base fixture cleanup, and recovery of all four prior disposable reference definitions. Active subscriptions remained one. Advanced acceptance failed because the probe expected INVALID_COMPARE_DIGEST while pinned Shopify actually rejected the stale write with STALE_OBJECT. Metaobjects, bulk, diagnostics and detailed billing metadata were not reached; no new extension release is claimed.

The correction asserts actual STALE_OBJECT and re-reads the unchanged value after rejection. Bulk import now classifies atomic STALE_OBJECT/INVALID_COMPARE_DIGEST responses as conflicts, excluded from failed-row retry. A regression simulates another editor changing the value between the read precheck and Shopify's atomic mutation: both codes preserve that editor's value and cannot retry. Explicit Node 22.13.0 full release checks passed with 99 tests, zero lint errors/warnings, typecheck, database parity and build. Exact-source staging acceptance remains required.

Self-review before dispatch also gave the deliberately invalid bulk row its own missing-definition identity, so it cannot mark the later conflict row as a duplicate. The disposable bulk definition uses the existing numeric cleanup suffix contract (21); cleanup permissions were not widened.


## Representative service acceptance and remaining cleanup guard

PR #163 passed App Validation 37058362950 and AI Native Quality Gates 37058362936, then merged development 53fd7b80ebc6ed77932ec4b24e7e6248431017e2. Staging run 37058589257/job 111009288392 passed runtime/session checks, all 21 typed cases, stale-write rejection and preserved-value re-read, wrong reference rejection, merchant metaobject create/list/edit/rename/reference/entry-delete, bulk mixed saved/invalid/conflict outcomes and shop isolation/completed resume, plus actual permission/plan diagnostics. Read-only billing metadata confirmed pro-plan ACTIVE, test=true, five trial days and USD55 EVERY_30_DAYS. No billing mutation was performed. Optional read_files remains absent.

Acceptance remained failed because the empty-definition count guard rejected cleanup immediately after confirmed entry deletion. All advanced values/definitions/entry/job and base fixtures were cleaned; exact leftover metaobject definition 24588714356 was reported. Possible delayed count convergence is a hypothesis, not a verified cause. The follow-up refreshes reads only (four attempts, three one-second waits), requires actual empty entry collection and exact numeric zero count, and preserves the merchant deletion guard. Recovery is scoped to that exact failed-run ID plus disposable type/name/access/field identity. A regression proves delayed count convergence, populated/stuck-count rejection, and merchant-type rejection without mutation retries. Full Node22.13 release checks passed with 100 tests, lint/typecheck/parity/build; a new actual staging run must confirm the outcome.


## Empty collection verification correction

PR #164 passed App Validation 37059216394 and AI Native Quality Gates 37059216568, then merged development 76c7f084d2c0b4df82a68dc352a36b69f6a979c4. Staging 37059623391/job 111012784746 deployed it and passed runtime/session reads but stopped during exact prior-fixture recovery. The reported count remained 1 through four bounded reads while the type entry connection was empty, minutes after the confirmed entry deletion. New fixtures were not started. Definition 24588714356 remained; no extension release was attempted.

The timed refresh was insufficient and is removed. Empty-only deletion now verifies the exact ID/type-bound definition metaobjects connection and the separate type-bound entry connection. Both must expose valid arrays/pagination, zero nodes and hasNextPage=false before mutation. The aggregate count is displayed as Shopify's reported count and cannot substitute for actual collection evidence. Identity mismatch, malformed data, pagination or any entry blocks deletion. UI offers Check and remove empty definition; explicit confirmation and server authorization remain. Probe recovery still targets the single observed disposable ID and exact identity constraints, and reuses the same actual-empty guard. This does not permit populated deletion or replay ambiguous mutations. The read/delete race remains an explicit limitation because Shopify provides no atomic empty-collection condition for definition deletion.

Node22.13 full release checks passed with 102 tests, zero lint errors/warnings, typecheck, SQLite/Postgres parity and build. Regressions verify empty actual collections with stale aggregate count, both sources detecting entries, wrong ID/type, malformed connection/pagination, and merchant probe rejection. Current final staging acceptance and extension release remain pending actual outcomes.

The same aggregate-count inconsistency cannot gate public-access consent: every private-to-public definition change now requires the exact PUBLIC_ACCESS confirmation, including reported count zero. UI and server agree. A regression proves no mutation without consent for zero/nonzero counts. Node22.13 full release checks passed with 103 tests, zero lint warnings/errors, typecheck/parity/build.
