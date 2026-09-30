# Project Idea — VSN Metafields expansion

## Intake Status
RECEIVED — 2026-10-01. Product planning input from current user conversation; implementation consent and production rollout are separate.

## Raw User Input
> "es k elawa hum shopify jitni bhi metafield definections deta ha un k liye bhi banayinge proper or custom bhi. Front-end k liye es ka block bhi plan krna ha us ki options us k data show krna user k liye har aik option ho customize krne k liye block ko. ab ye sab A AI-Native development k liye me plan kr lo"
>
> "theek ha continue krro pr pahle har cheez plan me add kr lo"
>
> "jo hamara AI planer blueprint tha us ki base pr add kiya ha jase wo kahta ha?"
>
> "phale proper blueprint complate krro"

## Normalized Understanding

### Explicit Requirements
- Expand beyond product metafield definitions to Shopify-supported standard definitions and custom definitions, subject to verified API capabilities.
- Plan frontend theme app blocks that display eligible metafield data and give merchants comprehensive useful customization controls.
- Follow this repository's ANPOS planning blueprint before feature implementation.

### Facts
- User reports a working local setup on the `development` branch; its runtime bindings have not been independently inspected. Repo config confirms `development` is the local/staging source branch, staging deploy is manual, and `main` is the release branch.
- Current `app/routes/app.api.fields.jsx` hardcodes `PRODUCT`, namespace `vsn_metafields`, and six field types.
- The existing app uses Shopify Admin GraphQL, React Router, Prisma/PostgreSQL and Cloudflare production runtime.
- The current project-state resume point is production rollback-window certification, distinct from this feature initiative.

### Assumptions
- A single block could render every type and owner: unvalidated and likely false due to Liquid context and access limits.
- Merchants need bulk value editing: recommended after market comparison, but not explicitly requested as a launch requirement.
- Existing billing plan covers new capabilities: unknown; preserve current entitlement contract until product decision.

### Preferences
- Full coverage of Shopify-supported definitions and highly configurable storefront presentation.
- AI-native planning and truthful completion evidence.

### Constraints
- No breakage to installed shops, existing definitions/values, paid subscriptions or certified rollback path.
- Shopify API version, scopes, theme context and privacy limit availability.
- No unsupported claims that customer/order data appears on public storefront or checkout via theme app blocks.

### References
- Repository README, AGENTS.md, .ai/manifest.json and current routes.
- Shopify metafield types, standard definitions, definition APIs, theme app extension and dynamic-source docs.
- Metafields Guru and Shopify native bulk editor for comparison; market findings need validation before product claims.

### Open Questions
- Exact owner/type matrix for pinned Admin API and shop scopes.
- Merchant-owned versus app-reserved namespace strategy and migration.
- Theme compatibility set and new feature entitlements.
- PM provider and Development AI selection remain unresolved in repository state.

## Research Status
IN_PROGRESS — primary Shopify docs inspected; capability matrix and competitor audit need deeper validation.

## Planning Status
IN_PROGRESS — options/modules and pre-plan proposed on branch; no runtime completion claim.
