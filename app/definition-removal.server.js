export async function removeDefinition(admin, definitions, { id, key }) {
  const selected = definitions.find((field) => field.id === id && field.key === key);
  if (!selected) return { ok: false, status: 404, error: "Definition not found for this resource." };

  const response = await admin.graphql(`#graphql
    mutation DeleteSelectedMetafieldDefinition($id: ID!) {
      metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: false) {
        deletedDefinitionId
        userErrors { field message }
      }
    }
  `, { variables: { id: selected.id } });
  const result = await response.json();
  const deletion = result?.data?.metafieldDefinitionDelete;
  const error = result?.errors?.[0]?.message || deletion?.userErrors?.[0]?.message;
  if (error || deletion?.deletedDefinitionId !== selected.id) {
    return { ok: false, status: 400, error: error || "Definition deletion was not confirmed." };
  }
  return { ok: true };
}
