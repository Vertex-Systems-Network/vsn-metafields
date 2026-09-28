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
- **PHASE-01 progress:** 3/6 work units complete; work unit 4 staging auth validation active
- **Active work:** Issue #4 — Cloudflare staging auth is working; embedded navigation and 15-day trial consistency are being finalized; no production cutover authorized

The protected project history has been rewritten and `main` is the sole live branch. The application tree was preserved exactly across the rewrite. AI Native Quality Gates now perform a normal fresh clone of `main`, require zero reachable accidental `..git/` paths, and run `git fsck --full`. GitHub-managed `refs/pull/*` retain legacy PR snapshots outside normal project branch/tag control; that platform-side dereference/GC item is tracked separately and is not treated as a live project-ref blocker.

Cloudflare migration safety: the existing Shopify app identity, paid subscriptions, Railway production URL, and PostgreSQL-backed Prisma session store remain unchanged during staging preparation. The repository now carries a staging-only Wrangler baseline and a CI dry-run/invariant gate before any Cloudflare deployment is allowed.

Prisma Worker runtime: Prisma `6.19.3` now uses the engine-less client with `@prisma/adapter-pg`; the existing Shopify `PrismaSessionStorage` contract and PostgreSQL Session schema are unchanged. CI proves a real session store/load/delete round-trip through the adapter.

Workerd runtime: CI now boots the full React Router app inside the Cloudflare Workers runtime and separately proves PrismaPg + Shopify PrismaSessionStorage store/load/delete behavior against isolated PostgreSQL. Staging deployment is manual-only and production Shopify URLs remain on Railway.

Cloudflare staging auth root cause: the fresh Neon schema is migrated and reachable, but Shopify's Prisma session adapter begins its readiness query when `PrismaSessionStorage` is constructed at module scope. Cloudflare Workers forbid database/network I/O outside a request context, so the adapter reports a misleading missing-session-table error even while request-time Prisma counts succeed. The current candidate moves Prisma/session database work into request-scoped operations and disconnects after each operation.

Billing invariant: the Pro plan trial is centrally defined as 15 days and contract-tested so API creation and package UI cannot silently drift apart.

Shopify staging version safety: the dedicated staging app identity is no longer represented by the production client ID in source control. A guarded manual workflow can create an unreleased staging Shopify app version using the staging app automation token, verify the staging client ID differs from production, and carry the required app/uninstalled, app/scopes_update, and compliance webhook subscriptions before any manual release.
