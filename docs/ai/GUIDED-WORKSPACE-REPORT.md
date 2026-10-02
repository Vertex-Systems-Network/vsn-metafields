# VSN | Metafields — permissions and guided workspace

## Status

Implementation and local checks are complete. Remote CI and exact-source staging release will be recorded after verification. Merchant permission approval, actual Shopify billing navigation and two-theme accessibility acceptance remain pending. No live production release is included.

## Requested changes

- Declared `read_content` and `read_files` as optional scopes in the three Shopify app configurations. Required scopes and app identities/URLs stay stable. This enables a merchant-approved request; it does not grant access itself.
- Replaced the compressed diagnostics text with readable connection metrics and four feature cards. Pages & articles and Files & media have separate Enable actions. The client queries the installed app's optional scopes before requesting only the selected read scope, handles decline, and refreshes server-verified diagnostics. Core required-scope gaps use Shopify's app installation/update flow.
- Added shared visible screen skeletons/spinners and workspace navigation/background/mutation status. Initial home, plans, metaobjects, imports and connection screens have loaders; value/resource/reference and import-detail requests have explicit progress. Save, create and apply actions use green; selected removals/cancellation use red; reference search uses blue; secondary actions stay neutral. Native buttons preserve readable action labels, focus, disabled/busy semantics and 44px minimum height. Motion is disabled for reduced-motion preferences.
- Added consistent section/control/button spacing and responsive connection cards. Advanced scope/API details are collapsed.
- Added seven SVG illustrated walkthroughs to the help center, with exact option labels, location paths, steps, alt text and an enlarge link. Example data and illustration status are visible. These are guides, not authenticated screenshots.

## Packages

| Capacity / feature | Starter $19 | Growth $35 | Pro $55 |
| --- | ---: | ---: | ---: |
| Rows per CSV import | 5 | 20 | 100 |
| Items per list value | 8 | 32 | 128 |
| Fields per new metaobject definition | 2 | 5 | 25 |
| Private draft metaobjects | Included | Included | Included |
| Public metaobject access and published-entry saves | Pro only | Pro only | Included |
| Prepare failed import rows for retry | Pro only | Pro only | Included |
| Products / existing five theme block types | Unlimited / 5 | Unlimited / 5 | Unlimited / 5 |

All amounts are USD every 30 days. Pro is highlighted as the recommended full workflow. No popularity or business-outcome claims are invented. The existing `pro-plan`, USD55 EVERY_30_DAYS and five-day new-subscription trial remain intact; active plan switches still request zero additional trial days. Lower-tier limits and feature gates are disclosed before purchase and enforced from actual ACTIVE Shopify subscription state. Client Pro claims cannot unlock them.

Downgrades do not remove or unpublish content, or delete saved logs/exports. Existing definition metadata edits and selected removals remain available. New list/import writes must fit the current tier. Saving Active public metaobject entries requires Pro; public definitions without Draft/Active capability require Pro for entry writes. Lower tiers can save supported Draft entries and create fresh previews; failed-row retry preparation requires Pro. These rules do not claim control over independent edits in Shopify's native administration.

## Verification and limits

- Node22.13.0 release suite: lint, typecheck, DB contract, 134 tests and application build passed before publication; final checks are recorded with remote evidence.
- Tests exercise optional-scope request isolation, decline/unconfigured/already-granted behavior and real diagnostics readiness; actual server route no-write feature gates and client-plan tampering; existing metadata/removal and Pro compatibility; initial skeletons, separated permission cards and seven resolvable image previews.
- All seven help SVGs were rendered and visually inspected. This verifies illustration layout, not Shopify screen appearance.
- Browser preview of the component fixture was blocked by the cloud browser URL policy, which disallows local-file URLs. No workaround or authenticated UI certification is claimed. The prior declined Shopify sign-in handoff was not renewed.
- A store owner must approve the optional scope modal before `read_content` / `read_files` can be verified as granted. Publishing optional scope configuration does not certify picker availability. No subscription creation, cancellation or approval was performed by this batch.
- Main/live, provider cleanup, Specifications settings-count advisory and remaining merchant/two-theme/accessibility/performance acceptance remain separate pending work.

## Primary references

- https://shopify.dev/docs/api/app-home/latest/apis/authentication-and-data/scopes-api
- https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration
