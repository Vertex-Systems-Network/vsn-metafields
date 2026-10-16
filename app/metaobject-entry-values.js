// Send only edited fields so Shopify's patch mutation preserves untouched keys.
// Handle/status-only edits leave the field patch empty.
export function entryValuesForSave(editing, values) {
  if (!editing) return values;
  const previous = Object.fromEntries(
    editing.fields.map(({ key, value }) => [key, value ?? ""]),
  );
  const changed = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== previous[key]),
  );
  return changed;
}
