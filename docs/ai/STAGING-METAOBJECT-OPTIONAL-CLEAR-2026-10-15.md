# Staging optional metaobject field clear — 2026-10-15

[PR #318](https://github.com/Vertex-Systems-Network/vsn-metafields/pull/318) merged an explicit optional text-field clear path. Shopify Admin API 2026-07 uses `fields` for patching and `values` for full replacement; the app reads the current entry, checks its timestamp, merges existing text siblings, omits the cleared key, and checks the returned cleared value. Required fields reject blank values. Definitions with other value types give a native-editor instruction instead of attempting a risky conversion.

Local Node 22 release checks passed lint, typecheck, database contract, 189/189 tests and build. AI Native Quality Gates and App Validation passed. [Cloudflare Staging #103](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/38645117846) completed successfully from `0bb0b1914644882cbda40fd0eb6a1b8f5af3260d`: runtime health, staging session/subscription reads and disposable lifecycle cleanup passed.

The installed Staging app and private `Size guide (QA)` definition opened in the authenticated browser. That definition has only the required Title field, so an optional-field clear and Shopify readback were **not** performed there. This change remains service and contract verified, with representative browser acceptance open. No public access, tier, billing, Live or App Store mutation was performed.

Acceptance stays **3/12 (25%)**, Phase04 **0/3**. Independent PR298/310 reviews, mixed CSV exact approval, file transfers, signed privacy, accessibility/performance and full theme/fresh-install gates remain open. [Machine evidence](../evidence/metafields-metaobject-optional-clear-2026-10-15.json).
