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
- Staging capability/lifecycle execution, Shopify extension upload/release, two-theme editor/storefront tests, real rich-text/image filters, accessibility and device screenshots are not yet certified. Unit fixtures are not that evidence.
- All owner enums are inventoried, but writes/values for all 25 active owners are not claimed verified. Unsupported scopes/store capabilities return actual authorization errors.
- Advanced value editors, type/data migrations, metaobject/taxonomy renderers and bulk/CSV remain later work. Basic existing value editing supports product/variant/collection and six scalar types.

Acceptance status: implementation prepared; staging/theme verification required. Update this record with actual PR/CI/staging results rather than marking all blueprint tasks complete.

## Publication and remote checks

PR #153 targets development. Initial published commit f3199805247c019231d9e98d6e6fd1b22c50ff41 passed App Validation run 36934316343 and ANPOS repository-integrity run 36934316366. Development requires zero approving reviews and successful checks; no ruleset was changed. Follow-up adds development-only staging extension version/release automation and includes the value-read query in authenticated schema validation. Staging acceptance is still pending actual runs.

## Development merge and first staging execution

PR #153 merged into development at af320d32b336f75110f8570ca6c047a1ef272ee5. Final PR App Validation (36934898996) and ANPOS integrity (36934898915) passed. Post-merge Dependency Audit (36981843229), Staging Readiness (36981843141), ANPOS (36981843106) and App Validation (36981843135) passed.

Cloudflare Staging Deploy run 36982126594 deployed that source successfully; isolated Neon migrations, runtime/billing health, offline Shopify session and subscription reads passed. Metafield acceptance failed **before fixture mutation** because the legacy pin mutation used an unsupported id input. Authenticated 2026-07 schema requires namespace/key/ownerType. This follow-up fixes that input, reports every GraphQL validation error together, and reuses the already registered staging release workflow so extension release can execute from development without promoting unverified code to main. Extension release requires a successful staging acceptance run for the exact development SHA. All theme acceptance limitations above remain open.
