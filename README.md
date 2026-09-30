# Shopify Metafields Builder

## Engineering status

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
- **PHASE-01 progress:** 6/6 preparation work units complete; production Worker deployed and independently accepted
- **Active work:** Issue #4 — Shopify production cutover is released and post-release verified; a repository-enforced 24-hour Railway rollback window is active

The protected project history has been rewritten and `main` is the sole live branch. The application tree was preserved exactly across the rewrite. AI Native Quality Gates now perform a normal fresh clone of `main`, require zero reachable accidental `..git/` paths, and run `git fsck --full`. GitHub-managed `refs/pull/*` retain legacy PR snapshots outside normal project branch/tag control; that platform-side dereference/GC item is tracked separately and is not treated as a live project-ref blocker.

Cloudflare migration safety: the existing Shopify app identity, paid subscriptions, and Railway production URL remain unchanged during preparation. Neon environments are strictly separated: the existing Neon endpoint `ep-snowy-surf-b3gxl2wf`, currently under the dashboard project name `vsn-metafields`, is the staging database and its canonical name is `vsn-metafields-staging`. Live production must use a different Neon project named `vsn-metafields-production`. The production endpoint must first be repository-certified before the guarded Production Neon Provisioning workflow can run. Provisioning then verifies the exact endpoint ID, pooled/direct URL pair, zero pre-migration Session rows, applies the Prisma schema, and records safe evidence. Schema provisioning success is separately certified before the 4 audited production Shopify Session rows can be copied from restored Supabase; Session migration success is separately certified before Worker deploy or independent acceptance.

Prisma Worker runtime: Prisma `6.19.3` now uses the engine-less client with `@prisma/adapter-pg`; the existing Shopify `PrismaSessionStorage` contract and PostgreSQL Session schema are unchanged. CI proves a real session store/load/delete round-trip through the adapter.

Workerd runtime: CI now boots the full React Router app inside the Cloudflare Workers runtime and separately proves PrismaPg + Shopify PrismaSessionStorage store/load/delete behavior against isolated PostgreSQL. Staging deployment is manual-only. Production Shopify is now on Cloudflare; the Railway source remains preserved only for rollback during the active rollback window.

Cloudflare staging auth: fully verified on the isolated staging app/store. Shopify now requires expiring offline access tokens for Admin API access; `future.expiringOfflineAccessTokens` is enabled, session refresh fields are present, and staging Admin GraphQL plus subscription reads pass.

Billing invariant: the Pro plan is centrally defined as USD 55 every 30 days with a 5-day trial and contract-tested so API creation, health metadata, and package UI cannot silently drift apart.

Shopify staging version safety: the dedicated staging app identity is no longer represented by the production client ID in source control. A guarded manual workflow can create an unreleased staging Shopify app version using the staging app automation token, verify the staging client ID differs from production, and carry the required app/uninstalled, app/scopes_update, and compliance webhook subscriptions before any manual release.

Production database identity: Neon project `vsn-metafields-production` is certified as project `nameless-breeze-35836648` with endpoint `ep-flat-mouse-b5z1wu54`; staging remains pinned to `ep-snowy-surf-b3gxl2wf`. Production schema provisioning is certified from successful run `36635943764`. The 4 audited production Shopify Session rows have now been atomically copied from restored Supabase to Neon through authenticated platform connectors after source count/token/fingerprint verification; full-row equality was verified before commit, and independent post-copy checks confirm 4 sessions / 4 access tokens on both source and target. Production Prepare run `36652638277` deployed Worker version `8a0d51eb-74d4-4041-8216-89aef63e1a52`, and independent Production Acceptance run `36652893746` passed database/session/runtime/billing metadata checks. Production Offline Token Migration run `36655885762` then migrated and verified both legacy offline tokens without reinstall or billing mutation. Shopify Production Cutover Candidate run `36656394999` created unreleased version `cloudflare-production-cutover-8d201357d738-4` from source `8d201357d738bb715dd4e53fc09d841685126aef`; its read-only subscription snapshot covered 2 shops / 2 active subscriptions with digest `af26a6fe5b407c4ca07f05a65c6c332cad54649739961013705d0f56ebd81c76`. Shopify Production Cutover Release run `36657352966` released exact candidate `cloudflare-production-cutover-8d201357d738-4` to users. Pre/post subscription snapshots remained identical at 2 shops / 2 active subscriptions with digest `af26a6fe5b407c4ca07f05a65c6c332cad54649739961013705d0f56ebd81c76`; Cloudflare Worker health passed after release and three compliance webhooks were enqueued. Cloudflare is now the recorded live target, while the Railway source configuration remains preserved strictly for rollback during the post-cutover window.

Release baseline: the certified production runtime source is `c184b25628fc5c59a1110c6fe9ec49e11ce31b05`. Protected `main` remains the dispatch authority and `development` is kept aligned through fast-forward reconciliation. Production deploy verifies the certified source is in protected-main ancestry, checks out that exact commit, and the Worker reports it through `/healthz`. Documentation/control-plane commits can therefore advance without silently changing the certified runtime payload. Production Worker deployment and Shopify live cutover remain separate manual authorization gates.


Rollback window: the production cutover released at `2026-09-30T01:55:25Z`. Railway must remain available for a minimum of 24 hours, so the earliest permitted closure is `2026-10-01T01:55:25Z`. The guarded `Production Rollback Window Certification` workflow must then pass Cloudflare health and certified source SHA, USD 55 / 5-day billing metadata, the exact 2-shop / 2-active-subscription fingerprint, 4 production Sessions / 4 access tokens, 2/2 expiring offline-token readiness, Railway runtime reachability, and rollback-source integrity. Railway retirement and temporary Supabase cleanup are forbidden until that certification is recorded.
