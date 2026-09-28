# Shopify Metafields Builder

## Engineering status

- **Repository:** `Vertex-Systems-Network/vsn-metafields`
- **Lifecycle:** PHASE-00 — existing app reconciliation & security baseline
- **Verified baseline:** `6a3f1b49ae60917a2e58c7e4e0301158b750b2f0`
- **Application validation:** green — install, Prisma validate/migrate, lint, typecheck, contract smoke tests, build
- **Dependency security:** production high/critical audit green; full installed tree high/critical audit green
- **Residual high/critical dependency advisories:** none under the permanent audit gate
- **ANPOS quality gate:** green
- **Shopify secure-major upgrade:** complete
- **Auth/webhook/billing/metafield contract smoke coverage:** complete and enforced in CI
- **History-hygiene tooling:** committed — purge runbook, read-only audit script, repository-bound + expected-main + exact-ref-allowlist guarded local-mirror helper, synthetic safety tests, machine-enforced ref-retirement policy + SHA-bound private freeze guard
- **Active P0 blocker:** Issue #41 — historical `..git/` purge requires an administrator-controlled ruleset maintenance window
- **PHASE-00 progress:** ~99%

The current application and audited live branch tip trees contain no direct accidental `..git/` entries. Historical Git metadata remains reachable through ancestry, so PHASE-00 cannot close until the controlled history rewrite is completed and validated from a fresh clone.
