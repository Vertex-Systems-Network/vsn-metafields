# VSN | Metafields 1.1.1 — popover, alignment and validation

The four screenshot-reported changes are implemented in app v1.1.1 and released to isolated staging from `44b812501d1d3af1728009496a16610032ac8323` (PR176 plus probe correction PR177). Node22.13.0 release checks passed150 tests; implementation/probe CI passed. Runtime37117727013 and Shopify release37117885064 passed for the same source; active app version is `staging-metafields-44b812501d1d`. Shopify readback verified validation edits on product/variant/collection definitions and rules on a newly created metaobject field. All21 representative typed cases, lifecycle, bulk, diagnostics and disposable cleanup passed. Full evidence: `docs/evidence/metafields-popover-validation-2026-10-03.json`.

The first staging attempt deployed the Worker and passed health/session reads, then exposed a missing `node:assert/strict` import in the new offline rule-readback probe. Disposable cleanup passed. PR177 corrected that import; the repeated acceptance above passed. Production and billing were not changed. Three compliance webhooks were enqueued; independent receipt acceptance remains pending.

Validation location: Fields & values → Create/Edit custom definition → Access and options → Value validation. Choose a type first; its supported rules appear as labeled controls. Blank a rule to remove it, then save. New metaobject fields expose the same editor; changing existing metaobject field validation is outside this change.

| Request | Implementation |
| --- | --- |
| Dropdown cut off by cards | A body portal escapes section/box shadow-root overflow. The fixed overlay fits the viewport, flips above when needed, bounds its list height and tracks scrolling/resizing. Active-option scrolling changes only the list. Outside click, blur, Escape and Tab close safely. |
| Button spacing | Wrapping action rows use 12px gaps (8px for table actions); margin overrides avoid double spacing. Search actions align to the 32px input. |
| Input/select height | Custom triggers now use Shopify inputs’ observed 32px height. Options/actions retain their larger interaction targets. Visible search labels align the filter row. |
| Field-value validation option | Visible controls use the selected Shopify type’s supported validations: length/number/date bounds, list bounds, patterns, choices, domains and other discovered rules. Advanced JSON remains available. Custom definition edits load and update stored rules; explicit empty rules clear them. New metaobject fields use the same editor. Value editors show current rules. |

Server checks validate unique supported rule names and bounded string values using fresh capability metadata. Shopify authorizes every mutation and remains authoritative for rule-value semantics and enforcement; unsupported or duplicate rules fail before mutation. Omitted validation metadata remains untouched. Immutable namespace/key/type, active-plan gates and reference/public-access confirmation are preserved.

Self-review covers portal focus/outside handling and cleanup, local list scrolling, responsive positioning, native control alignment, visible labels, immutable identity, server-owned capabilities and malformed input. No dependency, database schema, billing price, Worker limit or production configuration change is needed.

The supplied image(6)..image(10) screenshots are issue evidence, not screenshots of the correction. Exact hashes are retained in design intake. Deterministic component-handler/geometry/API tests do not certify browser pixel layout, real focus, screen-reader behavior, mobile keyboard or zoom. Authenticated visual acceptance remains blocked by the prior declined Shopify login handoff and automatic accounts-redirect rejection; no new sign-in or expired token replay is authorized by this task.

Primary references: https://shopify.dev/docs/apps/build/metafields/list-of-validation-options and https://shopify.dev/docs/api/admin-graphql/latest/queries/metafieldDefinitionTypes.
