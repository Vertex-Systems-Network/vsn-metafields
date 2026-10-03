# Metafields recovery procedures

Scope: feature staging and separately approved production release. Source procedures: `docs/development-release-flow.md`, `.github/workflows/cloudflare-staging-deploy.yml`, `.github/workflows/cloudflare-production-version-rollback.yml`, `.github/workflows/cloudflare-production-acceptance.yml`, `config/cloudflare/production-cutover.json`. These instructions are a runbook; an unexecuted drill is not recovery evidence.

## Bad feature deployment

1. Record deployed source, Worker, app/client, shop and database endpoint using sanitized runtime/workflow output. Staging must be `vsn-metafields-staging` and certified Neon endpoint `ep-snowy-surf-b3gxl2wf`. Stop on mismatch.
2. Preserve failing run IDs and exact errors without tokens, session URLs, merchant values or database credentials. Distinguish auth, database, Shopify rate/permission, UI and theme failures.
3. Fix/revert on a development-derived branch, review and run Node22.13.0 `npm run check:release` plus repository integrity. Preserve schema/setting IDs and saved content; never roll back by deleting data.
4. Merge normally to development, dispatch the staging workflow from development with its staging confirmation, and require exact source identity, API probe, retained values and complete disposable cleanup.
5. Release the matching staging Shopify extension only after runtime acceptance passes. Recheck affected merchant/theme tasks. A prior green SHA is not acceptance for a changed tree.

## Production stop/rollback

Do not deploy production from this runbook without separate release authorization. Inspect the protected-main release evidence and current rollback-window state first. The old24-hour rollback window is recorded closed; do not pretend the previous Worker is automatically authorized. The manual version-rollback workflow rejects a closed/mismatched window. Use only a separately reviewed recovery plan through the actual guarded workflows. Verify exact current/candidate/retained Worker identities, migrations and the actual subscription/session fingerprint. Do not use the old Railway endpoint or delete the retained version. Current-feature rollback/roll-forward and post-deploy acceptance remain unexecuted.

## Shopify auth/permission/provider failure

Confirm staging identity and granted scopes through diagnostics/probes. Read success does not imply write permission. Never loop auth redirects, replay expired session URLs or grant scopes automatically. Follow explicitly authorized owner-consent UI; keep unsupported resources on native paths. For GraphQL rate failures, preserve bounded error/retry behavior and pagination. Failed imports retain immutable previews/snapshots; resume/retry only eligible rows and inspect conflicts before writing. Do not recreate a whole import or blindly retry mutations after an ambiguous response.

## Database/session or content recovery

Fail closed on database identity/access errors; do not run production migrations from local/staging. Session and job records belong to their shop/environment. Preserve logs without raw rows. Before any provider restore, identify backup timestamp, restore target, approved scope and actual provider capability; compare schema/source compatibility, isolate restored verification and reconcile subsequent writes. No backup availability, restore result, RTO or RPO is invented. A provider restore and outage drill remain pending separate evidence; no destructive drill is run here.

## Privacy webhook receipt check

Enqueued delivery is not a received/signed webhook. Verify provider delivery outcome against the matching app/topic and privacy-safe receiver evidence. Check raw-body signature enforcement, topic handling and per-shop disposition; do not copy payloads or credentials into reports. If independent receipt evidence is unavailable, retain pending status. Never issue genuine customer/shop redaction as a test; any mutation drill must use explicitly disposable staging identities and approved boundaries.

## Evidence and escalation

Record exact SHA/run IDs, sanitized failure class, expected/actual behavior, cleanup and recovery time measured during a real drill. Source self-review, service probes and release receipts have distinct evidence boundaries. Financial approvals remain user actions. Merchant data deletion, live promotion, scope/security expansion and legacy-provider removal need their own concrete authorization. Assign an actual operator before relying on emergency response; do not invent an on-call contact or SLA.
