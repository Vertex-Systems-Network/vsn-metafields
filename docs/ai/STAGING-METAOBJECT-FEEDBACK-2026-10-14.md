# Staging metaobject feedback recovery — 2026-10-14

[PR #312](https://github.com/Vertex-Systems-Network/vsn-metafields/pull/312) fixes a reproduced editor defect: after a rejected private-entry edit, Cancel edit reset the form but left its old error on the new-entry screen. Selecting a definition, entering an entry edit and cancelling now reset mutation feedback. Cancel edit is disabled during a pending mutation, matching the other save controls.

[Staging #100](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/38568356016) passed from `182e27a33c9ced092a7fd8b267e9e4ecb19443f6`. Migrations/isolation, Worker health, sessions/subscription and disposable lifecycle acceptance passed with cleanup and no failures. Local Node22.13 release checks passed lint, typecheck, model contract, **189/189 tests** and build. Both feature PR CI checks passed. No Live deployment occurred.

| Actual browser check | Result |
|---|---|
| Two-character title rejected against minimum3 | Pass |
| 101-character title rejected against maximum100 | Pass |
| Cancel edit disabled while Save is pending | Pass |
| Cancel returns to new-entry form without old error | Pass |
| Re-edit does not inherit discarded error | Pass |
| Changing definition clears the old error | Pass |
| Fresh saved-entry read preserves title, handle and Draft | Pass |
| Starter new-definition editor stops at2/2 fields | Pass; Add field disabled |
| Starter public-access option disabled | Pass; no access change performed |

The private QA definition is `Size guide (QA)` / `vsn_qa_20261004`; saved entry `qa-guide` remains `Cotton size guide`, Draft. No successful browser save, definition creation, deletion, publication, billing or permission change was performed. The extra second field existed only in an unsaved local form. These checks do not certify real tier transitions, public content, sibling-field preservation or concurrent-editor conflicts.

Retained logs returned **0 warning/error text matches** in the recorded30-minute window. Invocation logging remains disabled, so this is not proof of every request outcome or signed privacy delivery. [Machine evidence](../evidence/metafields-metaobject-feedback-2026-10-14.json).

A real recovery screenshot was captured and inspected, but its attachment could not be made available through the documented browser shared-file path. No broken image reference was published and no additional in-app screenshot change was added. Draft PR310 remains the prior independently reviewable Reload-gallery/test proposal; it is not merged or deployed.

Acceptance remains **3/12 (25%); Phase04 0/3**. META007 still needs the remaining public/access, conflict and preservation browser flows. PR298/310 independent review, mixed browser Apply exact approval, file transfers, complete merchant/theme/accessibility/performance, signed privacy and operational acceptance remain open. Live remains held. [Full task report](STAGING-BATCH-REPORT-2026-10-14.md).
