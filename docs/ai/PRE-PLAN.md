# AI-Native Pre-Plan — VSN Metafields expansion

Status: project-specific planning draft. Existing PHASE-01 Cloudflare rollback certification remains the current production work. This feature initiative must not overwrite its resume point.

## 1. Product Objective
Enable Shopify merchants to manage supported standard/custom metafield definitions and values, then display eligible values through configurable theme app blocks without editing theme code. Primary actors: store owner/content manager, theme editor user, storefront visitor.

## 2. Scope
In: versioned owner/type capabilities; standard and custom definitions; safe management; typed values; metaobjects; theme app blocks; accessibility, import/export where justified, migration and release safety.
Out: universal storefront exposure for all Admin owners; checkout rendering via theme app blocks; arbitrary executable Liquid/HTML; pricing changes or production rollout in this planning work.

## 3. Current Repository Reality
`app/routes/app.api.fields.jsx`: PRODUCT-only, six types, fixed namespace, list/create/reset. `app/routes/app._index.jsx`: create/list/reset UI and active-plan gate. `shopify.app.toml` has product/metaobject/order-read scopes, not every proposed owner scope. Existing package has React Router, Prisma, Shopify app SDK and Cloudflare runtime. README records accepted entitlement hotfix, two active subscriptions and a protected rollback window; live verification is not performed in this planning branch. Tests/build status: README reports green baseline, but this branch has not run CI. Production and isolated staging are documented; no staging feature implementation yet.

## 4. Primary Actors and Workflows
Merchant: discover standard template or create custom definition → assign typed value → select compatible block → configure data source/design → preview → publish. Storefront visitor: see accessible, localized, non-sensitive rendering. Operator: diagnose permissions/import failures and safely roll back.

## 5. Validated Requirements
User intent: REQ-META-001 broad standard/custom definition coverage; REQ-META-002 storefront blocks and merchant customization; REQ-META-003 ANPOS planning before implementation. Derived safeguards: REQ-META-004 capability truth by owner/type/API/scope/context; REQ-META-005 existing data/subscription safety; REQ-META-006 verified end-to-end acceptance. Derived items are proposals pending product validation.

Reference inventory: `docs/ai/METAFIELDS-CAPABILITY-MATRIX.md` records the complete 2026-07 owner enum from Shopify docs and the type families; actual shop probes and scopes remain unverified. `docs/ai/METAFIELDS-DISCOVERY.md` compares Shopify native plus three publicly listed apps, separating vendor claims from outcomes. Canonical phases/work units are now in `config/ai/execution-plan.json` and linked from traceability.\n\n## 6. Assumptions Still Requiring Validation
Full owner/type list for pinned 2026-07 Admin API; scope upgrades; what users need beyond Shopify's native dynamic sources and bulk editor; whether all display presets are valuable; theme compatibility and translations; pricing/entitlement boundaries.

## 7. Constraints and Risks
Admin access does not imply Liquid access. Theme app blocks require supporting themes and cannot render on checkout pages. Type/list/reference combinations vary. Definition deletion and bulk writes carry data risk. Customer/order values are privacy-sensitive. Production release is subscription-sensitive.

## 8. Approved Technology Decisions
Current stack (fact): React Router embedded app, Admin GraphQL, Prisma/PostgreSQL, Cloudflare. Proposed extension: Shopify Theme App Extension with Liquid app blocks and minimal JS. No new technology stack is approved by this document. Material changes require recorded decision/consent under repository protocol.

## 9. Options Bank Summary
Selected for planning: OPT-META-001 standard/custom definition manager; OPT-META-002 versioned capability registry; OPT-META-003 typed values; OPT-META-004 typed theme blocks. Candidate: OPT-META-005 metaobjects; OPT-META-006 bulk jobs. Deferred: OPT-META-007 protected owner storefront display; OPT-META-008 checkout-specific UI. These statuses are planning selections, not engineering approval.

## 10. Proposed Modules
MOD-META-CAPABILITY, MOD-META-DEFINITIONS, MOD-META-VALUES, MOD-META-METAOBJECTS, MOD-META-THEME, MOD-META-BULK, MOD-META-OPERATIONS. See modules bank for boundaries and acceptance.

## 11. Phase / Milestone Strategy
Feature milestone F0: discovery, capability and market evidence; F1: product/variant/collection definition manager; F2: typed values and first field/specifications blocks; F3: metaobjects and specialized renderers; F4: broader eligible owner support, bulk operations and release. These are feature milestone names, not replacements for existing PHASE-01.

## 12. Dependency and Critical Path
Preserve rollback window; establish API capability/scope/namespace decision; then definitions → values → typed rendering → theme verification → gradual production release. Scope upgrades and subscription entitlements may block rollout.

## 13. QA Strategy
Contract tests for GraphQL/validation/entitlement; staging create/write/read/delete; type/reference/list matrix; theme-editor and storefront desktop/mobile; multiple instances, missing/private data, localization, accessibility and performance. Link actual evidence to traceability.

## 14. Security Strategy
Per-shop authentication and server-side entitlement; least-privilege scopes; public/private access separation; safe Liquid escaping; data classification/retention; deletion previews; import limits and audit; protected production release path.

## 15. Deployment / Operations Implications
Mandatory sequence: local work on `development` or a feature branch based on it → local checks → manual deployment of `development` to isolated staging → staging evidence → reviewed `development → main` PR → exact-SHA manual live deployment/acceptance. User reports local setup, but its actual runtime is unverified. See `docs/development-release-flow.md` and `config/development-flow.json`.

No feature production deploy during planning. Staging first, rollback/health/subscription snapshot verification and existing Cloudflare rollback certification remain independent. Add migration/runbook and diagnostics before release.

## 16. Unresolved Human Decisions
PM provider selection or skip; Development AI selection/identity verification; material technology/scope consent as applicable; pricing entitlement for expanded features; protected customer/order editing scope. User already authorized planning; no need to ask routine design choices.

## 17. Execution Readiness
- [x] User objective captured and repository baseline read.
- [x] Proposed options, modules and milestones decomposed and registered in the canonical execution plan.
- [x] Shopify 2026-07 documentation owner inventory and multi-app public market comparison recorded.\n- [ ] Shop-level owner/type/scope probes and merchant outcome validation completed.
- [ ] System design and ADRs accepted.
- [ ] Applicable technology consent/agent/PM selections resolved.
- [ ] Work units entered in canonical queue with verified runtime identity when used.
- [ ] CI/schema validation and staging access evidence recorded.
- [ ] Production rollback window certified independently.
No feature implementation or ANPOS execution-readiness claim yet.
