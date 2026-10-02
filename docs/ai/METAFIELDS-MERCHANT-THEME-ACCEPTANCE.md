# Merchant and theme acceptance batch

This is the execution checklist for the remaining META-004/005/006/007/008/009/010/011 acceptance. Implementation and representative Shopify API evidence exist; these browser tasks are still pending. META-012 remains a separate reviewed production release. No production customer data may be copied into staging.

PR167 fixes passed113 local/CI contracts and were merged as development e90b9f764865f4d10ee7add4bc7de3941bf50a68. Exact-source runtime37066444570 and active staging extension37066820946 passed; all disposable fixture cleanup succeeded. Proof: `docs/evidence/metafields-storefront-qa-2026-10-03.json`. The following browser rows remain pending.

## Current review findings

Review base: development `25ebf0937fe5bf31abe6ca765d6bdbcd23565f58`. Review is an authorized self-review, not an independent reviewer or a persistent Supervisor certification.

| Finding | Severity / affected paths | Evidence and disposition |
| --- | --- | --- |
| Superseded variant request could replace the current selection, including a return to the original variant during debounce | High correctness; `extensions/vsn-storefront/assets/vsn-metafields.js` | Fixed: invalidate pending requests when the selection arrives; hide stale content; only the current controller may replace a block or clear busy state. Deterministic out-of-order response tests run the actual shipped asset. |
| Serial block requests could continue an obsolete selection after a slow first response | Medium correctness/resource impact; same asset | Fixed: launch the eligible block requests together, so every pending request is invalidated on the next selection. |
| Hidden original/empty blocks could not recover when the selected variant ID matched their stored ID; stalled requests had no deadline | Medium availability; same asset | Fixed: hidden anchors may refresh; each request aborts after eight seconds and hides stale data on failure. Tests cover recovery, timeouts and detached theme-editor blocks. |
| Relative links with backslashes or embedded tab/newline/carriage return can normalize into an external address | Medium security; `snippets/vsn-safe-link.liquid` | Fixed: reject backslashes and those raw control characters. Scalar/reference fixtures reject the unsafe paths and retain escaped locale-relative paths. |
| One section request per eligible block can duplicate section downloads | Low performance/debt; variant refresh asset | Deferred: current requests are debounced, canceled and bounded. Measure actual two-theme latency/network volume before introducing shared-request ownership and cancellation complexity. Not a claim of measured storefront performance. |
| Shopify-specific rich text/image/video filters and theme event integration are outside LiquidJS/VM doubles | Acceptance gap; all five blocks | Pending actual Shopify rendering on two unpublished themes. Local fixtures deliberately throw for unsupported Shopify-only filters. |

No dependency, database schema, billing price, entitlement, owner mutation scope or production configuration change is required for these fixes. Existing module boundaries and server-side authorization stay in place. Tests use deterministic timers and controllable responses, including responses that deliberately ignore abort signals; they are not browser screenshots or WCAG certification.

## Required browser evidence

Use the isolated staging app and staging shop. Record the runtime SHA, active extension version, actual theme name/version, viewport, task result and screenshot for each material state. Theme names are not invented before access. Use two unpublished Online Store 2.0 themes; do not publish either test theme. Use only disposable synthetic product/variant/collection/metaobject data, and record cleanup. Do not delete genuine merchant data or create/cancel/approve a subscription during an automated acceptance run.

| Work unit | Task / observable success | Current evidence boundary |
| --- | --- | --- |
| META-004 | Open a product, variant and collection value editor; save scalar, zero/false, structured/list and accessible reference values; reopen and verify; reject invalid values; show conflict after another edit | API/contract evidence passed; authenticated merchant UI pending |
| META-007 | Create a private merchant definition and draft entry; edit one field while preserving others; inspect exact public-access/publish confirmation; verify populated-definition removal is refused | API lifecycle passed; actual confirmation, validation and error UI pending |
| META-008 | Upload quoted CSV; inspect immutable preview and mixed saved/invalid/conflict rows; resume from history; export before snapshots; retry only eligible failures | Durable/API evidence passed; CSV UI/task completion pending |
| META-010 | Follow setup guide; verify actual scope/plan/database diagnostics; optional media/page picker gaps must be visible; preserve native unsupported paths | API diagnostics passed; merchant onboarding pending |
| META-005 | Add Single Field; test context/override, fallback, empty/private values, false/zero, lists and rich text; save/reopen all relevant settings | Extension build and fixtures passed; Shopify rendering pending |
| META-006 | Add Specifications; reorder fields, override namespace, hide empty fields, format values; use two instances and every layout | Extension build and fixtures passed; two-theme editor/storefront pending |
| META-009 | Add Reference Cards, FAQ and Media; test mapped/public fields, incomplete entries, native disclosures, lazy images, controlled video and unsupported files | Extension build and supported fixtures passed; real media/filter execution pending |
| META-005/006/009 | In both themes change variants rapidly and return to the original; simulate a failed section request; verify no stale or other-product value; verify empty-to-populated recovery and overrides | Deterministic shipped-JS tests passed; actual theme events/network behavior pending |
| META-011 accessibility | Keyboard-only forms/pickers/errors/dialogs, visible focus, labels, native FAQ disclosures, screen-reader errors/busy states; 200% zoom/320px reflow; desktop/mobile touch targets; actual configured contrast | Semantics/static review only; WCAG 2.2 AA acceptance pending |
| META-011 performance/security | Record two-theme section request count/latency and layout behavior; verify escaped untrusted values and private data suppression; record required signed webhook delivery outcomes | Bounds and safe-link fixtures passed; measured storefront and independent webhook delivery evidence pending |
| Billing follow-up | Observe the merchant Buy Plan action reaching a Shopify approval screen with visible navigation/error fallback, then return to app | ACTIVE test-plan read is verified; approval navigation is pending. Financial approval remains a user action. |

If Shopify access is absent, keep these tasks pending. The earlier declined sign-in handoff is not renewed by a generic continue instruction. Record the access limitation and complete independent code/contract/CI work without manufacturing UI evidence.

## Completion and promotion

Attach screenshots and actual task results to requirement traceability and the relevant work units. If a task fails, fix it first on a development-derived branch, run applicable checks, merge normally to development and redeploy the exact development source to isolated staging. Recheck affected scenarios on both themes. Keep a clear distinction between fixture, service, browser and release evidence.

Only after applicable merchant/theme/accessibility/security/performance acceptance passes may META-011 complete and a reviewed development-to-main release candidate be prepared. Preserve the production rollback gate and retained previous Worker version. A main merge is not a live deployment.
