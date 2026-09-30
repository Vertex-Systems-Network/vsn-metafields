export async function renameDefinition(admin, definitions, ownerType, { id, key, name }) {
  const selected = definitions.find((field) => field.id === id && field.key === key);
  const cleanName = String(name || "").trim();
  if (!selected) return { ok: false, status: 404, error: "Definition not found for this resource." };
  if (!cleanName || cleanName.length > 255) {
    return { ok: false, status: 400, error: "Enter a name of 1 to 255 characters." };
  }
  const response = await admin.graphql(`#graphql
    mutation RenameMetafieldDefinition($definition: MetafieldDefinitionUpdateInput!) {
      metafieldDefinitionUpdate(definition: $definition) {
        updatedDefinition { id name }
        userErrors { field message }
      }
    }
  `, { variables: { definition: { namespace: selected.namespace, key: selected.key, ownerType, name: cleanName } } });
  const result = await response.json();
  const payload = result?.data?.metafieldDefinitionUpdate;
  const error = result?.errors?.[0]?.message || payload?.userErrors?.[0]?.message;
  if (error || payload?.updatedDefinition?.id !== selected.id) {
    return { ok: false, status: 400, error: error || "Definition update was not confirmed." };
  }
  return { ok: true, name: payload.updatedDefinition.name };
}
