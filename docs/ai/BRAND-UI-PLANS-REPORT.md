# VSN | Metafields — brand, workspace and package limits

## Status

Implementation, local release checks, required remote CI, Cloudflare readiness, staging runtime acceptance and Shopify staging configuration/five-block release are complete at development `50031b53c50bf27982cf5295d2ae4229bb36ce15`. Active staging version: `staging-metafields-50031b53c50b`. Signed-in merchant and two-theme visual acceptance remain unverified. This is not a production release certificate.

## Scope and compatibility

- Display name: `VSN | Metafields` across app home/header/page metadata, root landing page, health display metadata, production/staging Shopify configuration, extension group name and project identity. Internal service IDs, app IDs, existing URLs, handles and `pro-plan` remain stable.
- Fixed the reported Metaobjects Application Error: the first render compared two absent types and then accessed `entries.data.nodes` before data existed. Reproduced the original exact HEAD component as `Cannot read properties of undefined (reading 'nodes')`; the corrected actual component passes loading/empty/error SSR regression cases.
- Added a responsive workspace header/navigation, content task cards, contextual links, pricing comparison, visible billing recovery and import/metaobject loading/empty states. Advanced metaobject validations are collapsed and new field keys avoid collisions after removal.
- Added seven searchable help topics, step-by-step instructions and FAQs for definitions, values, metaobjects, imports, storefront, plans and recovery. Preserved connection diagnostics and permission request flow.

## Packages

| Capacity / price                     |   Starter |    Growth |       Pro |
| ------------------------------------ | --------: | --------: | --------: |
| USD every 30 days                    |        19 |        35 |        55 |
| New-subscription trial days          |         5 |         5 |         5 |
| Rows per CSV import job              |        10 |        50 |       100 |
| Items per list value                 |        16 |        64 |       128 |
| Fields per new metaobject definition |         3 |        10 |        25 |
| Products                             | Unlimited | Unlimited | Unlimited |
| Theme block types                    |         5 |         5 |         5 |

All tiers include current standard/custom definitions, supported typed values, metaobjects, preview/import/export and all five blocks. Limits are **per operation/object**, not monthly quotas or total store counts. Imports remain under 256 KB with at most 20 saved jobs and seven-day retention. Shopify still controls owner/type availability and permissions. Representative value writes are certified for product, variant and collection; no new all-owner certification is claimed.

The previous Pro contract stays `pro-plan`, USD 55, EVERY_30_DAYS and five trial days. Its existing 100-row, 128-list-item and 25-field technical caps are preserved. An already-active subscription switch requests zero additional trial days. Historical/provider plan names reported ACTIVE retain Pro capabilities to preserve the prior any-active-subscription entitlement contract. Shopify's test flag does not revoke an ACTIVE entitlement.

## Enforcement and data safety

- Entitlements are fetched from authenticated Shopify `currentAppInstallation.activeSubscriptions`; client plan selection/amount cannot grant capabilities or set prices.
- List limits are checked in actual value and metaobject save routes and in bulk preview/apply/retry. New definition field caps are checked before Shopify creation.
- Bulk row caps are checked before preview DB work and again before acquiring an apply lease. A downgrade cannot apply or retry an oversized earlier job. Existing logs/exports remain readable under an active subscription; selected log removal remains available.
- Downgrades do not delete Shopify content. Existing larger definition metadata and selected removals remain editable. Existing definitions are not migrated or truncated. New saved list values must meet the current plan.
- Billing create/cancel still requires authenticated POST, validates Shopify confirmation URLs and checks duplicate active subscriptions. Staging stays test billing. No subscription purchase, cancellation or provider price migration was performed by this work.
- Root error boundary and Shopify App Bridge authentication handling remain intact. The UI fixture is separate from production code and cannot perform Shopify writes.

## Local evidence

- Runtime: Node 22.13.0.
- `npm run check:release`: 126 tests passed, no failures; lint, type generation/typecheck, DB model contract and full build passed.
- Dedicated tests exercise actual billing/value/metaobject route actions, authenticated entitlement failures, limit boundaries, price tampering, existing ACTIVE test subscriptions, no-write overflows and a post-downgrade import blocked before claim/write.
- Actual route/component SSR tests cover the Metaobjects crash, error/empty responses, three pricing cards, help and imports.
- Shopify production/staging isolation and staging contract validators passed.
- Self-review: verified legacy Pro compatibility, new-tier monotonic limits, downgrade retention, per-operation wording, billing trial behavior, plan-derived server guards and preservation of Shopify authentication boundaries.

## Remote verification

- PR #169 merged the branded workspace and package implementation to development `4a0ba0f8c1f2dd395d1f2d8fa0bd77ab6ca3b9d9`. App Validation run `37071816437`, integrity and dependency security audit passed.
- Cloudflare readiness run `37071816369` exposed a stale boot-smoke assertion for the old display name despite HTTP 200 responses. PR #170 changed it to the shared `APP_NAME`; the corrected development source is `50031b53c50bf27982cf5295d2ae4229bb36ce15`.
- Corrected-source Cloudflare Readiness `37072471634` and integrity `37072471698` passed. Runtime staging `37072689721` passed the exact-source health/session/subscription checks, 21 representative typed-value cases, metaobject lifecycle, bulk mixed outcomes and diagnostics. All disposable fixture cleanup passed with zero failures.
- Existing subscription metadata remains `pro-plan`, ACTIVE, test=true, USD 55 every 30 days and five trial days. It was read only. Actual new-tier billing transitions are not certified by these checks.
- Shopify staging release `37073199061` passed the exact-source runtime gate, 126 contracts, five-block build, isolated app upload/release and active-version listing. Provider output confirms staging app `VSN | Metafields`, active version `staging-metafields-50031b53c50b` and `production_app_changed=false`. Three synthetic compliance topics were enqueued; CLI success is not independent proof of final delivery receipt.
- Machine evidence: `docs/evidence/metafields-brand-ui-plans-2026-10-03.json`.

## Visual and release limits

- Local UI fixture bundles the actual workspace/routes with explicitly simulated Shopify data. It is not merchant acceptance.
- Browser visual checks are **not passed**: agent-browser Chrome installation failed on certificate validation, the official Playwright browser download returned unusable archives, and the cloud browser rejected the localhost fixture URL. No desktop/mobile screenshots or WCAG certification are claimed.
- Signed-in merchant clicks, Shopify approval navigation, real Starter/Growth subscription transitions, two themes, rich text/media/reference rendering and accessibility remain pending.
- The previous Specifications block settings-count advisory remains unresolved by this UI batch.
- Staging configuration was released and the provider confirmed its new name. The live installed app name remains unverified and awaits the separate production configuration release. Official reference: https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration
- Main/live release and physical Supabase/retained Worker cleanup remain separate pending work. Production is unchanged by this batch.
