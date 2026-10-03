# Remaining acceptance batch — 2026-10-03

Staging sign-in was explicitly renewed by the user, completed through the secure handoff and positively verified. The embedded **VSN | Metafields (Staging)** app runs **v1.2.3**, source `dd29e53bdf68de20dd34a45b1b647c035be7916b`. Development is v1.2.4 (`08868a52e872949d6f1572cfb13ddd3f8363f5e1`). New changes are reviewable draft work, not deployed. The historical declined sign-in/redirect rejection no longer blocks these authorized staging checks.

## Work completed and directly observed

- Shopify's app menu exposes home without duplicate page children. The dashboard's own five destinations work. The actual Staging title and version tag are visible.
- At the observed desktop viewport, the app uses the available iframe width; the header stays sticky. Sidebar width is256px expanded/72px collapsed and occupies the remaining height below the73px header. Keyboard focus shows the collapsed item label; Escape dismisses it. Actual mouse hover/mobile/zoom/screen-reader acceptance is still pending.
- Name generates a key; manual key edits survive renaming; Use key from name restores generation. The unsaved form exposes value-validation controls. Type search has118 grouped options/icons; the single-line search returns2 variants. Resource search exposes26 owners and narrows product to2. Escape closes both dropdowns; no desktop card clipping observed.
- A private synthetic metaobject definition with required title/min3/max100 saved and reopened. Invalid `ab` produced a clear error without creating an entry. A valid `Cotton size guide` entry saved as Draft `qa-guide`; Edit readback matches. Public activation was not saved or certified.
- Quoted CSV pasted through the actual UI preserved a comma and escaped quotes in proposed values. The durable preview has2 invalid rows,0 processed and revision0. Apply remains disabled, including after checking confirmation. File chooser automation timed out twice; upload, valid mixed-row completion/resume and downloaded export are not certified.
- Workspace navigation and actual writes displayed their loading/saving messages. Diagnostics report staging, database reachable, active subscription,1 saved import and all four tool groups Ready. Readiness is not complete picker-flow acceptance.
- Actual plan cards show $19/$35/$55 and5/20/100 import rows,8/32/128 list items,2/5/25 definition fields. Pro is the existing test subscription. No financial approval, cancellation or tier change was performed.
- In the **unpublished Horizon draft194100724084**, all five VSN blocks were available, added to one section, inspected, saved and retained after editor reload; Single field reopened. Empty-source guidance is visible. No public content/filter rendering, second-theme acceptance or measured performance claim.
- **19 real app/theme screenshots** are captured under `public/help/screenshots`, identified by version/date and SHA256 in the UI evidence. Help now includes topic and block screenshots with location/step instructions, enlarge links, alt text and lazy loading. Existing conceptual diagrams remain explicitly labeled. All148 option explanations remain; screenshots show the visible source controls, not every lower setting separately.

## Fixes prepared from the observed issues

1. Native field wrapper was32px while custom select was34px. Trigger vertical padding changes4px→3px to align with32px controls; deployed verification awaits release.
2. Resource search forced words into `title:` and returned0 for `snowboard`, while an empty query fetched17 products. Both value/reference search routes now preserve bounded Shopify query syntax as GraphQL variables, including quoted phrases/operators/Unicode; over120 characters returns an actionable400 before resource lookup. Search guidance/labels describe this behavior. Primary reference: https://shopify.dev/docs/api/usage/search-syntax.
3. Starter/Growth Pro-only features incorrectly inherited checkmarks, while Pro had duplicated check text. Restricted features now use a neutral marker and included features a single check. Billing terms/entitlements unchanged.
4. Help uses actual screenshot walkthroughs for all seven topics and five blocks. These are stagingv1.2.3 baseline captures; they do not certify the pending fixes on staging.

Earlier v1.2.4 work remains: official pinned `@shopify/cli@4.8.2` local command (actual version4.8.2) and dropdown handling for visual-viewport offsets, resize/scroll and offscreen dismissal. Prior159-test checks passed. This follow-up adds meaningful route and screenshot-asset regressions. Final Node22.13.0 release check passed161 tests with0 failures, lint/typecheck/database-model parity/build; repository integrity, isolation and diff checks also passed. Results are recorded in `docs/evidence/metafields-authenticated-ui-2026-10-03.json`.

## Each remaining work unit

| Work unit | New direct evidence | Still required |
| --- | --- | --- |
| META-004 Values | Resource/definition selection and empty typed editor; search defect reproduced/fixed locally | Valid UI save/reopen, invalid/conflict states and actual page/file reference pickers |
| META-005 Single field | Horizon draft add/save/reload/reopen and actual controls | Configured public value rendering in two unpublished themes |
| META-006 Specifications | Horizon draft persistence and real controls | Two themes, two instances/reordering/layouts and editor usability;45-setting advisory retained |
| META-007 Metaobjects | Private definition/rules and invalid/valid draft entry save/reopen | Public-access confirmation, multi-field preservation and concurrent edit/error cases |
| META-008 Import/export | Durable quoted paste preview; invalid-only apply guard | Actual file upload, valid mixed outcomes, resume/history/export-download acceptance |
| META-009 Typed blocks | All five registered/persisted in one draft; empty-source guidance | Actual rich-text/media/reference filters and variant/failure/recovery behavior on two themes |
| META-010 Help/plans/onboarding | Embedded identity/menu/loaders/diagnostics, read-only tiers,19 real captures | Direct installed local Dev title, lower per-setting images, actual tier transitions and new deployed Help/fixes |
| META-011 Final QA | Authenticated staging baseline partial; source/route regression work | Accessibility/device/zoom/contrast/performance, signed compliance receipts, restore/outage drill and independent assurance |
| META-012 Production | Guarded release procedures preserved | Not started: requires previous acceptance, reviewed development→main release and independent production assurance |

Queue remains **3 complete,7 verification_required,1 in_progress,1 not_started**. Partial observations do not close broad work-unit criteria.

## Release and assurance blockers

PR186 merged to development `08868a52e872949d6f1572cfb13ddd3f8363f5e1`. Quality37146463670, validation37146463678 and staging-readiness37146463721 passed. **Dependency Security Audit37146463711 failed**. Draft PR187 contains the busboy3.2.0→3.2.2 published patch and correct runtime classification of prop-types/object-assign/react-is; its prior quality37147171812 and validation37147171818 passed. Production audit is0; the full development tree still has11 high affected package entries via the remaining `braces` advisory GHSA-vfj7-8cjw-p6xm (no published patched version at the recorded check). These are11 affected entries, not11 distinct vulnerabilities. The supported security gate remains failed, not waived. Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.

No new runtime/Shopify staging dispatch or main/live promotion followed that failure. Active extension remains `staging-metafields-dd29e53bdf68`; runtime run37144530937 and Shopify run37144739776 are the prior successful v1.2.3 release. The current UI checks certify that baseline only.

Read-only Neon endpoint lookup for `ep-snowy-surf-b3gxl2wf` requires the actual staging project ID; the connected tool is unscoped and no project-list capability is exposed. Backup existence and isolated restore are unverified. Three enqueued compliance deliveries are not signed delivery receipts. Privacy/retention, operator/risk assignments, Node patch review, tamper-evident privileged audit and independent assurance remain separate gaps.

## Retained QA fixtures

- Private `vsn_qa_20261004` definition and Draft `qa-guide` entry remain in staging.
- Saved2-row invalid preview from `2026-10-03T20:20:09.086Z` remains,0 processed; configured7-day retention applies.
- Horizon draft194100724084 contains the saved empty-source QA section with five VSN blocks. Current `test-data` theme was not edited/published.

No permanent fixture removal was attempted. Genuine product metadata, subscriptions and production were unchanged. Detailed observations, limitations and asset hashes: `docs/evidence/metafields-authenticated-ui-2026-10-03.json`.

Next engineering gate: reviewed compatible remediation of the development-tool audit, then staging deployment and remaining browser acceptance. Staging login itself is complete and no longer needs renewed permission. Backup/restore needs the real staging project/isolated target; independent and production signoff are still outstanding.
