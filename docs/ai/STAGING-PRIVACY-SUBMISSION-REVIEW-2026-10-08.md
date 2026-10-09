# Staging privacy and submission review — 2026-10-08

## Code changes in PR #242

- Authenticated app/uninstalled and shop/redact handlers delete import jobs and all Session rows for the exact shop. Uninstall no longer relies on a non-null session returned with a webhook.
- Invalid bulk CSV rows persist only a row number, validity flag, and validation error. Valid product, variant, and collection rows still contain the merchant-provided metafield value and before snapshot for up to seven days. Expired jobs are physically removed on the next preview for that shop; there is no independent scheduled purge.
- customers/redact removes legacy import jobs whose saved rows identify the payload customer ID or any order ID in orders_to_redact. The entire matching job is removed to avoid leaving associated snapshots. The follow-up matches customer email (case-insensitively) or a full phone string in saved rows when Shopify omits an ID. This cannot identify arbitrary personal information that does not match identifiers in the webhook.
- customers/data_request still acknowledges receipt but has no merchant-facing export/delivery workflow. The app cannot claim a complete customer data request response when arbitrary merchant-provided values may include personal information. A privacy process and data inventory must be settled before a Build for Shopify submission.

## Validation scope

App Validation runs lint, typecheck, contract tests, database checks, and build. The bulk test verifies invalid-row minimization and shop-scoped legacy redaction. Staging deploy and synthetic Shopify webhook triggers are separate manual workflows; CLI sample delivery checks handler receipt but does not establish subscription registration or a real merchant deletion journey. Do not trigger app/uninstalled on the installed staging shop because it must remain active.

## Remaining submission work

1. Define a documented response process for customers/data_request, including arbitrary merchant text, retention, and backups; verify with a representative request.
2. Verify an isolated clean install, billing and onboarding from zero without resetting the active staging store.
3. Audit accessibility/performance and saved storefront theme behavior. Specifications block has 45 merchant controls and CLI warns above 40; reducing controls needs a deliberate UX migration.
4. Resolve or document upstream npm deprecations and Shopify CLI boolean warning through supported dependency updates. Do not suppress them merely to produce a clean log.
5. Live staging registration was independently observed in Shopify Dev Dashboard for active version `staging-metafields-d4b05e8eb3c7`: the three privacy URL fields point to the staging Worker. This establishes published configuration; synthetic CLI deliveries and earlier Worker receipts provide handler evidence, but a representative real customer request remains untested.

## Staging acceptance at source d4b05e8 — 2026-10-09 PKT

Cloudflare [run #78](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/37836465895) and Shopify [release #17](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/37837050783) passed for exact source d4b05e8eb3c709b214cfea2ad1db75fac49d8536. The release ran 169/169 contract tests and queued three synthetic privacy deliveries. Shopify [active version details](https://dev.shopify.com/dashboard/214077920/apps/429222363137/versions/1160301051905) displayed all three compliance URLs. The embedded staging app loaded Home, and a saved job loaded and refreshed on Import & export before returning Home. No uninstall or billing mutation was performed. A post-deploy exact Worker telemetry query from 20:03:30 UTC to 20:14:29 UTC showed 16 info events and no error or warning-level events; this limited sample does not prove absence of all failures.

The subsequent email-only redaction change requires its own CI and exact-source staging deployment before acceptance.
