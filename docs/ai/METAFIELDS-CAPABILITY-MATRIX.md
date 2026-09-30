# Shopify metafield capability matrix — planning evidence

Reference API: repository config uses Admin GraphQL 2026-07. Shopify currently labels 2026-07 as latest. Source: https://shopify.dev/docs/api/admin-graphql/2026-07/enums/MetafieldOwnerType (accessed 2026-10-01). This is a documentation inventory, **not a shop-level probe**. Definition support, scopes, value access and Liquid storefront availability require verification per owner.

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

Use Shopify standard template IDs and official enable flow, not a duplicate custom namespace/key. Source: https://shopify.dev/docs/apps/build/metafields/list-of-standard-definitions and https://shopify.dev/docs/apps/build/metafields/definitions. Custom namespace strategy and existing `vsn_metafields` migration remain proposed ADR work.

## Block eligibility decision

Only expose a block source when all are true: definition/value exists, Liquid context resolves the intended resource, storefront access is allowed, renderer supports its type, and the theme allows an app block at that location. Otherwise show an actionable editor state or fallback. App blocks cannot render checkout pages: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration.

## Evidence gaps

Live 2026-07 shop introspection; exact per-owner OAuth scopes; permission upgrade effect on installed shops; representative standard template list; Liquid/theme tests on product, collection, page and article; limits and list/validation combinations; customer/order privacy review. These gaps block implementation claims, not this documentation inventory.
