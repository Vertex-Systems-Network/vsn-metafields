# Issue #41 — Ref Retirement and Rewrite Inventory

Snapshot anchor: `main` at `045c820a70f681cdbe36e13592bcdd2574f772c9`.

This document is a preflight plan only. It does not delete branches, change rulesets, or force-push rewritten history.

## Verified repository state

- 21 live branch refs existed at the inventory checkpoint before this planning branch was created.
- This planning branch adds one temporary clean-tree ref and must be retired with the other maintenance branches after merge.
- 21/21 previously live branch current trees were verified to contain **zero** direct `..git/` entries.
- All non-main live branches were divergent from current `main`; none was a simple direct ancestor.
- There were no open pull requests at the audit checkpoint.
- No tags were present.
- The accidental `..git/` history still remains reachable through branch ancestry.

## Category A — exact merged-PR branch tips

These branches currently point at the exact head SHA of a PR already merged to `main`. Their useful changes are represented on `main`; their branch lineages do not need to remain public after a private pre-rewrite ref backup is captured.

| Branch | Merged PR |
| --- | --- |
| `migration/cloudflare-subscription-safe-v2` | #43 |
| `phase-00/billing-safety` | #29 |
| `phase-00/child-workflow-hygiene` | #16 |
| `phase-00/dependabot-major-guardrails` | #31 |
| `phase-00/dependency-hygiene` | #15 |
| `phase-00/history-rewrite-plan` | #44 |
| `phase-00/metafield-safety` | #24 |
| `phase-00/node22-baseline` | #30 |
| `phase-00/p0-security-baseline` | #12 |
| `phase-00/shopify-security-upgrade` | #39 |
| `phase-00/webhook-hardening` | #13 |
| `phase-00/webhook-privacy-state` | #14 |
| `security/git-history-purge-runbook` | #42 |

**Recommended disposition:** capture the pre-rewrite ref map privately, then retire these remote branches before the history rewrite instead of rewriting them individually.

## Category B — merged work plus a containment-only tip

These branch heads advanced after their original merge only to remove accidental Git metadata from the current branch tree.

| Branch | Historical merged PR | Current tip purpose |
| --- | --- | --- |
| `anpos/adopt-existing-blueprint` | #6 | containment-only |
| `railway/fix-deploy-9ac769` | #2 | containment-only |
| `railway/fix-deploy-fdebcf` | #1 | containment-only |

The current tip commit message on each is `fix(security): remove accidental git metadata from branch tree`.

**Recommended disposition:** capture the pre-rewrite ref map privately, then retire these remote branches. The merged product changes already exist on `main`.

## Category C — closed/unmerged or superseded branches requiring explicit retirement confirmation

### `anpos/adopt-existing-vsn-metafields`

- PR #3 closed without merge.
- Current tip only adds the containment commit after that closed branch.
- The repository later merged the canonical ANPOS adoption through PR #6.

**Assessment:** appears superseded by the merged ANPOS path. Retire after confirming no intentionally preserved alternative setup is needed.

### `migration/cloudflare-subscription-safe`

- PR #5 closed without merge.
- Current tip only adds the containment commit.
- A later Cloudflare safety baseline was merged through PR #43.

**Assessment:** appears superseded by PR #43. Retire after confirming no unique migration work is still required.

### `phase-00/actions-runner-probe`

- PR #18 closed without merge.
- Unique change is the minimal `.github/workflows/runner-probe.yml` diagnostic workflow.
- GitHub Actions now executes successfully on the repository.

**Assessment:** diagnostic branch is obsolete. Retire after private ref capture.

### `phase-00/shopify-v3-security-upgrade`

- PR #40 closed without merge.
- Contains an alternate Shopify dependency/API upgrade attempt.
- The validated secure upgrade was merged through PR #39 and is already green on `main`.

**Assessment:** superseded by PR #39. Retire after private ref capture.

## Category D — temporary planning branch

`phase-00/history-ref-inventory` was created only to publish this inventory. After this document is merged, it should be retired with the other maintenance branches.

## Recommended remote rewrite scope

If Categories A-D are retired after their refs are captured in the private rollback evidence, the public remote can be reduced to the minimum required active branch set before history rewriting.

Preferred target:

- `main` only, unless a genuinely active migration/development branch is intentionally preserved at execution time.

This is safer than rewriting many stale branch lineages because it minimizes:

- force-updated refs;
- opportunities to reintroduce pre-rewrite ancestry;
- collaborator confusion;
- rollback complexity;
- GitHub cached branch history.

## Maintenance sequence

1. Freeze pushes/merges.
2. Re-enumerate branches, tags, open PRs, and rulesets.
3. Save all current refs in the private rollback mirror/evidence.
4. Confirm Category C retirement decisions against latest repository state.
5. Retire approved obsolete remote branches.
6. Temporarily adjust the `main` ruleset only as required for the authorized rewrite.
7. Rewrite the remaining active refs with the committed Issue #41 runbook.
8. Force-update only the approved rewritten refs.
9. Restore the original ruleset immediately.
10. Fresh-clone and run App Validation, ANPOS Quality Gates, Git integrity checks, and secret scanning.
11. Verify no old branch/ref can reintroduce contaminated ancestry.

## Current blocker

Repository ruleset `main` (id `24085428`) has active `non_fast_forward` protection, no bypass actors, and the current connected integration reports `current_user_can_bypass: never`.

Therefore no destructive rewrite should be attempted from the current integration.
