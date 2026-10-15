# Staging CSV transfer recheck — 2026-10-15

On the installed Shopify Staging app (`staging-oath3rth`), the Import & export screen showed a 5-row Starter limit and a copyable CSV template with the expected `ownerType,ownerId,namespace,key,type,value_json` columns. The `Download CSV template` action was clicked while waiting for a browser download event; no file arrived within 10 seconds. The app's **Show CSV template** recovery disclosed the expected header and sample row.

A disposable 158-byte CSV matching that template was prepared for Staging. Clicking the visible **CSV file** control and then the actual `input[type=file]` inside `iframe[name="app-iframe"]`, each with a file chooser listener already active, produced no chooser event within 10 seconds. No upload or preview was claimed from this attempt.

Selected completed import job `2026-10-14T00:56:00.120Z` (1/1 processed, revision 3). It showed row 2 on Product `15336402485620`, field `vsn_qa_20261004.care`, `Newer native edit must stay` → same value, result `unchanged`. Clicking **Export before snapshot** with a download listener again produced no download event within 10 seconds. **Show before CSV** displayed the expected header and the existing value as an escaped CSV field, preserving the non-file copy path. This verifies the in-app CSV content for this saved job, not browser file transfer or a new Apply.

META008 remains `verification_required`. Mixed CSV Apply previously failed automatic exact-payload approval review and was not retried. The previous one-row Apply, mixed preview, and service lifecycle evidence remain distinct from missing browser file transfer. Overall accepted work remains 3/12; Live and App Store submission remain held.
