# Metafields feature work units

Execution stage for every work unit: local/development branch and local verification, then manual development-to-staging dispatch and staging verification, then reviewed development-to-main promotion and guarded live release only where applicable. An unverified local setup is never accepted as staging evidence. See `docs/development-release-flow.md`.

This queue is a feature proposal; it does not claim a Supervisor lease, Worker claim, agent identity, implementation, test pass or production readiness. It does not replace PHASE-01's rollback certification.

| ID | Module | Work unit | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| META-001 | MOD-META-CAPABILITY | Pin API version and inventory owner/type/validation/scopes/storefront matrix | Production rollback state reconciled | Primary docs plus staging GraphQL probes; unsupported entries marked |
| META-002 | MOD-META-DEFINITIONS | Record namespace/access ADR and safe migration | META-001 | Existing values retained, deletion impact reviewed |
| META-003 | MOD-META-DEFINITIONS | Standard template discover/enable and custom create/edit/delete | META-002 | Staging API contracts, pagination, errors |
| META-004 | MOD-META-VALUES | Typed editor for scalar/list/reference values | META-003 | Write/read representative types; invalid data rejected |
| META-005 | MOD-META-THEME | Theme extension Single Field block | META-004 | Theme editor plus desktop/mobile storefront, empty/private states |
| META-006 | MOD-META-THEME | Specifications block with ordering/formatting/design controls | META-005 | Two themes, multiple instances, WCAG checks |
| META-007 | MOD-META-METAOBJECTS | Definitions, entries and reference display | META-001, META-004 | Reusable content end-to-end |
| META-008 | MOD-META-BULK | Previewed CSV and resumable bulk edit | META-004, validated need | Mixed valid/invalid rows, idempotency, job bounds |
| META-009 | MOD-META-THEME | Rich media/reference/FAQ/variant blocks | META-005, META-007 | Typed renderers, variant updates, fallback |
| META-010 | MOD-META-OPERATIONS | Onboarding, permissions, entitlement and diagnostics | META-003, META-005 | Merchant task completion, server-side gate |
| META-011 | MOD-META-OPERATIONS | Staging E2E, accessibility, security, performance and release preflight | META-006, META-009, META-010 | Actual evidence in traceability, safe rollback |
| META-012 | MOD-META-OPERATIONS | Progressive production rollout | META-011, independent rollback certification | Unchanged billing/subscriptions, health, stop/rollback evidence |

At work start, map each ID into the canonical coordination/work queue using authenticated project runtime and preserve module/option/requirement links. Do not mark ready/complete from this table alone.

## Batch 1, 2, 4 implementation

Capability, definition lifecycle and Single Field/Specifications code is implemented on a development-derived feature branch. See `docs/ai/METAFIELDS-BATCH-124-REPORT.md`; META-001/002/003 representative staging acceptance is complete; META-005/006 remain `verification_required` until actual theme acceptance exists. The user authorized self-review for this batch; enforced repository/environment gates remain in effect.

## Batch table items 3, 5, 6

The latest conversation table maps 3 to META-004, 5 to META-007/008/009, and 6 to META-010. These are implemented together on a development-derived branch. See `docs/ai/METAFIELDS-BATCH-356-REPORT.md` for exact bounds, failure evidence and pending browser acceptance. This batch does not claim production release or all-type/all-owner mutation verification.
