# Staging bulk loader verification — 2026-10-07

## Result

The staging bulk saved-job read/refresh path now passes after PR #220. Cloudflare telemetry records the earlier 503 on the previous Worker version, then successful requests on the deployed fix. No Shopify metafields were written.

## Evidence

- Read-only page smoke also opened Home, Fields & values, Metaobjects, Plans and Help center. Fields & values loaded 7 registered definitions and 248 standard templates for the selected resource; Metaobjects showed the existing QA definition; Plans showed the active Starter test subscription. No create/edit/save/plan-switch controls were submitted.
- Help center diagnostics reported Environment=Staging, Database=Reachable, Subscription=Active, with product/collection values, metaobjects, pages/articles and files/media marked Ready. The panel showed 3 saved imports.
- Fix: PR [#220](https://github.com/Vertex-Systems-Network/vsn-metafields/pull/220), merged to `development` at `c387156977483666b6bd5a27794e4056709f2f7e`.
- Staging deployment and acceptance: [workflow run #73](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/37700944893), successful on the same source SHA.
- Shopify staging app: `staging-oath3rth`, Import & export page.
- Selected an existing saved job dated `2026-10-03T21:33:52.535Z`, then used **Refresh selected job**. The page issued its normal saved-job read request and rendered the returned record: status complete, 1/1 processed, revision 3. Its row showed a stale-value conflict and explicitly stated that no write was made.
- The app route implementation is `app/routes/app.api.bulk.jsx`; its loader authenticates the Admin request, checks the plan entitlement, reads the requested job and returns its public representation. The UI refresh generated the live `/app/api/bulk.data` requests.
- Cloudflare telemetry showed one HTTP 503 with outcome `exceededCpu` at `2026-10-07T22:53:23Z` on previous Worker version `a891304d-3532-4331-9e59-50d2acc0166d`. PR #220 removes the duplicate Shopify subscription GraphQL request and reuses the entitlement result. The fix was deployed in staging workflow run #73; current Worker version `67521451-4d0e-41b3-acb3-63c85357f93f` began serving traffic at `2026-10-07T23:13:50Z`.
- After that deployment, 9 correlated `/app/api/bulk.data` request records in the 90-minute observation window returned HTTP 200 with outcome `ok`. Recent UI refreshes were among the successful requests. The prior 503 did not recur on the current version.

## Boundaries

- No import apply/retry/remove action was used.
- No metafield value, definition, product, subscription, or production resource was changed.
- Cloudflare observability was queried read-only for route, response status, outcome, CPU time and Worker version; request query strings and sensitive values were excluded.
- This live check is narrow; it is not a complete zero-start or merchant acceptance test.

## Still outstanding

1. **Zero-start app acceptance:** a fresh merchant journey through all app areas, including definitions, values, metaobjects, plans, import/export and help/error recovery. Existing staging state and saved records mean a truly clean install/user journey has not been demonstrated.
2. **Theme acceptance:** Shopify CLI/theme validation and actual rendering/configuration in the two unpublished themes; editor usability for the settings advisory also remains open.
3. **Accessibility and performance:** browser-based keyboard, reflow, accessibility and performance checks across the app.
4. **Compliance webhooks:** independent receipt verification for the webhook deliveries recorded by prior staging release evidence.
5. **Issue #4:** remains open. Its original body requires staging validation before production URL cutover and explicitly says the issue alone does not authorize cutover. This staging page check does not justify closing it or changing production.
6. **Issue #68:** remains open as a non-blocking GitHub Support/platform cleanup follow-up for historical pull refs; this is outside application code and needs provider-side handling if pursued.
7. **Other open PRs observed:** #148 remains a draft to `development` with theme/browser/staging acceptance gates listed in its description; #124 targets `main` and concerns a historical Session migration rerun path. Neither is part of this staging CPU fix; no merge/closure was performed.

## Completion statement

The CPU fix is deployed and the live staging saved-job read/refresh path now passes. The whole product is **not complete**: the acceptance items above remain. Production remains untouched.
