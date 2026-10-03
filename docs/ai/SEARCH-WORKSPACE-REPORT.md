# VSN | Metafields 1.1.0 — search and definition workspace

## Status and scope

All nine requested code changes are implemented. Node22.13.0 release checks passed: lint, typecheck, database contract, 145 tests and build. Remote CI and exact-source staging evidence will be recorded after verification. This batch targets development and isolated staging; no production or billing mutation is authorized or performed.

## Changes

| User issue | Result |
| --- | --- |
| Worker: Too many subrequests | Interactive catalog loads one 250-template page per request. The actual loader makes two domain GraphQL calls, including subscription verification; enable revalidates only the selected page before its mutation, for three calls. SDK authentication/transport work is additional. Full catalog enumeration remains exclusively in the offline acceptance probe. No Worker account plan or runtime limit is raised. |
| Shopify-style search filters | Polaris `s-search-field` controls replace search inputs for templates, registered definitions, resource titles, references and help. Definition filters combine search, type and access, expose matching counts and Clear filters. |
| Custom definition form | Details and access/options are grouped, namespace/key share a responsive row, and a live preview shows identity, resource, type and storefront access. Existing immutable key/type behavior is retained for editing. |
| Searchable metafield resource | Searchable labeled resource select, with deprecated Media image disabled. Resource-values Resource and Definition selects also search their loaded options. Server title search remains explicit and scoped to authorized Shopify resources. |
| Smooth section navigation | Document scroll behavior is smooth; section targets account for the sticky navigation/progress height. Reduced-motion preferences use immediate scrolling. Existing embedded routing/search context and hash targets remain intact. |
| Sticky workspace menu | Fields & values, Metaobjects, Import & export, Plans and Help center stay visible at the top while scrolling. Loading progress sits below the menu. |
| Version tag | Canonical `APP_VERSION` is 1.1.0, displayed immediately beside the workspace brand and returned by the health endpoint. Shopify API2026-07 is a separate version. |
| Name → key | Name suggests a safe ASCII key. Manual edits freeze the suggestion; Use key from name resumes it. Existing definition edits cannot rename the stored identity. |
| Reference field-type style/icons | Grouped searchable picker with outline icons, human labels, One/List badges and a selected check. Used for custom definitions and metaobject fields; registered rows show the same presentation. Canonical Shopify type strings are preserved. |

Template search is explicitly scoped to loaded pages. Load more templates fetches a continuation page in a new Worker invocation; the app never silently truncates the catalog to the first matches. Duplicate pages are deduplicated, owner changes reset the catalog, and forged IDs or wrong-owner selections fail before mutation.

## Review and verification

- Actual route regressions verify catalog/enable call budgets, cursors, no full-definition enumeration, wrong-owner/forged-ID rejection and server-owned identity. A signed, staging-only read diagnostic now reads the first and next catalog pages inside one deployed Worker invocation. Its existing signature and production-exclusion guards are preserved.
- Real component handler regressions verify automatic keys, manual override/reset, filter/group selection, disabled-option denial, grouped keyboard order and visibility of a selected later option. These deterministic hook tests are not DOM/focus/visual certification.
- Local release suite passed145 tests; ANPOS integrity, staging isolation, staging contract and diff checks passed. No dependency was added. Design reference SHA256 is `cf67b50c161b36e8be475bd53cb1087c87c9c7799ae8815ffcf1303680df0160` for user-provided `image(5).png` / `libfile_b344e5fd58748191bd5d1c4c5b2885aa`.
- Authorized self-review found grouped keyboard traversal followed API ordering rather than visual group ordering. Fixed traversal to follow displayed groups and preserved the selected option beyond the visible200-item window. Catalog empty/loading wording also distinguishes an unloaded catalog from completed pagination.
- Authenticated browser acceptance is blocked: automatic approval review rejected the Shopify accounts redirect because the prior login handoff was declined. No credentials or expired token URLs were replayed, no new sign-in handoff was opened, and no bypass was attempted. Actual desktop/mobile layout, smooth-scroll motion, sticky placement, focus/screen-reader behavior and picker task acceptance remain pending.

Store-owner optional page/file permission consent, billing navigation, two-theme accessibility/performance acceptance and live promotion remain separate pending work. Existing packages, subscriptions, optional scopes, app identities, database schema and theme-extension bytes are unchanged by this batch.

## Primary references

- https://developers.cloudflare.com/workers/wrangler/configuration/#limits
- https://shopify.dev/docs/api/admin-graphql/latest/queries/standardMetafieldDefinitionTemplates
- https://shopify.dev/docs/api/app-home/latest/web-components/forms/search-field
- https://shopify.dev/docs/api/app-home/latest
