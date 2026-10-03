# Remaining-task batch and environment titles — 2026-10-03

Base development: bdd2d2741b2bf46475f8ba9901d749a08c038cd8. User requested remaining-task execution, Dev/Staging titles, unchanged production name and a factual final report. This batch follows local -> reviewed development -> isolated staging. It does not promote main/live or renew the previously declined Shopify sign-in.

## Implemented titles

| Environment | Display name | Source |
| --- | --- | --- |
| Local | VSN \| Metafields (Dev) | Local runner explicitly sets APP_ENV=local; the existing ignored local Shopify config name is normalized on dev start |
| Staging | VSN \| Metafields (Staging) | Trusted server APP_ENV=staging and staging Shopify TOML |
| Production | VSN \| Metafields | Trusted APP_ENV=production; production Shopify names remain unchanged |

Server loader data supplies page metadata, public landing title, workspace header/footer and Fields & values page headings through a shared React context. Health reports the same public display name and source. Request URLs do not select identity. Bundler optimization mode cannot override an explicit deployment environment. Only a public display name is serialized; no environment object or credentials reach clients. Local example TOML is supplied for missing machine-local setup; no local app/store identity or credentials are invented. App version is1.2.3.

## Remaining records completed in this batch

- Architecture proposals ADR0001..0003 link their existing accepted replacement ADR0006, preserving the reference-retention and supported-validation amendments. No new architecture authorization is asserted; exact historical decision time remains unknown.
- Three recovery procedures are registered against the actual runbook. Operators remain unassigned and drill results absent; a runbook is not an executed restore.
- Current project pins and official upstream lifecycle sources are recorded. Node22 major-line EOL is2027-04-30; that does not certify old22.13.0 patch security. Shopify2026-07 is currently documented as accessible until2027-07-16 15:00 UTC. Sources: https://github.com/nodejs/Release and https://shopify.dev/docs/api/usage/versioning (checked2026-10-03). No API/runtime/dependency upgrade is performed. Operator patch assessment stays pending.
- Historical PRODUCT-only research snapshot is explicitly superseded by the actual v1.2.2 service evidence:25 definition-owner reads,118 discovered types and21 representative value cases. Value mutation scope remains Product/ProductVariant/Collection.

## Verification and honest boundaries

Local Node22.13.0 release check passed156 tests, lint, typecheck, database model parity and build. A subsequent actual-loader/metadata/health test passed with the complete workspace test file (12 tests), including trusted environment precedence, ignored URL overrides, unchanged plan metadata and absence of secret values. Integrity and diff checks passed. CI and staging results are appended only after completion. Authorized self-review is not an independent reviewer or persistent Supervisor certification.

Pending: current authenticated app/control images for Help center; actual Shopify admin name/menu, full merchant value/metaobject/import/picker flows; tier/downgrade and approval navigation; both unpublished themes; mobile/320px/200% zoom/keyboard/screen-reader/contrast; measured performance; independent signed compliance receipt verification. Specifications45-settings advisory remains physically present and tracked; no saved setting IDs are removed. The earlier sign-in refusal/automatic accounts-redirect rejection is not bypassed, nor is the local browser-preview protocol rejection.

Remaining production assurance: independent release review, qualified privacy/retention review, actual operator/risk assignments, patch assessment, provider backup/restore/outage drill and tamper-evident privileged audit certification. Production promotion, genuine subscription approvals, merchant-data deletion and legacy-provider/retained Worker cleanup remain separately bounded. META-001..012 counts remain3 complete,7 verification_required,1 in_progress,1 not_started; service tests alone cannot close these browser/outcome tasks.
