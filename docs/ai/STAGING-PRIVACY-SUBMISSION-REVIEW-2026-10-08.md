# Staging privacy and submission review — 2026-10-08

## Code changes in PR #242

- Authenticated app/uninstalled and shop/redact handlers delete import jobs and all Session rows for the exact shop. Uninstall no longer relies on a non-null session returned with a webhook.
- Invalid bulk CSV rows persist only a row number, validity flag, and validation error. Valid product, variant, and collection rows still contain the merchant-provided metafield value and before snapshot for up to seven days. Expired jobs are physically removed on the next preview for that shop; there is no independent scheduled purge.
- customers/redact removes legacy import jobs whose saved rows identify the payload customer ID or any order ID in orders_to_redact. The entire matching job is removed to avoid leaving associated snapshots. This exact-ID cleanup does not identify personal information typed into arbitrary product metafield text.
- customers/data_request still acknowledges receipt but has no merchant-facing export/delivery workflow. The app cannot claim a complete customer data request response when arbitrary merchant-provided values may include personal information. A privacy process and data inventory must be settled before a Build for Shopify submission.

## Validation scope

App Validation runs lint, typecheck, contract tests, database checks, and build. The bulk test verifies invalid-row minimization and shop-scoped legacy redaction. Staging deploy and synthetic Shopify webhook triggers are separate manual workflows; CLI sample delivery checks handler receipt but does not establish subscription registration or a real merchant deletion journey. Do not trigger app/uninstalled on the installed staging shop because it must remain active.

## Remaining submission work

1. Define a documented response process for customers/data_request, including arbitrary merchant text, retention, and backups; verify with a representative request.
2. Verify an isolated clean install, billing and onboarding from zero without resetting the active staging store.
3. Audit accessibility/performance and saved storefront theme behavior. Specifications block has 45 merchant controls and CLI warns above 40; reducing controls needs a deliberate UX migration.
4. Resolve or document upstream npm deprecations and Shopify CLI boolean warning through supported dependency updates. Do not suppress them merely to produce a clean log.
5. Confirm live webhook subscription registration independently from synthetic handler triggers.
