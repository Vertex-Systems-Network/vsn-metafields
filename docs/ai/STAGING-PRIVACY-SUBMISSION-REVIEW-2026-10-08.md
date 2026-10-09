# Staging privacy and submission review — 2026-10-08

## Code changes in PR #242

- Authenticated app/uninstalled and shop/redact handlers delete import jobs and all Session rows for the exact shop. Uninstall no longer relies on a non-null session returned with a webhook.
- Invalid bulk CSV rows persist only a row number, validity flag, and validation error. Valid product, variant, and collection rows still contain the merchant-provided metafield value and before snapshot for up to seven days. Previously expired jobs were physically removed only on the next preview for that shop. This follow-up adds an hourly Worker cron to delete expired jobs across shops; deletion can lag the seven-day expiry by up to about an hour, plus Cloudflare trigger propagation or outages.
- customers/redact removes legacy import jobs whose saved rows identify the payload customer ID or any order ID in orders_to_redact. The entire matching job is removed to avoid leaving associated snapshots, including matches found in legacy result snapshots. The follow-up matches customer email (case-insensitively) or a full phone string in saved rows when Shopify omits an ID. This cannot identify arbitrary personal information that does not match identifiers in the webhook.
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

The subsequent email-only redaction change passed App Validation and AI Native Quality Gates. Cloudflare [run #79](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/37868529842) and Shopify [release #18](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/37868950640) succeeded for exact source bc54390b4ace60e9134cc847ebd7befce7fc18ad. Release ran 170/170 tests and queued three synthetic compliance deliveries. Shopify [active version](https://dev.shopify.com/dashboard/214077920/apps/429222363137/versions/1160517419009) shows all three staging URLs, and embedded Home loaded with a verified Starter subscription.

The scheduled-retention and result-snapshot follow-up in this branch requires its own CI and exact-source staging deployment. The customers/data_request merchant-facing workflow remains a submission blocker. Shopify Dev Dashboard reports a deprecated offline-token notice from the prior 14 days and an Oct 2 webhook failure metric; neither establishes a failure in the current Worker, but both warrant separate investigation.

## Data request follow-up (pending staging acceptance)

The authenticated `customers/data_request` handler now records an idempotent, shop-scoped pending request. The embedded Privacy requests screen shows Shopify's customer/order identifiers, candidate import jobs and all current jobs for manual free-text review. The merchant must provide applicable app-held data directly to the store owner and explicitly record fulfillment; webhook acknowledgement itself is not fulfillment. Completed records clear contact identifiers and are purged after 30 days. Pending requests remain visible even when overdue. Import snapshots still expire after seven days, so a merchant must review promptly and include any other data sources or backups in the response process. This workflow does not automatically email the store owner or prove actual delivery. A representative real request and operator response remain required before submission.
