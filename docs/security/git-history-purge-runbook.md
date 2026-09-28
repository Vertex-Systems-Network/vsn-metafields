# Git History Purge Runbook

## Purpose

This runbook governs the controlled removal of the accidentally committed `..git/` directory from all reachable Git history for `Vertex-Systems-Network/vsn-metafields`.

The current branch snapshots have already been contained by removing `..git/` from active trees. This runbook is for the separate history-rewrite phase.

## Known incident facts

- First known introduction: `88bb3078b9ee550977e858dcf0c30b2b9e8d64a7` (2026-06-24, `init`).
- Removal from `main`: `31529dd0f87b189342f87bcdc171341cf4427165` (2026-09-27).
- Historical tree inspection found 274 entries under `..git/`.
- Targeted review of `..git/config`, `FETCH_HEAD`, reflogs, and packed refs did not detect an obvious embedded PAT/private-key/common-token signature.
- That targeted result is not proof that opaque historical Git objects are safe.
- No tags were present at the inventory checkpoint.
- Current-tree containment commits were applied to previously affected non-main branches without force-pushing.

## Non-negotiable safety rules

1. If a real credential is discovered, revoke/rotate it before finishing the history rewrite.
2. Never paste credential values into issues, pull requests, logs, chat, or runbook evidence.
3. Do not rewrite repository history while collaborators are actively pushing.
4. Capture immutable pre-rewrite refs before any force update.
5. Resolve or deliberately close/snapshot open pull requests before the rewrite because their commit SHAs/diffs can be invalidated.
6. Do not use `git revert` as a purge mechanism; it leaves the original path in history.
7. Never merge an old pre-rewrite branch back into rewritten history.

## Guarded automation helper

For Issue #41 maintenance, prefer the committed cross-platform helper over manually typing destructive commands.

### Read-only preflight

```bash
git clone --mirror https://github.com/Vertex-Systems-Network/vsn-metafields.git vsn-metafields-purge.git

python scripts/security/prepare_git_history_purge.py \
  --repo-dir vsn-metafields-purge.git \
  --evidence-dir vsn-metafields-purge-evidence \
  --expected-main <CURRENT_GITHUB_MAIN_SHA>
```

Default mode is read-only. It requires a bare/mirror clone whose normalized `origin` is exactly `Vertex-Systems-Network/vsn-metafields`, records head/tag refs and reachable accidental `..git/` object counts, verifies `--expected-main` when supplied, and writes evidence outside Git history without printing remote credentials, file contents, or secret values.

### Confirmed local-mirror rewrite

Only after the repository write freeze, private rollback capture, secret scan, and authorized ruleset maintenance are ready:

```bash
python scripts/security/prepare_git_history_purge.py \
  --repo-dir vsn-metafields-purge.git \
  --evidence-dir vsn-metafields-purge-evidence \
  --expected-main <CURRENT_GITHUB_MAIN_SHA> \
  --approved-head main \
  --rewrite \
  --confirm PURGE_DOT_DOT_GIT_HISTORY
```

The helper requires the exact confirmation phrase, an `--expected-main` SHA captured from GitHub at the maintenance freeze, and an explicit approved branch/tag allowlist. The mirror's complete head/tag set must match that allowlist exactly before rewriting. For the preferred Issue #41 path, retire obsolete branches first and use `--approved-head main`. It refuses a wrong repository identity, stale mirror, or unexpected ref before rewriting, runs `git filter-repo` only against the local mirror, requires zero reachable `..git/` objects afterward, runs `git fsck --full`, and writes post-rewrite evidence.

**The helper never pushes or force-pushes any remote ref.** GitHub ref updates remain a separately reviewed administrator action under Phase E.

## Phase A — Preflight inventory

Run from a fresh administrator-controlled environment.

Before any retirement or ruleset change, validate the fresh mirror against the committed branch-disposition policy and capture the freeze evidence outside both repositories:

```bash
python scripts/security/verify_ref_retirement_readiness.py \
  --repo-dir /path/to/vsn-metafields-purge.git \
  --write-snapshot /private/evidence/vsn-metafields-issue-41-freeze.json
```

This first pass is read-only and reports any pending `confirm_retire` branches. After the administrator explicitly approves those candidates, repeat with the corresponding `--confirm-retire <branch>` flags plus `--require-ready`. Immediately before destructive maintenance, use `--verify-snapshot /private/evidence/vsn-metafields-issue-41-freeze.json`; any branch/tag or SHA movement aborts the window. The guard never deletes refs, changes rulesets, pushes, or force-pushes.

Also capture the raw ref/path inventory from the same fresh mirror:

```bash
git clone --mirror https://github.com/Vertex-Systems-Network/vsn-metafields.git vsn-metafields-purge.git
cd vsn-metafields-purge.git

git show-ref > ../vsn-metafields-pre-rewrite-refs.txt
git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/tags > ../vsn-metafields-pre-rewrite-heads-tags.txt
git rev-list --objects --all | grep -E '(^| )\.\.git(/|$)' > ../vsn-metafields-pre-rewrite-git-metadata-paths.txt || true
```

Record:
- current default branch SHA;
- every branch and tag SHA;
- number of open pull requests;
- repository visibility;
- branch/ruleset settings that prevent force updates;
- any deployment or release process that pins commit SHAs.

Do not include secret values in the evidence files.

## Phase B — Freeze and coordination

Before mutation:

- pause merges and pushes;
- close, merge, or explicitly snapshot all open PRs;
- note any PRs that GitHub reports as affected by the rewrite;
- notify collaborators that old clones must not push after the rewrite;
- ensure a clean rollback mirror exists offline;
- record the current `main` SHA and all branch/tag SHAs in Issue #41.

## Phase C — Rewrite in an isolated mirror

Use a recent `git-filter-repo` version that supports sensitive-data removal mode.

```bash
git filter-repo \
  --sensitive-data-removal \
  --invert-paths \
  --path '..git'
```

Then inspect the rewrite report:

```bash
grep '^refs/pull/.*/head$' .git/filter-repo/changed-refs || true
grep -E '(^| )\.\.git(/|$)' <(git rev-list --objects --all) && exit 1 || true
git fsck --full
```

Do not continue if any reachable object still maps to `..git/`.

## Phase D — Secret-safe validation before push

Required checks:

```bash
git rev-list --objects --all | grep -E '(^| )\.\.git(/|$)' && exit 1 || true
git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/tags
git fsck --full
```

Also run the repository's secret-scanning workflow/tooling against the rewritten mirror. Report only finding types/paths/status, never secret values.

If a credential is found:
1. stop;
2. rotate/revoke it;
3. document the rotation status without the value;
4. rerun the rewrite/scan as needed.

## Phase E — GitHub update

Only after Phase D is clean and the maintenance window is active:

1. Temporarily adjust branch/ruleset protections only as narrowly as required.
2. Reconfirm no new commits landed after the preflight snapshot.
3. Push the rewritten refs.

```bash
git push --force --mirror origin
```

Expected behavior:
- rewritten heads/tags update;
- GitHub-owned `refs/pull/*` may reject updates because they are read-only.

Do not treat unexpected non-PR ref failures as success.

## Phase F — Post-push verification

Immediately verify:

```bash
git ls-remote origin
```

Then make a brand-new clone and check:

```bash
git clone https://github.com/Vertex-Systems-Network/vsn-metafields.git verify-vsn-metafields
cd verify-vsn-metafields

git rev-list --objects --all | grep -E '(^| )\.\.git(/|$)' && exit 1 || true
git fsck --full
```

Repository checks after rewrite:
- `main` contains expected application state;
- App Validation passes;
- AI Native Quality Gates pass;
- current branches/tags match the approved rewritten ref map;
- Cloudflare migration branch still contains its intended work;
- no stale pre-rewrite branch is merged back.

## Phase G — GitHub cache / pull-request references

A history rewrite does not automatically erase:
- collaborators' old clones;
- forks;
- cached GitHub views;
- GitHub pull-request refs.

If a real sensitive credential/object is confirmed, follow GitHub's sensitive-data removal support process after the rewrite. Provide only the metadata GitHub requests, such as affected PR count and first changed commit(s), not secret values.

## Phase H — Collaborator recovery

Required collaborator rule:

> Do not pull-and-push an old clone after the rewrite.

Preferred recovery:
1. archive any unpushed work;
2. fresh clone the repository;
3. manually reapply only legitimate unpushed changes.

If a collaborator must retain local work, rebase/cherry-pick only clean commits onto rewritten refs. Never merge the old tainted lineage.

## Rollback

Before the remote force update, rollback is simply deleting the rewritten mirror and stopping.

After remote force update, rollback requires the separately stored pre-rewrite refs. Because restoring them would re-publish the contaminated history, rollback must only be used for repository recovery and must be followed by another purge before normal development resumes.

Never store the rollback mirror in the public repository.

## Completion evidence for Issue #41

Issue #41 can close only when:

- all active heads/tags have rewritten SHAs recorded;
- no reachable `..git/` path remains;
- fresh-clone validation passes;
- App Validation is green;
- AI Native Quality Gates are green;
- secret scan is clean or any discovered credentials have been rotated/revoked;
- affected collaborators have acknowledged clone cleanup;
- obsolete pre-rewrite branches/PRs cannot reintroduce the old lineage.

## References

- GitHub Docs: Removing sensitive data from a repository
- GitHub Docs: Best practices for preventing data leaks
- `git-filter-repo` upstream documentation
