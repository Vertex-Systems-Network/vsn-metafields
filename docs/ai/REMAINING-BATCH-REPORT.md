# Remaining acceptance batch — 2026-10-03

Base development: `4117a6588525f1c656259411ecbe02060ee1f1b1`. The request covers all nine remaining work units and a factual report. This batch completes executable engineering work; it does not claim unavailable merchant/theme observations or override release gates.

## Fixes and executed checks

- Local `dev:shopify` pointed at `shopify@4.8.2`, rather than the official `@shopify/cli@4.8.2`. The command now uses the official pinned CLI and `--config local`. The actual version command returned `4.8.2`; no app-dev/login/install flow was started. Official source: https://shopify.dev/docs/api/shopify-cli.
- The searchable dropdown previously treated the visible mobile viewport as starting at layout coordinate zero, and used visible height for a layout-relative bottom anchor. A panned zoom viewport or keyboard could place it outside the visible area. Positioning now uses visible offsets/bounds and layout height, follows both viewport resize and scroll, dismisses when its trigger leaves view, and removes event listeners on cleanup. Primary API source: https://drafts.csswg.org/cssom-view/#the-visualviewport-interface. These are implementation/regression results, not device-browser acceptance.
- App version is `1.2.4`; Dev/Staging/base production title mapping and all sidebar destinations remain preserved.
- Node 22.13.0 full release check passed 159 tests with zero failures, lint, typecheck, database-model parity and build. The targeted search/workspace file passed all 18 tests, including geometry and actual component event/listener regression. Repository integrity, isolation validation and diff checks passed.
- Current development evidence PR185 quality run `37145095920` is successful. Prior exact-source staging v1.2.3 evidence remains preserved in `docs/evidence/metafields-environment-titles-2026-10-03.json` until this batch's release results are appended.
- Backup inventory attempt used only the certified staging endpoint ID `ep-snowy-surf-b3gxl2wf`. The available Neon connection is unscoped and returned `project_id is required`; no project-list tool is exposed and the staging project ID is absent from the inspected project records. No project ID, backup existence or restore result is invented; no database/resource mutation was made.

## Each remaining task and its actual disposition

| Work unit | Existing verification | Still required / disposition |
| --- | --- | --- |
| META-004 Values editor | Representative API writes/readback, typed values, validation/conflict/reference contracts | Authenticated UI save/reopen, invalid/conflict states and actual page/file pickers; pending access |
| META-005 Single Field | Extension build and supported Liquid/JS fixtures | Add/save/reopen and actual Shopify rendering in two unpublished themes; pending access |
| META-006 Specifications | Fixture/layout contracts; saved setting IDs retained | Both themes, two instances/reordering/layouts and editor usability; 45-settings advisory persists |
| META-007 Metaobjects | Definition/entry lifecycle and validation service evidence | Merchant dialogs/public-access confirmation/error UX; pending access |
| META-008 Import/export | Immutable preview, mixed outcomes, resume/isolation/retry service and route contracts | Actual quoted CSV upload/task completion/history/export UI; pending access |
| META-009 Typed blocks | Supported Reference Cards/FAQ/Media fixtures and bounded refresh JS | Actual Shopify rich-text/media filters, rapid variants, failures/recovery on both themes; pending access |
| META-010 Onboarding, Help, plans | Diagnostics/scopes and tier route guards; environment names; all 148 setting explanations | Real installed local title, embedded menu/title/loader/picker/tier flows and actual current app/control screenshots; pending access |
| META-011 Final staging QA | Local/CI/API acceptance plus fixes in this batch | Actual mobile/320px/200% zoom/keyboard/screen-reader/contrast, measured performance, signed compliance delivery receipts and isolated restore/outage drill; in progress |
| META-012 Production rollout | Existing guarded release procedures | Not started: requires previous acceptance and independent release/production assurance; no main/live promotion in this batch |

The prior Shopify sign-in handoff was declined and automatic approval review rejected the subsequent accounts redirect. This instruction to continue the batch does not explicitly renew staging sign-in. No new auth flow, reused expired token URL, alternate browser login route or local-preview workaround was attempted. Current app screenshots therefore remain absent rather than being manufactured from illustrative diagrams or old uploaded screenshots.

Three enqueued compliance deliveries from the previous release are not signed delivery receipts. Backup/restore needs the actual staging project/backup/isolated target; no destructive outage or source restore was run. Privacy/retention review, operator/risk assignments, Node patch-security assessment and tamper-evident privileged audit certification remain independent assurance gaps. Authorized self-review is not independent signoff.

Queue counts remain **3 complete, 7 verification_required, 1 in_progress, 1 not_started**. No remaining work unit is closed solely because implementation or API tests passed. Production configuration, actual subscriptions and genuine merchant data are unchanged.

## Release evidence

Implementation CI and exact-source isolated staging runtime/extension results will be recorded here after they finish. Full authenticated merchant/theme acceptance remains subject to the access boundary above.
