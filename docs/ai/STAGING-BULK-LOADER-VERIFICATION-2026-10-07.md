# Staging bulk loader verification — 2026-10-07

## Result

The staging bulk saved-job read/refresh path now passes after PR #220. Cloudflare telemetry records the earlier 503 on the previous Worker version, then successful requests on the deployed fix. No Shopify metafields were written.

## Evidence

- Read-only page smoke also opened Home, Fields & values, Metaobjects, Plans and Help center. Fields & values loaded 7 registered definitions and 248 standard templates for the selected resource; Metaobjects showed the existing QA definition; Plans showed the active Starter test subscription. No create/edit/save/plan-switch controls were submitted.
- Help center diagnostics reported Environment=Staging, Database=Reachable, Subscription=Active, with product/collection values, metaobjects, pages/articles and files/media marked Ready. The panel showed 3 saved imports. On 2026-10-08, the live guide route rendered all 7 topics plus the complete first-field workflow and connection diagnostics; one app-hosted guide screenshot loaded successfully.
- Fix: PR [#220](https://github.com/Vertex-Systems-Network/vsn-metafields/pull/220), merged to `development` at `c387156977483666b6bd5a27794e4056709f2f7e`.
- Staging deployment and acceptance: [workflow run #73](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/37700944893), successful on the same source SHA.
- Shopify staging app: `staging-oath3rth`, Import & export page.
- Selected an existing saved job dated `2026-10-03T21:33:52.535Z`, then used **Refresh selected job**. The page issued its normal saved-job read request and rendered the returned record: status complete, 1/1 processed, revision 3. Its row showed a stale-value conflict and explicitly stated that no write was made.
- The app route implementation is `app/routes/app.api.bulk.jsx`; its loader authenticates the Admin request, checks the plan entitlement, reads the requested job and returns its public representation. The UI refresh generated the live authenticated `/app/api/bulk.data` request, and the job response rendered in the page; this covers the previously pending direct live-request check without bypassing Shopify authentication.
- Reviewed the live definition form and `app/metafield-capabilities.js`: the form defaults Namespace to `vsn_metafields`, while validation permits ordinary custom namespaces such as `custom` and rejects reserved Shopify/app namespaces. Therefore the guide's `custom.care_instructions` example is supported; no namespace docs fix is needed.
- Read-only theme editor check on 2026-10-08: the unpublished Horizon draft's Apps picker listed all five VSN blocks (FAQ, Media, Reference cards, Single field, Specifications). Its preview rendered an already configured Specifications block and its empty-state guidance. The `debut-vintage-theme` draft's section Apps picker reported no app blocks available for that section. No block was added; Save remained disabled and neither draft was saved or published. This confirms block discovery in Horizon, not successful populated-value rendering or support in the vintage theme.
- Cloudflare telemetry showed one HTTP 503 with outcome `exceededCpu` at `2026-10-07T22:53:23Z` on previous Worker version `a891304d-3532-4331-9e59-50d2acc0166d`. PR #220 removes the duplicate Shopify subscription GraphQL request and reuses the entitlement result. The fix was deployed in staging workflow run #73; current Worker version `67521451-4d0e-41b3-acb3-63c85357f93f` began serving traffic at `2026-10-07T23:13:50Z`.
- After that deployment, 9 correlated `/app/api/bulk.data` request records in the 90-minute observation window returned HTTP 200 with outcome `ok`. Recent UI refreshes were among the successful requests. The prior 503 did not recur on the current version.

- Read-only reference-picker smoke (2026-10-08): selected the existing Page and File definitions for an existing QA product, searched by each saved reference's title, and both results appeared in the app's reference picker. A schema-validated read-only Shopify Admin GraphQL query resolved the saved references as an existing published Page and a READY MediaImage. No Save or Remove action was used. This verifies existing-reference search and saved-reference resolution; new reference writes and conflict handling remain untested.
- Limited keyboard smoke on Help center (2026-10-08): the Connection and permissions panel reported Staging, Database=Reachable and Subscription=Active, with product/collection values, metaobjects, pages/articles and files/media Ready. Tab moved focus from Refresh status to Copy support diagnostics. The staging browser console check returned no warning/error entries. This is not a complete accessibility or performance audit.

## Boundaries

- No import apply/retry/remove action was used.
- No metafield value, definition, product, theme, plan, subscription or production resource was changed. No Save, Remove, import Apply, retry or job removal action was used.
- Cloudflare observability was queried read-only for route, response status, outcome, CPU time and Worker version; request query strings and sensitive values were excluded.
- This live check is narrow; it is not a complete zero-start or merchant acceptance test.

## Still outstanding

1. **Zero-start app acceptance:** a fresh merchant journey through all app areas, including definitions, values, metaobjects, plans, import/export and help/error recovery. Existing staging state and saved records mean a truly clean install/user journey has not been demonstrated.
2. **Theme acceptance:** Horizon exposes the five app blocks and renders an existing Specifications block's empty state, but Shopify CLI/theme validation, configured populated-value rendering and editor settings review remain open. The `debut-vintage-theme` draft exposes no app blocks for its section; its app-block compatibility remains unverified/unsupported in this editor.
3. **Accessibility and performance:** one limited Help center tab-focus smoke passed; keyboard coverage across all app pages, reflow/zoom, assistive-technology checks, WCAG audit and performance measurements remain open.
4. **Compliance webhooks:** independent receipt verification for the webhook deliveries recorded by prior staging release evidence.
5. **Issue #4:** remains open for separate migration cleanup work. The latest issue comment says to keep it open until Railway project/service state is identified and any authorized cleanup has provider evidence. This staging validation does not close it or authorize a production change.
6. **Issue #68:** remains open as a non-blocking GitHub Support/platform cleanup follow-up for historical pull refs; this is outside application code and needs provider-side handling if pursued.
7. **Other open PRs observed:** #148 remains a draft to `development` with theme/browser/staging acceptance gates listed in its description; #124 targets `main` and concerns a historical Session migration rerun path. Neither is part of this staging CPU fix; no merge/closure was performed.

## Completion statement

The CPU fix is deployed and the live staging saved-job read/refresh path now passes. The whole product is **not complete**: the acceptance items above remain. Production remains untouched.
