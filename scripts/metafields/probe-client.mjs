// Only an explicit rejected throttle response can retry. An ambiguous mutation
// timeout, transport error, partial data or other API error must never replay.
export async function probeGraphql(fetchRequest, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetchRequest();
    if (!response.ok) throw new Error(`Shopify HTTP ${response.status}`);
    const result = await response.json();
    const rejected = !result.data && result.errors?.length &&
      result.errors.every((e) => e.extensions?.code === "THROTTLED");
    if (!rejected || attempt === 3) return Response.json(result);
    const cost = result.extensions?.cost;
    const status = cost?.throttleStatus;
    const needed = Number(cost?.requestedQueryCost) - Number(status?.currentlyAvailable);
    const delay = Number.isFinite(needed) && Number(status?.restoreRate) > 0 ?
      Math.ceil(needed / Number(status.restoreRate) * 1000) : 1000;
    if (delay > 5000) throw new Error("Probe query exceeds the bounded throttle retry window.");
    await wait(Math.max(1000, delay));
  }
}

export function failedRunDisposableDefinition(field) {
  const match = /^advanced_(\d{13})_[a-f0-9]{6}_(?:\d+|meta)$/.exec(field.key || "");
  const createdAt = match ? Number(match[1]) : 0;
  return field.namespace === "vsn_probe" && field.name === `Disposable ${field.type}` &&
    createdAt >= Date.parse("2026-10-02T10:23:01Z") && createdAt <= Date.parse("2026-10-02T10:23:58Z");
}
