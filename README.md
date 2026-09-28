# Shopify Metafields Builder

## Engineering status

- **Repository:** `Vertex-Systems-Network/vsn-metafields`
- **Lifecycle:** PHASE-00 — existing app reconciliation & security baseline
- **Verified main:** `47d3fca9fb8f51fe291c7039e404612888b8c33d`
- **Application validation:** green — install, Prisma validate/migrate, lint, typecheck, contract smoke tests, build
- **Dependency security:** production high/critical audit green; full-tree critical audit green
- **Residual development-tool advisories:** tracked in Issue #54; no forced breaking audit fix used
- **ANPOS quality gate:** green
- **Shopify secure-major upgrade:** complete
- **Auth/webhook/billing/metafield contract smoke coverage:** complete and enforced in CI
- **History-hygiene tooling:** committed — purge runbook, read-only audit script, guarded local-mirror helper, synthetic safety tests, ref-retirement plan
- **Active P0 blocker:** Issue #41 — historical `..git/` purge requires an administrator-controlled ruleset maintenance window
- **PHASE-00 progress:** ~99%

The current application and audited live branch tip trees contain no direct accidental `..git/` entries. Historical Git metadata remains reachable through ancestry, so PHASE-00 cannot close until the controlled history rewrite is completed and validated from a fresh clone.
