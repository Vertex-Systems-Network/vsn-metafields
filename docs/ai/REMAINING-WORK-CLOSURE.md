# Remaining work closure — 2026-10-03

Base: development44ed908e7d70db1684f8f467f0390125f0b890c1. The current instruction authorizes remaining implementation and removal of duplicate Shopify admin page links. This batch retains only the hidden `/app` home destination in App Bridge; all five visible page destinations live in the embedded Workspace sidebar. Shopify's documented `rel="home"` behavior sets the app-name landing route without a visible menu item: https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/app-nav.

## Reconciled records

Module status is derived from the real work-unit queue: capability/definitions complete, values/metaobjects/bulk/theme verification_required, operations in_progress. Exact feature evidence through v1.2.1 is linked in the execution plan and requirement traceability; actual screenshots/accessibility evidence arrays stay empty. META-001..012 counts remain3 complete,7 verification_required,1 in_progress,1 not_started. A code/test/service pass does not close merchant or theme tasks. Requirements83..96 are classified for this conventional Shopify app; no model/LLM/RAG or high-impact automated decision ships in the product, and AI-development tooling is a separate runtime concern. Applicable assurance gaps retain explicit findings.

## Specifications settings advisory

Shopify CLI4.8.2 release37131931720/job111228585500 reports warning `ExcessiveSettingsCount`:45 interactive settings versus the check's default40. Current official check documentation confirms it is a configurable warning, counts only entries with an id, and ignores headers/paragraphs: https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/excessive-settings-count. Published theme-app extension content limits do not list this40-control recommendation as an enforced setting limit: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#file-and-content-size-limits.

Disposition: tracked nonblocking UX debt, not a failed provider deployment. Preserve all45 existing setting IDs/defaults, six grouping headers and saved merchant configuration. All148 shipped theme controls retain help coverage. Splitting/removing controls would require compatibility and actual editor-usability evidence. Do not suppress or raise the check to fabricate a clean result. Verify the grouped panel with a beginner in both themes; redesign only after observing the issue. The physical warning remains and is not reported as fixed.

## Validation and product-outcome contract

Target: a merchant/content manager creating care instructions without theme-code edits. Critical journey: definition -> value -> compatible block -> configuration -> populated/empty preview. Acceptance checklist provides exact observable tasks for all screens, 320px/200% reflow, keyboard and error recovery. Capture source SHA, active extension, actual theme/version, viewport, result, screenshot and disposable cleanup. No invented sample or usability outcome is recorded.

Use bounded manual observations first, with no analytics provider or tracking added: task completion = successfully reopened saved value plus correct storefront output; task duration = elapsed observation time; recovery = successful retry after a deliberately invalid input; picker success = intended authorized page/file can be selected; plan-navigation success = visible Shopify approval screen and safe return without a financial approval. Store sanitized aggregate counts/timing and consented observations only, no staff IDs, tokens, raw values or screen URLs. Baselines/targets/adoption/conversion remain unknown until actual observation. Automated probes are synthetic reliability evidence, not merchant or paid-plan conversion evidence.

## Boundaries and remaining acceptance

The app writes values for Product, ProductVariant and Collection;118 discovered type entries and25 owner-definition reads are not118/all-owner writes. Unsupported paths retain Shopify-native editing. Page/file scopes are granted in the latest staging API probe, but actual pickers/declined-consent UX still need browser acceptance. Protected-owner public display and checkout extension remain deferred, not hidden launch requirements.

Current app/control/theme images, full merchant flows, two unpublished themes, browser accessibility/performance and independent signed compliance-webhook receipt verification remain pending. Existing declined Shopify sign-in and rejected accounts redirect are not renewed by a generic remaining-work request. Fresh explicit staging sign-in authorization is needed. The prior local file-preview protocol rejection must not be worked around. No production promotion, financial approval, merchant-data deletion or provider cleanup is performed in this batch.

Recovery procedures: `docs/operations/metafields-recovery.md`. Plan and assurance reconciliation is evidence bookkeeping, not persistent Supervisor, verified agent-pool, legal compliance or final production certification. Existing PM/agent identity choices and protected-provider capability questions remain separate. Final feature release source/checks/staging outcomes are recorded after they actually complete.

## Local review and verification

Node22.13.0 `npm run check:release` passed all154 contracts, lint, typecheck, SQLite/Neon model parity and app build. ANPOS schema/integrity and diff checks passed. Existing navigation contract now asserts only the hidden home destination is registered in Shopify, while sidebar component tests retain all page destinations and embedded context. No dependency, database, billing price/scope, Liquid setting or production behavior changes. Authorized self-review checked exact evidence references, conservative status rollups, absent app images and review/access boundaries; this is not an independent Supervisor certification. Staging outcomes are recorded separately after completion.

## Staging outcome

PR182 merged as development `4af68de2eb63796aca93254186dca1a96d8333db`, app v1.2.2. Implementation CI37138657307/37138657310 and development CI37140531427/37140531479 passed. Runtime37140709009/job111254393855 passed the exact source, all21 typed cases, persisted validations, lifecycle/metaobjects/bulk/diagnostics and full disposable cleanup with zero failures. Shopify release37140931023/job111255042255 activated `staging-metafields-4af68de2eb63`; production_app_changed=false. Three compliance webhooks were enqueued; independent receipt verification stays pending. Specifications advisory remains. Evidence: `docs/evidence/metafields-dashboard-navigation-2026-10-03.json`. GitHub summary screenshot proves release success only; it is not a current-app/control image. Work-unit counts and merchant/theme/browser acceptance remain unchanged.


## Environment-title and remaining-record batch

PR184 / development dd29e53bdf68de20dd34a45b1b647c035be7916b released app v1.2.3 to isolated staging. Final CI157 tests and exact-source runtime37144530937 / Shopify37144739776 passed, including disposable cleanup with zero failures. Public title/H1 and provider app name report Staging; local uses Dev and production preserves its base name. Existing accepted ADR supersession, recovery runbook registration, runtime/API support inventory and historical research evidence were reconciled without asserting new approval, drill, patch security or independent signoff. Evidence: docs/evidence/metafields-environment-titles-2026-10-03.json; factual report: docs/ai/ENVIRONMENT-BATCH-REPORT.md. Authenticated current app images/merchant/theme/accessibility acceptance and independent receipts/production assurance remain pending. Work-unit counts unchanged.
