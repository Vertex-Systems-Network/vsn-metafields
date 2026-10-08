# Staging Media block recheck — 2026-10-08

## Result

**PASS** — the populated Media app block rendered in Shopify's unpublished Horizon theme editor for both desktop and mobile previews.

- Store: `staging-oath3rth`
- Preview product: The Complete Snowboard
- Block resource: Product
- Temporary definition: `vsn_qa_media_20261008.media` (`file_reference`, Storefront API public read)
- Temporary value: existing staging gift-card MediaImage, `gid://shopify/MediaImage/56389915246964`
- The desktop preview showed the gift-card image in product information; the mobile preview showed it within the narrow layout without visible horizontal overflow.
- Left the theme editor using **Leave page**, discarding the unsaved block configuration. No theme save or publish was performed.

## Cleanup

Deleted the temporary product metafield value and its definition. Shopify mutation responses contained no user errors. Read-back confirmed no remaining `vsn_qa_media_20261008` product metafield definition and no value on the product.

The VSN Metafields app was left open on Home. The Home view confirmed **Starter workspace Shopify subscription verified**.

## Scope

This records a staging theme-editor preview only. It does not establish saved or published storefront behavior, nor complete product acceptance. Remaining broader gates include saved/published storefront verification (subject to the standing no-publish instruction), additional theme/context coverage, accessibility and responsive checks beyond the observed mobile preview, and outstanding non-theme issue/CI gates.