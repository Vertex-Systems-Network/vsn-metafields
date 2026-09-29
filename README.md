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
- **PHASE-01 progress:** 5/6 work units complete; production preflight certified
- **Active work:** Issue #4 — provision a separate `vsn-metafields-production` Neon project, bootstrap its Prisma schema through the guarded production bootstrap workflow, then migrate the 4 audited Shopify Session rows before Worker deploy + independent acceptance

The protected project history has been rewritten and `main` is the sole live branch. The application tree was preserved exactly across the rewrite. AI Native Quality Gates now perform a normal fresh clone of `main`, require zero reachable accidental `..git/` paths, and run `git fsck --full`. GitHub-managed `refs/pull/*` retain legacy PR snapshots outside normal project branch/tag control; that platform-side dereference/GC item is tracked separately and is not treated as a live project-ref blocker.

Cloudflare migration safety: the existing Shopify app identity, paid subscriptions, and Railway production URL remain unchanged during preparation. Neon environments are strictly separated: the existing Neon endpoint `ep-snowy-surf-b3gxl2wf`, currently under the dashboard project name `vsn-metafields`, is the staging database and its canonical name is `vsn-metafields-staging`. Live production must use a different Neon project named `vsn-metafields-production`; production bootstrap/migration/deploy/acceptance workflows reject the staging endpoint and require a pooled runtime URL plus its matching direct migration URL. A dedicated manual bootstrap workflow initializes only an empty isolated production Neon target, applies Prisma migrations, verifies migration history, and proves the Session table remains empty before any data copy. The restored Supabase database is only the authoritative migration source for the 4 audited production Shopify Session rows.

Prisma Worker runtime: Prisma `6.19.3` now uses the engine-less client with `@prisma/adapter-pg`; the existing Shopify `PrismaSessionStorage` contract and PostgreSQL Session schema are unchanged. CI proves a real session store/load/delete round-trip through the adapter.

Workerd runtime: CI now boots the full React Router app inside the Cloudflare Workers runtime and separately proves PrismaPg + Shopify PrismaSessionStorage store/load/delete behavior against isolated PostgreSQL. Staging deployment is manual-only and production Shopify URLs remain on Railway.

Cloudflare staging auth: fully verified on the isolated staging app/store. Shopify now requires expiring offline access tokens for Admin API access; `future.expiringOfflineAccessTokens` is enabled, session refresh fields are present, and staging Admin GraphQL plus subscription reads pass.

Billing invariant: the Pro plan is centrally defined as USD 55 every 30 days with a 5-day trial and contract-tested so API creation, health metadata, and package UI cannot silently drift apart.

Shopify staging version safety: the dedicated staging app identity is no longer represented by the production client ID in source control. A guarded manual workflow can create an unreleased staging Shopify app version using the staging app automation token, verify the staging client ID differs from production, and carry the required app/uninstalled, app/scopes_update, and compliance webhook subscriptions before any manual release.

Release baseline: the certified production runtime source is `c184b25628fc5c59a1110c6fe9ec49e11ce31b05`. Protected `main` remains the dispatch authority and `development` is kept aligned through fast-forward reconciliation. Production deploy verifies the certified source is in protected-main ancestry, checks out that exact commit, and the Worker reports it through `/healthz`. Documentation/control-plane commits can therefore advance without silently changing the certified runtime payload. Production Worker deployment and Shopify live cutover remain separate manual authorization gates.
