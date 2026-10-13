# Staging Neon snapshot restore verification — 2026-10-13 UTC

Scope: Staging project `weathered-scene-72555022` only. No Live database, deployment, or Shopify app release was changed.

## Snapshot and comparison

- Manual snapshot: `snap-damp-wave-b3btox3c` (`staging-qa-2026-10-14`), created 2026-10-13 21:08:08 UTC, expires 2026-10-21 00:00 UTC.
- Restored test branch: `br-dry-grass-b3dggu3n` (`staging-restore-qa-20261014`), restore status `finalized`, expires 2026-10-15 00:00 UTC.
- Original Staging branch: `br-noisy-grass-b3p6s941`, default branch, named `production` in this Neon project. This name does not denote the separate Live Neon project.
- Both branches expose identical public base tables: `MetafieldJob`, `PrivacyRequest`, `Session`, `_prisma_migrations`.
- Exact row counts from read-only SELECT queries:

| Table | Original Staging | Restored branch |
| --- | ---: | ---: |
| MetafieldJob | 6 | 6 |
| PrivacyRequest | 0 | 0 |
| Session | 4 | 4 |
| _prisma_migrations | 3 | 3 |

## Restore behavior and repair

The Neon connector's snapshot restore call with `finalize: true` and no explicit target branch unexpectedly reassigned the Staging compute endpoint to the restored branch and retained the original as a backup. The original branch was restored as default, the original endpoint `ep-snowy-surf-b3gxl2wf` was moved back, and branch names were corrected. The Staging app diagnostics subsequently reported Database reachable, Subscription Active, and Saved imports 6.

A temporary endpoint `ep-jolly-queen-b3mysyph` was created on the restored branch for the comparison, then deleted. Final endpoint listing contains only `ep-snowy-surf-b3gxl2wf` on the original Staging branch. Final branch listing confirms the original branch is default and the test branch is nondefault with expiry.

## Gate interpretation

This verifies a manual snapshot can be restored and its schema and counts read in Staging. It does not establish automated backup cadence, RPO/RTO timing, a full app-level recovery drill, or the remaining META-011 assurance gates. Do not repeat the restore call against the Staging default branch; use an explicitly isolated restore target after confirming Neon API semantics and endpoint reassignment behavior.
