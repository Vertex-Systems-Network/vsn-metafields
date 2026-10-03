# Storefront block blueprint — planning, not shipped

Historical planning snapshot: initial2026-10-01 facts/status below are retained for provenance. Current implementation and acceptance are governed by `config/ai/execution-plan.json`, `config/ai/modules-bank.json`, `docs/ai/METAFIELDS-MERCHANT-THEME-ACCEPTANCE.md` and exact release evidence through v1.2.1. This snapshot is not the current completion report.
## Merchant journey

Create or enable a definition → set a typed value on a supported resource → choose a compatible theme app block → select its contextual data source → configure presentation → preview populated and empty states → publish. The app should show why a definition is not eligible for a given template instead of offering a source that renders nothing.

Shopify app blocks target theme sections, are added by the merchant in the theme editor, and require a compatible template/section. Dynamic source availability depends on the template's resource and setting type. App blocks do not render on checkout steps. References: [app block configuration](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration), [dynamic sources](https://shopify.dev/docs/storefronts/themes/architecture/settings/dynamic-sources), [theme support](https://shopify.dev/docs/apps/build/online-store/verify-support).

## First two blocks

| Block | Data contract | Merchant options | Empty/invalid behavior |
| --- | --- | --- | --- |
| Single Field | One eligible contextual product, variant or collection value; type-aware renderer | Label on/off/custom label; text alignment; size; color; spacing; width; border/background; format choices relevant to its type; fallback text | Editor guidance when source/context is absent; storefront hides empty wrapper or shows merchant-defined fallback |
| Specifications | Ordered, allowlisted set of eligible fields from one contextual owner; each row typed | Field selection/order; label override; table/list/cards; columns; row dividers; heading; spacing; colors; mobile stacking; hide-empty per row | Suppress missing rows, then hide entire block or show fallback; no empty table |

Controls must be grouped by content, layout, typography, color, spacing and responsive behavior; only show a control when the chosen renderer can honor it. Prefer Shopify's native dynamic source picker where compatible. If multi-field selection/order cannot be represented safely in block schema, use a versioned app configuration reference resolved through an approved storefront-safe mechanism; no arbitrary Liquid, raw HTML or unbounded app proxy fetches.

## Type-specific renderers after the foundation

| Family | Display choices | Required safeguards |
| --- | --- | --- |
| Text/rich text | Plain text, prose, expandable text | Escape plain text; Shopify-supported rich text rendering; no merchant script injection |
| Numbers/date/measurements | Localized number/date, unit, currency, rating | Type-aware parsing; locale and unit semantics; sensible zero/false handling |
| Color/media | Swatch, image, downloadable file | Alt text, width/height, responsive image, safe link destination |
| References/lists | Resource card, gallery, list | Resolve permitted references only; missing target fallback; bounds and pagination |
| Variant | Selected variant field | Verify variant-change integration and no stale value after selection |

Customer, order and other protected owners are excluded from public blocks until privacy, access and legitimate surface decisions are approved. A metafield's existence in Admin does not establish storefront visibility.

## Acceptance evidence per block

Use two supported themes and record theme/editor identity, extension version, branch/SHA, template, resource, definition and type. Verify desktop/mobile, multiple block instances, empty/private values, escaped output, localization, keyboard/focus and screen-reader labels, variant switching where applicable, performance impact, and publish/unpublish behavior. Capture real theme-editor and storefront evidence. No block is complete solely because its Liquid file compiles.

The first owner-definition slice in PR #148 does not include a theme app extension, values, or any block. Block work starts only after owner/type/storefront gates and value editing are verified in staging.
