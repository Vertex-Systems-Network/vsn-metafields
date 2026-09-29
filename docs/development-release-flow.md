# Development, Staging, and Live Release Flow

This repository uses three separate operating modes.

## 1. Local development

Work locally from the `development` branch (or a short-lived feature branch based on `development`).

```bash
git switch development
git pull
npm ci
npm run dev
```

Local secret files such as `.env`, `.env.local`, and `.dev.vars` are ignored by Git and must never be committed.

Local development does **not** deploy the live application.

## 2. Staging

Runtime changes pushed to `development` automatically deploy to the isolated `cloudflare-staging` environment.

Staging is the place to verify Shopify authentication, sessions, webhooks, navigation, billing reads, and UI behavior before a release.

The staging workflow is forbidden from using the production Railway Shopify URL or the production Shopify identity.

## 3. Release branch

`main` is the release branch.

Development reaches `main` only through a reviewed pull request from `development` when a release is intentionally requested.

Pushing or merging to `main` does **not** automatically deploy the Cloudflare production Worker and does **not** change the Shopify live URL.

## 4. Live production

Cloudflare production deployment is manual-only through the guarded `Cloudflare Production Prepare` workflow.

Shopify live cutover is a separate authorization-gated workflow. It cannot run merely because code was developed, pushed, staged, or merged.

During the current migration the Railway production service stays available as rollback until post-cutover verification is complete.

## Normal daily workflow

```text
Local code
   ↓
development branch
   ↓ automatic
Cloudflare staging
   ↓ verify
PR: development → main
   ↓ only when release is wanted
main
   ↓ manual production deploy
Cloudflare production Worker
   ↓ separate explicit authorization
Shopify live cutover
```

The important rule is: **development never becomes live automatically.**
