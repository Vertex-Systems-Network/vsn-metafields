import { authenticate } from "../shopify.server";

const NAMESPACE = "vsn_metafields";

export const loader = async ({ request }) => {
	const { admin } = await authenticate.admin(request);

	const res = await admin.graphql(`
    query {
      metafieldDefinitions(first: 100, ownerType: PRODUCT) {
        nodes { id key namespace pinnedPosition }
      }
    }
  `);

	const data = await res.json();
	const definitions = data?.data?.metafieldDefinitions?.nodes ?? [];
	const vsnFields = definitions.filter(f => f.namespace === NAMESPACE);

	const results = [];

	for (const field of vsnFields) {
		if (field.pinnedPosition !== null) {
			results.push({ key: field.key, status: "already pinned" });
			continue;
		}

		const pinRes = await admin.graphql(
			`#graphql
      mutation PinField($id: ID!) {
        metafieldDefinitionUpdate(definition: { id: $id, pin: true }) {
          updatedDefinition { id key pinnedPosition }
          userErrors { message }
        }
      }`,
			{ variables: { id: field.id } }
		);

		const pinData = await pinRes.json();
		const errors = pinData?.data?.metafieldDefinitionUpdate?.userErrors ?? [];

		results.push({
			key: field.key,
			status: errors.length > 0 ? `error: ${errors[0].message}` : "pinned",
		});
	}

	return Response.json({ ok: true, results });
};