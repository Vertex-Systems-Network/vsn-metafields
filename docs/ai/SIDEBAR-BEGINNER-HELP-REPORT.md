# VSN | Metafields 1.2.1 — sidebar and beginner help

The v1.2.0 request is implemented for full available embedded width, a sticky left desktop menu, a collapsible sticky mobile menu and proper SVG dropdown chevrons. The user screenshot is an issue reference, not acceptance evidence: `image(20261003-112731).png`, SHA256 `45da33edefbe043edafb9db72a793f24d63ce9ec587f6ac4586d93b69c8e8dfa`.

The outer 1400px width limit is removed. Each Polaris page uses its documented `inline-size="large"` attribute, including initial loading/empty states. The initial v1.2.0 sidebar occupies 208px; content expands into the remainder. Below 700px the menu collapses to preserve form width. Embedded search context is retained by all navigation links. The dropdown arrow is an outline SVG and rotates with expanded state. Fixed body-portal positioning now measures the mobile navigation bottom, rather than assuming the old horizontal menu's fixed inset.

Help now starts with a complete care-instructions example, a plain-language glossary and topic navigation. Seven searchable guides provide exact locations, steps, expected results, every principal form/action explanation, concrete examples, common mistakes and recovery advice. All 148 theme block options across Single field, Specifications, Reference cards, FAQ and Media have explanations, actual choices, ranges and defaults checked against their shipped schemas. Help search includes those settings. Controls are grouped in expandable sections to keep the initial guide readable.

## Actual image acceptance remains pending

The requested current app screenshots are **not complete**. The previous seven illustrations are retained only inside explicitly labeled conceptual-diagram disclosures; they are not presented as current app screenshots. The supplied issue screenshots show old/clipped layouts and cannot verify this correction. A local preview harness bundled actual source with fixture data, but browser rendering/capture was not verified because its file URL was rejected by the cloud browser's protocol policy. No HTTP/tunnel/alternate browser workaround was attempted. Previous Shopify login handoff was declined and an accounts redirect was automatically rejected; this task does not renew sign-in authorization. Fresh explicitly authorized authenticated staging access is needed for current app/Shopify theme screenshots and visual acceptance.

Capture plan after access is available:

| Screen | Required captures |
| --- | --- |
| Embedded layout | Full desktop workspace at the user's width, sticky header and full-height 256px sidebar while scrolled, 72px collapsed icons with hover/Tab/Escape tooltips, 320px collapsed/open mobile menu and 200% zoom |
| Fields | Resource picker; custom Name/Namespace/Key/Type and preview; One/List picker; access/pin/validation controls; advanced JSON; standard templates; registered filters/actions |
| Values | Resource search/results; Resource/Definition selection; scalar/list/reference editors; current rules; save/reload/remove feedback |
| Metaobjects | Definition selector/form; field key/label/type/required/validation; entry handle/fields/status/public confirmation; entries/edit/delete/pagination |
| Import | CSV template/upload/paste; valid/invalid preview and snapshots; confirmation/apply/continue; result/retry/remove job |
| Plans | Three actual cards, active test plan and approval navigation without changing billing |
| Help/permissions | Glossary and control explanations; ready/missing permission states and diagnostics |
| Theme editor | Each of the five app blocks, settings panels covering every actual option, desktop/mobile result and empty/reference/variant contexts |

Crop out session URLs/tokens, staff identities and unrelated merchant data; use disposable labeled example data. Link verified images to their exact guide/control groups with descriptive alt text, source SHA and captured surface. Do not label API/SSR checks as image acceptance.

## Review and verification

Self-review covers layout boundaries, mobile disclosure semantics, SVG icon accessibility, search-context preservation, picker viewport bounds, help accuracy and schema drift. No dependency, database, API mutation, billing price, Worker limit or live configuration changes are required. Production promotion is outside this scope.

Local checks, implementation CI and isolated staging outcomes are recorded in the accompanying release evidence after completion. Deterministic tests do not certify actual browser pixel layout, focus, screen-reader behavior or authenticated theme rendering.

Primary component reference: https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page (`inline-size="large"`).

## Staging 1.2.0 and requested follow-up

PR179 merged development `1f3771a89abe06ad7e170f731077d099e80eaab0`. Node22.13.0 release checks passed152 tests and integrity validation; implementation CI37121126257/37121126282 passed. Runtime37121328080 and Shopify staging release37121554175 passed for that exact source, active `staging-metafields-1f3771a89abe`. All21 representative typed cases, lifecycle, validation, bulk/metaobjects/diagnostics and complete disposable cleanup passed. Three compliance webhooks were enqueued; receipt acceptance remains pending. Evidence: `docs/evidence/metafields-sidebar-help-2026-10-03.json`.

While completing that release, the user requested a wider/full-height sidebar, sticky header, desktop collapse/expand and proper collapsed-item hover tooltips. The v1.2.1 follow-up expands the menu to256px and collapses it to72px. Desktop height is the viewport minus the measured sticky header; mobile retains a collapsible menu so content remains usable. ResizeObserver tracks header height, including wrapped headers. Popup and anchor offsets account for the header and mobile menu. Tooltip portals escape sidebar scrolling, support hover and keyboard focus, remain hoverable, close on Escape/navigation and clear their timers/listeners. Help explains the new navigation controls. Deterministic component tests cover independent desktop/mobile controls and tooltip behavior; actual browser visual/focus acceptance and current screenshots remain pending under the same access boundary.

## Staging v1.2.1 verification

PR180 merged development `80188cb9b62b59cfde30f6d8f98466063443a57c`. Node22.13.0 release checks passed all 154 tests, lint, typecheck, database contract and build. Repository integrity passed. Implementation CI37131282456/37131282492 and development CI37131577501/37131577525 succeeded. Exact-source runtime37131714509 (job111227968668) passed all 21 representative typed cases, persisted validation edits, metaobject rules/lifecycle, bulk and diagnostics; complete disposable cleanup returned no failures. Shopify staging release37131931720 (job111228585500) succeeded and activated `staging-metafields-80188cb9b62b`; production_app_changed=false. Three compliance webhooks were enqueued; receipts remain pending.

Release evidence: `docs/evidence/metafields-sidebar-collapse-2026-10-03.json`. GitHub release-summary proof is retained as `libfile_c4e87d9634308191b9506e3743775099`; it verifies the release, not the current app layout. Actual requested screenshots and full browser acceptance remain pending. No billing mutation, production promotion, dependency or database change was performed.
