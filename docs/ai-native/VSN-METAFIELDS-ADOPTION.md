# VSN Metafields — ANPOS Existing-Project Adoption

- Adoption mode: `existing_project`
- Canonical ANPOS source: `Vertex-Systems-Network/ai-native-project-operating-system@0cbf0d7d1d2f7d5c8b2995bfbb3c895d3f1e35ad`
- Target baseline: `Vertex-Systems-Network/vsn-metafields@b36462870009d756d3d68efa324d5e36976c9cbb`
- Protocol version: `1.4.0`
- Existing application code preserved: yes
- Project-management provider: not selected
- Development-AI pool: discovery required
- GitHub Rules: pending explicit owner decision
- GitHub security capability: unknown; capability-dependent checks are not required yet

## Existing implementation observed

The repository is an embedded Shopify app using React Router, Shopify App Bridge/Polaris web components, Prisma/PostgreSQL session storage, Shopify GraphQL Admin API metafield-definition operations, App Store distribution, recurring billing, and compliance webhook routes.

## Baseline findings to reconcile first

1. Compliance webhook handlers still contain TODO paths for customer data request/redaction and shop redaction.
2. A GET loader performs the pin-fields mutation; mutations should use an authenticated non-GET action.
3. Metafield discovery is capped at the first 100 definitions and destructive reset is sequential; pagination, bounded concurrency, partial-failure reporting, and safer confirmation/evidence are needed.
4. Billing configuration is hard-coded in route code and subscription creation should reconcile existing active/pending subscriptions before creating a new charge.
5. Runtime configuration logging is overly verbose and should be reduced for production.
6. Shopify API-version configuration should be normalized across app runtime, webhooks, generated types, and upgrade policy.
7. The data model currently persists Shopify sessions only; saved templates/configuration, audit history, operational evidence, and entitlement/product state need explicit product decisions before feature expansion.
8. The repository needs project-specific automated tests, observability, threat/data classification evidence, release rollback guidance, and runbooks.

## Initial execution objective

Do not rewrite the existing app. Establish a regression-safe baseline, map current behavior into ANPOS phases/modules/work units, classify already-complete capabilities from repository evidence, then improve the highest-risk/highest-value gaps through guarded PRs.
