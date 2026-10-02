# Capability, definitions and storefront blocks batch (table items 1, 2, 4)

User instruction: treat these items as one batch, perform self-review, and hold the conversational approval/review loop for this work. This does not disable GitHub branch rules, protected environments or production safeguards.

Source: feature/metafield-capability-definition-blocks, based on development 7943d0db24882e0cc82340d5a0a3e80a3e900391. Includes the prior unmerged definition/value/block foundation. Target: development. No live release is part of this batch.

## Implemented

| Area | Result |
| --- | --- |
| Capability | Pinned 2026-07, 26 enum entries including disabled deprecated owner, runtime type/validation catalog, actual granted scopes, selected-owner read probe and API write authorization |
| Definitions | Paginated all-namespace list, official standard enable, custom create, metadata edit, scoped removal preserving values, private Storefront API default, namespace/access ADR |
| Single field | Explicit/current context and resource overrides, selected variant, labels, fallback, supported typed rendering |
| Specifications | Five ordered namespace/key rows, mixed namespaces, empty state, row/table/card layouts and columns |
| Design | Desktop/mobile font sizes and padding, alignment, width, spacing, colors, borders, radius, label typography, boolean/date/link/list/image formatting and device visibility |
| Variant refresh | Theme events/form changes, per-block section fetch, product identity guard, request cancellation, stale-response guard and hiding stale values on failure |
| Verification | Node 22 local release checks, behavioral Shopify service mocks and Liquid fixture tests; isolated staging lifecycle probe prepared |

## Evidence and limits

- `npm run check:release` passed on Node 22.13.0: lint (zero errors; one existing warning in packages), typecheck, SQLite/Neon Session model contract, 68 contract/render tests, Prisma clients and React Router build.
- Shopify CLI 4.8.2 theme extension build passed after adding the required locales directory; settings-count advisory remains. ANPOS repository integrity validation passed.
- Self-review found/fixed empty unsupported-list wrappers, multiline formatting, stale variant response races, cross-owner stale field selection, and deprecated standard visibility input, and legacy bulk pinning that silently changed storefront access without the active-plan gate. Pinning now preserves access and confirms each result.
- Shopify public pinned schema retrieval is unavailable (network failures and an official proxy 404). The staging lifecycle probe now validates the owner inventory and extracted GraphQL documents against the authenticated 2026-07 shop schema before any fixture mutation. Its actual result must be recorded before claiming API compatibility.
- Staging capability/lifecycle execution passed in run 36983997108. Shopify extension release passed in run 36985386231. Two-theme editor/storefront tests, real rich-text/image filters, accessibility and device screenshots still require actual evidence. Unit fixtures are not that evidence.
- All owner enums are inventoried, but writes/values for all 25 active owners are not claimed verified. Unsupported scopes/store capabilities return actual authorization errors.
- Advanced value editors, type/data migrations, metaobject/taxonomy renderers and bulk/CSV remain later work. Basic existing value editing supports product/variant/collection and six scalar types.

Acceptance status: representative capability/definition foundation verified on isolated staging; storefront blocks released to isolated staging, with actual theme editor/storefront verification still required. Do not mark all blueprint tasks complete.

## Publication and remote checks

PR #153 targets development. Initial published commit f3199805247c019231d9e98d6e6fd1b22c50ff41 passed App Validation run 36934316343 and ANPOS repository-integrity run 36934316366. Development requires zero approving reviews and successful checks; no ruleset was changed. Follow-up adds development-only staging extension version/release automation and includes the value-read query in authenticated schema validation. Staging acceptance is still pending actual runs.

## Development merge and first staging execution

PR #153 merged into development at af320d32b336f75110f8570ca6c047a1ef272ee5. Final PR App Validation (36934898996) and ANPOS integrity (36934898915) passed. Post-merge Dependency Audit (36981843229), Staging Readiness (36981843141), ANPOS (36981843106) and App Validation (36981843135) passed.

Cloudflare Staging Deploy run 36982126594 deployed that source successfully; isolated Neon migrations, runtime/billing health, offline Shopify session and subscription reads passed. Metafield acceptance failed **before fixture mutation** because the legacy pin mutation used an unsupported id input. Authenticated 2026-07 schema requires namespace/key/ownerType. This follow-up fixes that input, reports every GraphQL validation error together, and reuses the already registered staging release workflow so extension release can execute from development without promoting unverified code to main. Extension release requires a successful staging acceptance run for the exact development SHA. All theme acceptance limitations above remain open.

Second staging run 36983378465 again passed deployment/health/session/subscription checks, and authenticated validation confirmed the app documents after the pin fix. The only remaining schema rejection was the probe's deprecated collectionCreate input argument: the introspection request omitted deprecated input values. Probe now requests full deprecated input metadata and uses the current collection/CollectionCreateInput API. No fixture mutation occurred in either failed run.

## Successful authenticated acceptance and extension release follow-up

Run 36983997108 passed on development 2f634842a4473d303d3942be0a3ef3ed2abe5cbc at 2026-10-02T08:27:40Z. Its safe JSON result is committed at docs/evidence/metafields-staging-2026-10-02.json. All 25 active owner definition reads, 118 type entries, exact owner enum and 28 GraphQL documents, product/variant/collection lifecycle and retained values, product standard enable, and fixture cleanup passed. Staging has two stored sessions and zero active subscriptions: subscription reads passed; paid UI entitlement is not certified. No existing merchant resources were edited. META-001/002/003 representative foundation acceptance is now complete; META-005/006 actual theme acceptance stays open.

Shopify staging release run 36984305286 stopped before upload because source contract tests ran after staging client-ID injection. Reorder those steps without weakening the placeholder/isolation assertion. The actual 8,516-template product catalog also needs searchable bounded selection; this follow-up adds name/namespace/key search and displays up to 50 matches.

Runtime note: initial batch local checks used Node 22.13.0 as previously recorded. This resumed session's prior cached Node path was absent; follow-up local checks executed on the host Node 24.19.0. Required remote CI for PRs #154/#155 ran Node 22.13.0 and passed. Future local checks explicitly verify the executable version. Main remains dde3ba16539c892b140cce72b3039dd55d42edf6; no production release is part of this batch.

Final local follow-up checks explicitly printed Node v22.13.0 and passed npm run check:release, all 68 tests, ANPOS integrity and diff checks before publication.

## Final staging result

Final application source is development 4be9bb290c6761ded7aeefa4d475a6440c7bab65 (PR #156). Runtime run 36985174278 passed the full lifecycle and retained-value acceptance again. Shopify Staging Release run 36985386231 built/uploaded the extension and released staging-metafields-4be9bb290c67 at 2026-10-02T08:41:19Z; CLI versions list confirmed active. Production app configuration diff was empty. All three compliance webhook topics were enqueued; this is not independent delivery confirmation. Specifications retains the 45-settings advisory. Safe combined evidence: docs/evidence/metafields-final-staging-2026-10-02.json.

Remaining acceptance: authenticated Shopify staging theme editor and storefront checks on two compatible themes, real rich-text/image filters, variant refresh integration, responsive/device screenshots and accessibility. Browser opened the actual staging shop and reached Shopify sign-in; no signed-in admin session is available yet. Backend Shopify session verification is separate from browser authentication. No claim of finished theme acceptance, full mutation coverage for every owner/type, advanced value editors, or production launch is made.

Code work, self-review, required CI, isolated staging API acceptance and staging extension release are completed within the authorized batch. Remaining theme acceptance is awaiting authenticated site access. Main is unchanged; live was not deployed. This final follow-up changes evidence documents only and identifies the exact deployed application SHA above.
