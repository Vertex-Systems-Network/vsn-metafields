# Reference cards staging recheck — 2026-10-08

## Result

Populated Reference cards content rendered in the unpublished Horizon product preview on the existing staging store, on desktop and mobile.

The preview visibly showed the temporary image, title, summary, and link for a Product `list.metaobject_reference` value on `The Complete Snowboard`.

## Cleanup and boundaries

- Deleted the temporary product metafield, product metafield definition, metaobject entry, and metaobject definition.
- Schema-validated Admin GraphQL read-back returned an empty Product definition list for the temporary namespace, a null metaobject definition, and a null product metafield.
- Exited Horizon with **Leave page**, discarding its unsaved block and mapping. No theme Save or Publish occurred.
- The staging app remained installed and active on its Home page with the Starter subscription verified.
- Production was not touched.

## Remaining acceptance

This verifies populated Reference cards in the unpublished Horizon editor preview only. Media populated rendering, saved/published storefront behavior, broader resource/type coverage, full accessibility/mobile behavior, zero-start acceptance, and independent compliance-webhook receipt verification remain open. The overall product is not complete.
