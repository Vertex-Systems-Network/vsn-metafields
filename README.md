# Shopify Metafields Builder

## Engineering status

- **Repository:** `Vertex-Systems-Network/vsn-metafields`
- **Lifecycle:** PHASE-00 — existing app reconciliation & security baseline
- **Verified main:** `271f675828d692ecbd06dc9ef0b032aea9ff5ff3`
- **Application validation:** green — install, Prisma validate/migrate, lint, typecheck, contract smoke tests, build
- **ANPOS quality gate:** green
- **React Router:** 7.18.4 patch/security line validated and merged
- **Shopify secure-major upgrade:** complete
- **Auth/webhook/billing/metafield contract smoke coverage:** complete and enforced in CI
- **History-hygiene tooling:** complete — purge runbook, read-only audit, ref-retirement plan, guarded local-mirror purge helper, synthetic safety-regression test
- **Active P0 blocker:** Issue #41 — historical `..git/` purge requires an administrator-controlled ruleset maintenance window
- **PHASE-00 progress:** ~99%

The current application and audited live branch-tip trees contain no direct accidental `..git/` entries. Historical Git metadata remains reachable through ancestry. Repository-side preparation is complete; PHASE-00 can close only after the controlled history rewrite, protection restoration, secret-safe verification, and fresh-clone validation.
