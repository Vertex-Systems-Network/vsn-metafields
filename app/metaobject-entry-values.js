// Send only edited fields so Shopify's patch mutation preserves untouched keys.
// An unchanged form still sends its existing values for handle/status edits.
export function entryValuesForSave(editing, values) {
  if (!editing) return values;
  const previous = Object.fromEntries(
    editing.fields.map(({ key, value }) => [key, value ?? ""]),
  );
  const changed = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== previous[key]),
  );
  return Object.keys(changed).length ? changed : values;
}
