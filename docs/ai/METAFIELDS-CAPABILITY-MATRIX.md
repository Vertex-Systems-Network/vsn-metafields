# Shopify metafield capability matrix — planning evidence

Historical planning snapshot: initial2026-10-01 facts/status below are retained for provenance. Current implementation and acceptance are governed by `config/ai/execution-plan.json`, `config/ai/modules-bank.json`, `docs/ai/METAFIELDS-MERCHANT-THEME-ACCEPTANCE.md` and exact release evidence through v1.2.1. This snapshot is not the current completion report.
Reference API: repository config uses Admin GraphQL 2026-07. The app remains pinned to 2026-07; do not follow the moving latest alias. Source: https://shopify.dev/docs/api/admin-graphql/2026-07/enums/MetafieldOwnerType (accessed 2026-10-01). This is a documentation inventory, **not a shop-level probe**. Definition support, scopes, value access and Liquid storefront availability require verification per owner.

## Owner inventory

| Owner enum | Planning category | Storefront block handling |
| --- | --- | --- |
| PRODUCT | Public content candidate | Contextual product block, validate access |
| PRODUCTVARIANT | Public content candidate | Selected variant behavior, theme compatibility |
| COLLECTION | Public content candidate | Contextual collection block |
| PAGE, BLOG, ARTICLE | Online-store content candidate | Contextual template and Liquid probe |
| SHOP | Store-global candidate | Global data visibility and access probe |
| CUSTOMER, COMPANY, COMPANY_LOCATION | Protected data | Admin management only until privacy/access design; no generic public display |
| ORDER, DRAFTORDER, GIFT_CARD_TRANSACTION | Protected transaction data | Admin management only; no generic public display |
| LOCATION, MARKET, SELLING_PLAN, TRANSFER | Specialized resource | Definition/value/scope and storefront context probe |
| API_PERMISSION, CARTTRANSFORM, DELIVERY_CUSTOMIZATION, DISCOUNT, FULFILLMENT_CONSTRAINT_RULE, ORDER_ROUTING_LOCATION_RULE, PAYMENT_CUSTOMIZATION, VALIDATION | App/platform configuration | Investigate API purpose; do not imply merchant storefront block |
| MEDIA_IMAGE | Deprecated | No new definition flow; migration policy only |

The enum contains 25 non-deprecated owner values plus deprecated MEDIA_IMAGE. Enum membership alone does not prove every definition operation is available to this app. Required scopes are not assumed from owner names. Before enabling each owner, probe definition create/read/update/delete, value set/get, access level, resource picker and applicable Liquid object in an isolated shop.

## Data types and rendering

Official source: https://shopify.dev/docs/apps/build/metafields/list-of-data-types and https://shopify.dev/docs/api/admin-graphql/2026-07/queries/metafieldDefinitionTypes (accessed 2026-10-01). Query the API for supported validations; do not hardcode all scalar/list permutations.

| Family | Examples | Editor and renderer contract |
| --- | --- | --- |
| Text | single/multi-line, rich text | Text/rich editor; escaped or Shopify rich-text rendering |
| Numeric/boolean/date | integer, decimal, boolean, date/time | Locale-aware format, type validation |
| Structured/measurement | JSON, money, rating, dimension, weight, volume | Typed schema, unit and currency display; never raw JSON by default |
| Color/media | color, file references | Swatch/image/file link with alt text and safe URL |
| Resource references | product, variant, collection, page, metaobject, mixed, taxonomy | Picker, reference existence check, typed card/list renderer |
| Lists | Supported list-prefixed types only | Repeating editor, ordering, bounded item count |

GraphQL stores values as strings regardless of type; renderer must use typed Liquid metafield `.value` semantics. Type migration can invalidate existing values. Shopify documents an app-created definition limit of 256 per resource type, with nuances for standards: https://shopify.dev/docs/apps/build/metafields/metafield-limits. Verify limits and errors in staging before UI claims.

## Standard versus custom

Use Shopify standard template IDs and official enable flow, not a duplicate custom namespace/key. Source: https://shopify.dev/docs/apps/build/metafields/list-of-standard-definitions and https://shopify.dev/docs/apps/build/metafields/definitions. The implemented namespace/access decision is in `docs/adr/0006-metafield-definition-ownership.md`. Existing `vsn_metafields` data remains in place.

## Block eligibility decision

Only expose a block source when all are true: definition/value exists, Liquid context resolves the intended resource, storefront access is allowed, renderer supports its type, and the theme allows an app block at that location. Otherwise show an actionable editor state or fallback. App blocks cannot render checkout pages: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration.

## Evidence gaps

Live 2026-07 shop introspection; exact per-owner OAuth scopes; permission upgrade effect on installed shops; representative standard template list; Liquid/theme tests on product, collection, page and article; limits and list/validation combinations; customer/order privacy review. These gaps block implementation claims, not this documentation inventory.

## First staging probe: product, variant, collection

The current app configurations pin Admin API `2026-07` and request `read_products,write_products` (plus existing metaobject and order scopes). Shopify's scope list associates Product, ProductVariant and Collection with product scopes; this does **not** prove the installed staging app has those grants or that each definition mutation succeeds. Source: https://shopify.dev/docs/api/usage/access-scopes (checked 2026-10-01).

| Gate | PRODUCT | PRODUCTVARIANT | COLLECTION | Pass evidence |
| --- | --- | --- | --- | --- |
| Installed app scopes | Check granted `read_products,write_products` | Same | Same | Staging app identity and granted-scope query; redact token |
| Definition read | List owner definitions and preserve pagination | Same | Same | Owner-filtered response, no cross-owner data |
| Definition create | Create a unique disposable `vsn_metafields` key | Same | Same | Definition ID and empty GraphQL/userErrors |
| Value round trip | Write and read on a staging product | Write and read on a selected variant | Write and read on a staging collection | Exact typed value and owner GID; test only disposable resources |
| Storefront | Product Liquid context | Selected-variant behavior on two variants | Collection Liquid context | Theme editor and rendered storefront evidence on the target theme |
| Removal | Remove only the disposable definition after recording value behavior | Same | Same | Exact ID and associated-value policy recorded; never use bulk reset for a probe |

Each gate records API version, shop/app identity, branch/SHA, timestamp, request operation, safe response summary and observed result. A failed owner remains disabled in the UI until the cause and scope upgrade path are understood. The draft PR #148 adds only definition-list/create/reset owner routing; it does **not** implement value round trips or storefront blocks. Its local build cannot satisfy this staging gate.

## Authenticated staging evidence — 2026-10-02

Run 36983997108 on development 2f634842a4473d303d3942be0a3ef3ed2abe5cbc passed authenticated pinned-schema validation (28 GraphQL documents; exact owner inventory), definition reads for all 25 active owner enums, and discovery of 118 type entries and actual granted scopes. Standard catalog returned 8,516 product templates. Product, product variant and collection custom create/read/metadata update/value write/definition removal/value retention all passed; one absent product standard template enabled/removed successfully. Fixture cleanup passed. See docs/evidence/metafields-staging-2026-10-02.json. This certifies the recorded representative mutations, not writes for every owner/type/template, and does not certify public Liquid/theme availability.
