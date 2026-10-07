# Shopify Metafields Builder

## Current staging status — 2026-10-07

- **Current development source:** `c387156977483666b6bd5a27794e4056709f2f7e`.
- **Bulk loader CPU fix:** merged as PR #220 and deployed to isolated staging. [Staging deployment run #73](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/37700944893) passed.
- **Live staging request check:** selected an existing saved import and used **Refresh selected job**. The embedded page reloaded its saved-job data and rendered the stored result (complete, 1/1 processed, revision 3; stale-value conflict correctly showed “no write was made”). This was read-only; no import was applied.
- **Not yet fully accepted:** zero-start merchant flows across all app pages, accessibility/performance, current theme/editor validation, and independent compliance-webhook receipt verification remain open. The live UI check above covers only the bulk saved-job read/refresh path.
- **Production:** no production deploy, app release, subscription change, or import apply was performed in this validation.

The detailed production migration and rollback records below are historical evidence from earlier phases. Their dates, SHAs and completion claims describe those records; they are not a current overall product-completion checklist.

# Shopify Metafields Builder

## Historical engineering status (earlier phase snapshot)

- **Repository:** `Vertex-Systems-Network/vsn-metafields`
- **Lifecycle:** PHASE-01 — Cloudflare subscription-safe migration
- **Verified baseline:** `36dd19a5068f0fca9638768fc7cfea65b8d2b62a`
- **Application validation:** green — install, Prisma validate/migrate, lint, typecheck, contract smoke tests, build
- **Dependency security:** production high/critical audit green; full installed tree high/critical audit green
- **Residual high/critical dependency advisories:** none under the permanent audit gate
- **ANPOS quality gate:** green
- **Shopify secure-major upgrade:** complete
- **Auth/webhook/billing/metafield contract smoke coverage:** complete and enforced in CI
- **History-hygiene tooling:** committed — purge runbook, read-only audit script, repository-bound + expected-main + exact-ref-allowlist guarded local-mirror helper, synthetic safety tests, machine-enforced ref-retirement policy + SHA-bound private freeze guard + non-executable administrator maintenance bundle + tree-preserving post-rewrite certifier + SHA-bound non-main ref retirement executor
- **Active P0 blocker:** none — protected project history rewrite is complete and ruleset protections are restored
- **PHASE-00 progress:** 100% complete
- **PHASE-01 progress:** 7/7 current production entitlement work units complete; live hotfix accepted
- **Active work:** Issue #4 rollback window certified and closure recorded; physical legacy asset cleanup remains separate

The protected project history has been rewritten and `main` is the sole live branch. The application tree was preserved exactly across the rewrite. AI Native Quality Gates now perform a normal fresh clone of `main`, require zero reachable accidental `..git/` paths, and run `git fsck --full`. GitHub-managed `refs/pull/*` retain legacy PR snapshots outside normal project branch/tag control; that platform-side dereference/GC item is tracked separately and is not treated as a live project-ref blocker.

Cloudflare migration safety: the existing Shopify app identity, paid subscriptions, and Railway production URL remain unchanged during preparation. Neon environments are strictly separated: the existing Neon endpoint `ep-snowy-surf-b3gxl2wf`, currently under the dashboard project name `vsn-metafields`, is the staging database and its canonical name is `vsn-metafields-staging`. Live production must use a different Neon project named `vsn-metafields-production`. The production endpoint must first be repository-certified before the guarded Production Neon Provisioning workflow can run. Provisioning then verifies the exact endpoint ID, pooled/direct URL pair, zero pre-migration Session rows, applies the Prisma schema, and records safe evidence. Schema provisioning success is separately certified before the 4 audited production Shopify Session rows can be copied from restored Supabase; Session migration success is separately certified before Worker deploy or independent acceptance.

Prisma Worker runtime: Prisma `6.19.3` now uses the engine-less client with `@prisma/adapter-pg`; the existing Shopify `PrismaSessionStorage` contract and PostgreSQL Session schema are unchanged. CI proves a real session store/load/delete round-trip through the adapter.

Workerd runtime: CI now boots the full React Router app inside the Cloudflare Workers runtime and separately proves PrismaPg + Shopify PrismaSessionStorage store/load/delete behavior against isolated PostgreSQL. Staging deployment is manual-only. Production Shopify is on Cloudflare. The former Railway rollback endpoint now returns HTTP 404, so rollback protection has been moved to the certified previous Cloudflare Worker version instead of depending on Railway runtime reachability.

Cloudflare staging auth: fully verified on the isolated staging app/store. Shopify now requires expiring offline access tokens for Admin API access; `future.expiringOfflineAccessTokens` is enabled, session refresh fields are present, and staging Admin GraphQL plus subscription reads pass.

Billing invariant: the Pro plan is centrally defined as USD 55 every 30 days with a 5-day trial and contract-tested so API creation, health metadata, and package UI cannot silently drift apart.

Shopify staging version safety: the dedicated staging app identity is no longer represented by the production client ID in source control. A guarded manual workflow can create an unreleased staging Shopify app version using the staging app automation token, verify the staging client ID differs from production, and carry the required app/uninstalled, app/scopes_update, and compliance webhook subscriptions before any manual release.

Production database identity: Neon project `vsn-metafields-production` is certified as project `nameless-breeze-35836648` with endpoint `ep-flat-mouse-b5z1wu54`; staging remains pinned to `ep-snowy-surf-b3gxl2wf`. Production schema provisioning is certified from successful run `36635943764`. The 4 audited production Shopify Session rows have now been atomically copied from restored Supabase to Neon through authenticated platform connectors after source count/token/fingerprint verification; full-row equality was verified before commit, and independent post-copy checks confirm 4 sessions / 4 access tokens on both source and target. Production Prepare run `36652638277` deployed Worker version `8a0d51eb-74d4-4041-8216-89aef63e1a52`, and independent Production Acceptance run `36652893746` passed database/session/runtime/billing metadata checks. Production Offline Token Migration run `36655885762` then migrated and verified both legacy offline tokens without reinstall or billing mutation. Shopify Production Cutover Candidate run `36656394999` created unreleased version `cloudflare-production-cutover-8d201357d738-4` from source `8d201357d738bb715dd4e53fc09d841685126aef`; its read-only subscription snapshot covered 2 shops / 2 active subscriptions with digest `af26a6fe5b407c4ca07f05a65c6c332cad54649739961013705d0f56ebd81c76`. Shopify Production Cutover Release run `36657352966` released exact candidate `cloudflare-production-cutover-8d201357d738-4` to users. Pre/post subscription snapshots remained identical at 2 shops / 2 active subscriptions with digest `af26a6fe5b407c4ca07f05a65c6c332cad54649739961013705d0f56ebd81c76`; Cloudflare Worker health passed after release and three compliance webhooks were enqueued. Cloudflare is the recorded live target. The production entitlement hotfix then refreshed the two expired offline Shopify access tokens using their still-valid refresh tokens, deployed Worker version `f25977a9-b02e-492c-9e01-6d3de120c5a8` from source `e706ce3cdbcc8998f4686ee039e0e59aeaa6574b`, and was accepted by successful runtime-hotfix run `36690095989`. The exact 2-shop / 2-active-subscription digest remained unchanged.

Release baseline: the currently certified production runtime source is `e706ce3cdbcc8998f4686ee039e0e59aeaa6574b`, accepted on Cloudflare Worker version `f25977a9-b02e-492c-9e01-6d3de120c5a8`. The previous certified source `c184b25628fc5c59a1110c6fe9ec49e11ce31b05` remains available as Cloudflare Worker rollback version `8a0d51eb-74d4-4041-8216-89aef63e1a52`. Protected `main` remains the dispatch authority, and production runtime changes continue to use exact immutable source SHAs.


Rollback window: successful entitlement-hotfix acceptance reset the 24-hour window at `2026-09-30T08:31:09Z`, so the earliest permitted closure is `2026-10-01T08:31:09Z`. Until then, certified Cloudflare rollback version `8a0d51eb-74d4-4041-8216-89aef63e1a52` must remain available. The guarded `Production Rollback Window Certification` workflow must pass Cloudflare health/current source, USD 55 / 5-day billing metadata, the exact 2-shop / 2-active-subscription fingerprint, production Session/token readiness, and previous Worker-version rollback availability. Temporary Supabase cleanup remains forbidden until certification is recorded.

Closure evidence: certification run [`36926166869`](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/36926166869) succeeded on protected `main` SHA `6fb39e14592d8aec75740385e2b247021690f73f` at `2026-10-01T21:05:13Z`. It refreshed and verified both production offline tokens, confirmed the unchanged subscription digest `af26a6fe5b407c4ca07f05a65c6c332cad54649739961013705d0f56ebd81c76` (2 shops / 2 active), verified 4 Session rows / 4 tokens, Worker health, source and billing metadata, and availability of the previous Cloudflare version. The 24-hour window was recorded closed at `2026-10-01T21:08:53Z`. Certification performed no Cloudflare rollback-version deletion or Supabase cleanup. Both assets remain retained pending separate inventory, retention and provider-verified cleanup decisions. The manual version rollback workflow is gated to an active window and no longer operates under the closed state.
