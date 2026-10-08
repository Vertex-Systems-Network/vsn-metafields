# Staging Help Center and Plans recheck — 2026-10-08

## Result

**PASS — limited read-only recheck** on the existing `staging-oath3rth` app.

- Help center loaded with 7 guides.
- Opened the storefront concept illustration. It rendered in the guide and linked to the app's own Worker asset path `/help/storefront.svg`; its alt text identifies the illustration as an example rather than a current-app screenshot.
- Opened Plans and compared the visible cards with the Plans and billing guide. Both showed Starter $19, Growth $35, and Pro $55 USD per 30 days, a 5-day trial description, and the same row/list/metaobject capacity limits.
- Shopify showed the existing Starter test subscription as active through 2026-11-06. No plan switch, trial start, cancellation, billing action, permission change, or app data write was submitted.

## Scope

This confirms one in-app guide illustration loads from the app's own Worker asset path and that the visible plan comparison matches the corresponding guide text. It does not check every guide image, all help topics, or image behavior on other devices. No app code or store content was changed. Production and theme state were not touched.

Broader staging acceptance remains open: zero-start journey, expanded theme/context and accessibility/performance coverage, independent compliance-webhook receipt verification, and Shopify CLI/theme validation. The app should be left on Home with its Starter subscription active.
