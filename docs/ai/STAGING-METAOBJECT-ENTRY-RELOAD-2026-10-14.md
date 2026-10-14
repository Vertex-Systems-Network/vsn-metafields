# Staging metaobject entry reload — 2026-10-14

[PR #315](https://github.com/Vertex-Systems-Network/vsn-metafields/pull/315) added a selected-entry reload action to the editor. It fetches the latest entry and timestamp through the authenticated route, discards unsaved edits, clears stale mutation feedback, and reloads the entries list. The UI prevents Save, Cancel and row actions while the fresh read is pending, checks that a response still belongs to the selected entry and definition, and displays a read error without discarding the current edit.

Local Node 22.13 release checks passed lint, typecheck, database contract, **189/189 contract tests** and build. App Validation and AI Native Quality Gates passed on the PR. [Cloudflare Staging run #101](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/38616316193) completed successfully from development source `8887354a3c4cb066864b2f59812785e74d9a9073`; the workflow passed isolated migration, Worker health, subscription/session and disposable lifecycle checks with cleanup.

[PR #316](https://github.com/Vertex-Systems-Network/vsn-metafields/pull/316) aligned the in-app Metaobjects Help step. [Staging run #102](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/38617680921) completed successfully from development source `9894b8a245cfe4386574441772a7b7f422bdc523`, including lifecycle cleanup. The actual Staging Help center displayed the new Reload entry instruction.

Actual Staging browser check on the private QA definition `Size guide (QA)` / `vsn_qa_20261004`:

| Step | Observed result |
|---|---|
| Edit existing `qa-guide` | Saved title `Cotton size guide`, Draft |
| Change title to `ab` and Save | `Text violates min length 3.`; controls disabled during the request |
| Click Reload entry | Saved `Cotton size guide` restored, old error cleared, `qa-guide` still selected for editing |

The invalid edit was not saved. The existing QA entry stayed Draft. This exercises rejected-edit recovery; a second browser session's stale edit rejection was verified in the [prior report](STAGING-METAOBJECT-FEEDBACK-2026-10-14.md). It does not prove a race between the timestamp read and Shopify mutation, omitted sibling-field preservation, real public access or plan transition.

Cloudflare retained application logs had **0 warning/error text matches** for the recorded 30-minute window. Invocation logging is disabled, so this does not certify every request outcome. [Machine evidence](../evidence/metafields-metaobject-entry-reload-2026-10-14.json).

Acceptance remains **3/12 (25%)**; Phase04 **0/3**. PR298/310 independent reviews, mixed CSV Apply exact approval, file transfer, full theme/accessibility/performance, matching signed privacy fulfillment and operational assurance are still open. Live deployment and App Store submission remain held.
