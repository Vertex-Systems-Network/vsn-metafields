// Deterministic snapshot of the original entry shown in the editor.
// Shopify updatedAt has second-level precision: timestamp alone can miss
// two edits during the same second. Include ALL fields (including null),
// handle and publication status so omitted values remain protected.
export async function metaobjectEntryFingerprint(entry) {
  if (!entry || typeof entry.id !== "string" || typeof entry.type !== "string" ||
      typeof entry.handle !== "string" || !Array.isArray(entry.fields))
    throw new RangeError("Reload the selected entry before editing.");

  const fields = entry.fields.map((field) => {
    if (!field || typeof field.key !== "string" ||
        (field.value !== null && typeof field.value !== "string"))
      throw new RangeError("Reload the selected entry before editing.");
    return [field.key, field.type || "", field.value];
  }).sort((a, b) => a[0].localeCompare(b[0]));
  if (new Set(fields.map((f) => f[0])).size !== fields.length)
    throw new RangeError("Duplicate fields require a fresh entry reload.");

  const snapshot = JSON.stringify([
    entry.id, entry.type, entry.handle,
    entry.capabilities?.publishable?.status ?? null,
    fields,
  ]);
  const bytes = new TextEncoder().encode(snapshot);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function assertExpectedEntryFingerprint(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new RangeError("Reload the selected entry before editing.");
}

export async function verifyMetaobjectEntryFingerprint(entry, value) {
  assertExpectedEntryFingerprint(value);
  if (await metaobjectEntryFingerprint(entry) !== value)
    throw new RangeError("Entry changed. Reload before editing.");
}
