# Staging privacy webhook observability recheck — 2026-10-11

## Scope

Read-only check of persisted Cloudflare Workers Observability telemetry for the dedicated staging Worker. This check did not send a webhook, query request bodies, inspect customer data, or change any Shopify/Cloudflare resource.

## Evidence

- Shopify Staging Release workflow [run #27](https://github.com/Vertex-Systems-Network/vsn-metafields/actions/runs/38091921365) completed successfully for `cfdf06020ccb817fb68421f1777c4b7d2c93ad29`. Its `Enqueue a synthetic customer data request` step completed successfully at 2026-10-10 22:35 UTC. The workflow reports that enqueue acceptance does not independently confirm Worker delivery or processing.
- Read-only Cloudflare Worker script configuration for `vsn-metafields-staging` reports observability enabled, query-string redaction enabled, persisted custom logs enabled, and automatic invocation logs disabled.
- A read-only Workers Observability values query used dataset `cloudflare-workers`, Worker service `vsn-metafields-staging`, and the window 2026-10-10 22:25–22:45 UTC. It requested only the unique values for `$workers.event.request.path` and `$metadata.trigger`.
- The returned values were `/internal/staging-acceptance` and `GET /internal/staging-acceptance`, respectively. No compliance webhook route appeared in those returned values.

## Conclusion and limitation

The persisted telemetry query did not provide evidence that the synthetic `customers/data_request` reached or was processed by the staging Worker in that window. It also does **not** prove a delivery failure: automatic invocation logs are disabled, and Cloudflare's retained custom-log values are not an authoritative Shopify webhook-delivery ledger. Delivery and app-side fulfillment remain **unverified**.

To close this item, obtain app-specific Shopify webhook delivery evidence tied to a test delivery and a matching application-side receipt/processing record, without using real customer data. Do not infer receipt from the workflow's enqueue success alone.

## Safety

No request bodies, query-string values, customer identifiers, or customer payloads were retrieved. No staging data or configuration was modified. No Live environment or published theme was touched.
