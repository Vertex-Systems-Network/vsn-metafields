# Shopify Metafields Builder

## Engineering status

- **Repository:** `Vertex-Systems-Network/vsn-metafields`
- **Lifecycle:** PHASE-00 — existing app reconciliation & security baseline
- **Verified main:** `d3e5dd9cb5717179e4619ffbcf12c94be061363c`
- **Application validation:** green — install, Prisma validate/migrate, lint, typecheck, build
- **ANPOS quality gate:** green
- **Shopify secure-major upgrade:** complete
- **History-hygiene tooling:** committed — purge runbook + read-only audit script
- **Active P0:** Issue #41 — purge historically committed `..git/` metadata from all reachable branch history
- **PHASE-00 progress:** ~97%

The current application tree is clean. Historical `..git/` content remains reachable through existing branch ancestry, so an all-ref rewrite is still required before PHASE-00 can close.
