# Metafield definition ownership, access and migration

Date: 2026-10-01. Status: accepted for the capability/definition/block batch by the user's current instruction.

## Decisions

- Pin Admin GraphQL 2026-07. Discover type names and validation metadata from Shopify at runtime. Inventory includes 25 active owners; deprecated MEDIA_IMAGE is disabled.
- Custom definitions are merchant-owned. Keep existing `vsn_metafields` identities and values. Allow valid custom namespaces, including `custom`; reject app-reserved and Shopify-reserved namespaces for custom creation.
- Enable standard definitions through Shopify's official template ID, owner and access input. Preserve the original namespace, key, type and validations.
- Default Storefront API access to NONE. Offer PUBLIC_READ only for the seven public content contexts supported by these theme blocks. Do not grant new OAuth scopes automatically. Show installed grants and real API authorization errors. A successful definition read does not imply permission to write or access resource values.
- Do not edit another app's reserved namespace. Other merchant-owned definitions are visible, editable and removable only after a scoped identity check; Shopify remains the permission authority.
- Edit name, description, pin and Storefront API access. Namespace/key/type stay immutable in this UI. Type conversion, validation changes on populated definitions and namespace moves require a future previewed migration; this batch performs none.
- Remove a definition with `deleteAllAssociatedMetafields: false`, requiring exact owner/namespace/key confirmation. Existing values remain on their resources. Legacy reset only touches the selected owner's `vsn_metafields` definitions, retains values, and reports partial failure.
- Storefront blocks resolve product, selected variant, collection, shop, page, article or blog. They do not resolve customer/order/company data. Render only explicitly selected namespace/key and supported typed values; never render arbitrary JSON, HTML or user Liquid.
- Storefront API permission is an API setting, not a claim that every theme's Liquid behavior has been certified. Merchants should put only intended public content in a displayed block; confirm actual visibility on the target theme.

## Consequences and evidence

No database migration, namespace copying or bulk value deletion occurs. Sessions keep the existing SQLite-local/Neon-hosted adapter boundary. Billing settings and active subscriptions are unchanged.

Contract tests cover identity, pagination, authorization errors, dynamic list/reference types, validation metadata and retention request semantics. Liquid fixtures cover escaped text, false/zero, lists, links, variant context, ordering and missing values. Shopify-only rich-text/image filters and real theme/editor behavior still require Shopify evidence.

The staging lifecycle probe uses dedicated staging app credentials, certified staging Neon endpoint and a non-production offline shop session. It creates only draft disposable product/variant/collection fixtures, checks definition create/read/update/delete and retained values, enables/removes one uninstalled standard template, and cleans up its exact created IDs. Logs contain status summaries, no credentials or merchant values. A failed cleanup fails acceptance.

## 2026-10-02 reference-definition retention clarification

Actual staging run 36996039029 established that Shopify requires associated-metafield deletion when removing reference-type definitions. The merchant app therefore blocks reference removal before any mutation and directs the merchant to Shopify's native impact review. Namespace reset preflights reference definitions before deleting anything. Non-reference removal retains values as decided above. This narrows removal support to preserve the data-safety decision; it does not grant permission to bulk-delete merchant values. Only disposable staging probe identities use associated deletion for fixture cleanup, separately from merchant routes.
