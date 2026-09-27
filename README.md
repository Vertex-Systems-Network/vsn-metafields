# Shopify Metafields Builder

## Engineering status

- **Repository:** `Vertex-Systems-Network/vsn-metafields`
- **Lifecycle:** PHASE-00 — existing app reconciliation & security baseline
- **Verified main:** `4f3dfc1beae9f5ce238fe5de4d3c404eb25268f5`
- **Application validation:** green — install, Prisma validate/migrate, lint, typecheck, contract smoke tests, build
- **ANPOS quality gate:** green
- **Shopify secure-major upgrade:** complete
- **Auth/webhook/billing/metafield contract smoke coverage:** complete and enforced in CI
- **History-hygiene tooling:** committed — purge runbook, read-only audit script, ref-retirement plan
- **Active P0 blocker:** Issue #41 — historical `..git/` purge requires an administrator-controlled ruleset maintenance window
- **PHASE-00 progress:** ~98%

The current application and all audited live branch tip trees contain no direct accidental `..git/` entries. Historical Git metadata remains reachable through ancestry, so PHASE-00 cannot close until the controlled history rewrite is completed and validated from a fresh clone.
